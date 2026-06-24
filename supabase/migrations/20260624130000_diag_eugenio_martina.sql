-- DIAGNOSTICO (sola lettura): capire il pattern dei "doppioni" su Eugenio e Martina.
do $$
declare r record;
begin
  for r in
    select ce.id as entry_id, ce.title,
      count(gm.id) as total,
      count(distinct gm.drive_file_id) as distinct_drive,
      count(distinct (gm.folder_id::text || ':' || gm.drive_file_id)) as distinct_folder_drive,
      count(*) filter (where gm.album_choice = 'KEPT') as kept,
      count(*) filter (where gm.album_choice = 'DISCARDED') as discarded,
      count(distinct gm.folder_id) as folders
    from public.calendar_entries ce
    join public.gallery_media gm on gm.entry_id = ce.id
    where ce.title ilike '%eugenio%' or ce.title ilike '%martina%'
    group by ce.id, ce.title
  loop
    raise notice 'EVENT % / % → total=% distinct_drive=% distinct_folder_drive=% kept=% discarded=% folders=%',
      r.entry_id, r.title, r.total, r.distinct_drive, r.distinct_folder_drive, r.kept, r.discarded, r.folders;
  end loop;
end $$;
