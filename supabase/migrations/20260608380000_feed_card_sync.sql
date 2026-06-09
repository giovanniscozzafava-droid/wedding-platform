-- ============================================================================
-- La card-articolo nel feed deve sempre mostrare la foto (hero) dell'articolo.
-- Prima il trigger scattava all'insert (hero ancora nullo) → card senza foto.
-- Ora la card si sincronizza con titolo/estratto/hero correnti dell'articolo.
-- ============================================================================
create or replace function public.feed_post_from_blog()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_url text; v_prev jsonb;
begin
  if NEW.status = 'PUBLISHED' then
    v_url := 'https://planfully.it/blog/' || NEW.slug;
    v_prev := jsonb_build_object('url', v_url, 'title', NEW.title,
      'description', coalesce(NEW.excerpt, ''), 'image', NEW.hero_image_url, 'site_name', 'Planfully · Blog');
    if not exists (select 1 from public.posts where author_id = NEW.author_id and link_url = v_url) then
      insert into public.posts (author_id, body, visibility, link_url, link_preview)
      values (NEW.author_id, 'Nuovo articolo: ' || NEW.title, 'PUBLIC', v_url, v_prev);
    else
      update public.posts set link_preview = v_prev
       where author_id = NEW.author_id and link_url = v_url;
    end if;
  end if;
  return NEW;
end$$;

drop trigger if exists trg_feed_from_blog_ins on public.blog_posts;
create trigger trg_feed_from_blog_ins after insert on public.blog_posts
  for each row execute function public.feed_post_from_blog();
drop trigger if exists trg_feed_from_blog_upd on public.blog_posts;
create trigger trg_feed_from_blog_upd after update of status, hero_image_url, title, excerpt on public.blog_posts
  for each row execute function public.feed_post_from_blog();

-- Backfill: riempi la foto nelle card già create (image nullo)
update public.posts p
   set link_preview = jsonb_set(coalesce(p.link_preview, '{}'::jsonb), '{image}', to_jsonb(b.hero_image_url))
  from public.blog_posts b
 where p.link_url = 'https://planfully.it/blog/' || b.slug
   and b.hero_image_url is not null
   and coalesce(p.link_preview->>'image', '') = '';
