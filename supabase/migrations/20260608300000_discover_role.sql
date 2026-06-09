-- ============================================================================
-- Fix "profilo non trovato" in Scopri.
-- discover_suppliers include anche WP/Location che hanno servizi attivi, ma non
-- esponeva `role`: le card linkavano sempre a /p/fornitore/:slug → per una WP
-- (es. Rosella Elia) il profilo fornitore non esiste → 404. Aggiungiamo `role`
-- così il frontend instrada al profilo corretto (/p/wp/:slug per i capostipiti).
-- ============================================================================
drop function if exists discover_suppliers(text, text, text, int, int);
create or replace function discover_suppliers(
  p_city text default null, p_subrole text default null, p_search text default null,
  p_limit int default 24, p_offset int default 0
)
returns table (
  id uuid, slug text, role user_role, full_name text, business_name text, brand_logo_url text, subrole text,
  city text, province text, tagline text, bio text, service_radius_km int, discover_tier text,
  in_pancia_count bigint, services_count bigint, verified boolean, created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    p.id, p.slug, p.role, p.full_name, p.business_name, p.brand_logo_url, p.subrole,
    p.city, p.province, p.tagline, p.bio, p.service_radius_km, p.discover_tier,
    coalesce((select count(*) from collaborations c where c.fornitore_id = p.id and c.status = 'ACTIVE'), 0) as in_pancia_count,
    coalesce((select count(*) from services s where s.fornitore_id = p.id and s.is_active = true), 0) as services_count,
    p.is_verified_customer as verified,
    p.created_at
  from profiles p
  where p.is_discoverable = true and (p.deletion_requested_at is null)
    and (p.role = 'FORNITORE'
         or (p.role in ('WEDDING_PLANNER','LOCATION')
             and exists (select 1 from services s where s.fornitore_id = p.id and s.is_active = true)))
    and (p_subrole is null or p.subrole = p_subrole
         or exists (select 1 from services s join service_categories sc on sc.id = s.category_id
                     where s.fornitore_id = p.id and s.is_active = true and sc.subrole = p_subrole))
    and (p_city is null or lower(p.city) like lower('%' || p_city || '%'))
    and (p_search is null
         or lower(coalesce(p.business_name, p.full_name, '')) like lower('%' || p_search || '%')
         or lower(coalesce(p.tagline, '')) like lower('%' || p_search || '%')
         or exists (
              select 1 from services s left join service_categories sc on sc.id = s.category_id
               where s.fornitore_id = p.id and s.is_active = true
                 and (lower(s.name) like lower('%' || p_search || '%')
                      or lower(coalesce(sc.name, '')) like lower('%' || p_search || '%')
                      or exists (select 1 from unnest(s.tags) t where lower(t) like lower('%' || p_search || '%')))))
  order by
    case p.discover_tier when 'PREMIUM' then 0 when 'BOOST' then 1 else 2 end,
    p.created_at desc
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
$$;
grant execute on function discover_suppliers(text, text, text, int, int) to anon, authenticated;
