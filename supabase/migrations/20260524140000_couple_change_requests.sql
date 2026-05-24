-- Sistema richieste modifiche da parte degli sposi (COUPLE)
-- Sposi non modificano direttamente le card (invitati/tavoli/alloggi/trasporti/scaletta)
-- Inviano una richiesta che il WP/proprietario del wedding approva o rifiuta.

create type change_request_entity as enum (
  'GUEST', 'TABLE', 'ACCOMMODATION', 'TRANSPORT', 'TIMELINE', 'SUBEVENT', 'WEBSITE', 'OTHER'
);

create type change_request_action as enum ('CREATE', 'UPDATE', 'DELETE');

create type change_request_status as enum ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED');

create table couple_change_requests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references calendar_entries(id) on delete cascade,
  requested_by uuid not null references profiles(id) on delete cascade,
  entity_type change_request_entity not null,
  entity_id uuid,
  action change_request_action not null default 'UPDATE',
  title text not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  status change_request_status not null default 'PENDING',
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_ccr_wedding on couple_change_requests(wedding_id, status, created_at desc);
create index idx_ccr_requester on couple_change_requests(requested_by);

create trigger trg_ccr_updated_at before update on couple_change_requests
  for each row execute function set_updated_at();

alter table couple_change_requests enable row level security;

-- Sposi (partecipanti del wedding) possono leggere/creare le proprie richieste
create policy ccr_couple_read on couple_change_requests for select
  using (
    is_entry_participant(wedding_id)
    or exists (select 1 from calendar_entries ce where ce.id = wedding_id and ce.owner_id = auth.uid())
    or is_admin()
  );

create policy ccr_couple_insert on couple_change_requests for insert
  with check (
    requested_by = auth.uid()
    and (
      is_entry_participant(wedding_id)
      or exists (select 1 from calendar_entries ce where ce.id = wedding_id and ce.owner_id = auth.uid())
    )
  );

-- Solo owner wedding (WP) o admin possono aggiornare lo status
create policy ccr_owner_update on couple_change_requests for update
  using (
    exists (select 1 from calendar_entries ce where ce.id = wedding_id and ce.owner_id = auth.uid())
    or is_admin()
  );

create policy ccr_owner_delete on couple_change_requests for delete
  using (
    requested_by = auth.uid()
    or exists (select 1 from calendar_entries ce where ce.id = wedding_id and ce.owner_id = auth.uid())
    or is_admin()
  );

comment on table couple_change_requests is 'Richieste di modifica inviate dagli sposi al WP per invitati/tavoli/alloggi/trasporti/etc.';
