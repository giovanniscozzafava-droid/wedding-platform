do $$
declare r jsonb; e uuid := '07b29b6e-b76a-4d36-a1d9-4da6f5778e34';
begin
  select jsonb_build_object(
    'photo', count(*) filter (where media_type='PHOTO'),
    'video', count(*) filter (where media_type='VIDEO'),
    'kept_photo', count(*) filter (where media_type='PHOTO' and album_choice='KEPT'),
    'kept_video', count(*) filter (where media_type='VIDEO' and album_choice='KEPT'),
    'by_level', (select jsonb_object_agg(coalesce(f.level::text,'?'), c) from (select gm.folder_id, count(*) c from public.gallery_media gm where gm.entry_id=e group by gm.folder_id) s join public.gallery_folders f on f.id=s.folder_id),
    'gallery_owner_is_album_owner', (select (g.owner_id = ap.owner_id) from public.event_galleries g join public.album_projects ap on ap.entry_id=g.entry_id where g.entry_id=e limit 1)
  ) into r from public.gallery_media where entry_id=e;
  raise notice 'DIAG2 %', r;
end $$;
