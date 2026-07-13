-- TEST AVVERSARIALE "Scelte" v4 (net-zero, evento usa-e-getta): edge case + RLS + immutabilità.
-- Ogni asserzione stampata con RAISE NOTICE. Se un'attesa non torna → c'è un bug da fixare.
do $$
declare
  v_loc  uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27';
  v_alien uuid := '00000000-0000-0000-0000-0000000000aa';   -- utente non proprietario
  v_menu uuid; v_entry uuid;
  v_primo uuid[]; v_sec uuid[]; v_cont uuid[]; v_rec uuid; v_name text;
  v_r jsonb; v_n int; v_diverge boolean; v_nome_snap text; v_nome_vivo text; v_err text; v_a int; v_b int;
begin
  perform set_config('request.jwt.claim.sub', v_loc::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_loc::text, 'role','authenticated')::text, true);
  select id into v_menu from public.fb_menus where location_id=v_loc and name='La Baronella — Menu à la carte' limit 1;
  if v_menu is null then raise notice 'ADV: menu assente, salto.'; return; end if;

  insert into public.calendar_entries(owner_id, title, date_from, date_to, status, guest_count)
    values (v_loc, 'ADV Scelte v4 (usa-e-getta)', now()+interval '170 days', now()+interval '170 days', 'IN_TRATTATIVA', 80)
    returning id into v_entry;
  insert into public.fb_menu_proposals(location_id, entry_id, menu_id) values (v_loc, v_entry, v_menu) on conflict do nothing;
  select array_agg(id order by sort_order) into v_primo from public.fb_menu_items where menu_id=v_menu and course='PRIMO';
  select array_agg(id order by sort_order) into v_sec   from public.fb_menu_items where menu_id=v_menu and course='SECONDO';
  select array_agg(id order by sort_order) into v_cont  from public.fb_menu_items where menu_id=v_menu and course='CONTORNO';

  -- A) IMMUTABILITÀ SNAPSHOT + BADGE DIVERGENZA
  perform public.fb_dish_confirm(v_entry, v_primo[1], true);
  select recipe_id into v_rec from public.fb_menu_items where id=v_primo[1];
  select name into v_name from public.fb_recipes where id=v_rec;                 -- nome originale
  update public.fb_recipes set name = v_name || ' [MOD]' where id=v_rec;          -- lo chef cambia il piatto DOPO
  v_r := public.fb_event_menu_final(v_entry);
  select (e->>'diverge')::boolean, e->>'nome', e->>'nome_vivo' into v_diverge, v_nome_snap, v_nome_vivo
    from jsonb_array_elements(v_r->'piatti') e where (e->>'menu_item_id')::uuid = v_primo[1];
  raise notice 'ADV A · immutabilità: snapshot=%, vivo=%, diverge=% (atteso: nomi diversi, diverge=t)', v_nome_snap, v_nome_vivo, v_diverge;
  update public.fb_recipes set name = v_name where id=v_rec;                       -- RIPRISTINO

  -- B) VINCOLO MAX=2 (CONTORNO): 3 scelte -> tiene 2 (più recenti), 1 scarto
  perform public.fb_dish_confirm(v_entry, v_cont[1], true);
  perform public.fb_dish_confirm(v_entry, v_cont[2], true);
  perform public.fb_dish_confirm(v_entry, v_cont[3], true);
  select count(*) into v_a from public.fb_event_dish ed join public.fb_menu_items mi on mi.id=ed.menu_item_id
    where ed.entry_id=v_entry and mi.course='CONTORNO';
  select count(*) into v_b from public.fb_dish_passed_over where entry_id=v_entry and menu_item_id=v_cont[1];
  raise notice 'ADV B · max=2 contorni: confermati=% (atteso 2), scarto 1° contorno=% (atteso 1)', v_a, v_b;

  -- C) DE-CONFERMA: on poi off -> riga sparita
  perform public.fb_dish_confirm(v_entry, v_sec[1], true);
  select count(*) into v_a from public.fb_event_dish where entry_id=v_entry and menu_item_id=v_sec[1];
  perform public.fb_dish_confirm(v_entry, v_sec[1], false);
  select count(*) into v_b from public.fb_event_dish where entry_id=v_entry and menu_item_id=v_sec[1];
  raise notice 'ADV C · de-conferma: dopo on=% (atteso 1), dopo off=% (atteso 0)', v_a, v_b;

  -- D) GENERA MENÙ idempotente: due run -> stesso conteggio
  perform public.fb_generate_event_menu(v_entry);
  select count(*) into v_a from public.event_menu where entry_id=v_entry and notes='fb:auto';
  perform public.fb_generate_event_menu(v_entry);
  select count(*) into v_b from public.event_menu where entry_id=v_entry and notes='fb:auto';
  raise notice 'ADV D · genera menù idempotente: run1=%, run2=% (attesi uguali)', v_a, v_b;

  -- E) RLS: un utente NON proprietario non può confermare né leggere
  perform set_config('request.jwt.claim.sub', v_alien::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_alien::text, 'role','authenticated')::text, true);
  v_err := (public.fb_dish_confirm(v_entry, v_primo[2], true))->>'error';
  raise notice 'ADV E1 · confirm da estraneo: error=% (atteso forbidden)', v_err;
  v_err := (public.fb_event_choice_view(v_entry))->>'error';
  raise notice 'ADV E2 · choice_view da estraneo: error=% (atteso forbidden)', v_err;
  v_err := (public.fb_dish_set_photo(v_primo[1], 'https://x/y.jpg'))->>'error';
  raise notice 'ADV E3 · set_photo da estraneo: error=% (atteso forbidden)', v_err;
  perform set_config('request.jwt.claim.sub', v_loc::text, true);                  -- torno Baronella
  perform set_config('request.jwt.claims', json_build_object('sub', v_loc::text, 'role','authenticated')::text, true);

  -- verifica che l'estraneo NON abbia intaccato nulla
  select count(*) into v_a from public.fb_event_dish ed join public.fb_menu_items mi on mi.id=ed.menu_item_id where ed.entry_id=v_entry and mi.course='PRIMO';
  raise notice 'ADV E4 · primi confermati dopo tentativi estraneo=% (atteso 1: nessuna scrittura)', v_a;

  -- F) FOTO round-trip (owner): set -> choice_view mostra foto -> clear
  perform public.fb_dish_set_photo(v_primo[1], 'https://demo/img.jpg');
  select (e->>'foto') into v_nome_snap from jsonb_array_elements((public.fb_event_choice_view(v_entry))->'proposte') p,
     jsonb_array_elements(p->'piatti') e where (e->>'menu_item_id')::uuid=v_primo[1];
  raise notice 'ADV F · foto set -> choice_view foto=% (atteso https://demo/img.jpg)', v_nome_snap;
  perform public.fb_dish_set_photo(v_primo[1], null);                              -- azzero (piatto reale)

  -- G) fb_compute_requirements CHIAMATA CORRETTA (table), netto vs giacenza seedata
  select count(*), count(*) filter (where qty_needed > 0)
    into v_a, v_b
    from public.fb_compute_requirements((now()+interval '169 days')::date, (now()+interval '171 days')::date, true);
  raise notice 'ADV G · fabbisogno netto: % ingredienti in lista, di cui % da comprare (>0). Nessun errore json.', v_a, v_b;

  -- CLEANUP
  delete from public.calendar_entries where id=v_entry;
  raise notice 'ADV · evento usa-e-getta eliminato, nome ricetta ripristinato. Net-zero.';
end $$;
