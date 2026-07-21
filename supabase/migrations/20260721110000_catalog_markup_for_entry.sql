-- album_catalog_for_entry ora restituisce anche markup_percent del catalogo, così il picker può
-- applicare il RICARICO del fotografo ai modelli DesignAlbum di default (il cui prezzo di listino = costo).
create or replace function public.album_catalog_for_entry(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_studio text; v_cats jsonb; v_models jsonb; v_cat0 jsonb;
begin
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  if v_owner is null then select owner_id into v_owner from public.calendar_entries where id = p_entry limit 1; end if;
  if v_owner is null then return jsonb_build_object('error', 'no_event'); end if;

  select coalesce(business_name, full_name, 'Studio') into v_studio from public.profiles where id = v_owner;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'pdf_path', pdf_path, 'page_count', page_count, 'markup_percent', markup_percent)
           order by created_at), '[]'::jsonb)
    into v_cats from public.album_catalogs where owner_id = v_owner and active;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', h.id, 'catalog_id', h.catalog_id, 'page', h.page, 'x', h.x, 'y', h.y, 'w', h.w, 'h', h.h,
           'label', h.label, 'default_format', h.default_format, 'default_pages', h.default_pages,
           'price', h.price, 'image_path', h.image_path, 'options', h.options
         ) order by h.sort_order, h.page, h.created_at), '[]'::jsonb)
    into v_models from public.album_catalog_hotspots h
    where h.owner_id = v_owner
       or h.catalog_id in (select id from public.album_catalogs where owner_id = v_owner);

  v_cat0 := v_cats -> 0;
  return jsonb_build_object('ok', true, 'studio', v_studio,
    'catalogs', v_cats, 'models', v_models,
    'catalog', case when v_cat0 is null then null else jsonb_build_object(
        'id', v_cat0->>'id', 'name', v_cat0->>'name', 'pdf_path', v_cat0->>'pdf_path',
        'page_count', (v_cat0->>'page_count')::int, 'markup_percent', (v_cat0->>'markup_percent')::numeric,
        'owner_id', v_owner, 'studio', v_studio) end,
    'hotspots', coalesce((select jsonb_agg(m) from jsonb_array_elements(v_models) m
                          where m->>'catalog_id' = v_cat0->>'id'), '[]'::jsonb));
end$$;
grant execute on function public.album_catalog_for_entry(uuid) to authenticated;
