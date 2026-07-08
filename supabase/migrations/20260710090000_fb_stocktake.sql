-- FASE — INVENTARIO FISICO (stocktake): la direzione conta col tablet in magazzino le quantità REALI,
-- il sistema confronta col TEORICO (giacenza a lotti = "le carte"), calcola lo SCARTO (differenza a
-- valore) e, alla chiusura, RETTIFICA i lotti (FEFO in meno, nuovo lotto in più) così i numeri reali
-- combaciano col contato. Generico multi-tenant (RLS owner-only = la location/direzione).

create table if not exists public.fb_stocktake (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.profiles(id) on delete restrict,
  warehouse_id uuid not null references public.fb_warehouses(id) on delete restrict,
  status       text not null default 'APERTO' check (status in ('APERTO','CHIUSO','ANNULLATO')),
  note         text,
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create index if not exists idx_fb_stocktake_loc on public.fb_stocktake(location_id, status);
alter table public.fb_stocktake enable row level security;
drop policy if exists fb_stocktake_owner on public.fb_stocktake;
create policy fb_stocktake_owner on public.fb_stocktake for all using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_stocktake_admin on public.fb_stocktake;
create policy fb_stocktake_admin on public.fb_stocktake for select using (public.is_admin());

create table if not exists public.fb_stocktake_lines (
  id              uuid primary key default gen_random_uuid(),
  stocktake_id    uuid not null references public.fb_stocktake(id) on delete cascade,
  location_id     uuid not null references public.profiles(id) on delete restrict,
  ingredient_id   uuid not null references public.fb_ingredients(id) on delete restrict,
  theoretical_qty numeric(12,3) not null default 0,  -- giacenza sulle "carte" allo start
  counted_qty     numeric(12,3),                      -- reale contato (null = non ancora contato)
  unit_cost       numeric(12,4) not null default 0,   -- costo per valorizzare lo scarto
  counted_at      timestamptz,
  unique (stocktake_id, ingredient_id)
);
create index if not exists idx_fb_stocktake_lines_st on public.fb_stocktake_lines(stocktake_id);
alter table public.fb_stocktake_lines enable row level security;
drop policy if exists fb_stocktake_lines_owner on public.fb_stocktake_lines;
create policy fb_stocktake_lines_owner on public.fb_stocktake_lines for all using (location_id = auth.uid()) with check (location_id = auth.uid());

-- ── Apri inventario: crea la sessione e pre-popola una riga per ingrediente attivo con il TEORICO ──
create or replace function public.fb_stocktake_open(p_warehouse uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid := auth.uid(); v_wh uuid; v_st uuid; v_n int;
begin
  if v_loc is null then return jsonb_build_object('error','forbidden'); end if;
  if p_warehouse is not null then v_wh := p_warehouse;
  else select id into v_wh from public.fb_warehouses where location_id = v_loc and is_default limit 1; end if;
  if v_wh is null then select id into v_wh from public.fb_warehouses where location_id = v_loc order by created_at limit 1; end if;
  if v_wh is null then
    insert into public.fb_warehouses(location_id, name, is_default) values (v_loc, 'Magazzino', true) returning id into v_wh;
  end if;
  if not exists (select 1 from public.fb_warehouses where id = v_wh and location_id = v_loc) then
    return jsonb_build_object('error','forbidden'); end if;
  -- riusa un inventario già aperto sullo stesso magazzino
  select id into v_st from public.fb_stocktake where location_id = v_loc and warehouse_id = v_wh and status = 'APERTO' limit 1;
  if v_st is not null then return jsonb_build_object('ok', true, 'stocktake_id', v_st, 'reused', true); end if;

  insert into public.fb_stocktake(location_id, warehouse_id) values (v_loc, v_wh) returning id into v_st;
  insert into public.fb_stocktake_lines(stocktake_id, location_id, ingredient_id, theoretical_qty, unit_cost)
  select v_st, v_loc, i.id,
    coalesce((select sum(qty_remaining) from public.fb_stock_lots l where l.ingredient_id = i.id and l.warehouse_id = v_wh and l.qty_remaining > 0), 0),
    coalesce(
      (select sum(qty_remaining * unit_cost) / nullif(sum(qty_remaining), 0) from public.fb_stock_lots l where l.ingredient_id = i.id and l.warehouse_id = v_wh and l.qty_remaining > 0),
      (select cost_per_unit from public.fb_ingredient_cost_versions cv where cv.ingredient_id = i.id and cv.valid_until is null order by cv.valid_from desc limit 1),
      0)
  from public.fb_ingredients i where i.location_id = v_loc and i.is_active;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'stocktake_id', v_st, 'righe', v_n);
end$$;
grant execute on function public.fb_stocktake_open(uuid) to authenticated;

-- ── Chiudi inventario: RETTIFICA i lotti per far combaciare la giacenza col contato; ritorna lo scarto ──
create or replace function public.fb_stocktake_close(p_stocktake uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid; v_wh uuid; v_status text; r record; lot record;
        v_cur numeric; v_delta numeric; v_rem numeric; v_take numeric; v_lot uuid;
        v_n int := 0; v_scarto numeric := 0;
begin
  select location_id, warehouse_id, status into v_loc, v_wh, v_status from public.fb_stocktake where id = p_stocktake;
  if v_loc is null then return jsonb_build_object('error','not_found'); end if;
  if v_loc <> auth.uid() and not public.is_admin() then return jsonb_build_object('error','forbidden'); end if;
  if v_status <> 'APERTO' then return jsonb_build_object('error','not_open'); end if;

  for r in select * from public.fb_stocktake_lines where stocktake_id = p_stocktake and counted_qty is not null loop
    select coalesce(sum(qty_remaining), 0) into v_cur
      from public.fb_stock_lots where ingredient_id = r.ingredient_id and warehouse_id = v_wh and qty_remaining > 0;
    v_delta := r.counted_qty - v_cur;                      -- porta la giacenza reale al contato
    v_scarto := v_scarto + (r.counted_qty - r.theoretical_qty) * coalesce(r.unit_cost, 0);
    if v_delta = 0 then continue; end if;
    if v_delta < 0 then
      v_rem := -v_delta;
      for lot in select id, qty_remaining from public.fb_stock_lots
                 where ingredient_id = r.ingredient_id and warehouse_id = v_wh and qty_remaining > 0
                 order by expiry_date nulls last loop
        exit when v_rem <= 0;
        v_take := least(v_rem, lot.qty_remaining);
        insert into public.fb_stock_movements(location_id, ingredient_id, warehouse_id, lot_id, type, qty, unit_cost, reason)
          values (v_loc, r.ingredient_id, v_wh, lot.id, 'RETTIFICA', -v_take, r.unit_cost, 'Inventario ' || left(p_stocktake::text, 8));
        v_rem := v_rem - v_take;
      end loop;
    else
      insert into public.fb_stock_lots(location_id, ingredient_id, warehouse_id, lot_code, qty_received, qty_remaining, unit_cost)
        values (v_loc, r.ingredient_id, v_wh, 'INV-' || left(p_stocktake::text, 8), v_delta, 0, r.unit_cost) returning id into v_lot;
      insert into public.fb_stock_movements(location_id, ingredient_id, warehouse_id, lot_id, type, qty, unit_cost, reason)
        values (v_loc, r.ingredient_id, v_wh, v_lot, 'RETTIFICA', v_delta, r.unit_cost, 'Inventario ' || left(p_stocktake::text, 8));
    end if;
    v_n := v_n + 1;
  end loop;

  update public.fb_stocktake set status = 'CHIUSO', closed_at = now() where id = p_stocktake;
  return jsonb_build_object('ok', true, 'righe_rettificate', v_n, 'scarto_valore', round(v_scarto, 2));
end$$;
grant execute on function public.fb_stocktake_close(uuid) to authenticated;
