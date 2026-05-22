-- ============================================================================
-- Wedding Platform — Ruolo CLIENTE_SPOSI (couple) per accesso sposi
-- ============================================================================

-- 1. Aggiungi ruolo COUPLE all'enum user_role -------------------------------
alter type user_role add value if not exists 'COUPLE';

-- 2. Tabella wedding_couple_members -----------------------------------------
create type couple_role as enum ('SPOSO','SPOSA','PARTNER','PERSONA_DI_FIDUCIA');

create table if not exists wedding_couple_members (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references calendar_entries(id) on delete cascade,
  user_id     uuid references profiles(id) on delete set null,
  email       varchar(200) not null,
  full_name   varchar(160),
  role        couple_role not null default 'PARTNER',
  invite_token uuid not null default gen_random_uuid(),
  invited_at  timestamptz not null default now(),
  accepted_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_couple_entry on wedding_couple_members(entry_id);
create index if not exists idx_couple_user on wedding_couple_members(user_id);
create index if not exists idx_couple_token on wedding_couple_members(invite_token);
create unique index if not exists uq_couple_email on wedding_couple_members(entry_id, email);

alter table wedding_couple_members enable row level security;

-- WP/Location owner del wedding gestisce i couple_members
create policy "couple_owner_all" on wedding_couple_members for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);
create policy "couple_admin_all" on wedding_couple_members for all using (is_admin()) with check (is_admin());

-- Lo sposo stesso vede il suo record
create policy "couple_self_select" on wedding_couple_members for select using (user_id = auth.uid());

-- 3. RLS estensione: COUPLE vede il proprio wedding e dati associati --------
-- Helper: dato un calendar_entry, l'utente loggato e' uno dei suoi sposi?
create or replace function is_wedding_couple(p_entry uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.wedding_couple_members
    where entry_id = p_entry and user_id = auth.uid()
  );
$$;

-- Calendar entries: aggiungo policy SELECT per couple
drop policy if exists "calentry_select_couple" on calendar_entries;
create policy "calentry_select_couple" on calendar_entries for select
  using (is_wedding_couple(id));

-- Quotes: lo sposo vede il quote del suo wedding (read-only)
drop policy if exists "quotes_select_couple" on quotes;
create policy "quotes_select_couple" on quotes for select
  using (exists (
    select 1 from calendar_entries ce
    where ce.quote_id = quotes.id and is_wedding_couple(ce.id)
  ));

drop policy if exists "qitems_select_couple" on quote_items;
create policy "qitems_select_couple" on quote_items for select
  using (exists (
    select 1 from quotes q join calendar_entries ce on ce.quote_id = q.id
    where q.id = quote_items.quote_id and is_wedding_couple(ce.id)
  ));

-- Timeline, tavoli, invitati, budget (read), tasks, mood, playlist, sub-events, accommodations, transport, gadgets: couple read
drop policy if exists "timeline_select_couple" on event_timeline;
create policy "timeline_select_couple" on event_timeline for select using (is_wedding_couple(entry_id));

drop policy if exists "tables_select_couple" on event_tables;
create policy "tables_select_couple" on event_tables for select using (is_wedding_couple(entry_id));

drop policy if exists "guests_select_couple" on event_guests;
create policy "guests_select_couple" on event_guests for select using (is_wedding_couple(entry_id));

drop policy if exists "tasks_select_couple" on wedding_tasks;
create policy "tasks_select_couple" on wedding_tasks for select using (is_wedding_couple(entry_id));

drop policy if exists "mood_select_couple" on mood_images;
create policy "mood_select_couple" on mood_images for select using (is_wedding_couple(entry_id));
-- mood: couple PUO` aggiungere ispirazioni
drop policy if exists "mood_insert_couple" on mood_images;
create policy "mood_insert_couple" on mood_images for insert
  with check (is_wedding_couple(entry_id));
drop policy if exists "mood_delete_couple" on mood_images;
create policy "mood_delete_couple" on mood_images for delete
  using (is_wedding_couple(entry_id));

drop policy if exists "playlist_select_couple" on event_playlist;
create policy "playlist_select_couple" on event_playlist for select using (is_wedding_couple(entry_id));
drop policy if exists "playlist_insert_couple" on event_playlist;
create policy "playlist_insert_couple" on event_playlist for insert
  with check (is_wedding_couple(entry_id));
drop policy if exists "playlist_delete_couple" on event_playlist;
create policy "playlist_delete_couple" on event_playlist for delete
  using (is_wedding_couple(entry_id));

drop policy if exists "sub_select_couple" on event_subevents;
create policy "sub_select_couple" on event_subevents for select using (is_wedding_couple(entry_id));

drop policy if exists "acc_select_couple" on event_accommodations;
create policy "acc_select_couple" on event_accommodations for select using (is_wedding_couple(entry_id));

drop policy if exists "transport_select_couple" on event_transport;
create policy "transport_select_couple" on event_transport for select using (is_wedding_couple(entry_id));

drop policy if exists "gadgets_select_couple" on event_gadgets;
create policy "gadgets_select_couple" on event_gadgets for select using (is_wedding_couple(entry_id));

drop policy if exists "budgetc_select_couple" on budget_categories;
create policy "budgetc_select_couple" on budget_categories for select using (is_wedding_couple(entry_id));
drop policy if exists "budgete_select_couple" on budget_entries;
create policy "budgete_select_couple" on budget_entries for select using (is_wedding_couple(entry_id));

drop policy if exists "partic_select_couple" on calendar_entry_participants;
create policy "partic_select_couple" on calendar_entry_participants for select
  using (is_wedding_couple(entry_id));

-- 4. RPC: accetta invito coppia ---------------------------------------------
create or replace function couple_accept_invite(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update wedding_couple_members
     set user_id = auth.uid(), accepted_at = coalesce(accepted_at, now())
   where invite_token = p_token
     and user_id is null
   returning id into v_id;
  return v_id is not null;
end$$;
grant execute on function couple_accept_invite(uuid) to authenticated;
