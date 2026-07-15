-- SEED TEST (evento "Zoe Cappello"): foto di prova per testare la galleria sposi + selezione swipe.
-- Usa immagini pubbliche (Lorem Picsum = foto vere) come thumbnail_link, con drive_file_id "demo-…"
-- così l'app usa la thumbnail_link (niente Google Drive). Soglie abbassate (min 6 / max 15) per far
-- scattare i giri con poche foto. Idempotente: non re-inserisce se già seminate.
do $$
declare
  v_entry uuid; v_owner uuid; v_title text; v_gal uuid; v_folder uuid; v_token uuid;
  v_have int; i int;
  moments text[] := array[
    'preparativi','preparativi','dettagli-sposa','primo-sguardo',
    'partecipazione','chiesa','chiesa','anelli','uscita','famiglia','famiglia',
    'coppia','coppia','coppia','aperitivo','ricevimento','ricevimento','brindisi',
    'torta','primo-ballo','festa','festa','festa','bouquet','chiusura',
    'coppia','chiesa','festa','famiglia','dettagli'];
begin
  -- 1) trova l'evento (title o client_name, base o PII split), il più recente
  -- NB: client_name/email sono in calendar_entries_private (split PII 20260610010000), non su calendar_entries.
  select ce.id, ce.owner_id, ce.title into v_entry, v_owner, v_title
  from public.calendar_entries ce
  where ce.title ilike '%zoe%cappello%'
     or exists (select 1 from public.calendar_entries_private p where p.entry_id = ce.id and p.client_name ilike '%zoe%cappello%')
  order by ce.created_at desc limit 1;

  if v_entry is null then
    -- fallback più largo: solo "zoe"
    select ce.id, ce.owner_id, ce.title into v_entry, v_owner, v_title
    from public.calendar_entries ce
    where ce.title ilike '%zoe%'
       or exists (select 1 from public.calendar_entries_private p where p.entry_id = ce.id and p.client_name ilike '%zoe%')
    order by ce.created_at desc limit 1;
  end if;

  if v_entry is null then
    raise notice 'SEED ZOE: evento non trovato (nessun calendar_entries con "zoe"). Niente seminato.';
    return;
  end if;
  raise notice 'SEED ZOE: evento "%" (entry=%, owner=%)', v_title, v_entry, v_owner;

  -- 2) galleria dell'evento (crea se manca)
  select id into v_gal from public.event_galleries where entry_id = v_entry limit 1;
  if v_gal is null then
    insert into public.event_galleries(entry_id, owner_id, title, couple_label)
      values (v_entry, v_owner, 'Le foto di Zoe', 'Zoe & Cappello') returning id into v_gal;
    raise notice 'SEED ZOE: creata galleria %', v_gal;
  else
    update public.event_galleries set couple_label = coalesce(couple_label, 'Zoe & Cappello') where id = v_gal;
  end if;
  select share_token into v_token from public.event_galleries where id = v_gal;

  -- 3) cartella LAVORO_INTERO (le foto degli sposi), condivisa
  select id into v_folder from public.gallery_folders where gallery_id = v_gal and level = 'LAVORO_INTERO' limit 1;
  if v_folder is null then
    insert into public.gallery_folders(gallery_id, entry_id, name, level, shared, sort_order)
      values (v_gal, v_entry, 'Album completo', 'LAVORO_INTERO', true, 0) returning id into v_folder;
    raise notice 'SEED ZOE: creata cartella LAVORO_INTERO %', v_folder;
  else
    update public.gallery_folders set shared = true where id = v_folder;
  end if;

  -- 4) foto di prova (idempotente: salta se già presenti)
  select count(*) into v_have from public.gallery_media where folder_id = v_folder and source_name like 'zoe-test-%';
  if v_have = 0 then
    for i in 1..30 loop
      insert into public.gallery_media(folder_id, gallery_id, entry_id, drive_file_id, thumbnail_link, media_type, album_moment, source_name)
      values (v_folder, v_gal, v_entry,
              'demo-zoe-' || i,
              'https://picsum.photos/seed/zoe' || i || '/900/1200',
              'PHOTO', moments[i], 'zoe-test-' || lpad(i::text, 2, '0') || '.jpg');
    end loop;
    raise notice 'SEED ZOE: inserite 30 foto di prova nella cartella %', v_folder;
  else
    raise notice 'SEED ZOE: già presenti % foto di prova, non ne aggiungo', v_have;
  end if;

  -- 5) stato selezione azzerato con soglie da test (min 6 / max 15) per far scattare i giri
  delete from public.gallery_selection_decisions where gallery_id = v_gal;
  insert into public.gallery_selection(gallery_id, entry_id, round, status, target_min, target_max)
    values (v_gal, v_entry, 1, 'ACTIVE', 6, 15)
    on conflict (gallery_id) do update set round = 1, status = 'ACTIVE', target_min = 6, target_max = 15, submitted_at = null, updated_at = now();

  raise notice '==================================================';
  raise notice 'SEED ZOE PRONTO. Link selezione:  /g/%', v_token;
  raise notice '  galleria:   /g/%', v_token;
  raise notice '  swipe:      /g/%/selezione', v_token;
  raise notice '  soglie test: min 6 / max 15 · 30 foto';
  raise notice '==================================================';
end $$;
