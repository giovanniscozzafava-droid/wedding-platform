-- ============================================================================
-- Blog aperto anche ai FORNITORI: ogni professionista può scrivere articoli
-- (anche generati dall'AI a partire dai propri contenuti Instagram).
-- ============================================================================
drop policy if exists "blog_posts_write_authors" on blog_posts;
create policy "blog_posts_write_authors" on blog_posts for all using (
  (author_id = auth.uid() and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN')
  ))
  or is_admin()
) with check (
  (author_id = auth.uid() and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN')
  ))
  or is_admin()
);

drop policy if exists "blog_media_upload_authors" on storage.objects;
create policy "blog_media_upload_authors" on storage.objects for insert with check (
  bucket_id = 'blog-media' and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN')
  )
);
