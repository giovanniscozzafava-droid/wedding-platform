-- "Ogni professionista iscritto": il pannello admin deve includere TUTTI i ruoli
-- professionali, non solo fornitore/planner/location. Aggiungiamo anche FOTOLAB
-- (stamperia / album lab) e MAESTRANZA (collaboratori/maestranze). Restano esclusi
-- solo i NON professionisti: COUPLE/CLIENT (clienti), GUEST (invitati), ADMIN (staff)
-- — quelli si gestiscono dal pannello Utenti (admin_list_users).
-- Stessa firma (create or replace), backend-only. Segue 20260724160000.
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
    where p.role in ('FORNITORE','WEDDING_PLANNER','LOCATION','FOTOLAB','MAESTRANZA')
      and (p_plan is null or p_plan = '' or p.subscription_plan = p_plan)
      and (p_search is null or p_search = ''
           or p.full_name ilike '%'||p_search||'%'
           or p.business_name ilike '%'||p_search||'%'
           or u.email ilike '%'||p_search||'%')
    order by p.subscription_plan desc, p.created_at desc
    limit 100;
end$$;
grant execute on function public.admin_list_fornitori(text,text) to authenticated;
