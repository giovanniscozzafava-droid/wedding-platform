-- Libreria CONDIVISA di preset (disposizioni tavola) dell'impaginatore album.
-- Non appena staff/admin salva un preset, viene distribuito a TUTTI i professionisti: qui la tabella
-- e' leggibile da tutti gli autenticati, ma scrivibile solo da staff/admin. I preset si applicano per
-- NUMERO di foto sulla tavola (colonna n = bucket): un preset da 3 foto vale solo per le tavole da 3.

create table if not exists public.album_shared_presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  n int not null,                 -- numero foto sulla tavola (bucket)
  frames jsonb not null,          -- Frame[] (bounding box normalizzati)
  els jsonb,                      -- FreeSlot[] (composizione libera con rotazione), opzionale
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists album_shared_presets_n on public.album_shared_presets (n);

alter table public.album_shared_presets enable row level security;

-- Tutti i professionisti autenticati LEGGONO la libreria (auto-distribuzione).
drop policy if exists album_shared_presets_read on public.album_shared_presets;
create policy album_shared_presets_read on public.album_shared_presets
  for select to authenticated using (true);

-- Scrive / cancella SOLO staff o admin ("io o qualcuno di futuro in staff").
drop policy if exists album_shared_presets_write on public.album_shared_presets;
create policy album_shared_presets_write on public.album_shared_presets
  for all to authenticated
  using (public.is_admin() or public.is_support_staff())
  with check (public.is_admin() or public.is_support_staff());

grant select on public.album_shared_presets to authenticated;
grant insert, update, delete on public.album_shared_presets to authenticated;

-- Il client mostra il tasto "Salva nella libreria (tutti)" solo ai curatori.
create or replace function public.am_i_preset_curator()
returns boolean language sql security definer set search_path = public stable as $$
  select public.is_admin() or public.is_support_staff();
$$;
revoke all on function public.am_i_preset_curator() from anon, public;
grant execute on function public.am_i_preset_curator() to authenticated;
