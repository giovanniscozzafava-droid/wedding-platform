-- ============================================================================
-- LINK PREVIEW per post: se l'autore incolla un URL nel body, fetchamo i meta
-- tag Open Graph e li salviamo come jsonb. Il feed mostra una card ricca
-- (immagine + titolo + descrizione) sotto al testo.
-- ============================================================================

alter table posts
  add column if not exists link_url     text,
  add column if not exists link_preview jsonb;

comment on column posts.link_preview is
  'Open Graph metadata fetchata via edge function link-preview: { title, description, image, site_name, url }';

-- Estensione feed_home + feed_discover_trending per esporre i nuovi campi.
-- Modificando il return type serve drop & create.
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
    pr.full_name, pr.business_name, pr.slug, pr.role,
    pr.brand_logo_url, pr.subrole,
    p.body, p.media_urls, p.tagged_supplier_ids,
    p.visibility, p.like_count, p.comment_count, p.created_at,
    exists (select 1 from post_likes pl where pl.post_id = p.id and pl.user_id = (select uid from viewer)) as liked_by_me,
    p.event_id, ce.title,
    p.post_type, p.title, p.cover_image_url, p.body_html, p.slug,
    p.link_url, p.link_preview
  from posts p
  join profiles pr on pr.id = p.author_id
  left join calendar_entries ce on ce.id = p.event_id
  where
    (
      p.visibility = 'PUBLIC'
      or p.author_id = (select uid from viewer)
      or (p.visibility = 'NETWORK' and exists (
        select 1 from collaborations c
         where c.status = 'ACTIVE'
           and ((c.capostipite_id = p.author_id and c.fornitore_id = (select uid from viewer))
             or (c.fornitore_id = p.author_id and c.capostipite_id = (select uid from viewer)))
      ))
      or (p.visibility = 'FOLLOWERS' and exists (
        select 1 from follows f where f.followed_id = p.author_id and f.follower_id = (select uid from viewer)
      ))
    )
    and (
      p_filter = 'ALL'
      or (p_filter = 'MINE' and p.author_id = (select uid from viewer))
      or (p_filter = 'FOLLOWING' and exists (
        select 1 from follows f where f.followed_id = p.author_id and f.follower_id = (select uid from viewer)
      ))
      or (p_filter = 'NETWORK' and exists (
        select 1 from collaborations c
         where c.status = 'ACTIVE'
           and ((c.capostipite_id = p.author_id and c.fornitore_id = (select uid from viewer))
             or (c.fornitore_id = p.author_id and c.capostipite_id = (select uid from viewer)))
      ))
      or (p_filter = 'ARTICLES' and p.post_type = 'ARTICLE')
    )
  order by p.is_pinned desc, p.created_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

drop function if exists feed_discover_trending(int, int);
create or replace function feed_discover_trending(
  p_limit  int default 20,
  p_offset int default 0
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
  trending_score  numeric,
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
  with viewer as (select auth.uid() as uid),
  scored as (
    select
      p.*,
      pr.full_name      as author_name,
      pr.business_name  as author_business,
      pr.slug           as author_slug,
      pr.role           as author_role,
      pr.brand_logo_url as author_logo,
      pr.subrole        as author_subrole,
      ce.title          as event_title,
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
      and p.created_at > now() - interval '60 days'
      and p.author_id <> (select uid from viewer)
      and not exists (
        select 1 from follows f
         where f.follower_id = (select uid from viewer)
           and f.followed_id = p.author_id
      )
  )
  select
    s.id, s.author_id, s.author_name, s.author_business, s.author_slug,
    s.author_role, s.author_logo, s.author_subrole,
    s.body, s.media_urls, s.tagged_supplier_ids, s.visibility,
    s.like_count, s.comment_count, s.created_at,
    exists (select 1 from post_likes pl where pl.post_id = s.id and pl.user_id = (select uid from viewer)) as liked_by_me,
    s.event_id, s.event_title, s.trending_score,
    s.post_type, s.title, s.cover_image_url, s.body_html, s.slug,
    s.link_url, s.link_preview
  from scored s
  order by s.trending_score desc nulls last, s.created_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;
