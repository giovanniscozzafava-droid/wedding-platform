-- ============================================================================
-- "Borsa del fiore" / listino acquisto del fornitore: l'elenco riutilizzabile
-- degli ingredienti (steli, materiali) col loro costo d'acquisto. È la base del
-- food-cost della composizione: il calcolatore prende da qui i costi unitari e
-- suggerisce il prezzo di vendita del prodotto da mettere a catalogo.
-- Generica (utile a fioraio, allestimenti, pasticcere…), ma in UI per il
-- fioraio si chiama "Borsa del fiore".
-- ============================================================================
create table if not exists public.supplier_cost_ingredients (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  unit        text not null default 'gambo',   -- gambo, mazzo, pz, m, kg…
  unit_cost   numeric(12,2) not null default 0,
  category    text,
  active      boolean not null default true,
  ord         int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_cost_ingredients_supplier on public.supplier_cost_ingredients(supplier_id, active);

drop trigger if exists trg_cost_ingredients_upd on public.supplier_cost_ingredients;
create trigger trg_cost_ingredients_upd before update on public.supplier_cost_ingredients
  for each row execute function set_updated_at();

alter table public.supplier_cost_ingredients enable row level security;
drop policy if exists "cost_ingredients_own" on public.supplier_cost_ingredients;
create policy "cost_ingredients_own" on public.supplier_cost_ingredients
  for all using (supplier_id = auth.uid()) with check (supplier_id = auth.uid());

comment on table public.supplier_cost_ingredients is 'Borsa del fiore / listino acquisto riutilizzabile per il calcolo food-cost delle composizioni.';
