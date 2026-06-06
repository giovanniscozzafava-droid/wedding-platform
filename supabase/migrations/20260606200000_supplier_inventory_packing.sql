-- ============================================================================
-- Magazzino del fornitore + checklist attrezzatura per evento.
--  • supplier_inventory_items: il "magazzino" riutilizzabile del fornitore
--    (starter pack per tipo + tutto ciò che aggiunge). Es. band → violino,
--    batteria, mixer, cavi, luci; fotografo → corpi macchina, schede, drone,
--    batterie, cavi USB-C, computer.
--  • supplier_team_event_packing: la checklist "cosa portare" a quel turno,
--    spuntabile fino all'ultimo dettaglio.
-- ============================================================================

create table if not exists public.supplier_inventory_items (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  category    text,            -- es. "Audio", "Ottiche", "Luci", "Trasporto"
  qty_default int not null default 1,
  active      boolean not null default true,
  ord         int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_inventory_supplier on public.supplier_inventory_items(supplier_id, active);

create table if not exists public.supplier_team_event_packing (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.supplier_team_events(id) on delete cascade,
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  category    text,
  qty         int not null default 1,
  checked     boolean not null default false,   -- spuntato = caricato/portato
  ord         int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_packing_event on public.supplier_team_event_packing(event_id, ord);

drop trigger if exists trg_inventory_upd on public.supplier_inventory_items;
create trigger trg_inventory_upd before update on public.supplier_inventory_items
  for each row execute function set_updated_at();
drop trigger if exists trg_packing_upd on public.supplier_team_event_packing;
create trigger trg_packing_upd before update on public.supplier_team_event_packing
  for each row execute function set_updated_at();

alter table public.supplier_inventory_items     enable row level security;
alter table public.supplier_team_event_packing  enable row level security;

drop policy if exists "inventory_own" on public.supplier_inventory_items;
create policy "inventory_own" on public.supplier_inventory_items
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

drop policy if exists "packing_own" on public.supplier_team_event_packing;
create policy "packing_own" on public.supplier_team_event_packing
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

comment on table public.supplier_inventory_items is 'Magazzino riutilizzabile del fornitore (attrezzatura).';
comment on table public.supplier_team_event_packing is 'Checklist attrezzatura da portare a un turno/evento (spuntabile).';
