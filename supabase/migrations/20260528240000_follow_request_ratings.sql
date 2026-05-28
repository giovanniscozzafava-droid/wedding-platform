-- ============================================================================
-- Follow asimmetrico + rating reciproco capostipite ↔ fornitore
-- ----------------------------------------------------------------------------
-- 1) follows: aggiunge status (APPROVED|PENDING|REJECTED). Quando un WP
--    follows un fornitore: status = APPROVED automatico. Quando un fornitore
--    follows un WP: status = PENDING e il WP deve approvare.
-- 2) collaboration_ratings: tabella nuova con stars 1..5 + review opzionale,
--    una sola valutazione per direzione (rater→rated) e per evento (entry_id).
--    Si può votare solo dopo che l'evento è passato (calendar_entries.date_to).
-- 3) Vista user_rating_summary per la media stelle pubblica.
-- 4) RPC sicuri: request_follow, approve_follow, reject_follow, rate_user.
-- ============================================================================

-- ─── follows: enum status + colonna ──────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'follow_status') then
    create type follow_status as enum ('PENDING', 'APPROVED', 'REJECTED');
  end if;
end$$;

alter table follows
  add column if not exists status follow_status not null default 'APPROVED',
  add column if not exists decided_at timestamptz;

create index if not exists idx_follows_status on follows(status) where status <> 'APPROVED';
create index if not exists idx_follows_followed on follows(followed_id);

comment on column follows.status is
  'APPROVED = follow attivo. PENDING = richiesta in attesa (fornitore→WP). REJECTED = rifiutato.';

-- Aggiorna la policy di insert: la status deve riflettere il ruolo del followed
drop policy if exists "follows_write_own" on follows;
create policy "follows_write_own" on follows for insert with check (
  follower_id = auth.uid()
);

-- Update solo da target (per approve/reject)
drop policy if exists "follows_update_target" on follows;
create policy "follows_update_target" on follows for update using (
  followed_id = auth.uid() or is_admin()
);

-- ─── helper: visibili solo i follow APPROVATI ai non-coinvolti ───────────────
-- Policy lettura: l'utente vede i propri (in + out, PENDING o APPROVED),
-- i terzi vedono solo gli APPROVED.
drop policy if exists "follows_read_all" on follows;
drop policy if exists "follows_read_smart" on follows;
create policy "follows_read_smart" on follows for select using (
  status = 'APPROVED'
  or follower_id = auth.uid()
  or followed_id = auth.uid()
  or is_admin()
);

-- ─── RPC: richiesta follow (gestisce automaticamente status) ─────────────────
create or replace function request_follow(p_target uuid)
returns follows
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role text;
  v_me_role text;
  v_status follow_status;
  v_row follows%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_target = auth.uid() then raise exception 'cannot_follow_self'; end if;

  select role::text into v_target_role from profiles where id = p_target;
  select role::text into v_me_role     from profiles where id = auth.uid();
  if v_target_role is null then raise exception 'target_not_found'; end if;

  -- Logica approvazione:
  --  fornitore → WP/LOCATION : richiesta PENDING (servirà approval)
  --  altri casi: APPROVED automatico
  if v_me_role = 'FORNITORE' and v_target_role in ('WEDDING_PLANNER', 'LOCATION') then
    v_status := 'PENDING';
  else
    v_status := 'APPROVED';
  end if;

  insert into follows (follower_id, followed_id, status, decided_at)
  values (auth.uid(), p_target, v_status, case when v_status = 'APPROVED' then now() else null end)
  on conflict (follower_id, followed_id) do update
    set status = case
                   when follows.status = 'REJECTED' then excluded.status
                   else follows.status
                 end,
        decided_at = case when excluded.status = 'APPROVED' and follows.decided_at is null then now() else follows.decided_at end
  returning * into v_row;
  return v_row;
end$$;

grant execute on function request_follow(uuid) to authenticated;

-- ─── RPC: approve / reject ──────────────────────────────────────────────────
create or replace function approve_follow(p_follower uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  update follows
     set status = 'APPROVED', decided_at = now()
   where follower_id = p_follower
     and followed_id = auth.uid()
     and status = 'PENDING';
  return found;
end$$;
grant execute on function approve_follow(uuid) to authenticated;

create or replace function reject_follow(p_follower uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  update follows
     set status = 'REJECTED', decided_at = now()
   where follower_id = p_follower
     and followed_id = auth.uid()
     and status in ('PENDING','APPROVED');
  return found;
end$$;
grant execute on function reject_follow(uuid) to authenticated;

-- ─── ratings: collaboration_ratings ──────────────────────────────────────────
create table if not exists collaboration_ratings (
  id           uuid primary key default gen_random_uuid(),
  rater_id     uuid not null references profiles(id) on delete cascade,
  rated_id     uuid not null references profiles(id) on delete cascade,
  entry_id     uuid references calendar_entries(id) on delete set null,
  stars        int  not null check (stars between 1 and 5),
  review       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (rater_id, rated_id, entry_id)
);
create index if not exists idx_rate_rated on collaboration_ratings(rated_id);
create index if not exists idx_rate_entry on collaboration_ratings(entry_id);

alter table collaboration_ratings enable row level security;

-- chiunque autenticato vede le recensioni (per UI pubbliche)
drop policy if exists "rate_select_all" on collaboration_ratings;
create policy "rate_select_all" on collaboration_ratings for select using (true);

-- chi vota può inserire/aggiornare/eliminare solo i propri voti
drop policy if exists "rate_modify_own" on collaboration_ratings;
create policy "rate_modify_own" on collaboration_ratings for all
  using (rater_id = auth.uid())
  with check (rater_id = auth.uid());

-- updated_at automatico
create or replace function trg_rate_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end$$;
drop trigger if exists trg_rate_updated on collaboration_ratings;
create trigger trg_rate_updated before update on collaboration_ratings
  for each row execute function trg_rate_updated_at();

-- ─── RPC: rate_user (verifica relazione + che l'evento sia passato) ─────────
create or replace function rate_user(
  p_rated  uuid,
  p_entry  uuid,
  p_stars  int,
  p_review text default null
)
returns collaboration_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row collaboration_ratings%rowtype;
  v_event_end date;
  v_relates boolean;
begin
  if auth.uid() is null then raise exception 'unauthorized'; end if;
  if p_rated = auth.uid() then raise exception 'cannot_rate_self'; end if;
  if p_stars < 1 or p_stars > 5 then raise exception 'invalid_stars'; end if;

  -- L'evento deve esistere ed essere già passato (date_to <= today)
  select date_to into v_event_end from calendar_entries where id = p_entry;
  if v_event_end is null then raise exception 'entry_not_found'; end if;
  if v_event_end > current_date then raise exception 'event_not_completed_yet'; end if;

  -- Entrambi (rater e rated) devono aver fatto parte dell'evento:
  --   * uno dei due è owner_id (WP)
  --   * l'altro è in quote_items.supplier_id del quote linkato
  -- Caso simmetrico è ok.
  select exists (
    select 1 from calendar_entries ce
     where ce.id = p_entry
       and (
            -- WP rate fornitore presente nelle voci del proprio quote
            (ce.owner_id = auth.uid() and exists (
              select 1 from quote_items qi
               where qi.quote_id = ce.quote_id and qi.supplier_id = p_rated
            ))
         or
            -- Fornitore rate il WP del wedding in cui ha lavorato
            (ce.owner_id = p_rated and exists (
              select 1 from quote_items qi
               where qi.quote_id = ce.quote_id and qi.supplier_id = auth.uid()
            ))
         or
            -- Fornitore rate altro fornitore presente nello stesso quote
            (exists (
              select 1 from quote_items qi
               where qi.quote_id = ce.quote_id and qi.supplier_id = auth.uid()
            ) and exists (
              select 1 from quote_items qi
               where qi.quote_id = ce.quote_id and qi.supplier_id = p_rated
            ))
       )
  ) into v_relates;
  if not v_relates then raise exception 'not_authorized_to_rate_this_user_on_this_event'; end if;

  insert into collaboration_ratings (rater_id, rated_id, entry_id, stars, review)
  values (auth.uid(), p_rated, p_entry, p_stars, nullif(p_review, ''))
  on conflict (rater_id, rated_id, entry_id) do update
    set stars = excluded.stars,
        review = excluded.review
  returning * into v_row;
  return v_row;
end$$;

grant execute on function rate_user(uuid, uuid, int, text) to authenticated;

-- ─── view: media e conta voti per utente (pubblica) ─────────────────────────
create or replace view user_rating_summary as
  select rated_id as user_id,
         round(avg(stars)::numeric, 2) as avg_stars,
         count(*) as ratings_count
    from collaboration_ratings
   group by rated_id;

grant select on user_rating_summary to authenticated, anon;

-- ─── helper: rate-able pairs per evento (per UI prompt post-evento) ─────────
create or replace function rateable_users_for_entry(p_entry uuid)
returns table (user_id uuid, role text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  with me as (select auth.uid() as uid),
       evt as (
         select ce.id, ce.owner_id, ce.quote_id, ce.date_to
           from calendar_entries ce where ce.id = p_entry
       ),
       suppliers as (
         select distinct qi.supplier_id as uid
           from evt
           join quote_items qi on qi.quote_id = evt.quote_id
          where qi.supplier_id is not null
       )
  select p.id, p.role::text, coalesce(p.business_name, p.full_name)
    from profiles p
   where p.id <> (select uid from me)
     and (
          -- per il WP: tutti i fornitori del proprio evento
          (exists (select 1 from evt where evt.owner_id = (select uid from me))
            and p.id in (select uid from suppliers))
       or
          -- per un fornitore: il WP + altri fornitori dell'evento
          ((select uid from me) in (select uid from suppliers)
            and (p.id = (select owner_id from evt) or p.id in (select uid from suppliers)))
     )
     and (select date_to from evt) <= current_date;
$$;

grant execute on function rateable_users_for_entry(uuid) to authenticated;
