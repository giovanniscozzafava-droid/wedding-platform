-- ============================================================================
-- Ogni articolo del blog, quando pubblicato, compare ANCHE nel feed come card
-- cliccabile (link_preview) che porta all'articolo pubblico → traffico al
-- professionista. Idempotente (un solo post-feed per articolo).
-- ============================================================================
create or replace function public.feed_post_from_blog()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_url text;
begin
  if NEW.status = 'PUBLISHED' and (TG_OP = 'INSERT' or OLD.status is distinct from 'PUBLISHED') then
    v_url := 'https://planfully.it/blog/' || NEW.slug;
    if not exists (select 1 from public.posts where author_id = NEW.author_id and link_url = v_url) then
      insert into public.posts (author_id, body, visibility, link_url, link_preview)
      values (
        NEW.author_id,
        'Nuovo articolo: ' || NEW.title,
        'PUBLIC',
        v_url,
        jsonb_build_object(
          'url', v_url, 'title', NEW.title,
          'description', coalesce(NEW.excerpt, ''),
          'image', NEW.hero_image_url, 'site_name', 'Planfully · Blog'
        )
      );
    end if;
  end if;
  return NEW;
end$$;

drop trigger if exists trg_feed_from_blog_ins on public.blog_posts;
create trigger trg_feed_from_blog_ins after insert on public.blog_posts
  for each row execute function public.feed_post_from_blog();
drop trigger if exists trg_feed_from_blog_upd on public.blog_posts;
create trigger trg_feed_from_blog_upd after update of status on public.blog_posts
  for each row execute function public.feed_post_from_blog();

-- Backfill: articoli già pubblicati → card nel feed (se non già presente)
insert into public.posts (author_id, body, visibility, link_url, link_preview)
select b.author_id, 'Nuovo articolo: ' || b.title, 'PUBLIC',
       'https://planfully.it/blog/' || b.slug,
       jsonb_build_object('url', 'https://planfully.it/blog/' || b.slug, 'title', b.title,
                          'description', coalesce(b.excerpt, ''), 'image', b.hero_image_url, 'site_name', 'Planfully · Blog')
from public.blog_posts b
where b.status = 'PUBLISHED'
  and not exists (select 1 from public.posts p where p.author_id = b.author_id and p.link_url = 'https://planfully.it/blog/' || b.slug);
