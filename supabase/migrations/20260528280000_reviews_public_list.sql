-- ============================================================================
-- RPC pubblica: list_user_reviews(user_id)
-- Ritorna le recensioni RICEVUTE da un utente con stelle, review e info raters.
-- Usata sulla vetrina pubblica del fornitore/WP per mostrare i feedback.
-- ============================================================================

create or replace function list_user_reviews(p_user_id uuid, p_limit int default 20)
returns table (
  id            uuid,
  stars         int,
  review        text,
  created_at    timestamptz,
  rater_id      uuid,
  rater_role    text,
  rater_name    text,
  rater_logo    text,
  rater_slug    text,
  entry_title   text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.stars,
    r.review,
    r.created_at,
    r.rater_id,
    p.role::text,
    coalesce(p.business_name, p.full_name) as rater_name,
    p.brand_logo_url,
    p.slug,
    ce.title
  from collaboration_ratings r
  join profiles p on p.id = r.rater_id
  left join calendar_entries ce on ce.id = r.entry_id
  where r.rated_id = p_user_id
  order by r.created_at desc
  limit greatest(1, least(p_limit, 100));
$$;

grant execute on function list_user_reviews(uuid, int) to authenticated, anon;
