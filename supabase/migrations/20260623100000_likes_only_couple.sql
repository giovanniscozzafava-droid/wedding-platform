-- I like alle foto solo i CLIENTI (la coppia dell'evento): non i professionisti, non gli ospiti.
drop policy if exists ml_write on public.gallery_media_likes;
create policy ml_write on public.gallery_media_likes for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.gallery_media gm where gm.id = gallery_media_likes.media_id and public.is_wedding_couple(gm.entry_id))
  );
