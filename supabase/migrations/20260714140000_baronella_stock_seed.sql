-- Seed giacenza demo per La Baronella: un lotto per ingrediente (copertura PARZIALE), così il
-- foglio servizio/dispensa mostra "già in casa vs da comprare". Idempotente (solo dove manca).
do $$
declare v_loc uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27'; v_wh uuid; r record;
begin
  select id into v_wh from public.fb_warehouses where location_id = v_loc and is_default limit 1;
  if v_wh is null then
    insert into public.fb_warehouses(location_id, name, is_default) values (v_loc, 'Magazzino', true) returning id into v_wh;
  end if;

  for r in
    select i.id, i.stock_unit,
      coalesce((select cv.cost_per_unit from public.fb_ingredient_cost_versions cv
                where cv.ingredient_id = i.id and cv.valid_until is null order by cv.valid_from desc limit 1), 0.01) as cost
    from public.fb_ingredients i
    where i.location_id = v_loc and i.is_active
      and not exists (select 1 from public.fb_stock_lots l where l.ingredient_id = i.id and l.qty_remaining > 0)
  loop
    insert into public.fb_stock_lots(location_id, ingredient_id, warehouse_id, lot_code, qty_received, qty_remaining, unit_cost, expiry_date)
    values (v_loc, r.id, v_wh, 'DEMO-' || substr(r.id::text,1,8),
      case r.stock_unit when 'PZ' then 150 when 'ML' then 6000 else 6000 end,
      case r.stock_unit when 'PZ' then 150 when 'ML' then 6000 else 6000 end,
      r.cost, (now() + interval '90 days')::date);
  end loop;
  raise notice 'Seed giacenza Baronella: lotti demo inseriti dove mancavano.';
end $$;
