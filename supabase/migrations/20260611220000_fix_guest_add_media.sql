-- FIX upload ospiti: gallery_media.media_type è un enum (gallery_media_type) ma la
-- funzione inseriva un valore TEXT da una CASE → "column media_type is of type
-- gallery_media_type but expression is of type text" → l'upload ospite falliva sempre.
-- Cast esplicito della CASE all'enum.
create or replace function public.guest_add_media(p_entry uuid, p_storage_path text, p_thumb text, p_media_type text, p_promo boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gal uuid; v_folder uuid;
begin
  if not public._photo_is_guest(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_promo is not true then return jsonb_build_object('error', 'consent_required'); end if;
  select id into v_gal from public.event_galleries where entry_id = p_entry;
  if v_gal is null then return jsonb_build_object('error', 'no_gallery'); end if;
  select id into v_folder from public.gallery_folders
    where gallery_id = v_gal and level = 'INVITATI' and name = 'Foto & video degli ospiti' limit 1;
  if v_folder is null then
    insert into public.gallery_folders(gallery_id, entry_id, name, level, sort_order)
      values (v_gal, p_entry, 'Foto & video degli ospiti', 'INVITATI',
              coalesce((select max(sort_order) + 1 from public.gallery_folders where gallery_id = v_gal), 0))
      returning id into v_folder;
  end if;
  insert into public.gallery_media(folder_id, gallery_id, entry_id, drive_file_id, thumbnail_link, media_type, uploaded_by, promo_consent)
    values (v_folder, v_gal, p_entry, 'guest:' || p_storage_path, p_thumb,
            (case when p_media_type = 'VIDEO' then 'VIDEO' else 'PHOTO' end)::public.gallery_media_type, auth.uid(), true);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.guest_add_media(uuid, text, text, text, boolean) to authenticated;
