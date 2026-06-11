-- Impostazioni galleria (stile photo-delivery pro): il fotografo configura cosa
-- possono fare i clienti. Una riga per galleria.
create table if not exists public.gallery_settings (
  gallery_id uuid primary key references public.event_galleries(id) on delete cascade,
  allow_favorites boolean not null default true,
  favorites_color text not null default '#C49A5C',
  show_favorites_count boolean not null default false,
  favorites_limit integer,
  favorites_download text not null default 'off',     -- off | web | hi
  allow_comments boolean not null default true,
  allow_social boolean not null default true,
  show_filename boolean not null default false,
  pin_icons boolean not null default false,
  watermark_enabled boolean not null default false,
  watermark_text text,
  allow_download_all boolean not null default false,
  download_hd boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.gallery_settings enable row level security;

-- lettura: chi può vedere la galleria (riusa la RLS di event_galleries)
drop policy if exists gs_read on public.gallery_settings;
create policy gs_read on public.gallery_settings for select
  using (exists (select 1 from public.event_galleries g where g.id = gallery_settings.gallery_id));

-- scrittura: solo l'owner della galleria (o admin)
drop policy if exists gs_write on public.gallery_settings;
create policy gs_write on public.gallery_settings for all
  using (public.is_admin() or exists (select 1 from public.event_galleries g where g.id = gallery_settings.gallery_id and g.owner_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.event_galleries g where g.id = gallery_settings.gallery_id and g.owner_id = auth.uid()));
