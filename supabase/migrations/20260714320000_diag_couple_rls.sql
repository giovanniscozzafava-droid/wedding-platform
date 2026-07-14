-- DIAG (read-only): il vero user della coppia è riconosciuto come is_wedding_couple sull'evento?
do $$
declare v_uid uuid; v_is_couple boolean; v_is_guest boolean; v_email text;
        v_entry uuid := 'a651dc95-83fe-41ab-8a6e-5504b50c6b3a';
begin
  select m.user_id into v_uid from public.wedding_couple_members m where m.entry_id = v_entry limit 1;
  select email into v_email from auth.users where id = v_uid;
  raise notice 'DIAG couple user_id=% email=%', v_uid, v_email;

  -- simula la sessione della coppia
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text)::text, true);
  v_is_couple := public.is_wedding_couple(v_entry);
  v_is_guest  := public._photo_is_guest(v_entry);
  raise notice 'DIAG con la sessione della coppia → is_wedding_couple=% | _photo_is_guest=%', v_is_couple, v_is_guest;

  -- chi è il "guest_user_id" registrato che coincide con la coppia?
  raise notice 'DIAG la coppia è anche registrata come ospite? %',
    exists(select 1 from public.gallery_guests g where g.entry_id=v_entry and g.guest_user_id=v_uid);
end $$;
