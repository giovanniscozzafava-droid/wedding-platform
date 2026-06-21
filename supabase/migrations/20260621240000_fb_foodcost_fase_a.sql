-- ============================================================================
-- GESTIONALE F&B Location · FASE A — Ricettario + Food Cost (PRP-4 §3A/§4/§5)
-- Single-tenant per location: ogni riga fb_* e' di UNA location. RLS owner-only.
-- Unico ponte con la rete: fb_menus.service_id -> services.id (food cost -> margine).
-- Funzioni di lettura SECURITY INVOKER: la RLS garantisce l'isolamento tra location.
-- DOWN (commento): drop function fb_menu_foodcost, fb_explode_menu; drop table fb_menu_items,
--   fb_menus, fb_recipe_items, fb_recipes, fb_ingredient_cost_versions, fb_ingredients cascade.
-- ============================================================================

-- ── Ingrediente / materia prima ────────────────────────────────────────────
create table if not exists public.fb_ingredients (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.profiles(id) on delete restrict,
  name          text not null,
  category      text,
  stock_unit    text not null check (stock_unit in ('G','ML','PZ')),
  yield_percent numeric(5,2) not null default 100 check (yield_percent > 0 and yield_percent <= 100),
  allergens     text[] default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (location_id, name)
);
create index if not exists idx_fb_ingredients_loc on public.fb_ingredients(location_id) where is_active;

-- ── Storico costo per unita' base (pattern price_versions) ──────────────────
create table if not exists public.fb_ingredient_cost_versions (
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.fb_ingredients(id) on delete cascade,
  cost_per_unit numeric(12,4) not null,
  valid_from    timestamptz not null default now(),
  valid_until   timestamptz,
  source        text not null default 'MANUAL' check (source in ('MANUAL','PURCHASE'))
);
create index if not exists idx_fb_cost_current on public.fb_ingredient_cost_versions(ingredient_id) where valid_until is null;

-- ── Ricetta / preparazione (anche sotto-ricetta) ───────────────────────────
create table if not exists public.fb_recipes (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.profiles(id) on delete restrict,
  name         text not null,
  yield_qty    numeric(12,3) not null,
  yield_unit   text not null,
  is_subrecipe boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (location_id, name)
);

create table if not exists public.fb_recipe_items (
  id                     uuid primary key default gen_random_uuid(),
  recipe_id              uuid not null references public.fb_recipes(id) on delete cascade,
  ingredient_id          uuid references public.fb_ingredients(id) on delete restrict,
  subrecipe_id           uuid references public.fb_recipes(id) on delete restrict,
  qty                    numeric(12,3) not null,
  unit                   text not null,
  yield_percent_override numeric(5,2) check (yield_percent_override > 0 and yield_percent_override <= 100),
  check (num_nonnulls(ingredient_id, subrecipe_id) = 1),
  check (subrecipe_id is null or subrecipe_id <> recipe_id)
);
create index if not exists idx_fb_recipe_items_recipe on public.fb_recipe_items(recipe_id);

-- ── Menu = insieme di ricette, legato (opz.) a un service vendibile ─────────
create table if not exists public.fb_menus (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.profiles(id) on delete restrict,
  name        text not null,
  service_id  uuid references public.services(id) on delete set null,  -- IL PONTE coi preventivi
  basis       text not null default 'PER_COPERTO' check (basis in ('PER_COPERTO','FISSO')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table if not exists public.fb_menu_items (
  id            uuid primary key default gen_random_uuid(),
  menu_id       uuid not null references public.fb_menus(id) on delete cascade,
  recipe_id     uuid not null references public.fb_recipes(id) on delete restrict,
  qty_per_cover numeric(10,3) not null default 1
);
create index if not exists idx_fb_menu_items_menu on public.fb_menu_items(menu_id);

-- ── updated_at (riuso helper esistente set_updated_at) ──────────────────────
drop trigger if exists trg_fb_ingredients_upd on public.fb_ingredients;
create trigger trg_fb_ingredients_upd before update on public.fb_ingredients for each row execute function public.set_updated_at();
drop trigger if exists trg_fb_recipes_upd on public.fb_recipes;
create trigger trg_fb_recipes_upd before update on public.fb_recipes for each row execute function public.set_updated_at();
drop trigger if exists trg_fb_menus_upd on public.fb_menus;
create trigger trg_fb_menus_upd before update on public.fb_menus for each row execute function public.set_updated_at();

-- ── cost-versioning: la nuova versione corrente chiude la precedente ────────
create or replace function public.fb_close_prev_cost() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.fb_ingredient_cost_versions
     set valid_until = new.valid_from
   where ingredient_id = new.ingredient_id and id <> new.id and valid_until is null;
  return new;
end$$;
drop trigger if exists trg_fb_cost_close on public.fb_ingredient_cost_versions;
create trigger trg_fb_cost_close after insert on public.fb_ingredient_cost_versions for each row execute function public.fb_close_prev_cost();

-- ── RLS owner-only (location_id = auth.uid) + admin; figlie via padre ───────
alter table public.fb_ingredients              enable row level security;
alter table public.fb_ingredient_cost_versions enable row level security;
alter table public.fb_recipes                  enable row level security;
alter table public.fb_recipe_items             enable row level security;
alter table public.fb_menus                    enable row level security;
alter table public.fb_menu_items               enable row level security;

-- padri (location_id diretto)
drop policy if exists fb_ingredients_owner on public.fb_ingredients;
create policy fb_ingredients_owner on public.fb_ingredients for all
  using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_recipes_owner on public.fb_recipes;
create policy fb_recipes_owner on public.fb_recipes for all
  using (location_id = auth.uid()) with check (location_id = auth.uid());
drop policy if exists fb_menus_owner on public.fb_menus;
create policy fb_menus_owner on public.fb_menus for all
  using (location_id = auth.uid()) with check (location_id = auth.uid());

-- admin (lettura/gestione)
drop policy if exists fb_ingredients_admin on public.fb_ingredients;
create policy fb_ingredients_admin on public.fb_ingredients for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));
drop policy if exists fb_recipes_admin on public.fb_recipes;
create policy fb_recipes_admin on public.fb_recipes for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));
drop policy if exists fb_menus_admin on public.fb_menus;
create policy fb_menus_admin on public.fb_menus for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

-- figlie (via padre)
drop policy if exists fb_cost_owner on public.fb_ingredient_cost_versions;
create policy fb_cost_owner on public.fb_ingredient_cost_versions for all
  using (exists (select 1 from public.fb_ingredients i where i.id = ingredient_id and i.location_id = auth.uid()))
  with check (exists (select 1 from public.fb_ingredients i where i.id = ingredient_id and i.location_id = auth.uid()));
drop policy if exists fb_recipe_items_owner on public.fb_recipe_items;
create policy fb_recipe_items_owner on public.fb_recipe_items for all
  using (exists (select 1 from public.fb_recipes r where r.id = recipe_id and r.location_id = auth.uid()))
  with check (exists (select 1 from public.fb_recipes r where r.id = recipe_id and r.location_id = auth.uid()));
drop policy if exists fb_menu_items_owner on public.fb_menu_items;
create policy fb_menu_items_owner on public.fb_menu_items for all
  using (exists (select 1 from public.fb_menus m where m.id = menu_id and m.location_id = auth.uid()))
  with check (exists (select 1 from public.fb_menus m where m.id = menu_id and m.location_id = auth.uid()));

-- ── Esplosione menu -> ingredienti (CTE ricorsiva). INVOKER: la RLS isola. ──
create or replace function public.fb_explode_menu(p_menu_id uuid, p_covers numeric)
returns table (ingredient_id uuid, qty_stock_unit numeric)
language sql stable security invoker set search_path = public as $$
  with recursive expanded as (
    select ri.ingredient_id, ri.subrecipe_id,
           (ri.qty
             * coalesce(ri.yield_percent_override, i.yield_percent, 100) / 100
             * mi.qty_per_cover * p_covers
             / nullif(r.yield_qty,0)) as qty
    from public.fb_menu_items mi
    join public.fb_recipes r       on r.id = mi.recipe_id
    join public.fb_recipe_items ri on ri.recipe_id = r.id
    left join public.fb_ingredients i on i.id = ri.ingredient_id
    where mi.menu_id = p_menu_id
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
grant execute on function public.fb_explode_menu(uuid, numeric) to authenticated;

-- ── Food cost teorico a coperto (costo corrente ingrediente) ────────────────
create or replace function public.fb_menu_foodcost(p_menu_id uuid, p_covers numeric)
returns table (total_cost numeric, cost_per_cover numeric)
language sql stable security invoker set search_path = public as $$
  with ing as (
    select e.qty_stock_unit,
           coalesce((select cv.cost_per_unit from public.fb_ingredient_cost_versions cv
                      where cv.ingredient_id = e.ingredient_id and cv.valid_until is null
                      order by cv.valid_from desc limit 1), 0) as unit_cost
    from public.fb_explode_menu(p_menu_id, p_covers) e
  )
  select round(coalesce(sum(qty_stock_unit * unit_cost),0), 2)::numeric as total_cost,
         round(coalesce(sum(qty_stock_unit * unit_cost),0) / nullif(p_covers,0), 4)::numeric as cost_per_cover
  from ing;
$$;
grant execute on function public.fb_menu_foodcost(uuid, numeric) to authenticated;
