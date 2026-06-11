-- FIX: il DELETE diretto su storage.objects è vietato da Supabase ("Use the Storage
-- API instead") → delete_guest_media andava in errore. Ora l'RPC elimina solo la riga
-- gallery_media e RITORNA il path; il file viene rimosso dal client via Storage API.
-- + policy storage DELETE per owner/sposi/admin sui file ospiti del proprio evento.
create or replace function public.delete_guest_media(p_media uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_owner uuid; v_uploaded uuid; v_drive text; v_path text;
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
  delete from public.gallery_media where id = p_media;
  if v_drive like 'guest:%' then v_path := substr(v_drive, 7); end if;
  return jsonb_build_object('ok', true, 'path', v_path);
end$$;
grant execute on function public.delete_guest_media(uuid) to authenticated;

drop policy if exists guest_upload_delete on storage.objects;
create policy guest_upload_delete on storage.objects for delete to authenticated using (
  bucket_id = 'event-guest-uploads' and exists (
    select 1 from public.event_galleries g
    where g.entry_id::text = (storage.foldername(objects.name))[1]
      and (g.owner_id = auth.uid() or public.is_wedding_couple(g.entry_id) or public.is_admin())
  )
);
