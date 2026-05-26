-- ============================================================================
-- FASE 6 PIVOT — Home feed sociale stile LinkedIn/IG.
-- WP/Location/Admin (e fornitori Plus/Premium in futuro) pubblicano post:
-- testo + immagini + tag fornitori + opzionale evento collegato. Like e
-- commenti. Visibilita pubblica/network/follower.
-- ============================================================================

-- 1) Tabella post
create table if not exists posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references profiles(id) on delete cascade,
  body            text not null check (char_length(body) <= 5000),
  media_urls      text[] not null default '{}',
  tagged_supplier_ids uuid[] not null default '{}',
  event_id        uuid references calendar_entries(id) on delete set null,
  visibility      text not null default 'PUBLIC' check (visibility in ('PUBLIC','NETWORK','FOLLOWERS')),
  like_count      int not null default 0,
  comment_count   int not null default 0,
  is_pinned       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_posts_author_at on posts(author_id, created_at desc);
create index if not exists idx_posts_visibility_at on posts(visibility, created_at desc);
create index if not exists idx_posts_tagged on posts using gin (tagged_supplier_ids);

create trigger trg_posts_updated_at before update on posts
  for each row execute function set_updated_at();

-- 2) Likes
create table if not exists post_likes (
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 3) Comments
create table if not exists post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) > 0 and char_length(body) <= 1500),
  created_at timestamptz not null default now()
);
create index if not exists idx_post_comments_post on post_comments(post_id, created_at);

-- 4) Follows (chi segue chi)
create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followed_id uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index if not exists idx_follows_follower on follows(follower_id);
create index if not exists idx_follows_followed on follows(followed_id);

-- 5) Trigger: aggiorna like_count / comment_count
create or replace function bump_post_like_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update posts set like_count = like_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end$$;

drop trigger if exists trg_post_like_count on post_likes;
create trigger trg_post_like_count after insert or delete on post_likes
  for each row execute function bump_post_like_count();

create or replace function bump_post_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
    return old;
  end if;
  return null;
end$$;

drop trigger if exists trg_post_comment_count on post_comments;
create trigger trg_post_comment_count after insert or delete on post_comments
  for each row execute function bump_post_comment_count();

-- 6) RLS
alter table posts         enable row level security;
alter table post_likes    enable row level security;
alter table post_comments enable row level security;
alter table follows       enable row level security;

-- Posts: lettura in base a visibility + relazione con autore
drop policy if exists "posts_read_visible" on posts;
create policy "posts_read_visible" on posts for select using (
  visibility = 'PUBLIC'
  or author_id = auth.uid()
  or is_admin()
  or (visibility = 'NETWORK' and exists (
    select 1 from collaborations c
     where c.status = 'ACTIVE'
       and ((c.capostipite_id = posts.author_id and c.fornitore_id = auth.uid())
         or (c.fornitore_id = posts.author_id and c.capostipite_id = auth.uid()))
  ))
  or (visibility = 'FOLLOWERS' and exists (
    select 1 from follows f where f.followed_id = posts.author_id and f.follower_id = auth.uid()
  ))
);

-- Posts: scrittura solo WP/Location/Admin per ora (fornitori in Fase 6.2)
drop policy if exists "posts_write_capostipiti" on posts;
create policy "posts_write_capostipiti" on posts for all using (
  author_id = auth.uid() and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','ADMIN','FORNITORE')
  )
) with check (
  author_id = auth.uid() and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','ADMIN','FORNITORE')
  )
);

-- Likes: chiunque loggato puo' mettere/togliere il proprio like
drop policy if exists "likes_read_all" on post_likes;
create policy "likes_read_all" on post_likes for select using (true);
drop policy if exists "likes_insert_own" on post_likes;
create policy "likes_insert_own" on post_likes for insert with check (user_id = auth.uid());
drop policy if exists "likes_delete_own" on post_likes;
create policy "likes_delete_own" on post_likes for delete using (user_id = auth.uid());

-- Comments: chiunque loggato puo' commentare; modifica/cancella solo proprio
drop policy if exists "comments_read_visible" on post_comments;
create policy "comments_read_visible" on post_comments for select using (true);
drop policy if exists "comments_write_own" on post_comments;
create policy "comments_write_own" on post_comments for insert with check (author_id = auth.uid());
drop policy if exists "comments_delete_own" on post_comments;
create policy "comments_delete_own" on post_comments for delete using (author_id = auth.uid() or is_admin());

-- Follows: read pubblico, write solo per se stessi
drop policy if exists "follows_read_all" on follows;
create policy "follows_read_all" on follows for select using (true);
drop policy if exists "follows_write_own" on follows;
create policy "follows_write_own" on follows for insert with check (follower_id = auth.uid());
drop policy if exists "follows_delete_own" on follows;
create policy "follows_delete_own" on follows for delete using (follower_id = auth.uid());

-- 7) Storage bucket per media post
insert into storage.buckets (id, name, public)
  values ('post-media', 'post-media', true)
  on conflict (id) do update set public = true;

drop policy if exists "post_media_read_all" on storage.objects;
create policy "post_media_read_all" on storage.objects for select using (
  bucket_id = 'post-media'
);

drop policy if exists "post_media_upload_authors" on storage.objects;
create policy "post_media_upload_authors" on storage.objects for insert with check (
  bucket_id = 'post-media' and auth.uid() is not null
);

drop policy if exists "post_media_modify_owner" on storage.objects;
create policy "post_media_modify_owner" on storage.objects for update using (
  bucket_id = 'post-media' and owner = auth.uid()
);

drop policy if exists "post_media_delete_owner" on storage.objects;
create policy "post_media_delete_owner" on storage.objects for delete using (
  bucket_id = 'post-media' and (owner = auth.uid() or is_admin())
);

-- 8) RPC: feed home — post visibili all'utente, paginato
create or replace function feed_home(
  p_limit  int default 20,
  p_offset int default 0,
  p_filter text default 'ALL' -- 'ALL','NETWORK','FOLLOWING','MINE'
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
  event_title     text
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
    ce.title          as event_title
  from posts p
  join profiles pr on pr.id = p.author_id
  left join calendar_entries ce on ce.id = p.event_id
  where
    -- visibility check (mirror RLS, ridondante ma chiaro)
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
    -- filter
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
    )
  order by p.is_pinned desc, p.created_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

grant execute on function feed_home(int, int, text) to authenticated;

-- 9) RPC: commenti per post + autore
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
  order by pc.created_at asc
  limit 200;
$$;

grant execute on function post_comments_list(uuid) to anon, authenticated;

-- 10) RPC: toggle like atomico (semplifica frontend)
create or replace function post_toggle_like(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existed boolean;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  delete from post_likes where post_id = p_post_id and user_id = v_uid;
  if found then
    return jsonb_build_object('liked', false);
  end if;
  insert into post_likes (post_id, user_id) values (p_post_id, v_uid);
  return jsonb_build_object('liked', true);
end$$;

grant execute on function post_toggle_like(uuid) to authenticated;

-- 11) RPC: autocomplete tag fornitori (ricerca tra collaborations attive)
create or replace function search_suppliers_for_tag(p_query text, p_limit int default 8)
returns table (
  id uuid,
  full_name text,
  business_name text,
  brand_logo_url text,
  subrole text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (pr.id)
    pr.id, pr.full_name, pr.business_name, pr.brand_logo_url, pr.subrole
  from profiles pr
  left join collaborations c
    on (c.fornitore_id = pr.id and c.status = 'ACTIVE'
        and (c.capostipite_id = auth.uid() or c.fornitore_id = auth.uid()))
  where pr.role = 'FORNITORE'
    and (
      pr.id = ANY (select fornitore_id from collaborations where capostipite_id = auth.uid() and status = 'ACTIVE')
      or pr.is_discoverable = true
    )
    and (
      p_query is null or p_query = '' or
      lower(coalesce(pr.business_name, pr.full_name, '')) like lower('%' || p_query || '%')
    )
  order by pr.id, pr.business_name
  limit greatest(1, least(p_limit, 20));
$$;

grant execute on function search_suppliers_for_tag(text, int) to authenticated;

comment on table posts is
  'Post timeline social — WP/Location/Admin/Fornitori pubblicano contenuti (foto eventi, backstage). Visibility PUBLIC/NETWORK/FOLLOWERS. Like + commenti. Tag fornitori per cross-promo.';
