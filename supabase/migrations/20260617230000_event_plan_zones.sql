-- ============================================================================
-- ZONE e PUNTI D'INTERESSE (POI) della planimetria
-- ----------------------------------------------------------------------------
-- Disegnabili sulla piantina, con o senza immagine di sfondo:
--   • AREE (poligono): Band/DJ, pista, bar, buffet, tavolo torta, area generica
--   • PUNTI (POI): ingresso, uscita, bagni, rampa/scala
-- I POI servono soprattutto per la mobilità ridotta: vedere bagni/entrate/uscite
-- per avvicinare i tavoli delle persone con esigenze.
--
-- zones = jsonb array di:
--   { id, kind, label, points:[{x,y}], color }   (x,y normalizzati 0..1 della sala)
-- Per i POI points ha 1 elemento; per le aree >= 3.
-- ============================================================================

create table if not exists public.event_plan_zones (
  entry_id   uuid primary key references public.calendar_entries(id) on delete cascade,
  zones      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.event_plan_zones enable row level security;

drop policy if exists epz_select on public.event_plan_zones;
drop policy if exists epz_write_owner on public.event_plan_zones;
drop policy if exists epz_write_couple on public.event_plan_zones;
drop policy if exists epz_write_supplier on public.event_plan_zones;

create policy epz_select on public.event_plan_zones
  for select to authenticated
  using (
    exists (select 1 from public.calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or public.is_entry_participant(ce.id)))
    or public.is_wedding_couple(entry_id)
    or public.is_collab_supplier_of_entry(entry_id)
    or public.is_admin()
  );
create policy epz_write_owner on public.event_plan_zones
  for all to authenticated
  using (exists (select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()))
  with check (exists (select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()));
create policy epz_write_couple on public.event_plan_zones
  for all to authenticated
  using (public.is_wedding_couple(entry_id))
  with check (public.is_wedding_couple(entry_id));
create policy epz_write_supplier on public.event_plan_zones
  for all to authenticated
  using (public.is_collab_supplier_of_entry(entry_id))
  with check (public.is_collab_supplier_of_entry(entry_id));

-- Le piantine in libreria possono conservare le proprie zone (riuso) e una
-- visibilità di condivisione "in rete".
alter table public.floor_plans
  add column if not exists zones      jsonb not null default '[]'::jsonb,
  add column if not exists visibility text  not null default 'collaborators';  -- private | collaborators | network
