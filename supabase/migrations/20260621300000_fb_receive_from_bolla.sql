-- Ricezione da BOLLA fornitore: prende le righe estratte (da fb-read-bolla / Claude) e crea i lotti
-- in magazzino (match ingrediente per nome, altrimenti lo crea) + movimenti di CARICO. Best-effort
-- per riga (una riga sporca non blocca le altre). SECURITY DEFINER ma scrive solo sulla location.
create or replace function public.fb_receive_from_bolla(p_lines jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid := auth.uid(); v_wh uuid; r jsonb; v_ing uuid; v_unit text; v_factor numeric; v_qty numeric; v_cost numeric; v_lot uuid; n int := 0;
begin
  if v_loc is null then return jsonb_build_object('error','auth_required'); end if;
  if not exists (select 1 from public.profiles where id = v_loc and role in ('LOCATION','ADMIN')) then return jsonb_build_object('error','forbidden'); end if;
  select id into v_wh from public.fb_warehouses where location_id = v_loc and is_default limit 1;
  if v_wh is null then insert into public.fb_warehouses(location_id, name, is_default) values (v_loc, 'Magazzino', true) returning id into v_wh; end if;

  for r in select * from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) loop
    begin
      if coalesce(btrim(r->>'nome'), '') = '' or (r->>'quantita') is null then continue; end if;
      v_unit := upper(coalesce(r->>'unita', 'KG'));
      if v_unit in ('KG','G','GR') then v_unit := 'G'; v_factor := 1000;
      elsif v_unit in ('L','ML','LT') then v_unit := 'ML'; v_factor := 1000;
      else v_unit := 'PZ'; v_factor := 1; end if;

      select id into v_ing from public.fb_ingredients where location_id = v_loc and lower(name) = lower(btrim(r->>'nome')) limit 1;
      if v_ing is null then
        insert into public.fb_ingredients(location_id, name, stock_unit, category) values (v_loc, btrim(r->>'nome'), v_unit, 'Da bolla') returning id into v_ing;
      end if;

      v_qty := (r->>'quantita')::numeric * v_factor;
      v_cost := coalesce(nullif(r->>'prezzo_unitario_eur','')::numeric, 0) / v_factor;
      insert into public.fb_stock_lots(location_id, ingredient_id, warehouse_id, lot_code, qty_received, qty_remaining, unit_cost, expiry_date)
        values (v_loc, v_ing, v_wh, nullif(btrim(r->>'lotto'),''), v_qty, v_qty, v_cost, nullif(btrim(r->>'scadenza'),'')::date)
        returning id into v_lot;
      insert into public.fb_stock_movements(location_id, ingredient_id, warehouse_id, lot_id, type, qty, unit_cost, reason)
        values (v_loc, v_ing, v_wh, v_lot, 'CARICO', v_qty, v_cost, 'da bolla fornitore');
      n := n + 1;
    exception when others then raise notice 'riga bolla saltata: %', sqlerrm;
    end;
  end loop;
  return jsonb_build_object('ok', true, 'lotti', n);
end$$;
grant execute on function public.fb_receive_from_bolla(jsonb) to authenticated;
