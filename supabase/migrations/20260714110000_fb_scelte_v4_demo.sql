-- DEMO "Scelte" v4: rende dimostrabile la composizione lato coppia.
-- Attacca il paniere à la carte della Baronella a un evento demo (creato se manca) come
-- PROPOSTA, e imposta i vincoli per portata. Idempotente. Nessun dato reale toccato.
do $$
declare
  v_loc  uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27';  -- La Baronella (LOCATION)
  v_menu uuid;
  v_entry uuid;
begin
  select id into v_menu from public.fb_menus
   where location_id = v_loc and name = 'La Baronella — Menu à la carte' limit 1;
  if v_menu is null then
    raise notice 'Menu à la carte Baronella non trovato: salto il seed demo.'; return;
  end if;

  -- evento demo dedicato (riusa se già creato)
  select id into v_entry from public.calendar_entries
   where owner_id = v_loc and title = 'Matrimonio demo — Menù componibile' limit 1;
  if v_entry is null then
    insert into public.calendar_entries(owner_id, title, date_from, date_to, status, guest_count)
      values (v_loc, 'Matrimonio demo — Menù componibile',
              (now() + interval '150 days'), (now() + interval '150 days'), 'IN_TRATTATIVA', 120)
      returning id into v_entry;
  end if;

  -- proponi il paniere all'evento (la vista scelta legge da qui)
  insert into public.fb_menu_proposals(location_id, entry_id, menu_id)
    values (v_loc, v_entry, v_menu)
    on conflict (entry_id, menu_id) do nothing;

  -- vincoli per portata (esempio del brief): la coppia sceglie tra le alternative
  insert into public.fb_menu_courses(menu_id, course, min_select, max_select) values
    (v_menu, 'ANTIPASTO', 2, 3),
    (v_menu, 'PRIMO',     1, 1),
    (v_menu, 'SECONDO',   1, 1),
    (v_menu, 'CONTORNO',  1, 2),
    (v_menu, 'DOLCE',     1, 1)
  on conflict (menu_id, course) do update set min_select = excluded.min_select, max_select = excluded.max_select;

  raise notice 'Demo Scelte v4 pronta: evento % (paniere à la carte + vincoli portata).', v_entry;
end $$;
