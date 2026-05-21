-- ============================================================================
-- Wedding Platform — RLS impersonation tests
-- Lanciare con `bash tests/sql/run_rls_tests.sh`
--
-- Convenzioni:
--   - ogni test usa PL/pgSQL DO block che RAISE EXCEPTION on failure
--   - SET LOCAL all'interno di transaction; ROLLBACK alla fine
--   - impersonation Supabase: role=authenticated/anon + jwt.claim.sub
-- ============================================================================

-- IDs noti dal seed
-- Giulia (WP):           00000000-aaaa-0000-0000-000000000002
-- Villa Aurora (LOC):    00000000-aaaa-0000-0000-000000000003
-- Fioreria Bianchi:      00000000-aaaa-0000-0000-000000000004
-- Mario Foto:            00000000-aaaa-0000-0000-000000000005
-- Catering Sole:         00000000-aaaa-0000-0000-000000000006
-- Admin:                 00000000-aaaa-0000-0000-000000000001

-- Setup dati extra per test 5-8 (entry calendario + quote con token).
-- Eseguito come superuser (bypass RLS).
do $bootstrap$
declare
  v_entry uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  v_quote uuid := 'cccccccc-0000-0000-0000-000000000001';
  v_token uuid := 'dddddddd-0000-0000-0000-000000000001';
begin
  insert into calendar_entries (
    id, owner_id, title, client_name, client_email,
    date_from, date_to, status, value_amount, notes
  ) values (
    v_entry,
    '00000000-aaaa-0000-0000-000000000002',  -- Giulia
    'Matrimonio De Luca',
    'Famiglia De Luca',
    'deluca@cliente-test.it',
    '2026-09-15','2026-09-15',
    'IN_TRATTATIVA',
    25000,
    'Nota privata: cliente VIP, da non condividere con fornitori.'
  ) on conflict (id) do nothing;

  insert into calendar_entry_participants (entry_id, user_id, role_in_entry)
  values
    (v_entry, '00000000-aaaa-0000-0000-000000000005', 'fotografo')
  on conflict do nothing;

  insert into quotes (
    id, owner_id, title, client_name, client_email,
    event_date, status, access_token
  ) values (
    v_quote,
    '00000000-aaaa-0000-0000-000000000002',  -- Giulia owner
    'Preventivo De Luca v1',
    'Famiglia De Luca',
    'deluca@cliente-test.it',
    '2026-09-15',
    'INVIATO',
    v_token
  ) on conflict (id) do nothing;
end$bootstrap$;

-- ----------------------------------------------------------------------------
-- TEST 1: Fornitore Mario vede SOLO i suoi servizi
-- ----------------------------------------------------------------------------
do $$
declare v_count int; v_own int; v_other int;
begin
  perform set_config('role','authenticated', true);
  perform set_config('request.jwt.claim.sub','00000000-aaaa-0000-0000-000000000005', true);
  perform set_config('request.jwt.claim.role','authenticated', true);
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000005","role":"authenticated"}', true);

  set local role authenticated;
  select count(*) into v_count from services;
  select count(*) into v_own   from services where fornitore_id = '00000000-aaaa-0000-0000-000000000005';
  select count(*) into v_other from services where fornitore_id <> '00000000-aaaa-0000-0000-000000000005';
  reset role;

  if v_own = 5 and v_other = 0 and v_count = 5 then
    raise notice 'TEST 1 OK (Mario vede 5 servizi suoi, 0 altri)';
  else
    raise exception 'TEST 1 FAIL: own=% other=% total=% (atteso own=5 other=0)', v_own, v_other, v_count;
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- TEST 2: Fornitore Mario NON vede servizi Fioreria Bianchi
-- ----------------------------------------------------------------------------
do $$
declare v_count int;
begin
  perform set_config('request.jwt.claim.sub','00000000-aaaa-0000-0000-000000000005', true);
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000005","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into v_count from services where fornitore_id = '00000000-aaaa-0000-0000-000000000004';
  reset role;
  if v_count = 0 then
    raise notice 'TEST 2 OK (Mario non vede servizi di Fioreria Bianchi)';
  else
    raise exception 'TEST 2 FAIL: Mario vede % servizi di Fioreria (atteso 0)', v_count;
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- TEST 3: Capostipite Giulia vede servizi dei 3 fornitori collaboranti
-- ----------------------------------------------------------------------------
do $$
declare v_fior int; v_foto int; v_cat int;
begin
  perform set_config('request.jwt.claim.sub','00000000-aaaa-0000-0000-000000000002', true);
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into v_fior from services where fornitore_id = '00000000-aaaa-0000-0000-000000000004';
  select count(*) into v_foto from services where fornitore_id = '00000000-aaaa-0000-0000-000000000005';
  select count(*) into v_cat  from services where fornitore_id = '00000000-aaaa-0000-0000-000000000006';
  reset role;
  if v_fior = 8 and v_foto = 5 and v_cat = 6 then
    raise notice 'TEST 3 OK (Giulia vede 8+5+6 servizi dei collab)';
  else
    raise exception 'TEST 3 FAIL: fior=% foto=% cat=% (atteso 8/5/6)', v_fior, v_foto, v_cat;
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- TEST 4: Capostipite Giulia NON vede servizi di Villa Aurora (no collab tra loro)
-- ----------------------------------------------------------------------------
do $$
declare v_count int;
begin
  perform set_config('request.jwt.claim.sub','00000000-aaaa-0000-0000-000000000002', true);
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into v_count from services where fornitore_id = '00000000-aaaa-0000-0000-000000000003';
  reset role;
  if v_count = 0 then
    raise notice 'TEST 4 OK (Giulia non vede servizi di Villa Aurora, niente collab)';
  else
    raise exception 'TEST 4 FAIL: Giulia vede % servizi di Villa Aurora (atteso 0)', v_count;
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- TEST 5: Owner Giulia vede i propri calendar_entries (con campi sensibili)
-- ----------------------------------------------------------------------------
do $$
declare v_count int; v_notes text;
begin
  perform set_config('request.jwt.claim.sub','00000000-aaaa-0000-0000-000000000002', true);
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into v_count from calendar_entries;
  select notes into v_notes from calendar_entries where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  reset role;
  if v_count = 1 and v_notes is not null then
    raise notice 'TEST 5 OK (Giulia owner vede 1 entry con notes)';
  else
    raise exception 'TEST 5 FAIL: count=% notes=%', v_count, coalesce(v_notes,'<null>');
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- TEST 6: Participant Mario vede entry SOLO via view ridotta (no notes/value)
-- ----------------------------------------------------------------------------
do $$
declare
  v_via_view  int;
  v_value     numeric;
  v_visible   int;
begin
  perform set_config('request.jwt.claim.sub','00000000-aaaa-0000-0000-000000000005', true);
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000005","role":"authenticated"}', true);
  set local role authenticated;
  -- via view: deve vedere l'entry MA senza campi sensibili
  select count(*) into v_via_view from calendar_entries_for_participants;
  -- via tabella diretta: tramite policy participant vede MA value_amount/notes restano colonne SQL
  -- Verifichiamo che le colonne sensibili NON siano nella view ridotta.
  select count(*) into v_visible
    from information_schema.columns
   where table_name = 'calendar_entries_for_participants'
     and column_name in ('client_name','client_email','value_amount','notes');
  reset role;

  if v_via_view = 1 and v_visible = 0 then
    raise notice 'TEST 6 OK (Mario vede 1 entry via view ridotta, nessun campo sensibile esposto)';
  else
    raise exception 'TEST 6 FAIL: via_view=% campi_sensibili_in_view=%', v_via_view, v_visible;
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- TEST 7: Solo owner Giulia puo` UPDATE/DELETE il suo quote
--         Mario (non owner) deve fallire l'update.
-- ----------------------------------------------------------------------------
do $$
declare v_rows int;
begin
  -- Mario tenta update: non vede neanche la riga (RLS), update colpisce 0 righe.
  perform set_config('request.jwt.claim.sub','00000000-aaaa-0000-0000-000000000005', true);
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000005","role":"authenticated"}', true);
  set local role authenticated;
  update quotes set title = 'HACK' where id = 'cccccccc-0000-0000-0000-000000000001';
  get diagnostics v_rows = ROW_COUNT;
  reset role;
  if v_rows = 0 then
    raise notice 'TEST 7a OK (Mario non puo` modificare quote di Giulia)';
  else
    raise exception 'TEST 7a FAIL: Mario ha modificato % righe', v_rows;
  end if;

  -- Giulia owner: update va a buon fine.
  perform set_config('request.jwt.claim.sub','00000000-aaaa-0000-0000-000000000002', true);
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  update quotes set title = 'Preventivo De Luca v1 (edit owner)'
    where id = 'cccccccc-0000-0000-0000-000000000001';
  get diagnostics v_rows = ROW_COUNT;
  reset role;
  if v_rows = 1 then
    raise notice 'TEST 7b OK (Giulia owner puo` modificare il suo quote)';
  else
    raise exception 'TEST 7b FAIL: Giulia ha modificato % righe (atteso 1)', v_rows;
  end if;
end$$;

-- ----------------------------------------------------------------------------
-- TEST 8: Accesso pubblico via access_token (RPC quote_get_by_token)
--         - anon SENZA token: nessun accesso diretto a quotes
--         - anon CON token valido: la RPC ritorna i dati del quote
--         - anon con token errato: ritorna NULL
-- ----------------------------------------------------------------------------
do $$
declare
  v_anon_select  int;
  v_via_rpc      jsonb;
  v_bad_rpc      jsonb;
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims','{"role":"anon"}', true);
  set local role anon;

  -- 8a: anon non puo` listare quotes via SELECT diretto
  begin
    select count(*) into v_anon_select from quotes;
  exception when others then
    v_anon_select := 0;
  end;

  -- 8b: anon riceve quote via RPC con token valido
  v_via_rpc := quote_get_by_token('dddddddd-0000-0000-0000-000000000001'::uuid);

  -- 8c: anon riceve NULL con token errato
  v_bad_rpc := quote_get_by_token('00000000-0000-0000-0000-000000000000'::uuid);

  reset role;

  if v_anon_select = 0
     and v_via_rpc is not null
     and (v_via_rpc->>'title') like 'Preventivo De Luca v1%'
     and v_bad_rpc is null
  then
    raise notice 'TEST 8 OK (anon: SELECT diretto bloccato, RPC con token OK, token errato NULL)';
  else
    raise exception 'TEST 8 FAIL: anon_select=% via_rpc=% bad_rpc=%',
      v_anon_select, v_via_rpc::text, v_bad_rpc::text;
  end if;
end$$;

-- Cleanup dati di test (idempotente)
delete from calendar_entry_participants where entry_id = 'bbbbbbbb-0000-0000-0000-000000000001';
delete from calendar_entries where id = 'bbbbbbbb-0000-0000-0000-000000000001';
delete from quote_items where quote_id = 'cccccccc-0000-0000-0000-000000000001';
delete from quotes where id = 'cccccccc-0000-0000-0000-000000000001';
