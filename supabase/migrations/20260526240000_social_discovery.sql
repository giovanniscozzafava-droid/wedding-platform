-- ============================================================================
-- FASE 2 PIVOT — Discovery pubblica fornitori (feed /scopri stile LinkedIn)
-- + profilo pubblico fornitore (/p/fornitore/:slug)
-- + flow inverso "candidati alla rete del capostipite"
-- ============================================================================

-- 1) Colonne nuove su profiles per il social
alter table profiles
  add column if not exists slug              varchar(80) unique,
  add column if not exists is_discoverable   boolean not null default true,
  add column if not exists discover_tier     text default 'STANDARD' check (discover_tier in ('STANDARD','BOOST','PREMIUM')),
  add column if not exists tagline           varchar(200),
  add column if not exists service_radius_km int;

comment on column profiles.slug is
  'URL slug univoco per profilo pubblico /p/fornitore/:slug. Autogenerato da business_name/full_name al primo salvataggio.';
comment on column profiles.is_discoverable is
  'Se false, il fornitore non appare nel feed /scopri. Default true. Disattivabile manualmente.';
comment on column profiles.discover_tier is
  'Posizionamento nel feed: STANDARD (default, trial+Plus), BOOST (early access), PREMIUM (€79/mese — sorted first nel feed).';

-- 2) Slug autogenerato per profili esistenti (senza accenti, lowercase, dash)
update profiles
   set slug = lower(regexp_replace(
        coalesce(business_name, full_name, 'fornitore-' || substr(id::text, 1, 8)),
        '[^a-zA-Z0-9]+', '-', 'g'
      )) || '-' || substr(id::text, 1, 6)
 where slug is null
   and role in ('FORNITORE','WEDDING_PLANNER','LOCATION');

-- 3) RPC pubblica: feed fornitori discoverable
create or replace function discover_suppliers(
  p_city     text default null,
  p_subrole  text default null,
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
  subrole           text,
  city              text,
  province          text,
  tagline           text,
  bio               text,
  service_radius_km int,
  discover_tier     text,
  in_pancia_count   bigint,
  services_count    bigint,
  created_at        timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.slug,
    p.full_name,
    p.business_name,
    p.brand_logo_url,
    p.subrole,
    p.city,
    p.province,
    p.tagline,
    p.bio,
    p.service_radius_km,
    p.discover_tier,
    coalesce((
      select count(*) from collaborations c
       where c.fornitore_id = p.id and c.status = 'ACTIVE'
    ), 0) as in_pancia_count,
    coalesce((
      select count(*) from services s
       where s.fornitore_id = p.id and s.is_active = true
    ), 0) as services_count,
    p.created_at
  from profiles p
  where p.role = 'FORNITORE'
    and p.is_discoverable = true
    and (p.deletion_requested_at is null)
    and (p_subrole is null or p.subrole = p_subrole)
    and (p_city is null or lower(p.city) like lower('%' || p_city || '%'))
    and (p_search is null or
         lower(coalesce(p.business_name,p.full_name,'')) like lower('%' || p_search || '%') or
         lower(coalesce(p.tagline,'')) like lower('%' || p_search || '%'))
  order by
    case p.discover_tier when 'PREMIUM' then 0 when 'BOOST' then 1 else 2 end,
    p.created_at desc
  limit greatest(1, least(p_limit, 100))
  offset greatest(0, p_offset);
$$;

grant execute on function discover_suppliers(text, text, text, int, int) to anon, authenticated;

-- 4) RPC profilo pubblico singolo fornitore
create or replace function get_supplier_public_profile(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_services jsonb;
  v_capostipiti jsonb;
  v_in_pancia bigint;
begin
  select * into v_profile from profiles
   where slug = p_slug
     and role = 'FORNITORE'
     and is_discoverable = true
   limit 1;
  if v_profile.id is null then
    return null;
  end if;

  -- Servizi attivi (snapshot, no prezzi per ora se vuoi privacy; teniamo prezzi base)
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',           s.id,
    'name',         s.name,
    'description',  s.description,
    'base_price',   s.base_price,
    'unit',         s.unit,
    'category',     sc.name,
    'photos',       coalesce((select jsonb_agg(jsonb_build_object('url', sp.url, 'caption', sp.caption) order by sp.sort_order) from service_photos sp where sp.service_id = s.id), '[]'::jsonb)
  ) order by s.display_order, s.created_at desc), '[]'::jsonb)
  into v_services
  from services s
  left join service_categories sc on sc.id = s.category_id
  where s.fornitore_id = v_profile.id and s.is_active = true;

  -- Capostipiti che lo hanno in pancia (solo nome business + città, no PII)
  select coalesce(jsonb_agg(jsonb_build_object(
    'business_name', cp.business_name,
    'full_name',     cp.full_name,
    'role',          cp.role,
    'city',          cp.city
  )), '[]'::jsonb), count(*)
  into v_capostipiti, v_in_pancia
  from collaborations c
  join profiles cp on cp.id = c.capostipite_id
  where c.fornitore_id = v_profile.id and c.status = 'ACTIVE';

  return jsonb_build_object(
    'id',               v_profile.id,
    'slug',             v_profile.slug,
    'full_name',        v_profile.full_name,
    'business_name',    v_profile.business_name,
    'brand_logo_url',   v_profile.brand_logo_url,
    'brand_primary_color', v_profile.brand_primary_color,
    'subrole',          v_profile.subrole,
    'city',             v_profile.city,
    'province',         v_profile.province,
    'tagline',          v_profile.tagline,
    'bio',              v_profile.bio,
    'work_style',       v_profile.work_style,
    'service_radius_km',v_profile.service_radius_km,
    'phone',            null, -- mai esposto pubblicamente
    'website',          v_profile.website,
    'instagram',        v_profile.instagram,
    'facebook',         v_profile.facebook,
    'tiktok',           v_profile.tiktok,
    'discover_tier',    v_profile.discover_tier,
    'in_pancia_count',  v_in_pancia,
    'services',         v_services,
    'capostipiti',      v_capostipiti
  );
end$$;

grant execute on function get_supplier_public_profile(text) to anon, authenticated;

-- 5) Flow inverso: fornitore richiede collaborazione con un capostipite
-- Inserisce collaboration in stato PENDING_FROM_SUPPLIER (nuovo).
do $$ begin
  if not exists (select 1 from pg_type t where t.typname = 'collaboration_status' and 'PENDING_FROM_SUPPLIER' = any(enum_range(null::collaboration_status)::text[])) then
    alter type collaboration_status add value if not exists 'PENDING_FROM_SUPPLIER';
  end if;
exception when others then null;
end $$;

create or replace function supplier_request_collaboration(
  p_capostipite_id uuid,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier uuid := auth.uid();
  v_existing collaborations%rowtype;
  v_capo profiles%rowtype;
  v_new collaborations%rowtype;
begin
  if v_supplier is null then
    return jsonb_build_object('error','auth_required');
  end if;

  select * into v_capo from profiles where id = p_capostipite_id and role in ('WEDDING_PLANNER','LOCATION');
  if v_capo.id is null then
    return jsonb_build_object('error','capostipite_not_found');
  end if;

  select * into v_existing from collaborations
   where capostipite_id = p_capostipite_id and fornitore_id = v_supplier;
  if v_existing.id is not null then
    return jsonb_build_object('error','already_exists','status', v_existing.status, 'collaboration_id', v_existing.id);
  end if;

  insert into collaborations (capostipite_id, fornitore_id, status, invited_at)
  values (p_capostipite_id, v_supplier, 'PENDING_FROM_SUPPLIER', now())
  returning * into v_new;

  return jsonb_build_object('ok', true, 'collaboration_id', v_new.id, 'status', v_new.status);
end$$;

grant execute on function supplier_request_collaboration(uuid, text) to authenticated;

-- 6) Capostipite vede richieste in arrivo: usa stesso hook useSupplierInvites ma
-- ora ci sono anche righe PENDING_FROM_SUPPLIER. Aggiorniamo policy SELECT (gia
-- esiste collab_select_owner): nessuna modifica necessaria, il capostipite vede
-- le proprie righe per qualunque status.

comment on type collaboration_status is
  'Status collaboration: PENDING (capostipite ha invitato fornitore, attende risposta), PENDING_FROM_SUPPLIER (fornitore ha richiesto, capostipite valuta), ACTIVE (collaborazione attiva), REVOKED.';
