-- Il pannello admin "Fornitori" (RPC admin_list_fornitori) mostrava solo role='FORNITORE',
-- quindi LOCATION e WEDDING_PLANNER (es. La Baronella = LOCATION, Rosella Elia = WEDDING_PLANNER)
-- non comparivano — discrepanza rispetto a chi è davvero sulla piattaforma. Dall'admin si devono
-- vedere TUTTI i professionisti: allarghiamo il filtro ai 3 ruoli professionali. I clienti/coppie
-- restano nel pannello Utenti (admin_list_users). Stessa firma della versione precedente
-- (20260605130000): create or replace, nessun cambio di tipo di ritorno.
create or replace function public.admin_list_fornitori(p_search text default null, p_plan text default null)
returns table (
  id uuid, full_name text, business_name text, subrole text, email text,
  subscription_plan text, subscription_status text, service_regions text[], created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select p.id, p.full_name::text, p.business_name::text, p.subrole::text, u.email::text,
           p.subscription_plan, p.subscription_status, p.service_regions, p.created_at
    from profiles p join auth.users u on u.id = p.id
    where p.role in ('FORNITORE','WEDDING_PLANNER','LOCATION')
      and (p_plan is null or p_plan = '' or p.subscription_plan = p_plan)
      and (p_search is null or p_search = ''
           or p.full_name ilike '%'||p_search||'%'
           or p.business_name ilike '%'||p_search||'%'
           or u.email ilike '%'||p_search||'%')
    order by p.subscription_plan desc, p.created_at desc
    limit 100;
end$$;
grant execute on function public.admin_list_fornitori(text,text) to authenticated;
