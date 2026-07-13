-- FIX robustezza + ritocco demo + ri-test.
-- (1) fb_dish_confirm: tiebreak deterministico (id) nella scelta della "vittima" del vincolo max,
--     così anche con confirmed_at identico (stessa tx) la sostituzione è deterministica.
-- (2) riduce la giacenza demo Baronella per mostrare il mix "in casa vs da comprare".
-- (3) ri-test max=2 (conta il TOTALE scarti) + fabbisogno netto con mix.

-- (1) --------------------------------------------------------------------------------------
create or replace function public.fb_dish_confirm(p_entry uuid, p_menu_item_id uuid, p_on boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_menu uuid; v_cov int; v_course text; v_max int; v_victims uuid[];
begin
  select owner_id, coalesce(guest_count,0) into v_owner, v_cov from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden'); end if;
  select menu_id, course into v_menu, v_course from public.fb_menu_items where id = p_menu_item_id;
  if v_menu is null then return jsonb_build_object('error','dish_not_found'); end if;
  if p_on then
    insert into public.fb_event_dish(entry_id, menu_item_id, confirmed_by, snapshot)
      values (p_entry, p_menu_item_id, auth.uid(), public.fb_menu_item_snapshot(p_menu_item_id))
      on conflict (entry_id, menu_item_id) do update
        set confirmed_by = excluded.confirmed_by,
            snapshot = coalesce(public.fb_event_dish.snapshot, excluded.snapshot);
    select coalesce(max_select, 1) into v_max from public.fb_menu_courses where menu_id = v_menu and course = v_course;
    if v_max is null then v_max := 1; end if;
    select array_agg(mi2) into v_victims from (
      select ed.menu_item_id as mi2 from public.fb_event_dish ed
      join public.fb_menu_items mi on mi.id = ed.menu_item_id
      where ed.entry_id = p_entry and mi.menu_id = v_menu and mi.course = v_course and ed.menu_item_id <> p_menu_item_id
      order by ed.confirmed_at desc, ed.id desc offset greatest(v_max - 1, 0)) t;
    if v_victims is not null and array_length(v_victims, 1) > 0 then
      insert into public.fb_dish_passed_over(entry_id, menu_item_id, chosen_instead)
        select p_entry, unnest(v_victims), p_menu_item_id;
      delete from public.fb_event_dish where entry_id = p_entry and menu_item_id = any(v_victims);
    end if;
    if v_cov = 0 then select greatest(count(*),1) into v_cov from public.event_guests g
       where g.entry_id = p_entry and g.rsvp = 'YES' and g.age_group <> 'INFANT'; end if;
    if v_cov = 0 then v_cov := 100; end if;
    if not exists (select 1 from public.fb_event_menus where entry_id = p_entry and menu_id = v_menu) then
      insert into public.fb_event_menus(location_id, entry_id, menu_id, covers) values (v_owner, p_entry, v_menu, v_cov);
    end if;
  else
    delete from public.fb_event_dish where entry_id = p_entry and menu_item_id = p_menu_item_id;
  end if;
  return jsonb_build_object('ok', true, 'confermato', p_on);
end$$;
grant execute on function public.fb_dish_confirm(uuid, uuid, boolean) to authenticated;

-- (2) giacenza demo più bassa -> mix "in casa vs da comprare"
update public.fb_stock_lots
   set qty_received = case (select stock_unit from public.fb_ingredients i where i.id = ingredient_id) when 'PZ' then 20 when 'ML' then 1500 else 1500 end,
       qty_remaining = case (select stock_unit from public.fb_ingredients i where i.id = ingredient_id) when 'PZ' then 20 when 'ML' then 1500 else 1500 end
 where location_id = 'c117d389-0626-4a9e-8dd4-b2751902df27' and lot_code like 'DEMO-%';

-- (3) ri-test -------------------------------------------------------------------------------
do $$
declare v_loc uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27'; v_menu uuid; v_entry uuid; v_cont uuid[]; v_a int; v_b int;
begin
  perform set_config('request.jwt.claim.sub', v_loc::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_loc::text,'role','authenticated')::text, true);
  select id into v_menu from public.fb_menus where location_id=v_loc and name='La Baronella — Menu à la carte' limit 1;
  insert into public.calendar_entries(owner_id, title, date_from, date_to, status, guest_count)
    values (v_loc,'RETEST usa-e-getta', now()+interval '180 days', now()+interval '180 days','IN_TRATTATIVA',100) returning id into v_entry;
  insert into public.fb_menu_proposals(location_id, entry_id, menu_id) values (v_loc, v_entry, v_menu) on conflict do nothing;
  select array_agg(id order by sort_order) into v_cont from public.fb_menu_items where menu_id=v_menu and course='CONTORNO';

  perform public.fb_dish_confirm(v_entry, v_cont[1], true);
  perform public.fb_dish_confirm(v_entry, v_cont[2], true);
  perform public.fb_dish_confirm(v_entry, v_cont[3], true);
  select count(*) into v_a from public.fb_event_dish ed join public.fb_menu_items mi on mi.id=ed.menu_item_id where ed.entry_id=v_entry and mi.course='CONTORNO';
  select count(*) into v_b from public.fb_dish_passed_over where entry_id=v_entry;
  raise notice 'RETEST B · max=2: contorni confermati=% (atteso 2), TOTALE scarti registrati=% (atteso 1)', v_a, v_b;

  -- confermo un po' di piatti e guardo il fabbisogno netto col mix di scorte
  perform public.fb_dish_confirm(v_entry, (select id from public.fb_menu_items where menu_id=v_menu and course='PRIMO' order by sort_order limit 1), true);
  perform public.fb_dish_confirm(v_entry, (select id from public.fb_menu_items where menu_id=v_menu and course='SECONDO' order by sort_order limit 1), true);
  select count(*), count(*) filter (where qty_needed>0) into v_a, v_b
    from public.fb_compute_requirements((now()+interval '179 days')::date,(now()+interval '181 days')::date, true);
  raise notice 'RETEST G · fabbisogno netto col mix: % ingredienti, di cui % DA COMPRARE (>0)', v_a, v_b;

  delete from public.calendar_entries where id=v_entry;
  raise notice 'RETEST · pulito. Net-zero.';
end $$;
