-- DIAG: da dove vengono le "42 selezionate" su Zoe? Dump cartelle/media/album_choice/selezione.
do $$
declare v_entry uuid; v_gal uuid; v_tok uuid; r record; v jsonb;
begin
  select ce.id into v_entry from public.calendar_entries ce
   where ce.title ilike '%zoe%'
      or exists (select 1 from public.calendar_entries_private p where p.entry_id = ce.id and p.client_name ilike '%zoe%')
   order by ce.created_at desc limit 1;
  select id, share_token into v_gal, v_tok from public.event_galleries where entry_id = v_entry limit 1;
  raise notice 'DIAG: entry=% gallery=% token=%', v_entry, v_gal, v_tok;

  raise notice '--- CARTELLE (level | nome | n.media) ---';
  for r in select f.level, f.name, count(m.id) as n
             from public.gallery_folders f
             left join public.gallery_media m on m.folder_id = f.id
             where f.gallery_id = v_gal group by f.id, f.level, f.name order by f.level loop
    raise notice '   % | % | %', r.level, r.name, r.n;
  end loop;

  raise notice '--- album_choice su TUTTO l''evento (tutte le cartelle) ---';
  for r in select coalesce(album_choice,'(null)') as c, count(*) n from public.gallery_media where entry_id = v_entry group by album_choice loop
    raise notice '   % = %', r.c, r.n;
  end loop;

  raise notice '--- album_choice sulle SOLE base media (LAVORO_INTERO, PHOTO) ---';
  for r in select coalesce(m.album_choice,'(null)') as c, count(*) n
             from public.gallery_media m join public.gallery_folders f on f.id=m.folder_id
             where m.gallery_id=v_gal and f.level='LAVORO_INTERO' and m.media_type='PHOTO'
             group by m.album_choice loop
    raise notice '   % = %', r.c, r.n;
  end loop;

  raise notice '--- gallery_selection ---';
  for r in select round, status, target_min, target_max, submitted_at from public.gallery_selection where gallery_id=v_gal loop
    raise notice '   round=% status=% min/max=%/% submitted=%', r.round, r.status, r.target_min, r.target_max, r.submitted_at;
  end loop;
  raise notice '   decisioni totali=% (keep=%)',
    (select count(*) from public.gallery_selection_decisions where gallery_id=v_gal),
    (select count(*) from public.gallery_selection_decisions where gallery_id=v_gal and keep);

  select public.gallery_get_by_token(v_tok) into v;
  raise notice '--- RPC gallery_get_by_token: total=% pool=% kept=% decided=% media_len=% ---',
    v->'selection'->>'total', v->'selection'->>'pool', v->'selection'->>'kept', v->'selection'->>'decided',
    jsonb_array_length(coalesce(v->'media','[]'::jsonb));
end $$;
