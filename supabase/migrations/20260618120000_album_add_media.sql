-- IMPORT FOTO NELL'ALBUM: il fotografo (proprietario galleria) o gli sposi possono
-- AGGIUNGERE altre foto direttamente dall'impaginatore, senza passare da Drive.
-- Le foto finiscono in una cartella "Foto aggiunte all'album" (level EXTRA), già
-- marcate KEPT (entrano subito nella selezione/cassetto a sinistra) con momento facoltativo.

-- 1) Storage: chi può EDITARE l'album carica nel proprio evento (entry_id = 1° segmento path).
--    Riusa il bucket pubblico già esistente degli upload evento.
drop policy if exists album_upload_insert on storage.objects;
create policy album_upload_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'event-guest-uploads'
  and (storage.foldername(name))[1] ~* '^[0-9a-fA-F-]{36}$'
  and public.album_can_edit(((storage.foldername(name))[1])::uuid)
);

-- 2) Registra il media aggiunto all'album (SECURITY DEFINER: scrive in gallery_media/
--    gallery_folders/event_galleries che l'utente non tocca direttamente).
create or replace function public.album_add_media(p_entry uuid, p_storage_path text, p_thumb text, p_media_type text, p_moment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gal uuid; v_folder uuid; v_id uuid;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  select id into v_gal from public.event_galleries where entry_id = p_entry limit 1;
  if v_gal is null then
    insert into public.event_galleries(entry_id, owner_id, title)
      values (p_entry, auth.uid(), 'Album') returning id into v_gal;
  end if;
  select id into v_folder from public.gallery_folders
    where gallery_id = v_gal and level = 'EXTRA' and name = 'Foto aggiunte all''album' limit 1;
  if v_folder is null then
    insert into public.gallery_folders(gallery_id, entry_id, name, level, sort_order)
      values (v_gal, p_entry, 'Foto aggiunte all''album', 'EXTRA',
              coalesce((select max(sort_order) + 1 from public.gallery_folders where gallery_id = v_gal), 0))
      returning id into v_folder;
  end if;
  insert into public.gallery_media(folder_id, gallery_id, entry_id, drive_file_id, thumbnail_link, media_type, album_choice, album_moment, uploaded_by)
    values (v_folder, v_gal, p_entry, 'album:' || p_storage_path, p_thumb,
            (case when p_media_type = 'VIDEO' then 'VIDEO' else 'PHOTO' end)::public.gallery_media_type,
            'KEPT', nullif(p_moment, ''), auth.uid())
    returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.album_add_media(uuid, text, text, text, text) to authenticated;
