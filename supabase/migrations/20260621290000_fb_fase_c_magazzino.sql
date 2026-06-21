-- GESTIONALE F&B · FASE C — Magazzino a LOTTI, movimenti, FEFO, ricezione ordini, fabbisogno NETTO
-- (PRP-4 §3C/§5.5-5.8). Giacenza = somma lotti residui; consumo FEFO (first-expired-first-out);
-- lo scadenziario è conseguenza del modello a lotti. RLS owner-only. SECURITY DEFINER con owner-check.

create table if not exists public.fb_warehouses (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.profiles(id) on delete restrict,
  name text not null, kind text not null default 'DRY' check (kind in ('DRY','FRIDGE','FREEZER')),
  is_default boolean not null default false, created_at timestamptz not null default now()
);

create table if not exists public.fb_stock_lots (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.profiles(id) on delete restrict,
  ingredient_id uuid not null references public.fb_ingredients(id) on delete restrict,
  warehouse_id uuid not null references public.fb_warehouses(id) on delete restrict,
  lot_code text,
  qty_received numeric(12,3) not null,
  qty_remaining numeric(12,3) not null,
  unit_cost numeric(12,4) not null,
  expiry_date date,
  received_at timestamptz not null default now(),
  supplier_id uuid references public.fb_suppliers(id),
  created_at timestamptz not null default now(),
  check (qty_remaining >= 0)
);
create index if not exists idx_fb_lots_fefo on public.fb_stock_lots(ingredient_id, expiry_date nulls last) where qty_remaining > 0;
create index if not exists idx_fb_lots_expiry on public.fb_stock_lots(location_id, expiry_date) where qty_remaining > 0 and expiry_date is not null;

create table if not exists public.fb_stock_movements (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.profiles(id) on delete restrict,
  ingredient_id uuid not null references public.fb_ingredients(id) on delete restrict,
  warehouse_id uuid not null references public.fb_warehouses(id) on delete restrict,
  lot_id uuid references public.fb_stock_lots(id) on delete restrict,
  type text not null check (type in ('CARICO','SCARICO','RETTIFICA','SPRECO','TRASFERIMENTO')),
  qty numeric(12,3) not null,              -- segno: + carico, - scarico/spreco
  unit_cost numeric(12,4),
  reason text,
  event_id uuid references public.calendar_entries(id),
  order_id uuid references public.fb_purchase_orders(id) on delete set null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists idx_fb_movements_loc_date on public.fb_stock_movements(location_id, created_at desc);

-- RLS owner-only
alter table public.fb_warehouses      enable row level security;
alter table public.fb_stock_lots      enable row level security;
alter table public.fb_stock_movements enable row level security;
drop policy if exists fb_wh_owner on public.fb_warehouses;
create policy fb_wh_owner on public.fb_warehouses for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_lots_owner on public.fb_stock_lots;
create policy fb_lots_owner on public.fb_stock_lots for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_mov_owner on public.fb_stock_movements;
create policy fb_mov_owner on public.fb_stock_movements for all using (location_id = auth.uid()) with check (location_id = auth.uid());

-- trigger: SCARICO/SPRECO/RETTIFICA aggiornano il residuo del lotto (il CARICO crea il lotto a monte)
create or replace function public.fb_apply_movement() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type <> 'CARICO' and new.lot_id is not null then
    update public.fb_stock_lots set qty_remaining = greatest(0, qty_remaining + new.qty) where id = new.lot_id;
  end if;
  return new;
end$$;
drop trigger if exists trg_fb_apply_movement on public.fb_stock_movements;
create trigger trg_fb_apply_movement after insert on public.fb_stock_movements for each row execute function public.fb_apply_movement();

-- consumo FEFO (scarico per evento): consuma i lotti in scadenza crescente
create or replace function public.fb_consume_fefo(p_ingredient uuid, p_warehouse uuid, p_qty numeric, p_event uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_rem numeric := p_qty; v_take numeric; v_loc uuid;
begin
  if p_qty is null or p_qty <= 0 then return; end if;
  select location_id into v_loc from public.fb_ingredients where id = p_ingredient;
  if v_loc is null or (v_loc <> auth.uid() and not public.is_admin()) then raise exception 'forbidden'; end if;
  for r in select id, qty_remaining, unit_cost from public.fb_stock_lots
            where ingredient_id = p_ingredient and warehouse_id = p_warehouse and qty_remaining > 0
            order by expiry_date nulls last loop
    exit when v_rem <= 0;
    v_take := least(v_rem, r.qty_remaining);
    insert into public.fb_stock_movements(location_id, ingredient_id, warehouse_id, lot_id, type, qty, unit_cost, event_id)
      values (v_loc, p_ingredient, p_warehouse, r.id, 'SCARICO', -v_take, r.unit_cost, p_event);
    v_rem := v_rem - v_take;
  end loop;
  -- stock negativo permesso con warning (PRP): movimento di rettifica senza lotto
  if v_rem > 0 then
    insert into public.fb_stock_movements(location_id, ingredient_id, warehouse_id, type, qty, reason, event_id)
      values (v_loc, p_ingredient, p_warehouse, 'SCARICO', -v_rem, 'consumo oltre giacenza', p_event);
  end if;
end$$;
grant execute on function public.fb_consume_fefo(uuid, uuid, numeric, uuid) to authenticated;

-- ricezione ordine → crea lotti (col costo reale) + CARICO; aggiorna righe e stato
create or replace function public.fb_receive_order(p_order uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid; v_wh uuid; r jsonb; v_ing uuid; v_packqty numeric; v_packprice numeric; v_poi uuid; v_qty numeric; v_lot uuid; v_unit numeric;
begin
  select location_id into v_loc from public.fb_purchase_orders where id = p_order;
  if v_loc is null then return jsonb_build_object('error','not_found'); end if;
  if v_loc <> auth.uid() and not public.is_admin() then return jsonb_build_object('error','forbidden'); end if;
  select id into v_wh from public.fb_warehouses where location_id = v_loc and is_default limit 1;
  if v_wh is null then insert into public.fb_warehouses(location_id, name, is_default) values (v_loc, 'Magazzino', true) returning id into v_wh; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    select sp.ingredient_id, sp.pack_qty_stock_unit, sp.pack_price, poi.id
      into v_ing, v_packqty, v_packprice, v_poi
      from public.fb_purchase_order_items poi join public.fb_supplier_products sp on sp.id = poi.supplier_product_id
      where poi.id = (r->>'item_id')::uuid and poi.order_id = p_order;
    if v_ing is null then continue; end if;
    v_qty := (r->>'qty_packs')::numeric * v_packqty;
    v_unit := v_packprice / nullif(v_packqty, 0);
    insert into public.fb_stock_lots(location_id, ingredient_id, warehouse_id, qty_received, qty_remaining, unit_cost, expiry_date)
      values (v_loc, v_ing, v_wh, v_qty, v_qty, v_unit, nullif(r->>'expiry_date','')::date) returning id into v_lot;
    insert into public.fb_stock_movements(location_id, ingredient_id, warehouse_id, lot_id, type, qty, unit_cost, order_id)
      values (v_loc, v_ing, v_wh, v_lot, 'CARICO', v_qty, v_unit, p_order);
    update public.fb_purchase_order_items set qty_received_packs = (r->>'qty_packs')::numeric, expiry_date = nullif(r->>'expiry_date','')::date where id = v_poi;
  end loop;
  update public.fb_purchase_orders set status = 'RICEVUTO' where id = p_order;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fb_receive_order(uuid, jsonb) to authenticated;

-- vista scadenziario
create or replace view public.fb_lots_expiring with (security_invoker = true) as
  select l.*, (l.expiry_date - current_date) as days_to_expiry
  from public.fb_stock_lots l
  where l.qty_remaining > 0 and l.expiry_date is not null;

-- FABBISOGNO con opzione NETTO (sottrae la giacenza disponibile)
drop function if exists public.fb_compute_requirements(date, date);
create function public.fb_compute_requirements(p_from date, p_to date, p_net boolean default false)
returns table (
  ingredient_id uuid, ingredient_name text, stock_unit text, qty_needed numeric,
  supplier_id uuid, supplier_name text, supplier_product_id uuid, pack_label text,
  pack_qty numeric, packs_needed numeric, pack_price numeric, line_cost numeric
) language sql stable security invoker set search_path = public as $$
  with needs as (
    select e.ingredient_id, sum(e.qty_stock_unit) as qty
    from public.fb_event_menus em
    join public.calendar_entries ce on ce.id = em.entry_id
    cross join lateral public.fb_explode_menu(em.menu_id,
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
grant execute on function public.fb_compute_requirements(date, date, boolean) to authenticated;
