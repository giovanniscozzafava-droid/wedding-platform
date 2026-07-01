-- Prove menu a SESSIONI/turni: la location organizza sessioni (di norma 4 date, primaverile/
-- autunnale) e invita gruppi di clienti (lista). Ogni cliente riceve invito (email + WhatsApp) con
-- RSVP. Chi CONFERMA sblocca la funzione menu sulla propria dashboard (parte dalla degustazione).

create table if not exists public.fb_tasting_sessions (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  season      text,                                   -- 'PRIMAVERILE' | 'AUTUNNALE' | libero
  notes       text,
  created_at  timestamptz not null default now()
);
create table if not exists public.fb_tasting_session_dates (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.fb_tasting_sessions(id) on delete cascade,
  scheduled_at timestamptz not null,
  sala         text,
  capacity     int,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now()
);
create table if not exists public.fb_tasting_invites (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.fb_tasting_sessions(id) on delete cascade,
  entry_id       uuid references public.calendar_entries(id) on delete set null, -- evento del cliente → sblocco menu
  client_name    text not null,
  email          text,
  phone          text,
  token          text not null default replace(gen_random_uuid()::text, '-', ''),
  rsvp           text not null default 'PENDING' check (rsvp in ('PENDING','YES','NO')),
  chosen_date_id uuid references public.fb_tasting_session_dates(id) on delete set null,
  note           text,
  invited_at     timestamptz,
  responded_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_tsess_loc   on public.fb_tasting_sessions(location_id);
create index if not exists idx_tsdate_sess on public.fb_tasting_session_dates(session_id);
create index if not exists idx_tinv_session on public.fb_tasting_invites(session_id);
create index if not exists idx_tinv_entry   on public.fb_tasting_invites(entry_id) where entry_id is not null;
create unique index if not exists idx_tinv_token on public.fb_tasting_invites(token);

alter table public.fb_tasting_sessions      enable row level security;
alter table public.fb_tasting_session_dates enable row level security;
alter table public.fb_tasting_invites       enable row level security;

drop policy if exists tsess_owner on public.fb_tasting_sessions;
create policy tsess_owner on public.fb_tasting_sessions for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists tsdate_owner on public.fb_tasting_session_dates;
create policy tsdate_owner on public.fb_tasting_session_dates for all
  using (exists (select 1 from public.fb_tasting_sessions s where s.id = session_id and s.location_id = auth.uid()))
  with check (exists (select 1 from public.fb_tasting_sessions s where s.id = session_id and s.location_id = auth.uid()));
drop policy if exists tinv_owner on public.fb_tasting_invites;
create policy tinv_owner on public.fb_tasting_invites for all
  using (exists (select 1 from public.fb_tasting_sessions s where s.id = session_id and s.location_id = auth.uid()))
  with check (exists (select 1 from public.fb_tasting_sessions s where s.id = session_id and s.location_id = auth.uid()));

-- SBLOCCO menu: gate SOLO se il cliente è invitato a una sessione e NON ha ancora confermato.
-- Se non è in nessuna sessione → sbloccato (default, non rompe gli eventi esistenti).
create or replace function public.fb_menu_unlocked(p_entry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.fb_tasting_invites i where i.entry_id = p_entry and i.rsvp = 'YES') then true
    when exists (select 1 from public.fb_tasting_invites i where i.entry_id = p_entry) then false
    else true end;
$$;
grant execute on function public.fb_menu_unlocked(uuid) to authenticated;

-- Vista PUBBLICA dell'invito (token, anon) → date + stato
create or replace function public.fb_tasting_invite_public(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v record;
begin
  select i.id, i.client_name, i.rsvp, i.chosen_date_id, i.session_id, s.name as sname, s.season, s.notes as snotes,
         coalesce(p.business_name, p.display_name, p.full_name) as loc
    into v
    from public.fb_tasting_invites i
    join public.fb_tasting_sessions s on s.id = i.session_id
    join public.profiles p on p.id = s.location_id
   where i.token = p_token;
  if v.id is null then return jsonb_build_object('error','not_found'); end if;
  return jsonb_build_object('ok', true, 'invite_id', v.id, 'cliente', v.client_name, 'rsvp', v.rsvp,
    'chosen_date_id', v.chosen_date_id, 'sessione', v.sname, 'stagione', v.season, 'note', v.snotes, 'location', v.loc,
    'date', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'quando', d.scheduled_at, 'sala', d.sala)
                        order by d.sort_order, d.scheduled_at)
                      from public.fb_tasting_session_dates d where d.session_id = v.session_id), '[]'::jsonb));
end$$;
grant execute on function public.fb_tasting_invite_public(text) to anon, authenticated;

-- RISPOSTA RSVP (token, anon)
create or replace function public.fb_tasting_invite_respond(p_token text, p_rsvp text, p_date_id uuid default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_rsvp not in ('YES','NO') then return jsonb_build_object('error','bad_rsvp'); end if;
  update public.fb_tasting_invites
     set rsvp = p_rsvp,
         chosen_date_id = case when p_rsvp = 'YES' then p_date_id else null end,
         note = coalesce(p_note, note),
         responded_at = now()
   where token = p_token
   returning id into v_id;
  if v_id is null then return jsonb_build_object('error','not_found'); end if;
  return jsonb_build_object('ok', true, 'rsvp', p_rsvp);
end$$;
grant execute on function public.fb_tasting_invite_respond(text, text, uuid, text) to anon, authenticated;
