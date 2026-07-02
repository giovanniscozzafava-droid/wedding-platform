-- "IL MIO STILE" — ogni fotografo istruisce l'AI caricando i propri album (PDF): la vision legge le
-- tavole, ne estrae la geometria (riquadri) e le regole, e qui salviamo il PROFILO di stile del
-- fotografo + le tavole-modello (per il futuro "album fantasma"). Uno record per owner.
create table if not exists public.album_style_profiles (
  owner_id   uuid primary key references public.profiles(id) on delete cascade,
  profile    jsonb not null default '{}'::jsonb,   -- aggregato: foto/tavola, %doppia, %full-bleed, %bw, media...
  spreads    jsonb not null default '[]'::jsonb,    -- tavole-modello estratte: [{n, boxes:[{x,y,w,h}], bw, fullbleed}]
  samples    int   not null default 0,              -- quante tavole analizzate
  updated_at timestamptz not null default now()
);

alter table public.album_style_profiles enable row level security;

-- Ognuno vede/gestisce SOLO il proprio profilo.
drop policy if exists asp_own_sel on public.album_style_profiles;
create policy asp_own_sel on public.album_style_profiles for select using (owner_id = auth.uid());
drop policy if exists asp_own_ins on public.album_style_profiles;
create policy asp_own_ins on public.album_style_profiles for insert with check (owner_id = auth.uid());
drop policy if exists asp_own_upd on public.album_style_profiles;
create policy asp_own_upd on public.album_style_profiles for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists asp_own_del on public.album_style_profiles;
create policy asp_own_del on public.album_style_profiles for delete using (owner_id = auth.uid());
