-- DIAG (read-only): cartelle e conteggio media dell'evento Christian & Anastasia (a651dc95).
do $$
declare r record;
begin
  for r in
    select f.id, f.name, f.level, f.shared, f.assigned_subrole,
           (select count(*) from public.gallery_media m where m.folder_id = f.id) as media
      from public.gallery_folders f
     where f.entry_id = 'a651dc95-83fe-41ab-8a6e-5504b50c6b3a'
     order by f.sort_order
  loop
    raise notice 'CARTELLA "%" | livello=% | condivisa=% | subrole=% | foto=%',
      r.name, r.level, r.shared, coalesce(r.assigned_subrole,'—'), r.media;
  end loop;
end $$;
