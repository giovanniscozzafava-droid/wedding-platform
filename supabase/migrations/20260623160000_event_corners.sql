-- ANGOLI evento: il professionista compone "angoli" a tema (Bomboniere, Polaroid, Confettata,
-- Candy bar, Photo booth…) mettendo insieme gli accessori. Ogni angolo è una lista di accessori
-- con quantità, costo opzionale e spunta "pronto". Strumento operativo lato professionista.

create table if not exists public.event_corners (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.calendar_entries(id) on delete cascade,
  name       text not null,
  kind       text not null default 'ALTRO',
  note       text,
  status     text not null default 'DA_PREPARARE' check (status in ('DA_PREPARARE','PRONTO')),
  assignee   text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid()
);
create index if not exists idx_corners_entry on public.event_corners(entry_id);

create table if not exists public.event_corner_items (
  id         uuid primary key default gen_random_uuid(),
  corner_id  uuid not null references public.event_corners(id) on delete cascade,
  entry_id   uuid not null references public.calendar_entries(id) on delete cascade, -- denormalizzato per RLS semplice
  label      text not null,
  qty        numeric(10,2) not null default 1,
  unit_cost  numeric(12,2),
  note       text,
  checked    boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_corner_items_corner on public.event_corner_items(corner_id);

-- accesso: proprietario calendario, team dell'evento (partecipanti), la coppia, o admin
create or replace function public.corner_can_manage(p_entry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.calendar_entries ce where ce.id = p_entry and ce.owner_id = auth.uid())
      or exists (select 1 from public.calendar_entry_participants p where p.entry_id = p_entry and p.user_id = auth.uid())
      or public.is_wedding_couple(p_entry)
      or public.is_admin();
$$;

alter table public.event_corners      enable row level security;
alter table public.event_corner_items enable row level security;
drop policy if exists corner_all on public.event_corners;
create policy corner_all on public.event_corners for all using (public.corner_can_manage(entry_id)) with check (public.corner_can_manage(entry_id));
drop policy if exists corner_item_all on public.event_corner_items;
create policy corner_item_all on public.event_corner_items for all using (public.corner_can_manage(entry_id)) with check (public.corner_can_manage(entry_id));
