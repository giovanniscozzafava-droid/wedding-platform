-- GESTIONALE F&B · FASE B — Approvvigionamento (PRP-4 §3B/§5.8): fornitori materie prime, listini
-- (confezioni d'acquisto), legame EVENTO↔menu costato (+ coperti), e fabbisogno LORDO che intreccia
-- eventi × menu → ingredienti → confezioni del fornitore preferito → lista spesa + bozze ordine.
-- RLS owner-only (location_id = auth.uid). Funzioni di lettura SECURITY INVOKER (isolamento via RLS).

-- coperti di fallback sull'evento
alter table public.calendar_entries add column if not exists guest_count int;

-- Fornitore materie prime (privato della location) -------------------------------------------------
create table if not exists public.fb_suppliers (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references public.profiles(id) on delete restrict,
  name            text not null,
  email           text,
  phone           text,
  lead_time_days  int  not null default 1,
  min_order_value numeric(10,2) not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_fb_suppliers_loc on public.fb_suppliers(location_id) where is_active;

-- Listino: la confezione d'acquisto mappata all'ingrediente ---------------------------------------
create table if not exists public.fb_supplier_products (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null references public.fb_suppliers(id) on delete cascade,
  ingredient_id       uuid not null references public.fb_ingredients(id) on delete restrict,
  pack_label          text not null,                 -- "Cassa 6x1kg"
  pack_qty_stock_unit numeric(12,3) not null,        -- 6000 (in stock_unit dell'ingrediente)
  pack_price          numeric(12,4) not null,
  is_preferred        boolean not null default false,
  is_active           boolean not null default true
);
create index if not exists idx_fb_supplier_products_ing on public.fb_supplier_products(ingredient_id) where is_active;

-- Legame EVENTO ↔ menu costato (gestione food del singolo evento) ----------------------------------
create table if not exists public.fb_event_menus (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.profiles(id) on delete restrict,
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  menu_id     uuid not null references public.fb_menus(id) on delete cascade,
  covers      int,                                    -- null → fallback guest_count / invitati YES
  created_at  timestamptz not null default now()
);
create index if not exists idx_fb_event_menus_entry on public.fb_event_menus(entry_id);

-- Ordini d'acquisto (Fase B: bozza → inviato; ricezione in Fase C) ---------------------------------
create table if not exists public.fb_purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.profiles(id) on delete restrict,
  supplier_id   uuid not null references public.fb_suppliers(id) on delete restrict,
  status        text not null default 'BOZZA' check (status in ('BOZZA','INVIATO','RICEVUTO_PARZIALE','RICEVUTO','ANNULLATO')),
  expected_date date,
  total_cost    numeric(12,2) not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create table if not exists public.fb_purchase_order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.fb_purchase_orders(id) on delete cascade,
  supplier_product_id uuid not null references public.fb_supplier_products(id) on delete restrict,
  qty_packs           numeric(10,2) not null,
  unit_price          numeric(12,4) not null,
  qty_received_packs  numeric(10,2) not null default 0,
  expiry_date         date
);

-- updated_at
drop trigger if exists trg_fb_suppliers_upd on public.fb_suppliers;
create trigger trg_fb_suppliers_upd before update on public.fb_suppliers for each row execute function public.set_updated_at();
drop trigger if exists trg_fb_po_upd on public.fb_purchase_orders;
create trigger trg_fb_po_upd before update on public.fb_purchase_orders for each row execute function public.set_updated_at();

-- totale ordine mantenuto da trigger
create or replace function public.fb_recalc_po_total() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_order uuid := coalesce(new.order_id, old.order_id);
begin
  update public.fb_purchase_orders set total_cost = (
    select coalesce(sum(qty_packs * unit_price), 0) from public.fb_purchase_order_items where order_id = v_order
  ) where id = v_order;
  return null;
end$$;
drop trigger if exists trg_fb_po_items_total on public.fb_purchase_order_items;
create trigger trg_fb_po_items_total after insert or update or delete on public.fb_purchase_order_items
  for each row execute function public.fb_recalc_po_total();

-- RLS owner-only ---------------------------------------------------------------------------------
alter table public.fb_suppliers            enable row level security;
alter table public.fb_supplier_products    enable row level security;
alter table public.fb_event_menus          enable row level security;
alter table public.fb_purchase_orders      enable row level security;
alter table public.fb_purchase_order_items enable row level security;

drop policy if exists fb_suppliers_owner on public.fb_suppliers;
create policy fb_suppliers_owner on public.fb_suppliers for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_event_menus_owner on public.fb_event_menus;
create policy fb_event_menus_owner on public.fb_event_menus for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_po_owner on public.fb_purchase_orders;
create policy fb_po_owner on public.fb_purchase_orders for all using (location_id = auth.uid()) with check (location_id = auth.uid());

drop policy if exists fb_supplier_products_owner on public.fb_supplier_products;
create policy fb_supplier_products_owner on public.fb_supplier_products for all
  using (exists (select 1 from public.fb_suppliers s where s.id = supplier_id and s.location_id = auth.uid()))
  with check (exists (select 1 from public.fb_suppliers s where s.id = supplier_id and s.location_id = auth.uid()));
drop policy if exists fb_po_items_owner on public.fb_purchase_order_items;
create policy fb_po_items_owner on public.fb_purchase_order_items for all
  using (exists (select 1 from public.fb_purchase_orders o where o.id = order_id and o.location_id = auth.uid()))
  with check (exists (select 1 from public.fb_purchase_orders o where o.id = order_id and o.location_id = auth.uid()));

-- admin read
drop policy if exists fb_suppliers_admin on public.fb_suppliers;
create policy fb_suppliers_admin on public.fb_suppliers for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

-- FABBISOGNO LORDO: eventi nel periodo × menu costato × coperti → ingredienti → confezione del
-- fornitore preferito/economico, arrotondata per eccesso. = lista spesa + base bozze ordine.
create or replace function public.fb_compute_requirements(p_from date, p_to date)
returns table (
  ingredient_id uuid, ingredient_name text, stock_unit text, qty_needed numeric,
  supplier_id uuid, supplier_name text, supplier_product_id uuid, pack_label text,
  pack_qty numeric, packs_needed numeric, pack_price numeric, line_cost numeric
) language sql stable security invoker set search_path = public as $$
  with needs as (
    select e.ingredient_id, sum(e.qty_stock_unit) as qty
    from public.fb_event_menus em
    join public.calendar_entries ce on ce.id = em.entry_id
    cross join lateral public.fb_explode_menu(
      em.menu_id,
      coalesce(em.covers,
               ce.guest_count,
               (select count(*) from public.event_guests g where g.entry_id = ce.id and g.rsvp = 'YES' and g.age_group <> 'INFANT'),
               0)::numeric) e
    where ce.date_from between p_from and p_to
    group by e.ingredient_id
  ),
  picked as (
    select n.ingredient_id, n.qty,
      (select sp.id from public.fb_supplier_products sp
        where sp.ingredient_id = n.ingredient_id and sp.is_active
        order by sp.is_preferred desc, (sp.pack_price / nullif(sp.pack_qty_stock_unit,0)) asc limit 1) as sp_id
    from needs n where n.qty > 0
  )
  select i.id, i.name, i.stock_unit, round(p.qty, 1),
    s.id, s.name, sp.id, sp.pack_label,
    sp.pack_qty_stock_unit,
    ceil(p.qty / nullif(sp.pack_qty_stock_unit, 0)),
    sp.pack_price,
    round(ceil(p.qty / nullif(sp.pack_qty_stock_unit, 0)) * sp.pack_price, 2)
  from picked p
  join public.fb_ingredients i on i.id = p.ingredient_id
  left join public.fb_supplier_products sp on sp.id = p.sp_id
  left join public.fb_suppliers s on s.id = sp.supplier_id
  order by s.name nulls last, i.name;
$$;
grant execute on function public.fb_compute_requirements(date, date) to authenticated;
