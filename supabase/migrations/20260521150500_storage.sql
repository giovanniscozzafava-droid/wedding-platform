-- ============================================================================
-- Storage buckets + policy (PRP-1 WI-5, PRP-3 WI-10)
-- ============================================================================

-- 1. Bucket foto servizi (lettura pubblica via URL firmato; upload solo auth)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'service-photos','service-photos',true,
  2097152, -- 2MB
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 2. Bucket PDF preventivi (privato, accesso via signed URL Edge Function)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'quote-pdfs','quote-pdfs',false,
  10485760, -- 10MB
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- 3. Bucket brand assets (logo wedding planner premium)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets','brand-assets',true,
  1048576, -- 1MB
  array['image/jpeg','image/png','image/svg+xml','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- ----------------------------------------------------------------------------
-- Storage policies
-- Path convention service-photos/{service_id}/{...}
-- Path convention brand-assets/{user_id}/{...}
-- ----------------------------------------------------------------------------

-- service-photos: read pubblico (bucket public=true gia` consente lettura via
-- storage.objects policy default; ridondiamo policy esplicita).
drop policy if exists "service-photos read public" on storage.objects;
create policy "service-photos read public"
  on storage.objects for select
  using (bucket_id = 'service-photos');

-- service-photos: upload solo se l'utente loggato e' owner del service nel path.
drop policy if exists "service-photos write owner" on storage.objects;
create policy "service-photos write owner"
  on storage.objects for insert
  with check (
    bucket_id = 'service-photos'
    and auth.uid() is not null
    and exists (
      select 1 from services s
      where s.id::text = split_part(name, '/', 1)
        and s.fornitore_id = auth.uid()
    )
  );

drop policy if exists "service-photos delete owner" on storage.objects;
create policy "service-photos delete owner"
  on storage.objects for delete
  using (
    bucket_id = 'service-photos'
    and exists (
      select 1 from services s
      where s.id::text = split_part(name, '/', 1)
        and s.fornitore_id = auth.uid()
    )
  );

-- brand-assets: read pubblico, write solo owner cartella (user_id)
drop policy if exists "brand-assets read public" on storage.objects;
create policy "brand-assets read public"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

drop policy if exists "brand-assets write self" on storage.objects;
create policy "brand-assets write self"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-assets'
    and auth.uid() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "brand-assets delete self" on storage.objects;
create policy "brand-assets delete self"
  on storage.objects for delete
  using (
    bucket_id = 'brand-assets'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- quote-pdfs: solo service_role (Edge Function) puo` upload/read. Nessuna
-- policy: bucket privato + RLS default = no anon/auth access.
