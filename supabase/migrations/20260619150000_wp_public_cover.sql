-- La vetrina pubblica WP carica la cover (banner hero) ma la RPC non la restituiva → cover
-- caricata e mai mostrata. Aggiungiamo cover_image_url all'output (resto invariato).
create or replace function get_wp_public_profile(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_wp profiles%rowtype;
  v_posts jsonb;
  v_suppliers jsonb;
  v_blog_posts jsonb;
  v_total_events bigint;
begin
  select * into v_wp from profiles where slug = p_slug limit 1;
  if v_wp.id is null then return null; end if;
  if v_wp.role not in ('WEDDING_PLANNER','LOCATION','ADMIN') then return null; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'body', p.body, 'media_urls', p.media_urls,
    'like_count', p.like_count, 'comment_count', p.comment_count, 'created_at', p.created_at
  ) order by p.created_at desc), '[]'::jsonb)
  into v_posts
  from (select * from posts where author_id = v_wp.id and visibility = 'PUBLIC' order by created_at desc limit 6) p;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'business_name', p.business_name, 'full_name', p.full_name,
    'subrole', p.subrole, 'city', p.city, 'brand_logo_url', p.brand_logo_url, 'slug', p.slug
  )), '[]'::jsonb)
  into v_suppliers
  from collaborations c join profiles p on p.id = c.fornitore_id
  where c.capostipite_id = v_wp.id and c.status = 'ACTIVE' and p.is_discoverable = true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', bp.slug, 'title', bp.title, 'excerpt', bp.excerpt,
    'hero_image_url', bp.hero_image_url, 'reading_minutes', bp.reading_minutes, 'published_at', bp.published_at
  ) order by bp.published_at desc), '[]'::jsonb)
  into v_blog_posts
  from (select * from blog_posts where author_id = v_wp.id and status = 'PUBLISHED' order by published_at desc limit 5) bp;

  select count(*) into v_total_events from calendar_entries where owner_id = v_wp.id;

  return jsonb_build_object(
    'id', v_wp.id, 'slug', v_wp.slug, 'full_name', v_wp.full_name,
    'business_name', v_wp.business_name, 'business_legal_name', v_wp.business_legal_name,
    'role', v_wp.role, 'brand_logo_url', v_wp.brand_logo_url, 'cover_image_url', v_wp.cover_image_url,
    'brand_primary_color', v_wp.brand_primary_color, 'city', v_wp.city, 'province', v_wp.province,
    'tagline', v_wp.tagline, 'bio', v_wp.bio, 'work_style', v_wp.work_style,
    'website', v_wp.website, 'instagram', v_wp.instagram, 'facebook', v_wp.facebook, 'tiktok', v_wp.tiktok,
    'service_radius_km', v_wp.service_radius_km, 'in_pancia_suppliers', jsonb_array_length(v_suppliers),
    'total_events', v_total_events, 'recent_posts', v_posts, 'suppliers', v_suppliers, 'blog_posts', v_blog_posts
  );
end$$;
grant execute on function get_wp_public_profile(text) to anon, authenticated;
