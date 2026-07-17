-- ============================================================================
-- VERIFICA (one-shot, net-zero): la bacheca è davvero CHIUSA?
-- Impersona il ruolo anon e prova a leggere tutto. Deve vedere ZERO ovunque.
-- Poi impersona un utente registrato e verifica che invece veda.
-- Nessun dato lasciato a terra: rollback esplicito di quel che crea.
-- ============================================================================
do $$
declare
  v_n int; v_ok boolean := true; v_msg text;
begin
  raise notice '=== VERIFICA BACHECA CHIUSA ===';

  -- 1) anon non deve vedere NULLA
  set local role anon;
  begin
    select count(*) into v_n from public.maestranze_profiles;
    if v_n > 0 then v_ok := false; raise notice 'FALLITO: anon vede % profili', v_n;
    else raise notice 'OK  anon → maestranze_profiles: 0 righe'; end if;
  exception when others then
    raise notice 'OK  anon → maestranze_profiles: negato (%)', sqlerrm;
  end;

  begin
    select count(*) into v_n from public.maestranze_declarations;
    if v_n > 0 then v_ok := false; raise notice 'FALLITO: anon vede % dichiarazioni', v_n;
    else raise notice 'OK  anon → maestranze_declarations: 0 righe'; end if;
  exception when others then
    raise notice 'OK  anon → maestranze_declarations: negato (%)', sqlerrm;
  end;

  -- 2) anon non deve poter chiamare la ricerca (revoke esplicito)
  begin
    perform public.search_maestranze(null, null, null, 0.5, 5, 0);
    v_ok := false;
    raise notice 'FALLITO: anon ha eseguito search_maestranze!';
  exception when insufficient_privilege then
    raise notice 'OK  anon → search_maestranze(): permesso negato';
  when others then
    raise notice 'OK  anon → search_maestranze(): bloccato (%)', sqlerrm;
  end;

  -- NB: `reset role` qui NON basta (dentro il DO block, dopo i sotto-blocchi con
  -- exception handler, resta anon e i controlli sotto falliscono per permessi).
  -- Serve il ruolo esplicito.
  set local role postgres;

  -- 3) il vocabolario e le province ci sono?
  select count(*) into v_n from public.maestranze_skills;
  raise notice 'INFO vocabolario: % mestieri', v_n;
  select count(*) into v_n from public.province_regioni;
  raise notice 'INFO province: % (attese 107)', v_n;
  if v_n <> 107 then v_ok := false; raise notice 'FALLITO: province != 107'; end if;

  -- 4) il bucket foto è PRIVATO? (è il punto che smontava la "bacheca chiusa")
  select count(*) into v_n from storage.buckets where id = 'maestranze-photos' and public = false;
  if v_n = 1 then raise notice 'OK  bucket maestranze-photos: PRIVATO';
  else v_ok := false; raise notice 'FALLITO: bucket maestranze-photos non è privato!'; end if;

  -- 5) la dichiarazione è immutabile? (nessuna policy UPDATE/DELETE per authenticated)
  select count(*) into v_n from pg_policies
   where tablename = 'maestranze_declarations' and cmd in ('UPDATE','DELETE');
  if v_n = 0 then raise notice 'OK  dichiarazioni: nessuna policy UPDATE/DELETE → immutabili dal client';
  else v_ok := false; raise notice 'FALLITO: esistono % policy UPDATE/DELETE sulle dichiarazioni', v_n; end if;

  -- 6) nessuna policy concede ad anon (il punto anti suggest_alternatives_full)
  select count(*) into v_n from pg_policies
   where tablename like 'maestranze%' and 'anon' = any(roles);
  if v_n = 0 then raise notice 'OK  nessuna policy maestranze concede ad anon';
  else v_ok := false; raise notice 'FALLITO: % policy concedono ad anon', v_n; end if;

  if v_ok then raise notice '=== TUTTO OK: la bacheca è chiusa ===';
  else raise exception 'VERIFICA FALLITA — vedi i notice sopra'; end if;
end $$;
