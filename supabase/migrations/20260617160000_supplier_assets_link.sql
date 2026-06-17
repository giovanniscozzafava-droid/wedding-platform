-- Gli asset del fornitore possono venire anche da un LINK (Pinterest/Instagram/web):
-- il fornitore che non ha spazio per caricare incolla il link e usiamo l'immagine (og:image).
alter table public.supplier_assets add column if not exists image_url text;   -- URL immagine esterna
alter table public.supplier_assets add column if not exists source_url text;   -- link originale (pin/post)
alter table public.supplier_assets alter column storage_path drop not null;

-- una card deve avere o un file caricato o un'immagine via link
alter table public.supplier_assets drop constraint if exists supplier_assets_has_image;
alter table public.supplier_assets add constraint supplier_assets_has_image
  check (storage_path is not null or image_url is not null);

-- get_supplier_assets: includi image_url (la card mostra image_url se presente, altrimenti il file)
create or replace function public.get_supplier_assets(p_slug text, p_event_kind text default null, p_limit int default 40)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_sup uuid;
begin
  select id into v_sup from public.profiles where slug = p_slug limit 1;
  if v_sup is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'path', a.storage_path, 'image_url', a.image_url, 'caption', a.caption, 'tags', a.tags)
                     order by a.sort_order, a.created_at desc)
    from public.supplier_assets a
    where a.supplier_id = v_sup and a.is_public
      and (p_event_kind is null or a.event_kind is null or a.event_kind = p_event_kind)
    limit greatest(1, least(coalesce(p_limit, 40), 100))
  ), '[]'::jsonb);
end$$;
grant execute on function public.get_supplier_assets(text, text, int) to anon, authenticated;
