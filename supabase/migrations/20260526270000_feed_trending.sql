-- ============================================================================
-- FEED TRENDING — algoritmo stile Instagram "For You". Mostra al capostipite
-- (e a chiunque) post di autori che NON sta ancora seguendo, ordinati per
-- score di trending che premia engagement recente. È il vettore principale
-- con cui un capostipite scopre nuovi fornitori senza dover sfogliare /scopri.
--
-- Score formula:
--   score = (likes * 3 + comments * 5 + media_count * 1) /
--           pow(hours_since_published + 2, 1.5)
--
-- Decay temporale a 1.5: dopo 24h un post deve avere ~5x più engagement per
-- competere con uno appena pubblicato. Bonus +20% se l'autore è nei primi
-- 30 giorni di registrazione (onboarding boost). Solo post PUBLIC ultime 60gg.
-- ============================================================================

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
  trending_score  numeric
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
        (p.like_count * 3 + p.comment_count * 5 + array_length(p.media_urls, 1) * 1)::numeric
        / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.5)::numeric
        *
        case when extract(day from now() - pr.created_at) < 30 then 1.2 else 1.0 end
      ) as trending_score
    from posts p
    join profiles pr on pr.id = p.author_id
    left join calendar_entries ce on ce.id = p.event_id
    where p.visibility = 'PUBLIC'
      and p.created_at > now() - interval '60 days'
      -- escludi post di chi gia segui o sei tu
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
    s.event_id, s.event_title,
    s.trending_score
  from scored s
  order by s.trending_score desc nulls last, s.created_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

grant execute on function feed_discover_trending(int, int) to authenticated;

comment on function feed_discover_trending(int, int) is
  'Algoritmo trending stile IG "For You": post pubblici di chi NON segui, ordinati per (engagement * recency_decay * onboarding_boost). Vettore primario di discovery per i capostipiti.';
