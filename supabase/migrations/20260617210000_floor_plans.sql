-- ============================================================================
-- PIANTINE SALA (floor plans)
-- ----------------------------------------------------------------------------
-- La location/venue (un fornitore) carica le piantine della propria sala da
-- foto/PDF; vengono "proiettate" come sfondo del tableau e i tavoli si
-- posizionano sopra. Le piantine sono RIUTILIZZABILI (libreria del proprietario)
-- e applicabili a ogni evento. Se un evento non ha piantina → sala generica con
-- le forme preimpostate (comportamento attuale).
--
--  • floor_plans        = libreria del proprietario (venue/fornitore)
--  • event_floor_plans  = la piantina ATTIVA proiettata su uno specifico evento
-- ============================================================================

-- Bucket pubblico per le immagini delle piantine (il PDF viene convertito in PNG
-- lato client prima dell'upload, così la proiezione è sempre un'immagine).
insert into storage.buckets (id, name, public)
values ('floor-plans', 'floor-plans', true)
on conflict (id) do nothing;

-- Upload/gestione: l'utente autenticato gestisce i file nella propria cartella
-- (primo segmento del path = uid). Lettura pubblica (bucket public).
drop policy if exists "floor_plans_insert_own" on storage.objects;
drop policy if exists "floor_plans_update_own" on storage.objects;
drop policy if exists "floor_plans_delete_own" on storage.objects;
create policy "floor_plans_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'floor-plans' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "floor_plans_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'floor-plans' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "floor_plans_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'floor-plans' and (storage.foldername(name))[1] = auth.uid()::text);

-- Libreria piantine del proprietario (venue/fornitore) ----------------------
create table if not exists public.floor_plans (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'Piantina',
  image_url   text not null,
  ratio       real not null default 1.6,   -- larghezza/altezza, per proiettare in proporzione
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_floor_plans_owner on public.floor_plans(owner_id, sort_order);
alter table public.floor_plans enable row level security;

drop policy if exists floor_plans_all_own on public.floor_plans;
create policy floor_plans_all_own on public.floor_plans
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Piantina ATTIVA su un evento (proiettata nel tableau) ---------------------
create table if not exists public.event_floor_plans (
  entry_id      uuid primary key references public.calendar_entries(id) on delete cascade,
  floor_plan_id uuid references public.floor_plans(id) on delete set null,
  image_url     text not null,
  ratio         real not null default 1.6,
  name          text,
  updated_at    timestamptz not null default now()
);
alter table public.event_floor_plans enable row level security;

-- Gli stessi attori che gestiscono il tableau (owner, coppia, fornitore
-- collaboratore) possono leggere/impostare la piantina dell'evento.
drop policy if exists efp_select on public.event_floor_plans;
drop policy if exists efp_write_owner on public.event_floor_plans;
drop policy if exists efp_write_couple on public.event_floor_plans;
drop policy if exists efp_write_supplier on public.event_floor_plans;

create policy efp_select on public.event_floor_plans
  for select to authenticated
  using (
    exists (select 1 from public.calendar_entries ce where ce.id = entry_id and (ce.owner_id = auth.uid() or public.is_entry_participant(ce.id)))
    or public.is_wedding_couple(entry_id)
    or public.is_collab_supplier_of_entry(entry_id)
    or public.is_admin()
  );

create policy efp_write_owner on public.event_floor_plans
  for all to authenticated
  using (exists (select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()))
  with check (exists (select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid()));

create policy efp_write_couple on public.event_floor_plans
  for all to authenticated
  using (public.is_wedding_couple(entry_id))
  with check (public.is_wedding_couple(entry_id));

create policy efp_write_supplier on public.event_floor_plans
  for all to authenticated
  using (public.is_collab_supplier_of_entry(entry_id))
  with check (public.is_collab_supplier_of_entry(entry_id));
