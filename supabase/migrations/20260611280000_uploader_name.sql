-- Mostrare "da <Nome>" (solo nome, niente cognome) su chi ha caricato la foto/video.
-- Denormalizziamo il nome al momento dell'upload (split_part sul primo token).
alter table public.gallery_media add column if not exists uploader_name text;

create or replace function public.guest_add_media(p_entry uuid, p_storage_path text, p_thumb text, p_media_type text, p_promo boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gal uuid; v_folder uuid; v_name text;
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
  -- solo il PRIMO nome di chi carica
  select coalesce(nullif(split_part(coalesce(
            (select full_name_searched from public.gallery_guests where entry_id = p_entry and guest_user_id = auth.uid()),
            (select full_name from public.profiles where id = auth.uid()), ''), ' ', 1), ''), 'Un invitato')
    into v_name;
  insert into public.gallery_media(folder_id, gallery_id, entry_id, drive_file_id, thumbnail_link, media_type, uploaded_by, promo_consent, uploader_name)
    values (v_folder, v_gal, p_entry, 'guest:' || p_storage_path, p_thumb,
            (case when p_media_type = 'VIDEO' then 'VIDEO' else 'PHOTO' end)::public.gallery_media_type, auth.uid(), true, v_name);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.guest_add_media(uuid, text, text, text, boolean) to authenticated;

-- backfill upload ospiti già esistenti
update public.gallery_media gm
   set uploader_name = coalesce(nullif(split_part(coalesce(gg.full_name_searched, p.full_name, ''), ' ', 1), ''), 'Un invitato')
  from public.gallery_guests gg
  left join public.profiles p on p.id = gg.guest_user_id
 where gm.uploaded_by is not null and gm.uploader_name is null
   and gg.entry_id = gm.entry_id and gg.guest_user_id = gm.uploaded_by;
