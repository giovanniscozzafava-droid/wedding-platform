-- Ricerca di QUALSIASI professionista da suggerire a un cliente (non solo quelli seguiti).
-- Regola: ogni profilo professionale e' suggeribile. Ritorna i 5 ruoli professionali, escluso
-- il chiamante. Niente hiding dei concorrenti qui: si suggerisce chi si vuole.
create or replace function public.search_professionals(p_q text)
returns table (id uuid, name text, subrole text, role text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(nullif(p.business_name,''), p.full_name)::text as name,
         p.subrole::text, p.role::text
  from public.profiles p
  where p.role in ('FORNITORE','WEDDING_PLANNER','LOCATION','FOTOLAB','MAESTRANZA')
    and p.id <> auth.uid()
    and (
      coalesce(p_q,'') = ''
      or coalesce(p.business_name,'') ilike '%'||p_q||'%'
      or coalesce(p.full_name,'')     ilike '%'||p_q||'%'
      or coalesce(p.subrole,'')       ilike '%'||p_q||'%'
      or coalesce(p.city,'')          ilike '%'||p_q||'%'
    )
  order by coalesce(nullif(p.business_name,''), p.full_name)
  limit 25;
$$;
revoke all on function public.search_professionals(text) from anon, public;
grant execute on function public.search_professionals(text) to authenticated;
