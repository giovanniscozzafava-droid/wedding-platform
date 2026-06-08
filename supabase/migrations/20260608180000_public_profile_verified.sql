-- Espone "verificato" nel profilo pubblico del professionista (badge sulla card).
create or replace function get_supplier_public_profile(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_services jsonb;
  v_capostipiti jsonb;
  v_in_pancia bigint;
  v_caller_role user_role;
  v_hide_prices boolean;
begin
  select * into v_profile from profiles
   where slug = p_slug and role in ('FORNITORE','LOCATION') and is_discoverable = true
   limit 1;
  if v_profile.id is null then return null; end if;

  select role into v_caller_role from profiles where id = auth.uid();
  v_hide_prices := (v_caller_role = 'FORNITORE' and v_profile.id <> auth.uid());

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id, 'name', s.name, 'description', s.description,
    'base_price', case when v_hide_prices then null else s.base_price end,
    'unit', s.unit, 'category', sc.name,
    'photos', coalesce((select jsonb_agg(jsonb_build_object('url', coalesce(sp.thumbnail_url, sp.original_url), 'full_url', sp.original_url) order by sp.sort_order)
                        from service_photos sp where sp.service_id = s.id), '[]'::jsonb)
  ) order by s.display_order, s.created_at desc), '[]'::jsonb)
  into v_services
  from services s left join service_categories sc on sc.id = s.category_id
  where s.fornitore_id = v_profile.id and s.is_active = true;

  select coalesce(jsonb_agg(jsonb_build_object('business_name', cp.business_name, 'full_name', cp.full_name, 'role', cp.role, 'city', cp.city)), '[]'::jsonb), count(*)
  into v_capostipiti, v_in_pancia
  from collaborations c join profiles cp on cp.id = c.capostipite_id
  where c.fornitore_id = v_profile.id and c.status = 'ACTIVE';

  return jsonb_build_object(
    'id', v_profile.id, 'slug', v_profile.slug, 'role', v_profile.role,
    'verified', v_profile.is_verified_customer,
    'full_name', v_profile.full_name, 'business_name', v_profile.business_name, 'subrole', v_profile.subrole,
    'city', v_profile.city, 'bio', v_profile.bio, 'tagline', v_profile.tagline,
    'brand_logo_url', v_profile.brand_logo_url, 'cover_image_url', v_profile.cover_image_url,
    'phone', v_profile.phone, 'website', v_profile.website, 'instagram', v_profile.instagram,
    'discover_tier', v_profile.discover_tier, 'years_active', v_profile.years_active,
    'service_radius_km', v_profile.service_radius_km, 'service_regions', v_profile.service_regions,
    'services', v_services, 'capostipiti', v_capostipiti, 'in_pancia_count', v_in_pancia
  );
end$$;
grant execute on function get_supplier_public_profile(text) to anon, authenticated;
