-- VERIFICA end-to-end "Scelte" v4 (piatto → snapshot → food cost → esplosione → dispensa → menù).
-- Impersona la Baronella, esegue la cascata su un evento USA-E-GETTA e stampa ogni passo con
-- RAISE NOTICE, poi ELIMINA l'evento (net-zero: nessun dato reale toccato, nessuna giacenza consumata).
do $$
declare
  v_loc uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27';
  v_menu uuid; v_entry uuid;
  v_anti uuid[]; v_primo uuid[]; v_sec uuid[]; v_cont uuid[]; v_dolce uuid[];
  v_r jsonb; v_n int; v_cost numeric; v_ing int; v_po int;
begin
  perform set_config('request.jwt.claim.sub', v_loc::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_loc::text, 'role', 'authenticated')::text, true);

  select id into v_menu from public.fb_menus where location_id = v_loc and name = 'La Baronella — Menu à la carte' limit 1;
  if v_menu is null then raise notice 'VERIFY: menu à la carte assente, salto.'; return; end if;

  insert into public.calendar_entries(owner_id, title, date_from, date_to, status, guest_count)
    values (v_loc, 'VERIFY Scelte v4 (usa-e-getta)', now() + interval '160 days', now() + interval '160 days', 'IN_TRATTATIVA', 100)
    returning id into v_entry;
  insert into public.fb_menu_proposals(location_id, entry_id, menu_id) values (v_loc, v_entry, v_menu) on conflict do nothing;

  select array_agg(id order by sort_order) into v_anti  from public.fb_menu_items where menu_id = v_menu and course = 'ANTIPASTO';
  select array_agg(id order by sort_order) into v_primo from public.fb_menu_items where menu_id = v_menu and course = 'PRIMO';
  select array_agg(id order by sort_order) into v_sec   from public.fb_menu_items where menu_id = v_menu and course = 'SECONDO';
  select array_agg(id order by sort_order) into v_cont  from public.fb_menu_items where menu_id = v_menu and course = 'CONTORNO';
  select array_agg(id order by sort_order) into v_dolce from public.fb_menu_items where menu_id = v_menu and course = 'DOLCE';
  raise notice 'VERIFY 0 · paniere: % antipasti, % primi, % secondi, % contorni, % dolci',
    coalesce(array_length(v_anti,1),0), coalesce(array_length(v_primo,1),0), coalesce(array_length(v_sec,1),0), coalesce(array_length(v_cont,1),0), coalesce(array_length(v_dolce,1),0);

  -- 1) COMPOSIZIONE: 2 antipasti + 1 primo + 1 secondo + 1 contorno + 1 dolce
  perform public.fb_dish_confirm(v_entry, v_anti[1], true);
  perform public.fb_dish_confirm(v_entry, v_anti[2], true);
  perform public.fb_dish_confirm(v_entry, v_primo[1], true);
  perform public.fb_dish_confirm(v_entry, v_sec[1], true);
  perform public.fb_dish_confirm(v_entry, v_cont[1], true);
  perform public.fb_dish_confirm(v_entry, v_dolce[1], true);
  select count(*), count(*) filter (where snapshot is not null) into v_n, v_ing from public.fb_event_dish where entry_id = v_entry;
  raise notice 'VERIFY 1 · confermati: % piatti, % con snapshot immutabile (atteso 6 e 6)', v_n, v_ing;
  select snapshot->>'nome', snapshot->>'food_cost' into v_r from (select snapshot from public.fb_event_dish where entry_id=v_entry and menu_item_id=v_primo[1]) s;
  raise notice 'VERIFY 1b · snapshot primo: nome=%, food_cost=% (a costi correnti)',
    (select snapshot->>'nome' from public.fb_event_dish where entry_id=v_entry and menu_item_id=v_primo[1]),
    (select snapshot->>'food_cost' from public.fb_event_dish where entry_id=v_entry and menu_item_id=v_primo[1]);

  -- 2) VINCOLO MAX (PRIMO 1/1): scegliere un 2° primo sostituisce il 1° e registra lo scarto
  if coalesce(array_length(v_primo,1),0) >= 2 then
    perform public.fb_dish_confirm(v_entry, v_primo[2], true);
    select count(*) into v_n from public.fb_event_dish ed join public.fb_menu_items mi on mi.id=ed.menu_item_id
      where ed.entry_id=v_entry and mi.course='PRIMO';
    select count(*) into v_ing from public.fb_dish_passed_over where entry_id=v_entry and menu_item_id=v_primo[1] and chosen_instead=v_primo[2];
    raise notice 'VERIFY 2 · dopo 2° primo: primi confermati=% (atteso 1), scarto registrato (1°→2°)=% (atteso 1)', v_n, v_ing;
  end if;

  -- 3) FOOD COST per coperto (sui confermati)
  v_r := public.fb_event_foodcost(v_entry);
  raise notice 'VERIFY 3 · food cost: %/coperto su % coperti (% totali), piatti=%',
    v_r->>'cost_per_cover', v_r->>'coperti', v_r->>'total_cost', v_r->>'piatti';

  -- 4) ESPLOSIONE piatto→ingredienti (motore fabbisogno)
  select count(*) into v_ing from public.fb_explode_event(v_entry, 100::numeric);
  raise notice 'VERIFY 4 · esplosione: % ingredienti distinti a fabbisogno (100 coperti)', v_ing;

  -- 5) DISPENSA / foglio servizio (piatti + fabbisogno + magazzino a lotti)
  v_r := public.fb_event_sheet(v_entry);
  raise notice 'VERIFY 5 · foglio servizio: piatti=%, righe fabbisogno=%, righe magazzino=%',
    jsonb_array_length(coalesce(v_r->'piatti','[]'::jsonb)), jsonb_array_length(coalesce(v_r->'fabbisogno','[]'::jsonb)), jsonb_array_length(coalesce(v_r->'magazzino','[]'::jsonb));

  -- 6) GENERA MENÙ stampabile (dallo snapshot → event_menu)
  v_r := public.fb_generate_event_menu(v_entry);
  select count(*) into v_n from public.event_menu where entry_id=v_entry and notes='fb:auto';
  raise notice 'VERIFY 6 · genera menù: inseriti=%, righe event_menu(fb:auto)=% (attese 5)', v_r->>'inseriti', v_n;

  -- 7) MENÙ FINALE da snapshot + badge divergenza
  v_r := public.fb_event_menu_final(v_entry);
  raise notice 'VERIFY 7 · menù finale: % portate dallo snapshot; divergenti ora=%',
    jsonb_array_length(coalesce(v_r->'piatti','[]'::jsonb)),
    (select count(*) from jsonb_array_elements(coalesce(v_r->'piatti','[]'::jsonb)) e where (e->>'diverge')::boolean);

  -- 8) FABBISOGNO NETTO vs GIACENZA (dispensa, finestra dell'evento)
  begin
    v_r := public.fb_compute_requirements((now()+interval '159 days')::date, (now()+interval '161 days')::date, true);
    raise notice 'VERIFY 8 · fabbisogno netto vs giacenza calcolato (dispensa) ok';
  exception when others then raise notice 'VERIFY 8 · fb_compute_requirements: % (non bloccante)', sqlerrm; end;

  -- CLEANUP: elimina l'evento usa-e-getta (cascade: dish/snapshot/scarti/proposte/event_menu/fb_event_menus)
  delete from public.calendar_entries where id = v_entry;
  raise notice 'VERIFY · evento usa-e-getta eliminato: nessun dato reale toccato.';
end $$;
