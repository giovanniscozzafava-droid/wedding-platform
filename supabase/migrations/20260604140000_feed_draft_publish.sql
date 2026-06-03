-- ============================================================================
-- STATO BOZZA/PUBBLICATO sugli articoli del feed.
-- Bug: "Salva" pubblicava subito l'articolo (nessun filtro su moderation_status,
-- che esiste già con default 'PUBLISHED' e valore 'DRAFT' da 20260602140000).
-- Qui le RPC del feed nascondono le bozze a tutti tranne autore/admin.
-- L'editor (frontend) imposterà moderation_status='DRAFT' su Salva, 'PUBLISHED'
-- su Pubblica. I post normali (PostComposer) restano 'PUBLISHED' di default.
-- ----------------------------------------------------------------------------

-- feed_home: nascondi le bozze altrui (autore e admin vedono le proprie).
drop function if exists feed_home(int, int, text);
create or replace function feed_home(
  p_limit  int default 20,
  p_offset int default 0,
  p_filter text default 'ALL'
)
returns table (
  id uuid, author_id uuid, author_name text, author_business text, author_slug text,
  author_role user_role, author_logo text, author_subrole text, body text,
  media_urls text[], tagged_supplier_ids uuid[], visibility text, like_count int,
  comment_count int, created_at timestamptz, liked_by_me boolean, event_id uuid,
  event_title text, post_type text, title text, cover_image_url text, body_html text,
  slug text, link_url text, link_preview jsonb
)
language sql stable security definer set search_path = public
as $$
  with viewer as (select auth.uid() as uid)
  select
    p.id, p.author_id, pr.full_name, pr.business_name, pr.slug, pr.role,
    pr.brand_logo_url, pr.subrole, p.body, p.media_urls, p.tagged_supplier_ids,
    p.visibility, p.like_count, p.comment_count, p.created_at,
    exists (select 1 from post_likes pl where pl.post_id = p.id and pl.user_id = (select uid from viewer)),
    p.event_id, ce.title, p.post_type, p.title, p.cover_image_url, p.body_html,
    p.slug, p.link_url, p.link_preview
  from posts p
  join profiles pr on pr.id = p.author_id
  left join calendar_entries ce on ce.id = p.event_id
  where
    (p.moderation_status = 'PUBLISHED' or p.author_id = (select uid from viewer) or is_admin())
    and (
      p.visibility = 'PUBLIC'
      or p.author_id = (select uid from viewer)
      or (p.visibility = 'NETWORK' and can_see_network_of((select uid from viewer), p.author_id))
      or (p.visibility = 'FOLLOWERS' and exists (
        select 1 from follows f where f.followed_id = p.author_id and f.follower_id = (select uid from viewer)))
    )
    and (
      p_filter = 'ALL'
      or (p_filter = 'MINE' and p.author_id = (select uid from viewer))
      or (p_filter = 'ARTICLES' and p.post_type = 'ARTICLE')
      or (p_filter = 'FOLLOWING' and exists (
        select 1 from follows f where f.followed_id = p.author_id and f.follower_id = (select uid from viewer)))
      or (p_filter = 'NETWORK' and can_see_network_of((select uid from viewer), p.author_id))
    )
  order by p.is_pinned desc, p.created_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
$$;
grant execute on function feed_home(int, int, text) to authenticated, anon;

-- feed_discover_trending: solo pubblicati (le bozze non vanno mai in trending).
drop function if exists feed_discover_trending(int, int);
create or replace function feed_discover_trending(
  p_limit int default 20, p_offset int default 0
)
returns table (
  id uuid, author_id uuid, author_name text, author_business text, author_slug text,
  author_role user_role, author_logo text, author_subrole text, body text,
  media_urls text[], tagged_supplier_ids uuid[], visibility text, like_count int,
  comment_count int, created_at timestamptz, liked_by_me boolean, event_id uuid,
  event_title text, trending_score numeric, post_type text, title text,
  cover_image_url text, body_html text, slug text, link_url text, link_preview jsonb
)
language sql stable security definer set search_path = public
as $$
  with viewer as (select auth.uid() as uid),
  scored as (
    select p.*, pr.full_name as author_name, pr.business_name as author_business,
      pr.slug as author_slug, pr.role as author_role, pr.brand_logo_url as author_logo,
      pr.subrole as author_subrole, ce.title as event_title,
      (
        (p.like_count * 3 + p.comment_count * 5 + coalesce(array_length(p.media_urls, 1), 0) * 1)::numeric
        / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.5)::numeric
        * case when extract(day from now() - pr.created_at) < 30 then 1.2 else 1.0 end
        * case when p.post_type = 'ARTICLE' then 1.3 else 1.0 end
      ) as trending_score
    from posts p
    join profiles pr on pr.id = p.author_id
    left join calendar_entries ce on ce.id = p.event_id
    where p.visibility = 'PUBLIC'
      and p.moderation_status = 'PUBLISHED'
      and p.created_at > now() - interval '60 days'
      and p.author_id <> (select uid from viewer)
      and not exists (select 1 from follows f where f.follower_id = (select uid from viewer) and f.followed_id = p.author_id)
  )
  select s.id, s.author_id, s.author_name, s.author_business, s.author_slug,
    s.author_role, s.author_logo, s.author_subrole, s.body, s.media_urls,
    s.tagged_supplier_ids, s.visibility, s.like_count, s.comment_count, s.created_at,
    exists (select 1 from post_likes pl where pl.post_id = s.id and pl.user_id = (select uid from viewer)),
    s.event_id, s.event_title, s.trending_score, s.post_type, s.title,
    s.cover_image_url, s.body_html, s.slug, s.link_url, s.link_preview
  from scored s
  order by s.trending_score desc nulls last, s.created_at desc
  limit greatest(1, least(p_limit, 50)) offset greatest(0, p_offset);
$$;
grant execute on function feed_discover_trending(int, int) to authenticated, anon;

-- get_feed_article_by_slug: bozza visibile solo ad autore/admin.
create or replace function get_feed_article_by_slug(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare v_post posts%rowtype; v_author profiles%rowtype;
begin
  select * into v_post from posts where slug = p_slug and post_type = 'ARTICLE' limit 1;
  if v_post.id is null then return null; end if;
  if not can_see_post(v_post.id) then return null; end if;
  if v_post.moderation_status <> 'PUBLISHED'
     and v_post.author_id is distinct from auth.uid() and not is_admin() then
    return null;
  end if;
  select * into v_author from profiles where id = v_post.author_id;
  return jsonb_build_object(
    'id', v_post.id, 'slug', v_post.slug, 'title', v_post.title,
    'body_html', v_post.body_html, 'cover_image_url', v_post.cover_image_url,
    'tagged_supplier_ids', v_post.tagged_supplier_ids, 'visibility', v_post.visibility,
    'like_count', v_post.like_count, 'comment_count', v_post.comment_count,
    'created_at', v_post.created_at, 'updated_at', v_post.updated_at,
    'author', jsonb_build_object(
      'id', v_author.id, 'slug', v_author.slug, 'full_name', v_author.full_name,
      'business_name', v_author.business_name, 'brand_logo_url', v_author.brand_logo_url,
      'role', v_author.role, 'subrole', v_author.subrole, 'city', v_author.city,
      'tagline', v_author.tagline)
  );
end$$;
grant execute on function get_feed_article_by_slug(text) to anon, authenticated;
