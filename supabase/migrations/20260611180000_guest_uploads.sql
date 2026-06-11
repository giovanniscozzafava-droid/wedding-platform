-- Gli invitati caricano FOTO e VIDEO dell'evento; i fornitori del cerchio
-- (fotografo, videomaker, ...) possono usarli. Il consenso al riutilizzo promozionale
-- è OBBLIGATORIO ("clausola sine qua non": senza spunta non si carica).

alter table public.gallery_media
  add column if not exists uploaded_by uuid,
  add column if not exists promo_consent boolean not null default false;

-- Bucket pubblico per gli upload degli invitati (coerente con le miniature pubbliche).
insert into storage.buckets (id, name, public) values ('event-guest-uploads', 'event-guest-uploads', true)
  on conflict (id) do nothing;

-- Storage: l'ospite carica SOLO nella cartella del proprio evento (entry_id = 1° segmento path).
drop policy if exists guest_upload_insert on storage.objects;
create policy guest_upload_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'event-guest-uploads'
  and exists (select 1 from public.gallery_guests g
              where g.guest_user_id = auth.uid() and g.entry_id::text = (storage.foldername(name))[1])
);

-- gm_read: i media caricati dagli ospiti (uploaded_by valorizzato) sono leggibili
-- ANCHE dai membri del cerchio → il fotografo/videomaker li ritrova e li usa.
drop policy if exists gm_read on public.gallery_media;
create policy gm_read on public.gallery_media for select using (
  is_admin()
  or _photo_gallery_owner(gallery_id)
  or is_wedding_couple(entry_id)
  or (uploaded_by is not null and _photo_circle_member(entry_id))
  or exists (
    select 1 from public.gallery_folders f
    where f.id = gallery_media.folder_id and (
         (f.level = 'LAVORAZIONE' and (f.assigned_to = auth.uid()
            or (f.assigned_subrole is not null and f.assigned_subrole = _photo_my_subrole() and _photo_circle_member(f.entry_id))))
      or (f.level = 'LAVORO_INTERO' and f.shared and _photo_circle_member(f.entry_id) and _photo_lavoro_consented(f.entry_id))
      or (f.level = 'INVITATI' and _photo_is_guest(f.entry_id))
    )
  )
);

-- L'ospite registra il media caricato (consenso promo obbligatorio). SECURITY DEFINER
-- per inserire in gallery_media/gallery_folders (l'ospite non ha write diretta lì).
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
            case when p_media_type = 'VIDEO' then 'VIDEO' else 'PHOTO' end, auth.uid(), true);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.guest_add_media(uuid, text, text, text, boolean) to authenticated;
