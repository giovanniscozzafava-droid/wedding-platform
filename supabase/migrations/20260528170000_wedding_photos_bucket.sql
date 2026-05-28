-- ============================================================================
-- Bucket "wedding-photos": foto caricate dal WP o dagli sposi per il proprio
-- matrimonio (cerimonia, sopralluoghi luoghi, valutazioni). Public.
-- Path: {entry_id}/{kind}/{filename}, dove kind = ceremony, moodboard, ecc.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'wedding-photos', 'wedding-photos', true,
  10485760, -- 10MB per immagine
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do update set public = true;

-- Read pubblico (URL serviti pubblicamente, l'identificatore è opaco)
drop policy if exists "wedding_photos_read_all" on storage.objects;
create policy "wedding_photos_read_all" on storage.objects for select using (
  bucket_id = 'wedding-photos'
);

-- Insert: chiunque sia owner della calendar_entry collegata al primo segmento
-- del path (entry_id), OR un membro coppia, OR admin.
drop policy if exists "wedding_photos_insert_member" on storage.objects;
create policy "wedding_photos_insert_member" on storage.objects for insert with check (
  bucket_id = 'wedding-photos' and auth.uid() is not null and (
    exists (
      select 1 from calendar_entries ce
       where ce.id::text = split_part(name, '/', 1)
         and ce.owner_id = auth.uid()
    )
    or exists (
      select 1 from wedding_couple_members m
       where m.entry_id::text = split_part(name, '/', 1)
         and m.user_id = auth.uid()
    )
    or is_admin()
  )
);

drop policy if exists "wedding_photos_delete_member" on storage.objects;
create policy "wedding_photos_delete_member" on storage.objects for delete using (
  bucket_id = 'wedding-photos' and auth.uid() is not null and (
    owner = auth.uid()
    or exists (
      select 1 from calendar_entries ce
       where ce.id::text = split_part(name, '/', 1)
         and ce.owner_id = auth.uid()
    )
    or is_admin()
  )
);
