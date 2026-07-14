-- DRY-RUN finale sull'EVENTO DEMO reale di Baronella (quello che verrà mostrato): verifica che la
-- vista scelta sia popolata, simula la composizione completa (food cost + genera menù), poi
-- RIPORTA l'evento PRISTINO (nessun piatto confermato) per la demo dal vivo. Net-zero sull'evento.
do $$
declare
  v_loc uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27';
  v_entry uuid; v_menu uuid; v_unlocked boolean; v_r jsonb;
  v_prop int; v_dish int; v_anti uuid[]; v_primo uuid[]; v_sec uuid[]; v_cont uuid[]; v_dolce uuid[]; v_a int;
begin
  perform set_config('request.jwt.claim.sub', v_loc::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_loc::text,'role','authenticated')::text, true);

  select id into v_entry from public.calendar_entries where owner_id=v_loc and title='Matrimonio demo — Menù componibile' limit 1;
  if v_entry is null then raise notice 'DRYRUN: evento demo non trovato!'; return; end if;
  select id into v_menu from public.fb_menus where location_id=v_loc and name='La Baronella — Menu à la carte' limit 1;

  -- 1) la vista che vedrà la coppia è popolata?
  v_r := public.fb_event_choice_view(v_entry);
  select jsonb_array_length(coalesce(v_r->'proposte','[]'::jsonb)) into v_prop;
  select coalesce(sum(jsonb_array_length(coalesce(p->'piatti','[]'::jsonb))),0) into v_dish from jsonb_array_elements(coalesce(v_r->'proposte','[]'::jsonb)) p;
  begin v_unlocked := public.fb_menu_unlocked(v_entry); exception when others then v_unlocked := null; end;
  raise notice 'DRYRUN 1 · vista coppia: proposte=%, piatti totali=%, sbloccato=% (vincoli su prima proposta: %)',
    v_prop, v_dish, v_unlocked, (select p->'vincoli' from jsonb_array_elements(coalesce(v_r->'proposte','[]'::jsonb)) p limit 1);

  -- 2) simulo la composizione completa (come farà agli sposi)
  select array_agg(id order by sort_order) into v_anti  from public.fb_menu_items where menu_id=v_menu and course='ANTIPASTO';
  select array_agg(id order by sort_order) into v_primo from public.fb_menu_items where menu_id=v_menu and course='PRIMO';
  select array_agg(id order by sort_order) into v_sec   from public.fb_menu_items where menu_id=v_menu and course='SECONDO';
  select array_agg(id order by sort_order) into v_cont  from public.fb_menu_items where menu_id=v_menu and course='CONTORNO';
  select array_agg(id order by sort_order) into v_dolce from public.fb_menu_items where menu_id=v_menu and course='DOLCE';
  perform public.fb_dish_confirm(v_entry, v_anti[1], true);
  perform public.fb_dish_confirm(v_entry, v_anti[2], true);
  perform public.fb_dish_confirm(v_entry, v_primo[1], true);
  perform public.fb_dish_confirm(v_entry, v_sec[1], true);
  perform public.fb_dish_confirm(v_entry, v_cont[1], true);
  perform public.fb_dish_confirm(v_entry, v_dolce[1], true);

  v_r := public.fb_event_foodcost(v_entry);
  raise notice 'DRYRUN 2 · composto 6 piatti · food cost %/coperto su % coperti', v_r->>'cost_per_cover', v_r->>'coperti';
  v_r := public.fb_generate_event_menu(v_entry);
  raise notice 'DRYRUN 3 · genera menù -> % portate nel menù stampabile', v_r->>'inseriti';
  v_r := public.fb_event_menu_final(v_entry);
  raise notice 'DRYRUN 4 · menù finale (snapshot): % portate, divergenti=%',
    jsonb_array_length(coalesce(v_r->'piatti','[]'::jsonb)),
    (select count(*) from jsonb_array_elements(coalesce(v_r->'piatti','[]'::jsonb)) e where (e->>'diverge')::boolean);

  -- 3) RESET all'evento demo -> pristine per la demo dal vivo
  delete from public.fb_dish_passed_over where entry_id=v_entry;
  delete from public.fb_event_dish where entry_id=v_entry;
  delete from public.event_menu where entry_id=v_entry and notes='fb:auto';
  delete from public.fb_event_menus where entry_id=v_entry;
  select count(*) into v_a from public.fb_event_dish where entry_id=v_entry;
  raise notice 'DRYRUN 5 · evento demo riportato PRISTINO: piatti confermati residui=% (atteso 0). Pronto per la demo.', v_a;
end $$;
