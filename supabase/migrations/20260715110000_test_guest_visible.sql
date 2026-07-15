-- TEST (self-cleaning): un ospite registrato vede i media di una cartella LAVORO_INTERO solo se guest_visible.
do $$
declare v_entry uuid := 'a651dc95-83fe-41ab-8a6e-5504b50c6b3a'; v_guest uuid; v_folder uuid;
        v_prev boolean; v_is_guest boolean; v_off int; v_on int;
begin
  select guest_user_id into v_guest from public.gallery_guests where entry_id = v_entry and guest_user_id is not null limit 1;
  select id, guest_visible into v_folder, v_prev from public.gallery_folders where entry_id = v_entry and level='LAVORO_INTERO' limit 1;
  if v_guest is null or v_folder is null then raise notice 'TEST GUEST-VISIBLE: dati insufficienti, salto'; return; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_guest::text)::text, true);
  v_is_guest := public._photo_is_guest(v_entry);

  -- clausola RLS per ospite: media visibili di quella cartella con guest_visible OFF
  update public.gallery_folders set guest_visible = false where id = v_folder;
  select count(*) into v_off from public.gallery_media m join public.gallery_folders f on f.id=m.folder_id
    where m.folder_id = v_folder and f.guest_visible and public._photo_is_guest(f.entry_id);
  -- ...con guest_visible ON
  update public.gallery_folders set guest_visible = true where id = v_folder;
  select count(*) into v_on from public.gallery_media m join public.gallery_folders f on f.id=m.folder_id
    where m.folder_id = v_folder and f.guest_visible and public._photo_is_guest(f.entry_id);

  update public.gallery_folders set guest_visible = v_prev where id = v_folder;   -- ripristina

  if v_is_guest and v_off = 0 and v_on > 0 then
    raise notice 'TEST GUEST-VISIBLE: OK — ospite vede % foto con flag ON, 0 con flag OFF', v_on;
  else
    raise notice 'TEST GUEST-VISIBLE: ESITO INATTESO is_guest=% off=% on=%', v_is_guest, v_off, v_on;
  end if;
end $$;
