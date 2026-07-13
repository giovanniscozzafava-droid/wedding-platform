-- Foto piatto (wow effect): la location carica una foto per piatto → mostrata nelle card di
-- confronto lato coppia. Bucket pubblico in lettura, scrittura solo nella cartella {auth.uid()}.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fb-dish-photos', 'fb-dish-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists fb_dish_photos_read on storage.objects;
create policy fb_dish_photos_read on storage.objects for select
  using (bucket_id = 'fb-dish-photos');

drop policy if exists fb_dish_photos_insert on storage.objects;
create policy fb_dish_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'fb-dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists fb_dish_photos_update on storage.objects;
create policy fb_dish_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'fb-dish-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'fb-dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists fb_dish_photos_delete on storage.objects;
create policy fb_dish_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'fb-dish-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- RPC: la location salva/azzera l'URL foto del piatto (validando la proprietà del menu).
create or replace function public.fb_dish_set_photo(p_menu_item_id uuid, p_url text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_loc uuid;
begin
  select mm.location_id into v_loc from public.fb_menu_items mi join public.fb_menus mm on mm.id = mi.menu_id where mi.id = p_menu_item_id;
  if v_loc is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_loc = auth.uid() or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  update public.fb_menu_items set photo_url = nullif(btrim(coalesce(p_url,'')),'') where id = p_menu_item_id;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.fb_dish_set_photo(uuid, text) to authenticated;
