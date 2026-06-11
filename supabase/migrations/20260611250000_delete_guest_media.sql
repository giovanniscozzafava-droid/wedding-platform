-- Le foto/video caricati dagli OSPITI possono essere eliminati singolarmente dal
-- fornitore proprietario della galleria (chi ha emanato il servizio) o dagli sposi.
-- Solo i contributi degli ospiti (uploaded_by valorizzato), non il lavoro del fotografo.
create or replace function public.delete_guest_media(p_media uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_owner uuid; v_uploaded uuid; v_drive text;
begin
  select gm.entry_id, gm.uploaded_by, gm.drive_file_id, g.owner_id
    into v_entry, v_uploaded, v_drive, v_owner
    from public.gallery_media gm join public.event_galleries g on g.id = gm.gallery_id
   where gm.id = p_media;
  if v_entry is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_uploaded is null then return jsonb_build_object('error', 'not_guest_media'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(v_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  -- rimuovi anche il file dallo storage (se upload ospite)
  if v_drive like 'guest:%' then
    delete from storage.objects where bucket_id = 'event-guest-uploads' and name = substr(v_drive, 7);
  end if;
  delete from public.gallery_media where id = p_media;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.delete_guest_media(uuid) to authenticated;
