do $$
declare r jsonb; e uuid := '07b29b6e-b76a-4d36-a1d9-4da6f5778e34';
begin
  select jsonb_agg(jsonb_build_object('name',f.name,'level',f.level,'shared',f.shared,'count',s.c)) into r
  from (select folder_id, count(*) c from public.gallery_media where entry_id=e group by folder_id) s
  join public.gallery_folders f on f.id=s.folder_id;
  raise notice 'DIAG3 %', r;
end $$;
