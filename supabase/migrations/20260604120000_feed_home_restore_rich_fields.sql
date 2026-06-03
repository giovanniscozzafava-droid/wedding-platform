-- ============================================================================
-- REGRESSIONE feed_home: la migrazione 20260528100000 ha ridefinito feed_home
-- perdendo 7 colonne (post_type, title, cover_image_url, body_html, slug,
-- link_url, link_preview) introdotte da 20260526320000 + 20260526350000.
-- Conseguenza: nelle tab Tutto/Rete/Chi-seguo/I-miei gli ARTICOLI apparivano
-- come testo nudo e le ANTEPRIME LINK (og:image) sparivano. Solo "Scopri"
-- (feed_discover_trending) restava integra.
-- Qui ricreo feed_home con TUTTE le colonne, mantenendo la logica rete/visibilità.
-- ----------------------------------------------------------------------------

drop function if exists feed_home(int, int, text);
create or replace function feed_home(
  p_limit  int default 20,
  p_offset int default 0,
  p_filter text default 'ALL'
)
returns table (
  id              uuid,
  author_id       uuid,
  author_name     text,
  author_business text,
  author_slug     text,
  author_role     user_role,
  author_logo     text,
  author_subrole  text,
  body            text,
  media_urls      text[],
  tagged_supplier_ids uuid[],
  visibility      text,
  like_count      int,
  comment_count   int,
  created_at      timestamptz,
  liked_by_me     boolean,
  event_id        uuid,
  event_title     text,
  post_type       text,
  title           text,
  cover_image_url text,
  body_html       text,
  slug            text,
  link_url        text,
  link_preview    jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (select auth.uid() as uid)
  select
    p.id, p.author_id,
    pr.full_name      as author_name,
    pr.business_name  as author_business,
    pr.slug           as author_slug,
    pr.role           as author_role,
    pr.brand_logo_url as author_logo,
    pr.subrole        as author_subrole,
    p.body, p.media_urls, p.tagged_supplier_ids,
    p.visibility, p.like_count, p.comment_count, p.created_at,
    exists (select 1 from post_likes pl where pl.post_id = p.id and pl.user_id = (select uid from viewer)) as liked_by_me,
    p.event_id,
    ce.title          as event_title,
    p.post_type,
    p.title,
    p.cover_image_url,
    p.body_html,
    p.slug,
    p.link_url,
    p.link_preview
  from posts p
  join profiles pr on pr.id = p.author_id
  left join calendar_entries ce on ce.id = p.event_id
  where
    (
      p.visibility = 'PUBLIC'
      or p.author_id = (select uid from viewer)
      or (p.visibility = 'NETWORK' and can_see_network_of((select uid from viewer), p.author_id))
      or (p.visibility = 'FOLLOWERS' and exists (
        select 1 from follows f where f.followed_id = p.author_id and f.follower_id = (select uid from viewer)
      ))
    )
    and (
      p_filter = 'ALL'
      or (p_filter = 'MINE' and p.author_id = (select uid from viewer))
      or (p_filter = 'ARTICLES' and p.post_type = 'ARTICLE')
      or (p_filter = 'FOLLOWING' and exists (
        select 1 from follows f where f.followed_id = p.author_id and f.follower_id = (select uid from viewer)
      ))
      or (p_filter = 'NETWORK' and can_see_network_of((select uid from viewer), p.author_id))
    )
  order by p.is_pinned desc, p.created_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

grant execute on function feed_home(int, int, text) to authenticated, anon;
