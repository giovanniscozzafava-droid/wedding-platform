-- Assegnazione multi-trip ospiti ↔ trasporti/alloggi.
-- Un ospite puo' avere piu' viaggi (es. shuttle andata + ritorno + brunch giorno dopo)
-- e/o piu' notti in alloggi diversi (es. welcome dinner B&B + nozze hotel).

-- 1. Capacita su trasporti e alloggi
alter table event_transport
  add column if not exists capacity int,        -- posti totali (NULL = illimitato)
  add column if not exists notes text;          -- promemoria interno

alter table event_accommodations
  add column if not exists total_rooms int,     -- camere prenotate
  add column if not exists total_beds int,      -- posti letto totali
  add column if not exists check_in date,       -- default check-in
  add column if not exists check_out date,      -- default check-out
  add column if not exists notes text;

-- 2. Join ospite ↔ trasporto (N:M)
create table if not exists event_guest_transport (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references calendar_entries(id) on delete cascade,
  guest_id     uuid not null references event_guests(id) on delete cascade,
  transport_id uuid not null references event_transport(id) on delete cascade,
  notes        text,                            -- es. "bambino seggiolino"
  created_at   timestamptz not null default now(),
  unique (guest_id, transport_id)
);
create index if not exists idx_egt_guest on event_guest_transport(guest_id);
create index if not exists idx_egt_transport on event_guest_transport(transport_id);
create index if not exists idx_egt_entry on event_guest_transport(entry_id);

-- 3. Join ospite ↔ alloggio (N:M) con check-in/out specifici
create table if not exists event_guest_accommodation (
  id              uuid primary key default gen_random_uuid(),
  entry_id        uuid not null references calendar_entries(id) on delete cascade,
  guest_id        uuid not null references event_guests(id) on delete cascade,
  accommodation_id uuid not null references event_accommodations(id) on delete cascade,
  room_label      varchar(40),                  -- es. "Stanza 12" o "Camera matrimoniale"
  check_in        date,
  check_out       date,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (guest_id, accommodation_id, check_in)
);
create index if not exists idx_ega_guest on event_guest_accommodation(guest_id);
create index if not exists idx_ega_acc on event_guest_accommodation(accommodation_id);
create index if not exists idx_ega_entry on event_guest_accommodation(entry_id);

-- 4. RLS
alter table event_guest_transport enable row level security;
alter table event_guest_accommodation enable row level security;

-- entry owner + couple member possono leggere/modificare
create policy "egt_select" on event_guest_transport for select
  using (
    exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
    or is_wedding_couple(entry_id)
    or is_entry_participant(entry_id)
    or is_admin()
  );
create policy "egt_modify" on event_guest_transport for all
  using (
    exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
    or is_admin()
  )
  with check (
    exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
    or is_admin()
  );

create policy "ega_select" on event_guest_accommodation for select
  using (
    exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
    or is_wedding_couple(entry_id)
    or is_entry_participant(entry_id)
    or is_admin()
  );
create policy "ega_modify" on event_guest_accommodation for all
  using (
    exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
    or is_admin()
  )
  with check (
    exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
    or is_admin()
  );

comment on table event_guest_transport is 'Multi-trip: un ospite puo essere assegnato a piu trasporti (shuttle, navetta, volo gruppo, brunch).';
comment on table event_guest_accommodation is 'Un ospite puo avere piu pernottamenti su alloggi diversi con date proprie.';
