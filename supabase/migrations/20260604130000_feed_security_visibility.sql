-- ============================================================================
-- SICUREZZA FEED — i contenuti privati (NETWORK / FOLLOWERS) devono restare
-- privati anche su commenti e like, e gli articoli privati devono essere
-- accessibili ai membri legittimi (non solo autore/admin).
-- Problemi chiusi:
--  * post_comments_list (SECURITY DEFINER) leggeva i commenti di QUALSIASI post
--    a chiunque (anche anon) → niente gate di visibilità.
--  * policy comments_read_visible = using(true) e comments_write_own senza
--    controllo sul post → lettura/scrittura commenti su post non visibili.
--  * post_toggle_like permetteva like su post non visibili.
--  * get_feed_article_by_slug negava gli articoli NETWORK/FOLLOWERS ai membri.
-- Helper unico can_see_post() = stessa logica di feed_home/posts_read_visible.
-- ----------------------------------------------------------------------------

create or replace function can_see_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from posts p
    where p.id = p_post_id
      and (
        p.visibility = 'PUBLIC'
        or p.author_id = auth.uid()
        or is_admin()
        or (p.visibility = 'NETWORK' and can_see_network_of(auth.uid(), p.author_id))
        or (p.visibility = 'FOLLOWERS' and exists (
          select 1 from follows f where f.followed_id = p.author_id and f.follower_id = auth.uid()
        ))
      )
  );
$$;
grant execute on function can_see_post(uuid) to authenticated, anon;

-- ── Commenti: lista solo dei post visibili al chiamante ─────────────────────
create or replace function post_comments_list(p_post_id uuid)
returns table (
  id        uuid,
  body      text,
  created_at timestamptz,
  author_id uuid,
  author_name text,
  author_business text,
  author_slug text,
  author_logo text,
  author_role user_role
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pc.id, pc.body, pc.created_at,
    pr.id, pr.full_name, pr.business_name, pr.slug, pr.brand_logo_url, pr.role
  from post_comments pc
  join profiles pr on pr.id = pc.author_id
  where pc.post_id = p_post_id
    and can_see_post(p_post_id)
  order by pc.created_at asc
  limit 200;
$$;
revoke execute on function post_comments_list(uuid) from anon;
grant execute on function post_comments_list(uuid) to authenticated;

-- ── Like solo su post visibili ──────────────────────────────────────────────
create or replace function post_toggle_like(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if not can_see_post(p_post_id) then return jsonb_build_object('error','forbidden'); end if;
  delete from post_likes where post_id = p_post_id and user_id = v_uid;
  if found then
    return jsonb_build_object('liked', false);
  end if;
  insert into post_likes (post_id, user_id) values (p_post_id, v_uid);
  return jsonb_build_object('liked', true);
end$$;
grant execute on function post_toggle_like(uuid) to authenticated;

-- ── Policy commenti: lettura e scrittura solo su post visibili ──────────────
drop policy if exists "comments_read_visible" on post_comments;
create policy "comments_read_visible" on post_comments
  for select using (can_see_post(post_id));

drop policy if exists "comments_write_own" on post_comments;
create policy "comments_write_own" on post_comments
  for insert with check (author_id = auth.uid() and can_see_post(post_id));

-- ── Articolo singolo per slug: visibile ai membri legittimi ─────────────────
create or replace function get_feed_article_by_slug(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_post posts%rowtype;
  v_author profiles%rowtype;
begin
  select * into v_post from posts where slug = p_slug and post_type = 'ARTICLE' limit 1;
  if v_post.id is null then return null; end if;

  -- Stesso gate del feed: PUBLIC a tutti (indicizzabile), NETWORK/FOLLOWERS ai membri.
  if not can_see_post(v_post.id) then return null; end if;

  select * into v_author from profiles where id = v_post.author_id;
  return jsonb_build_object(
    'id',              v_post.id,
    'slug',            v_post.slug,
    'title',           v_post.title,
    'body_html',       v_post.body_html,
    'cover_image_url', v_post.cover_image_url,
    'tagged_supplier_ids', v_post.tagged_supplier_ids,
    'visibility',      v_post.visibility,
    'like_count',      v_post.like_count,
    'comment_count',   v_post.comment_count,
    'created_at',      v_post.created_at,
    'updated_at',      v_post.updated_at,
    'author', jsonb_build_object(
      'id',            v_author.id,
      'slug',          v_author.slug,
      'full_name',     v_author.full_name,
      'business_name', v_author.business_name,
      'brand_logo_url',v_author.brand_logo_url,
      'role',          v_author.role,
      'subrole',       v_author.subrole,
      'city',          v_author.city,
      'tagline',       v_author.tagline
    )
  );
end$$;
grant execute on function get_feed_article_by_slug(text) to anon, authenticated;
