-- SEC / MZ-1: search_professionals (mia 20260802120000) leggeva profiles diretto includendo role
-- 'MAESTRANZA' → enumerava OGNI maestranza (anche bozza/anonimizzata) col NOME LEGALE, ed era
-- invocabile anche da una COPPIA. Le maestranze hanno una superficie dedicata (maestranze_search,
-- con is_published + anonymized_at + display_name) e un flusso di consenso proprio: NON vanno
-- suggerite da qui. Fix: escludo MAESTRANZA e limito la ricerca ai soli chiamanti professionisti.
create or replace function public.search_professionals(p_q text)
returns table (id uuid, name text, subrole text, role text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(nullif(p.business_name,''), p.full_name)::text as name,
         p.subrole::text, p.role::text
  from public.profiles p
  where p.role in ('FORNITORE','WEDDING_PLANNER','LOCATION','FOTOLAB')  -- niente MAESTRANZA (flusso dedicato)
    and p.id <> auth.uid()
    -- solo un professionista puo' cercare/suggerire colleghi (una coppia non enumera i pro)
    and exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.role in ('FORNITORE','WEDDING_PLANNER','LOCATION','FOTOLAB','ADMIN')
    )
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
