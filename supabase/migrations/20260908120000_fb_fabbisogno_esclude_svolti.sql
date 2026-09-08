-- Il fabbisogno contava anche gli eventi già svolti (e quelli annullati).
--
-- `fb_compute_requirements(dal, al, netto)` sommava i menù di TUTTI gli eventi
-- con data nel periodo, senza guardare lo stato. Trovato girando il video
-- Baronella (08/09/2026): finestra 11–25 giugno con tre matrimoni già SVOLTI
-- (dispensa già scaricata) e uno da fare → 33 ingredienti per 3.011 €, quando
-- il quarto matrimonio da solo ne vale 314 €. `fb_generate_purchase_orders`
-- ci costruisce sopra gli ordini: una location avrebbe ricomprato tre volte
-- quello che aveva già cucinato.
--
-- Un evento svolto ha già consumato; uno annullato o archiviato non consumerà.
-- Nessuno dei tre deve generare spesa.
create or replace function public.fb_compute_requirements(p_from date, p_to date, p_net boolean default false)
returns table (
  ingredient_id uuid, ingredient_name text, stock_unit text, qty_needed numeric,
  supplier_id uuid, supplier_name text, supplier_product_id uuid, pack_label text,
  pack_qty numeric, packs_needed numeric, pack_price numeric, line_cost numeric
) language sql stable security invoker set search_path = public as $$
  with needs as (
    select e.ingredient_id, sum(e.qty_stock_unit) as qty
    from public.fb_event_menus em
    join public.calendar_entries ce on ce.id = em.entry_id
    cross join lateral public.fb_explode_event_menu(em.entry_id, em.menu_id,
      coalesce(em.covers, ce.guest_count,
        (select count(*) from public.event_guests g where g.entry_id = ce.id and g.rsvp = 'YES' and g.age_group <> 'INFANT'), 0)::numeric) e
    where ce.date_from between p_from and p_to
      and ce.archived_at is null
      and ce.status <> 'CANCELLATA'
      and coalesce(ce.evento_stato::text, '') not in ('SVOLTO', 'ANNULLATO')
    group by e.ingredient_id
  ),
  net as (
    select n.ingredient_id,
      greatest(0, n.qty - case when p_net then coalesce((select sum(qty_remaining) from public.fb_stock_lots l where l.ingredient_id = n.ingredient_id and l.qty_remaining > 0), 0) else 0 end) as qty
    from needs n
  ),
  picked as (
    select x.ingredient_id, x.qty,
      (select sp.id from public.fb_supplier_products sp where sp.ingredient_id = x.ingredient_id and sp.is_active
        order by sp.is_preferred desc, (sp.pack_price / nullif(sp.pack_qty_stock_unit,0)) asc limit 1) as sp_id
    from net x where x.qty > 0
  )
  select i.id, i.name, i.stock_unit, round(p.qty, 1),
    s.id, s.name, sp.id, sp.pack_label, sp.pack_qty_stock_unit,
    ceil(p.qty / nullif(sp.pack_qty_stock_unit, 0)), sp.pack_price,
    round(ceil(p.qty / nullif(sp.pack_qty_stock_unit, 0)) * sp.pack_price, 2)
  from picked p
  join public.fb_ingredients i on i.id = p.ingredient_id
  left join public.fb_supplier_products sp on sp.id = p.sp_id
  left join public.fb_suppliers s on s.id = sp.supplier_id
  order by s.name nulls last, i.name;
$$;
grant execute on function public.fb_compute_requirements(date, date, boolean) to authenticated;
