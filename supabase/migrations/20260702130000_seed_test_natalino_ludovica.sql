-- SEED DI TEST: album "TEST Natalino e Ludovica" con foto SELEZIONATE ma NON impaginate, così si
-- prova l'impaginazione AI (pulsante "Impagina con AI"). Idempotente. NON crea tavole/pagine.
--
-- Owner = account del fotografo Giovanni (Gisko): risolto per email o brand. Se non lo trova, FALLISCE
-- con un messaggio chiaro (così non semino mai dentro l'account sbagliato di un utente reale).
-- Foto = placeholder pubblici (picsum), con drive_file_id 'demo-...' (non-Drive → l'app usa il
-- thumbnail_link). 3 foto sono volutamente piccole per far scattare anche il badge "bassa risoluzione".
do $$
declare
  v_pid uuid;
  v_event uuid := gen_random_uuid();
  v_gal uuid := gen_random_uuid();
  v_folder uuid := gen_random_uuid();
  r record;
  i int := 0;
  v_w int; v_h int; v_seed text; v_o text; v_low boolean;
begin
  -- 1) OWNER (fotografo Giovanni): email di sistema o brand Gisko / cognome. Priorità all'email.
  select p.id into v_pid
    from public.profiles p
    left join auth.users u on u.id = p.id
   where u.email = 'giovanni.scozzafava@gmail.com'
      or p.business_name ilike '%gisko%'
      or p.full_name ilike '%scozzafava%'
   order by (u.email = 'giovanni.scozzafava@gmail.com') desc nulls last
   limit 1;
  if v_pid is null then
    -- NON fatale: su ambienti dove l'account di Giovanni non esiste il seed si salta senza rompere
    -- il push. Se succede in prod, mi passa l'email di login e ri-eseguo puntando a quella.
    raise notice 'Seed TEST saltato: nessun account Giovanni (gmail/gisko/scozzafava).';
    return;
  end if;

  -- 2) IDEMPOTENZA: rimuovi un eventuale TEST precedente (cascata su gallery/foto/tavole)
  delete from public.calendar_entries where owner_id = v_pid and title = 'TEST Natalino e Ludovica';

  -- 3) EVENTO (matrimonio confermato, senza impaginazione)
  insert into public.calendar_entries(id, owner_id, title, date_from, date_to, status, event_kind, evento_stato, guest_count)
  values (v_event, v_pid, 'TEST Natalino e Ludovica', current_date + 400, current_date + 400, 'CONFERMATA', 'matrimonio', 'PIANIFICAZIONE', 90);

  insert into public.wedding_couple_members(entry_id, email, full_name, role) values
    (v_event, 'natalino@example.com',  'Natalino Esposito', 'SPOSO'),
    (v_event, 'ludovica@example.com',  'Ludovica Marino',   'SPOSA');

  -- 4) GALLERIA + cartella "lavoro intero"
  insert into public.event_galleries(id, entry_id, owner_id, title, kind)
  values (v_gal, v_event, v_pid, 'Album Natalino e Ludovica', 'MIXED');

  insert into public.gallery_folders(id, gallery_id, entry_id, name, level, shared, sort_order)
  values (v_folder, v_gal, v_event, 'Lavoro intero', 'LAVORO_INTERO', true, 0);

  -- 5) FOTO KEPT taggate per momento (racconto in ordine), orientamenti misti. NIENTE tavole.
  for r in
    select m.moment, m.dom_o, g.n
      from (values
        ('preparativi','P',4),('preparativi-sposo','P',3),('dettagli-sposa','S',3),
        ('primo-sguardo','P',2),('arrivo','L',3),('partecipazione','L',3),('chiesa','L',6),
        ('anelli','S',2),('uscita','L',2),('famiglia','L',4),('coppia','P',10),
        ('aperitivo','S',4),('tableau','S',2),('ricevimento','L',4),('brindisi','L',2),
        ('torta','S',2),('primo-ballo','P',2),('festa','L',4),('chiusura','L',2)
      ) as m(moment, dom_o, cnt),
      lateral generate_series(1, m.cnt) as g(n)
  loop
    i := i + 1;
    v_seed := 'natlud-' || i;
    v_low := i in (7, 27, 48);                        -- 3 foto volutamente a bassa risoluzione
    -- un po' di varietà: ogni 5ª foto inverte l'orientamento dominante del momento
    v_o := case when (i % 5) = 0 then (case r.dom_o when 'P' then 'L' when 'L' then 'P' else 'S' end) else r.dom_o end;
    if v_low then v_w := 500; v_h := 334;
    elsif v_o = 'P' then v_w := 1080; v_h := 1620;
    elsif v_o = 'S' then v_w := 1200; v_h := 1200;
    else v_w := 1620; v_h := 1080;
    end if;
    insert into public.gallery_media(folder_id, gallery_id, entry_id, drive_file_id, thumbnail_link, media_type, album_choice, album_moment, uploaded_by)
    values (v_folder, v_gal, v_event, 'demo-' || v_seed,
            'https://picsum.photos/seed/' || v_seed || '/' || v_w || '/' || v_h,
            'PHOTO', 'KEPT', r.moment, v_pid);
  end loop;

  raise notice 'Seed TEST Natalino e Ludovica: evento %, % foto KEPT, owner %', v_event, i, v_pid;
end $$;
