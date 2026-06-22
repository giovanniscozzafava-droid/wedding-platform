-- SIMULAZIONE DI STAGIONE su TUTTI i matrimoni confermati di una location: aggancia menu+coperti,
-- e per ogni matrimonio (in ordine di data) fa approvvigionamento NETTO (compra solo il mancante,
-- sfruttando gli avanzi del matrimonio precedente) + consumo FEFO. Mostra spesa e food cost per evento.

-- Approvvigionamento di un singolo evento: fabbisogno NETTO -> crea i lotti (CARICO). Ritorna la spesa.
create or replace function public.fb_procure_event(p_entry uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v_loc uuid; v_wh uuid; v_date date; r record; v_packs numeric; v_lotqty numeric; v_unit numeric; v_spend numeric := 0; v_lot uuid;
begin
  select owner_id, date_from::date into v_loc, v_date from public.calendar_entries where id = p_entry;
  if v_loc is null then return 0; end if;
  select id into v_wh from public.fb_warehouses where location_id = v_loc and is_default limit 1;
  if v_wh is null then insert into public.fb_warehouses(location_id, name, is_default) values (v_loc, 'Magazzino', true) returning id into v_wh; end if;
  for r in
    with needs as (
      select e.ingredient_id, sum(e.qty_stock_unit) as qty
      from public.fb_event_menus em
      join public.calendar_entries ce on ce.id = em.entry_id
      cross join lateral public.fb_explode_menu(em.menu_id, coalesce(em.covers, ce.guest_count, 0)::numeric) e
      where em.entry_id = p_entry group by e.ingredient_id
    ),
    net as (
      select n.ingredient_id,
        greatest(0, n.qty - coalesce((select sum(qty_remaining) from public.fb_stock_lots l where l.ingredient_id = n.ingredient_id and l.qty_remaining > 0), 0)) as q
      from needs n
    )
    select x.ingredient_id, x.q, sp.pack_qty_stock_unit pq, sp.pack_price pp, sp.supplier_id sup
    from net x
    join lateral (
      select pack_qty_stock_unit, pack_price, supplier_id from public.fb_supplier_products sp
      where sp.ingredient_id = x.ingredient_id and sp.is_active
      order by sp.is_preferred desc, sp.pack_price / nullif(sp.pack_qty_stock_unit, 0) limit 1
    ) sp on true
    where x.q > 0
  loop
    v_packs := ceil(r.q / nullif(r.pq, 0));
    v_lotqty := v_packs * r.pq;
    v_unit := r.pp / nullif(r.pq, 0);
    v_spend := v_spend + v_packs * r.pp;
    insert into public.fb_stock_lots(location_id, ingredient_id, warehouse_id, lot_code, qty_received, qty_remaining, unit_cost, expiry_date, supplier_id)
      values (v_loc, r.ingredient_id, v_wh, 'PO-' || to_char(v_date, 'YYMMDD'), v_lotqty, v_lotqty, v_unit, v_date + 3, r.sup) returning id into v_lot;
    insert into public.fb_stock_movements(location_id, ingredient_id, warehouse_id, lot_id, type, qty, unit_cost, reason)
      values (v_loc, r.ingredient_id, v_wh, v_lot, 'CARICO', v_lotqty, v_unit, 'approvvigionamento evento');
  end loop;
  return round(v_spend, 2);
end$$;
grant execute on function public.fb_procure_event(uuid) to authenticated;

-- Fa girare l'intera stagione: assegna menu+coperti ai matrimoni confermati e cicla procure+consume.
create or replace function public.fb_run_season()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid := auth.uid(); v_full uuid; v_rid uuid; r record; rn int := 0;
        v_spend numeric; v_fc numeric; res jsonb := '[]'::jsonb;
        tot_spend numeric := 0; tot_cov int := 0; tot_fc numeric := 0;
        covers int[] := array[120, 150, 90, 200];
begin
  if v_loc is null then return jsonb_build_object('error','auth'); end if;
  select id into v_full from public.fb_menus where location_id = v_loc and name = 'Matrimonio Lenza — Completo';
  if v_full is null then return jsonb_build_object('error','seed_first'); end if;

  -- menu ridotto (senza secondo) — get-or-create
  select id into v_rid from public.fb_menus where location_id = v_loc and name = 'Matrimonio — Menu Ridotto';
  if v_rid is null then
    insert into public.fb_menus(location_id, name, basis) values (v_loc, 'Matrimonio — Menu Ridotto', 'PER_COPERTO') returning id into v_rid;
    insert into public.fb_menu_items(menu_id, recipe_id, qty_per_cover)
      select v_rid, rc.id, x.qpc from (values
        ('Tagliere salumi e formaggi',1),('Crostino di salmone',1),('Crostino di nduja',1),('Frittura di mare',1),
        ('Fileja alla nduja',1),('Cassata di ricotta',1),('Brindisi',1),('Caffe espresso',1)
      ) x(rec, qpc) join public.fb_recipes rc on rc.name = x.rec and rc.location_id = v_loc;
  end if;

  -- reset stagione (stock + agganci)
  delete from public.fb_stock_movements where location_id = v_loc;
  delete from public.fb_stock_lots where location_id = v_loc;
  delete from public.fb_event_menus where location_id = v_loc;

  -- assegna menu + coperti ai matrimoni confermati (ordine di data; il 3o a menu ridotto)
  for r in select id from public.calendar_entries where owner_id = v_loc and status = 'CONFERMATA' order by date_from loop
    rn := rn + 1;
    update public.calendar_entries set guest_count = covers[least(rn,4)] where id = r.id;
    insert into public.fb_event_menus(location_id, entry_id, menu_id, covers)
      values (v_loc, r.id, case when rn = 3 then v_rid else v_full end, covers[least(rn,4)]);
  end loop;

  -- gira la stagione: per ogni matrimonio, approvvigiona netto + consuma FEFO
  for r in
    select id, date_from, guest_count from public.calendar_entries
    where owner_id = v_loc and status = 'CONFERMATA' and id in (select entry_id from public.fb_event_menus)
    order by date_from
  loop
    v_spend := public.fb_procure_event(r.id);
    perform public.fb_consume_event(r.id);
    select coalesce(sum(-qty * unit_cost), 0) into v_fc from public.fb_stock_movements where event_id = r.id and type = 'SCARICO';
    res := res || jsonb_build_object('data', r.date_from::date, 'coperti', r.guest_count, 'spesa', v_spend,
                                     'food_cost', round(v_fc, 2), 'fc_coperto', round(v_fc / nullif(r.guest_count,0), 2));
    tot_spend := tot_spend + v_spend; tot_cov := tot_cov + coalesce(r.guest_count, 0); tot_fc := tot_fc + v_fc;
  end loop;

  return jsonb_build_object('eventi', res, 'tot_spesa', round(tot_spend,2), 'tot_coperti', tot_cov,
                            'tot_food_cost', round(tot_fc,2), 'avanzo_magazzino', round((tot_spend - tot_fc),2));
end$$;
grant execute on function public.fb_run_season() to authenticated;
