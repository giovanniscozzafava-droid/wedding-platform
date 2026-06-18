-- DIAGNOSTICA TEMPORANEA (verrà rimossa): conta i media album per capire la perdita di "like".
-- Solo aggregati, nessun dato personale. SECURITY DEFINER per leggere oltre RLS.
create or replace function public._diag_album_counts(p_entry uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'total', count(*),
    'kept', count(*) filter (where album_choice = 'KEPT'),
    'discarded', count(*) filter (where album_choice = 'DISCARDED'),
    'null_choice', count(*) filter (where album_choice is null),
    'imported_album', count(*) filter (where drive_file_id like 'album:%'),
    'imported_kept', count(*) filter (where drive_file_id like 'album:%' and album_choice = 'KEPT'),
    'guest', count(*) filter (where drive_file_id like 'guest:%'),
    'galleries', (select count(*) from public.event_galleries where entry_id = p_entry),
    'gallery_ids', (select count(distinct gallery_id) from public.gallery_media where entry_id = p_entry)
  )
  from public.gallery_media where entry_id = p_entry;
$$;
grant execute on function public._diag_album_counts(uuid) to anon, authenticated;
