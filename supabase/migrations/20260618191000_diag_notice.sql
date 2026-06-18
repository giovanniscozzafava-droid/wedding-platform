do $$
declare r jsonb; e uuid := '07b29b6e-b76a-4d36-a1d9-4da6f5778e34';
begin
  select jsonb_build_object(
    'total', count(*),
    'kept', count(*) filter (where album_choice='KEPT'),
    'discarded', count(*) filter (where album_choice='DISCARDED'),
    'nullc', count(*) filter (where album_choice is null),
    'imported', count(*) filter (where drive_file_id like 'album:%'),
    'imported_kept', count(*) filter (where drive_file_id like 'album:%' and album_choice='KEPT'),
    'guest', count(*) filter (where drive_file_id like 'guest:%'),
    'galleries', (select count(*) from public.event_galleries where entry_id=e)
  ) into r from public.gallery_media where entry_id=e;
  raise notice 'DIAGRESULT %', r;
end $$;
