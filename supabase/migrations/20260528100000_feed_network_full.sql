-- ============================================================================
-- Feed: estende il concetto di "NETWORK" per coprire tutto il grafo del wedding
-- ----------------------------------------------------------------------------
-- Pre-audit (28 mag 2026):
-- - Il ruolo COUPLE era escluso dalla policy di scrittura  → sposi muti nel feed
-- - La visibility NETWORK considerava SOLO le collaborazioni capostipite↔fornitore
-- - feed_home RPC replicava la stessa logica → coppia vedeva solo PUBLIC e i suoi
--
-- Post-fix:
-- - Coppia ↔ WP del proprio matrimonio: NETWORK reciproco
-- - Coppia ↔ fornitori del proprio matrimonio (via quote_items): NETWORK reciproco
-- - WP/fornitori restano collegati come prima via collaborations ACTIVE
-- - COUPLE può pubblicare (PUBLIC / NETWORK / FOLLOWERS)
-- ============================================================================

-- 1) Helper SECURITY DEFINER: relazione "NETWORK" tra due profili
create or replace function can_see_network_of(p_viewer uuid, p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Self
    p_viewer = p_author
    or
    -- Capostipite ↔ fornitore via collaborations ACTIVE (bidirezionale)
    exists (
      select 1 from collaborations c
       where c.status = 'ACTIVE'
         and ((c.capostipite_id = p_author and c.fornitore_id = p_viewer)
           or (c.fornitore_id = p_author and c.capostipite_id = p_viewer))
    )
    or
    -- Coppia ↔ owner del proprio wedding (WP) — bidirezionale
    exists (
      select 1
        from wedding_couple_members m
        join calendar_entries e on e.id = m.entry_id
       where m.user_id is not null
         and (
              (m.user_id = p_viewer and e.owner_id = p_author)
           or (m.user_id = p_author and e.owner_id = p_viewer)
         )
    )
    or
    -- Coppia ↔ fornitori del proprio wedding (via quote_items) — bidirezionale
    exists (
      select 1
        from wedding_couple_members m
        join calendar_entries e on e.id = m.entry_id
        join quote_items qi     on qi.quote_id = e.quote_id
       where m.user_id is not null
         and e.quote_id is not null
         and qi.supplier_id is not null
         and (
              (m.user_id = p_viewer and qi.supplier_id = p_author)
           or (m.user_id = p_author and qi.supplier_id = p_viewer)
         )
    )
$$;

grant execute on function can_see_network_of(uuid, uuid) to authenticated, anon;

-- 2) Aggiorna policy di lettura post per usare l'helper
drop policy if exists "posts_read_visible" on posts;
create policy "posts_read_visible" on posts for select using (
  visibility = 'PUBLIC'
  or author_id = auth.uid()
  or is_admin()
  or (visibility = 'NETWORK' and can_see_network_of(auth.uid(), author_id))
  or (visibility = 'FOLLOWERS' and exists (
    select 1 from follows f where f.followed_id = posts.author_id and f.follower_id = auth.uid()
  ))
);

-- 3) Aggiorna policy di scrittura per includere COUPLE
drop policy if exists "posts_write_capostipiti" on posts;
create policy "posts_write_all_roles" on posts for all using (
  author_id = auth.uid() and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','ADMIN','FORNITORE','COUPLE')
  )
) with check (
  author_id = auth.uid() and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','ADMIN','FORNITORE','COUPLE')
  )
);

-- 4) Rebuild feed_home RPC usando l'helper
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
