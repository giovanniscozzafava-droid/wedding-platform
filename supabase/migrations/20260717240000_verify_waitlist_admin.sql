-- Verifica one-shot: la lista nominativa funziona per un admin e NON per altri.
-- Impersona (request.jwt.claim.sub) l'admin e un non-admin, net-zero.
do $$
declare v_admin uuid; v_other uuid; v_n int; v_ok boolean := true;
begin
  select id into v_admin from public.profiles where role = 'ADMIN' limit 1;
  select id into v_other from public.profiles where role <> 'ADMIN' limit 1;

  -- come ADMIN → deve vedere l'elenco
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role','authenticated')::text, true);
  select count(*) into v_n from public.maestranze_waitlist_list();
  raise notice 'OK  admin -> maestranze_waitlist_list(): % righe', v_n;

  -- come NON-admin → deve fallire (forbidden)
  perform set_config('request.jwt.claim.sub', v_other::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_other, 'role','authenticated')::text, true);
  begin
    perform public.maestranze_waitlist_list();
    v_ok := false; raise notice 'FALLITO: un non-admin ha letto la lista!';
  exception when others then
    raise notice 'OK  non-admin -> maestranze_waitlist_list(): negato (%)', sqlerrm;
  end;

  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);

  if v_ok then raise notice '=== lista nominativa: guard OK ==='; else raise exception 'verifica fallita'; end if;
end $$;
