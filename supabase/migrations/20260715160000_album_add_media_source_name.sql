-- SOSTITUISCI FOTO: quando il fotografo ri-carica una foto ricolorata (stesso nome file), la
-- versione nuova deve poter essere RITROVATA per nome anche ai giri successivi di color. Per farlo
-- salviamo il nome file (source_name) anche sui media caricati dall'impaginatore, non solo su quelli
-- da Drive. Aggiungiamo il parametro p_source_name ad album_add_media.
--
-- Si fa DROP + CREATE (non solo CREATE OR REPLACE): aggiungere un parametro con DEFAULT crea una
-- funzione con firma diversa e lascerebbe DUE overload → PostgREST andrebbe in ambiguità quando la
-- si chiama con i primi 5 argomenti. Dropiamo la vecchia firma a 5 argomenti e teniamo solo la nuova.

drop function if exists public.album_add_media(uuid, text, text, text, text);

create or replace function public.album_add_media(
  p_entry uuid, p_storage_path text, p_thumb text, p_media_type text, p_moment text,
  p_source_name text default null
)
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
  insert into public.gallery_media(folder_id, gallery_id, entry_id, drive_file_id, thumbnail_link, media_type, album_choice, album_moment, uploaded_by, source_name)
    values (v_folder, v_gal, p_entry, 'album:' || p_storage_path, p_thumb,
            (case when p_media_type = 'VIDEO' then 'VIDEO' else 'PHOTO' end)::public.gallery_media_type,
            'KEPT', nullif(p_moment, ''), auth.uid(), nullif(p_source_name, ''))
    returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end$$;
grant execute on function public.album_add_media(uuid, text, text, text, text, text) to authenticated;
