-- ============================================================================
-- HOME PUBBLICA: la vetrina deve mostrare SOLO professionisti realmente configurati.
-- Prima bastava role in (WEDDING_PLANNER,LOCATION) + is_discoverable. Un account vuoto
-- (o un ospite finito per errore con ruolo professionale) compariva subito in home.
-- Aggiungiamo due condizioni: profilo onboardato E con un business_name valorizzato.
-- Stessa identica firma/colonne: cambia solo la WHERE.
-- ============================================================================
create or replace function discover_wp_and_locations(
  p_city     text default null,
  p_role     text default null,
  p_search   text default null,
  p_limit    int  default 24,
  p_offset   int  default 0
)
returns table (
  id                uuid,
  slug              text,
  full_name         text,
  business_name     text,
  brand_logo_url    text,
  role              user_role,
  city              text,
  province          text,
  tagline           text,
  bio               text,
  service_radius_km int,
  suppliers_count   bigint,
  posts_count       bigint,
  created_at        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id, p.slug, p.full_name, p.business_name, p.brand_logo_url,
    p.role, p.city, p.province, p.tagline, p.bio, p.service_radius_km,
    coalesce((select count(*) from collaborations c
              where c.capostipite_id = p.id and c.status = 'ACTIVE'), 0) as suppliers_count,
    coalesce((select count(*) from posts po
              where po.author_id = p.id and po.visibility = 'PUBLIC'), 0) as posts_count,
    p.created_at
  from profiles p
  where p.role in ('WEDDING_PLANNER','LOCATION')
    and p.is_discoverable = true
    and coalesce(p.onboarding_complete, false) = true             -- solo profili completati
    and nullif(btrim(coalesce(p.business_name, '')), '') is not null -- con un nome attività
    and (p.deletion_requested_at is null)
    and (p_role is null or p.role::text = p_role)
    and (p_city is null or lower(p.city) like lower('%' || p_city || '%'))
    and (p_search is null or
         lower(coalesce(p.business_name,p.full_name,'')) like lower('%' || p_search || '%') or
         lower(coalesce(p.tagline,'')) like lower('%' || p_search || '%'))
  order by p.created_at desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
$$;
grant execute on function discover_wp_and_locations(text, text, text, int, int) to anon, authenticated;
