-- FASE — Lista spesa PERSISTENTE per lo chef: genera ordini d'acquisto BOZZA dal fabbisogno netto
-- del periodo, uno per fornitore, con le righe (confezioni) e il totale. Le tabelle fb_purchase_orders/
-- _items esistono già; qui aggiungo la generazione. SECURITY INVOKER: RLS scopa a location = auth.uid()
-- (nessun leak cross-tenant), il chiamante inserisce solo nei propri ordini.

create or replace function public.fb_generate_purchase_orders(p_from date, p_to date)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_loc uuid := auth.uid(); r record; v_order uuid; v_cur uuid; v_ids uuid[] := '{}';
        v_orders int := 0; v_items int := 0; v_unmapped int;
begin
  if v_loc is null then return jsonb_build_object('error','forbidden'); end if;
  -- un ordine BOZZA per fornitore, righe = confezioni del fabbisogno netto (giacenza sottratta)
  for r in
    select * from public.fb_compute_requirements(p_from, p_to, true)
    where supplier_id is not null and supplier_product_id is not null and coalesce(packs_needed,0) > 0
    order by supplier_id
  loop
    if r.supplier_id is distinct from v_cur then
      insert into public.fb_purchase_orders(location_id, supplier_id, status, expected_date)
        values (v_loc, r.supplier_id, 'BOZZA', p_to) returning id into v_order;
      v_cur := r.supplier_id; v_orders := v_orders + 1; v_ids := array_append(v_ids, v_order);
    end if;
    insert into public.fb_purchase_order_items(order_id, supplier_product_id, qty_packs, unit_price)
      values (v_order, r.supplier_product_id, r.packs_needed, r.pack_price);
    v_items := v_items + 1;
  end loop;
  -- totali (non dipendo da trigger esterni): somma righe per ordine creato
  update public.fb_purchase_orders po
    set total_cost = coalesce((select round(sum(qty_packs * unit_price), 2) from public.fb_purchase_order_items i where i.order_id = po.id), 0)
    where po.id = any(v_ids);
  -- ingredienti senza listino fornitore (non ordinabili automaticamente)
  select count(*) into v_unmapped from public.fb_compute_requirements(p_from, p_to, true) where supplier_id is null and qty_needed > 0;
  return jsonb_build_object('ok', true, 'ordini', v_orders, 'righe', v_items, 'senza_fornitore', coalesce(v_unmapped,0));
end$$;
grant execute on function public.fb_generate_purchase_orders(date, date) to authenticated;
