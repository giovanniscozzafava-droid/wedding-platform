-- Richiesta: poter SUGGERIRE (e prima seguire) anche i capostipiti (WEDDING_PLANNER / LOCATION), non
-- solo i fornitori. In "Scopri" (discover_suppliers) i WP/LOCATION comparivano SOLO se avevano un
-- catalogo servizi attivo → un capostipite come Rosella Elia (WP senza servizi) era invisibile, quindi
-- non seguibile né suggeribile dalla Rete. Togliamo quel requisito: i capostipiti sono discoverable
-- come i fornitori. Il resto invariato (esclusione concorrenti diretti, bypass admin/staff, filtri).

create or replace function discover_suppliers(
  p_city text default null, p_subrole text default null, p_search text default null,
  p_limit int default 24, p_offset int default 0
)
returns table (
  id uuid, slug text, role user_role, full_name text, business_name text, brand_logo_url text, subrole text,
  city text, province text, tagline text, bio text, service_radius_km int, discover_tier text,
  in_pancia_count bigint, services_count bigint, verified boolean, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.slug, p.role, p.full_name, p.business_name, p.brand_logo_url, p.subrole,
    p.city, p.province, p.tagline, p.bio, p.service_radius_km, p.discover_tier,
    coalesce((select count(*) from collaborations c where c.fornitore_id = p.id and c.status = 'ACTIVE'), 0) as in_pancia_count,
    coalesce((select count(*) from services s where s.fornitore_id = p.id and s.is_active = true), 0) as services_count,
    p.is_verified_customer as verified,
    p.created_at
  from profiles p
  where p.is_discoverable = true and (p.deletion_requested_at is null)
    -- Fornitori E capostipiti (WP/Location): tutti discoverable, anche senza catalogo servizi.
    and p.role in ('FORNITORE','WEDDING_PLANNER','LOCATION')
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    -- admin/staff (founder): niente filtro anti-concorrenti → vede tutti. Utenti normali: esclusi i
    -- concorrenti diretti (stesso subrole per i fornitori, stesso ruolo per WP/Location).
    and (
      exists (select 1 from profiles priv where priv.id = auth.uid()
              and (priv.role = 'ADMIN' or coalesce(priv.is_support_staff, false)))
      or not exists (
        select 1 from profiles me where me.id = auth.uid() and (
          (me.role = 'FORNITORE' and p.role = 'FORNITORE' and me.subrole = p.subrole)
          or (me.role in ('WEDDING_PLANNER','LOCATION') and p.role = me.role)
        ))
    )
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
