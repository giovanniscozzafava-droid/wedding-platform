-- ════════════════════════════════════════════════════════════════════════════
-- MODELLI COME CARD UNIFICATE (funnel album).
-- Un modello = una card. Può venire da un PDF (hotspot posizionato) oppure essere una
-- CARD MANUALE (foto, per i fotografi che non hanno un PDF e si costruiscono il campionario).
-- Estende album_catalog_hotspots: catalog_id nullable, owner_id diretto (per le card senza PDF
-- e per la RLS), image_path (foto della card), options (materiali/colori/logo/foto-copertina +
-- sovrapprezzi), sort_order. Multi-PDF: più cataloghi attivi per fotografo.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.album_catalog_hotspots alter column catalog_id drop not null;
alter table public.album_catalog_hotspots add column if not exists owner_id uuid references public.profiles(id) on delete cascade;
alter table public.album_catalog_hotspots add column if not exists image_path text;
alter table public.album_catalog_hotspots add column if not exists options jsonb not null default '{}'::jsonb;
alter table public.album_catalog_hotspots add column if not exists sort_order int not null default 0;

-- backfill: owner_id dai cataloghi esistenti
update public.album_catalog_hotspots h
  set owner_id = c.owner_id
  from public.album_catalogs c
  where h.catalog_id = c.id and h.owner_id is null;

create index if not exists idx_album_hotspots_owner on public.album_catalog_hotspots(owner_id);

-- RLS: proprietario via owner_id diretto OPPURE via catalogo (retrocompatibile con le righe vecchie).
drop policy if exists album_hotspots_owner on public.album_catalog_hotspots;
create policy album_hotspots_owner on public.album_catalog_hotspots for all
  using (owner_id = auth.uid() or exists (select 1 from public.album_catalogs c where c.id = catalog_id and c.owner_id = auth.uid()))
  with check (owner_id = auth.uid() or exists (select 1 from public.album_catalogs c where c.id = catalog_id and c.owner_id = auth.uid()));
