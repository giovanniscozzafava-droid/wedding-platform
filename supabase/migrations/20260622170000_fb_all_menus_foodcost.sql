-- Food cost GENERALE: costo a coperto di tutti i menu della location (vista di confronto/listino).
create or replace function public.fb_all_menus_foodcost()
returns table (menu_id uuid, name text, cost_per_cover numeric, total_cost numeric)
language sql stable security invoker set search_path = public as $$
  select m.id, m.name, round(f.cost_per_cover, 2), round(f.total_cost, 2)
  from public.fb_menus m
  cross join lateral public.fb_menu_foodcost(m.id, 100) f
  where m.location_id = auth.uid() and m.is_active
  order by f.cost_per_cover;
$$;
grant execute on function public.fb_all_menus_foodcost() to authenticated;
