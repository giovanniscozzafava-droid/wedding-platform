-- ============================================================================
-- FASE 5 PIVOT — Blog WP-authored per SEO content marketing.
-- Ogni WP/Location/Admin puo' pubblicare articoli che diventano pagine
-- indicizzabili da Google. Effetto cumulativo: 50 WP × 1 articolo/mese
-- = 600 pagine SEO/anno. Acquisition organica leveraged.
-- ============================================================================

-- 1) Categorie editoriali
create table if not exists blog_categories (
  id          uuid primary key default gen_random_uuid(),
  name        varchar(80) not null,
  slug        varchar(80) not null unique,
  description text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into blog_categories (name, slug, description, sort_order) values
  ('Guide & Consigli',  'guide-consigli',  'Come pianificare ogni dettaglio di un evento perfetto.', 10),
  ('Storie di eventi',  'storie',          'Racconti dietro le quinte: matrimoni, battesimi, eventi corporate.', 20),
  ('Backstage',         'backstage',       'Lavoro dei wedding planner e location italiane.', 30),
  ('Ispirazioni',       'ispirazioni',     'Idee, mood, palette, allestimenti che funzionano.', 40),
  ('Trend',             'trend',           'Tendenze del settore eventi in Italia.', 50),
  ('Tips per fornitori','tips-fornitori',  'Consigli pratici per fotografi, fioriai, catering e altri pro.', 60),
  ('Location',          'location',        'Le ville, dimore storiche e venue piu suggestive d''Italia.', 70),
  ('Tradizioni',        'tradizioni',      'Riti, usi e tradizioni regionali italiane.', 80)
on conflict (slug) do nothing;

-- 2) Post articoli
create table if not exists blog_posts (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references profiles(id) on delete cascade,
  category_id     uuid references blog_categories(id) on delete set null,
  slug            varchar(160) not null unique,
  title           varchar(200) not null,
  excerpt         text,
  body_html       text not null default '',
  hero_image_url  text,
  hero_focal_y    int default 50,
  tags            text[] not null default '{}',
  status          text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','ARCHIVED')),
  seo_title       varchar(200),
  seo_description varchar(300),
  reading_minutes int,
  view_count      int not null default 0,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_blog_status_pub on blog_posts(status, published_at desc);
create index if not exists idx_blog_author     on blog_posts(author_id);
create index if not exists idx_blog_category   on blog_posts(category_id, published_at desc);
create index if not exists idx_blog_tags       on blog_posts using gin (tags);

create trigger trg_blog_posts_updated_at before update on blog_posts
  for each row execute function set_updated_at();

-- 3) RLS
alter table blog_categories enable row level security;
alter table blog_posts      enable row level security;

drop policy if exists "blog_categories_read_all" on blog_categories;
create policy "blog_categories_read_all" on blog_categories for select using (true);

drop policy if exists "blog_categories_admin_write" on blog_categories;
create policy "blog_categories_admin_write" on blog_categories for all
  using (is_admin()) with check (is_admin());

-- Lettura: pubblicati = pubblici, draft solo autore + admin
drop policy if exists "blog_posts_read_public" on blog_posts;
create policy "blog_posts_read_public" on blog_posts for select using (
  status = 'PUBLISHED'
  or author_id = auth.uid()
  or is_admin()
);

-- Scrittura: WP/Location/Admin possono creare/modificare propri post
drop policy if exists "blog_posts_write_authors" on blog_posts;
create policy "blog_posts_write_authors" on blog_posts for all using (
  (author_id = auth.uid() and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','ADMIN')
  ))
  or is_admin()
) with check (
  (author_id = auth.uid() and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','ADMIN')
  ))
  or is_admin()
);

-- 4) RPC pubblica: lista articoli con filtri + paginazione + autore
create or replace function blog_list_published(
  p_category text default null,
  p_search   text default null,
  p_limit    int  default 12,
  p_offset   int  default 0
)
returns table (
  id              uuid,
  slug            text,
  title           text,
  excerpt         text,
  hero_image_url  text,
  tags            text[],
  reading_minutes int,
  published_at    timestamptz,
  view_count      int,
  category_slug   text,
  category_name   text,
  author_id       uuid,
  author_name     text,
  author_business text,
  author_slug     text,
  author_logo     text,
  author_city     text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    bp.id, bp.slug, bp.title, bp.excerpt, bp.hero_image_url,
    bp.tags, bp.reading_minutes, bp.published_at, bp.view_count,
    bc.slug as category_slug, bc.name as category_name,
    p.id as author_id, p.full_name as author_name, p.business_name as author_business,
    p.slug as author_slug, p.brand_logo_url as author_logo, p.city as author_city
  from blog_posts bp
  left join blog_categories bc on bc.id = bp.category_id
  join profiles p on p.id = bp.author_id
  where bp.status = 'PUBLISHED'
    and bp.published_at is not null
    and (p_category is null or bc.slug = p_category)
    and (p_search is null or
         lower(bp.title)   like lower('%' || p_search || '%') or
         lower(bp.excerpt) like lower('%' || p_search || '%'))
  order by bp.published_at desc
  limit greatest(1, least(p_limit, 50))
  offset greatest(0, p_offset);
$$;

grant execute on function blog_list_published(text, text, int, int) to anon, authenticated;

-- 5) RPC pubblica: singolo articolo + incrementa view_count
create or replace function blog_get_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post blog_posts%rowtype;
  v_cat  blog_categories%rowtype;
  v_author profiles%rowtype;
begin
  select * into v_post from blog_posts where slug = p_slug limit 1;
  if v_post.id is null then return null; end if;
  -- Solo i pubblicati per anonymous; autore + admin vedono draft suoi
  if v_post.status <> 'PUBLISHED'
     and v_post.author_id is distinct from auth.uid()
     and not is_admin() then
    return null;
  end if;

  select * into v_cat    from blog_categories where id = v_post.category_id;
  select * into v_author from profiles        where id = v_post.author_id;

  -- Bump view count (best-effort, non blocca lettura)
  if v_post.status = 'PUBLISHED' then
    update blog_posts set view_count = view_count + 1 where id = v_post.id;
  end if;

  return jsonb_build_object(
    'id',              v_post.id,
    'slug',            v_post.slug,
    'title',           v_post.title,
    'excerpt',         v_post.excerpt,
    'body_html',       v_post.body_html,
    'hero_image_url',  v_post.hero_image_url,
    'hero_focal_y',    v_post.hero_focal_y,
    'tags',            v_post.tags,
    'status',          v_post.status,
    'seo_title',       coalesce(v_post.seo_title, v_post.title),
    'seo_description', coalesce(v_post.seo_description, v_post.excerpt),
    'reading_minutes', v_post.reading_minutes,
    'view_count',      v_post.view_count + 1,
    'published_at',    v_post.published_at,
    'updated_at',      v_post.updated_at,
    'category', case when v_cat.id is not null then jsonb_build_object(
      'slug', v_cat.slug, 'name', v_cat.name
    ) else null end,
    'author', jsonb_build_object(
      'id',            v_author.id,
      'slug',          v_author.slug,
      'full_name',     v_author.full_name,
      'business_name', v_author.business_name,
      'brand_logo_url',v_author.brand_logo_url,
      'role',          v_author.role,
      'city',          v_author.city,
      'tagline',       v_author.tagline
    )
  );
end$$;

grant execute on function blog_get_by_slug(text) to anon, authenticated;

-- 6) Storage bucket per immagini hero (separato da brand-assets)
insert into storage.buckets (id, name, public)
  values ('blog-media', 'blog-media', true)
  on conflict (id) do update set public = true;

-- Politiche storage: upload solo autori (WP/Location/Admin), read pubblico
drop policy if exists "blog_media_upload_authors" on storage.objects;
create policy "blog_media_upload_authors" on storage.objects for insert with check (
  bucket_id = 'blog-media' and exists (
    select 1 from profiles p where p.id = auth.uid()
      and p.role in ('WEDDING_PLANNER','LOCATION','ADMIN')
  )
);

drop policy if exists "blog_media_read_all" on storage.objects;
create policy "blog_media_read_all" on storage.objects for select using (
  bucket_id = 'blog-media'
);

drop policy if exists "blog_media_update_authors" on storage.objects;
create policy "blog_media_update_authors" on storage.objects for update using (
  bucket_id = 'blog-media' and owner = auth.uid()
);

drop policy if exists "blog_media_delete_authors" on storage.objects;
create policy "blog_media_delete_authors" on storage.objects for delete using (
  bucket_id = 'blog-media' and (owner = auth.uid() or is_admin())
);

comment on table blog_posts is
  'Articoli blog autorati da WP/Location/Admin. Pagine /blog/:slug indicizzate da Google. Vettore principale di SEO content marketing.';
