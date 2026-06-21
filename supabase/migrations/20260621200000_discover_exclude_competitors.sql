-- REGOLA Scopri: non mostrare i CONCORRENTI DIRETTI. Un fornitore non scopre fornitori dello
-- STESSO sottoruolo (un fotografo non vede altri fotografi); un capostipite non scopre capostipiti
-- dello STESSO ruolo (una WP non vede altre WP, una Location non vede altre Location). Si vede solo
-- chi è complementare. Vale per entrambe le funzioni di Scopri. (auth.uid() = chiamante.)
-- NB: ricreo con la firma VIVA (discover_suppliers espone role+verified) e droppo prima per poter
-- cambiare il return type.

drop function if exists discover_suppliers(text, text, text, int, int);
create function discover_suppliers(
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
    and (p.role = 'FORNITORE'
         or (p.role in ('WEDDING_PLANNER','LOCATION')
             and exists (select 1 from services s where s.fornitore_id = p.id and s.is_active = true)))
    -- niente concorrenti diretti né se stesso
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and not exists (
      select 1 from profiles me where me.id = auth.uid() and (
        (me.role = 'FORNITORE' and p.role = 'FORNITORE' and me.subrole = p.subrole)
        or (me.role in ('WEDDING_PLANNER','LOCATION') and p.role = me.role)
      ))
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

drop function if exists discover_wp_and_locations(text, text, text, int, int);
create function discover_wp_and_locations(
  p_city text default null, p_role text default null, p_search text default null,
  p_limit int default 24, p_offset int default 0
)
returns table (
  id uuid, slug text, full_name text, business_name text, brand_logo_url text, role user_role,
  city text, province text, tagline text, bio text, service_radius_km int,
  suppliers_count bigint, posts_count bigint, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.slug, p.full_name, p.business_name, p.brand_logo_url,
    p.role, p.city, p.province, p.tagline, p.bio, p.service_radius_km,
    coalesce((select count(*) from collaborations c where c.capostipite_id = p.id and c.status = 'ACTIVE'), 0) as suppliers_count,
    coalesce((select count(*) from posts po where po.author_id = p.id and po.visibility = 'PUBLIC'), 0) as posts_count,
    p.created_at
  from profiles p
  where p.role in ('WEDDING_PLANNER','LOCATION')
    and p.is_discoverable = true
    and coalesce(p.onboarding_complete, false) = true
    and nullif(btrim(coalesce(p.business_name, '')), '') is not null
    and (p.deletion_requested_at is null)
    -- niente concorrenti dello stesso ruolo (WP↛WP, Location↛Location) né se stesso
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
    and not exists (
      select 1 from profiles me where me.id = auth.uid()
        and me.role in ('WEDDING_PLANNER','LOCATION') and p.role = me.role)
    and (p_role is null or p.role::text = p_role)
    and (p_city is null or lower(p.city) like lower('%' || p_city || '%'))
    and (p_search is null or
         lower(coalesce(p.business_name,p.full_name,'')) like lower('%' || p_search || '%') or
         lower(coalesce(p.tagline,'')) like lower('%' || p_search || '%'))
  order by p.created_at desc
  limit greatest(1, least(p_limit, 100)) offset greatest(0, p_offset);
$$;
grant execute on function discover_wp_and_locations(text, text, text, int, int) to anon, authenticated;
