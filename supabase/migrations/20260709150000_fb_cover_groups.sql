-- FASE — Coperti a GRUPPI: un evento può avere più righe fb_event_menus, ciascuna con un ruolo
-- (OSPITI / BAMBINI / PROFESSIONISTI / BRIGATA) e il proprio menu + coperti. Ogni gruppo esplode nel
-- proprio menu (piatti confermati se presenti, altrimenti menu intero) e SOMMA su fabbisogno, consumo
-- dispensa, food cost e foglio di servizio. Così i tavoli extra (fotografi/cantanti) e la brigata che
-- mangia incidono davvero su acquisti e magazzino. Generico per tutte le location (RLS owner-only).
-- Retro-compatibile: eventi con una sola riga = ruolo OSPITI di default → comportamento invariato.

alter table public.fb_event_menus
  add column if not exists role text not null default 'OSPITI'
    check (role in ('OSPITI','BAMBINI','PROFESSIONISTI','BRIGATA')),
  add column if not exists label text;

-- ── Helper: esplode il menu per l'evento usando i PIATTI CONFERMATI di quel menu se presenti,
--    altrimenti tutte le voci del menu. Ricorsivo sulle sotto-ricette. Cuore del multi-gruppo.
create or replace function public.fb_explode_event_menu(p_entry uuid, p_menu_id uuid, p_covers numeric)
returns table (ingredient_id uuid, qty_stock_unit numeric)
language sql stable security invoker set search_path = public as $$
  with recursive base as (
    select mi.id, mi.recipe_id, mi.qty_per_cover
    from public.fb_menu_items mi
    where mi.menu_id = p_menu_id
      and (
        -- nessun piatto confermato su questo menu per l'evento → prendi tutto il menu
        not exists (
          select 1 from public.fb_event_dish ed
          join public.fb_menu_items m2 on m2.id = ed.menu_item_id
          where ed.entry_id = p_entry and m2.menu_id = p_menu_id)
        -- oppure questa voce è tra i piatti confermati
        or exists (
          select 1 from public.fb_event_dish ed
          where ed.entry_id = p_entry and ed.menu_item_id = mi.id)
      )
  ),
  expanded as (
    select ri.ingredient_id, ri.subrecipe_id,
           (ri.qty
             * coalesce(ri.yield_percent_override, i.yield_percent, 100) / 100
             * b.qty_per_cover * p_covers
             / nullif(r.yield_qty,0)) as qty
    from base b
    join public.fb_recipes r       on r.id = b.recipe_id
    join public.fb_recipe_items ri on ri.recipe_id = r.id
    left join public.fb_ingredients i on i.id = ri.ingredient_id
    union all
    select ri.ingredient_id, ri.subrecipe_id,
           (e.qty * ri.qty
             * coalesce(ri.yield_percent_override, i.yield_percent, 100) / 100
             / nullif(sr.yield_qty,0)) as qty
    from expanded e
    join public.fb_recipes sr      on sr.id = e.subrecipe_id
    join public.fb_recipe_items ri on ri.recipe_id = sr.id
    left join public.fb_ingredients i on i.id = ri.ingredient_id
  )
  select ingredient_id, sum(qty)::numeric
  from expanded where ingredient_id is not null
  group by ingredient_id;
$$;
grant execute on function public.fb_explode_event_menu(uuid, uuid, numeric) to authenticated;

-- ── Fabbisogno: somma su TUTTE le righe menu (tutti i gruppi) via helper per-riga ──────────
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

-- ── Consumo dispensa a evento SVOLTO: scarica il fabbisogno di TUTTI i gruppi (FEFO) ───────
create or replace function public.fb_consume_event(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid; v_wh uuid; r record; n int := 0;
begin
  select owner_id into v_loc from public.calendar_entries where id = p_entry;
  if v_loc is null then return jsonb_build_object('error','not_found'); end if;
  if v_loc <> auth.uid() and not public.is_admin() then return jsonb_build_object('error','forbidden'); end if;
  select id into v_wh from public.fb_warehouses where location_id = v_loc and is_default limit 1;
  if v_wh is null then return jsonb_build_object('error','no_warehouse'); end if;
  for r in
    select e.ingredient_id, sum(e.qty_stock_unit) as qty
    from public.fb_event_menus em
    join public.calendar_entries ce on ce.id = em.entry_id
    cross join lateral public.fb_explode_event_menu(em.entry_id, em.menu_id, coalesce(em.covers, ce.guest_count, 0)::numeric) e
    where em.entry_id = p_entry
    group by e.ingredient_id
  loop
    perform public.fb_consume_fefo(r.ingredient_id, v_wh, r.qty, p_entry);
    n := n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'ingredienti_scaricati', n);
end$$;

-- ── Costing per GRUPPO dell'evento (per la scheda Eventi lato location) ────────────────────
create or replace function public.fb_event_costing(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_gc int;
begin
  select owner_id, coalesce(guest_count,0) into v_owner, v_gc from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden'); end if;
  return jsonb_build_object('ok', true, 'gruppi', coalesce((
    select jsonb_agg(jsonb_build_object(
        'em_id', em.id, 'role', em.role, 'label', em.label, 'menu', mm.name,
        'coperti', coalesce(em.covers, v_gc, 0),
        'total_cost', round(g.total, 2),
        'cost_per_cover', round(g.total / nullif(coalesce(em.covers, v_gc, 0), 0), 2))
      order by case em.role when 'OSPITI' then 1 when 'BAMBINI' then 2 when 'PROFESSIONISTI' then 3 else 4 end, mm.name)
    from public.fb_event_menus em
    join public.fb_menus mm on mm.id = em.menu_id
    cross join lateral (
      select coalesce(sum(e.qty_stock_unit * coalesce((
               select cv.cost_per_unit from public.fb_ingredient_cost_versions cv
               where cv.ingredient_id = e.ingredient_id and cv.valid_until is null
               order by cv.valid_from desc limit 1), 0)), 0) as total
      from public.fb_explode_event_menu(em.entry_id, em.menu_id, coalesce(em.covers, v_gc, 0)::numeric) e
    ) g
    where em.entry_id = p_entry), '[]'::jsonb));
end$$;
grant execute on function public.fb_event_costing(uuid) to authenticated;

-- ── Foglio di servizio: fabbisogno + magazzino sommano TUTTI i gruppi; aggiunge 'gruppi'. ──
create or replace function public.fb_event_sheet(p_entry uuid)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_loc uuid; v_cov int; v_title text; v_date timestamptz; v_has_dish boolean;
begin
  select owner_id, coalesce(guest_count, 0), title, date_from into v_loc, v_cov, v_title, v_date
  from public.calendar_entries where id = p_entry;
  if v_loc is null then return jsonb_build_object('error','not_found'); end if;
  -- coperti OSPITI per testata/tavoli (i gruppi extra non siedono ai tavoli ospiti)
  if v_cov = 0 then
    select coalesce(max(covers) filter (where role = 'OSPITI'), max(covers), 0) into v_cov
    from public.fb_event_menus where entry_id = p_entry;
  end if;
  select exists (select 1 from public.fb_event_dish where entry_id = p_entry) into v_has_dish;

  return jsonb_build_object(
    'evento', jsonb_build_object('titolo', v_title, 'data', v_date, 'coperti', v_cov,
       'tavoli', ceil(v_cov::numeric / 10), 'coperti_per_tavolo', 10),
    'brigata', coalesce((select jsonb_agg(jsonb_build_object(
         'reparto', m.reparto, 'ruolo', m.role, 'nome', m.full_name,
         'postazione', b.station, 'chiamata', b.call_time, 'fine', b.end_time, 'tel', m.phone)
         order by case m.reparto when 'CUCINA' then 1 when 'SALA' then 2 when 'BAR' then 3 else 4 end, m.role)
       from public.fb_event_brigade b join public.fb_brigade_members m on m.id = b.member_id
       where b.entry_id = p_entry), '[]'::jsonb),
    'menu', coalesce((select jsonb_agg(distinct mm.name) from public.fb_event_menus em
       join public.fb_menus mm on mm.id = em.menu_id where em.entry_id = p_entry), '[]'::jsonb),
    'gruppi', coalesce((select jsonb_agg(jsonb_build_object(
         'ruolo', em.role, 'etichetta', em.label, 'menu', mm.name, 'coperti', coalesce(em.covers, v_cov, 0))
         order by case em.role when 'OSPITI' then 1 when 'BAMBINI' then 2 when 'PROFESSIONISTI' then 3 else 4 end, mm.name)
       from public.fb_event_menus em join public.fb_menus mm on mm.id = em.menu_id
       where em.entry_id = p_entry), '[]'::jsonb),
    'piatti', case when v_has_dish then coalesce((
         select jsonb_agg(jsonb_build_object('piatto', rc.name, 'per_coperto', mi.qty_per_cover,
             'porzioni', round(mi.qty_per_cover * v_cov)) order by mi.course, rc.name)
         from public.fb_event_dish ed
         join public.fb_menu_items mi on mi.id = ed.menu_item_id
         join public.fb_recipes rc on rc.id = mi.recipe_id
         where ed.entry_id = p_entry), '[]'::jsonb)
       else coalesce((select jsonb_agg(jsonb_build_object('piatto', rc.name,
             'per_coperto', mi.qty_per_cover, 'porzioni', round(mi.qty_per_cover * v_cov)) order by rc.name)
         from public.fb_event_menus em
         join public.fb_menu_items mi on mi.menu_id = em.menu_id
         join public.fb_recipes rc on rc.id = mi.recipe_id
         where em.entry_id = p_entry and em.role = 'OSPITI'), '[]'::jsonb) end,
    'fabbisogno', coalesce((select jsonb_agg(jsonb_build_object('ingrediente', i.name,
         'qta', round(t.qty), 'unita', i.stock_unit) order by i.name)
       from (select e.ingredient_id, sum(e.qty_stock_unit) qty
             from public.fb_event_menus em
             cross join lateral public.fb_explode_event_menu(em.entry_id, em.menu_id, coalesce(em.covers, v_cov, 0)::numeric) e
             where em.entry_id = p_entry group by e.ingredient_id) t
       join public.fb_ingredients i on i.id = t.ingredient_id), '[]'::jsonb),
    'magazzino', coalesce((select jsonb_agg(jsonb_build_object('ingrediente', i.name, 'lotto', l.lot_code,
         'disponibile', l.qty_remaining, 'unita', i.stock_unit, 'scadenza', l.expiry_date) order by i.name, l.expiry_date)
       from public.fb_stock_lots l join public.fb_ingredients i on i.id = l.ingredient_id
       where l.location_id = v_loc and l.qty_remaining > 0
         and l.ingredient_id in (
           select distinct e.ingredient_id from public.fb_event_menus em
           cross join lateral public.fb_explode_event_menu(em.entry_id, em.menu_id, coalesce(em.covers, v_cov, 0)::numeric) e
           where em.entry_id = p_entry)), '[]'::jsonb)
  );
end$$;
