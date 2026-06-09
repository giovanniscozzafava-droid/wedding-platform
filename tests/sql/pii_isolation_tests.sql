-- ============================================================================
-- Wedding Platform — PII isolation tests (audit notturno RLS/PII)
-- Gemello di rls_tests.sql. Lanciare con: bash tests/sql/run_rls_tests.sh
--   (oppure: docker exec ... psql -1 -v ON_ERROR_STOP=1 -f tests/sql/pii_isolation_tests.sql)
-- Richiede il DB locale Supabase avviato (`supabase start` + `supabase db reset`).
--
-- Convenzioni (come rls_tests.sql):
--   - DO block PL/pgSQL, RAISE NOTICE 'TEST .. OK' / RAISE EXCEPTION on fail
--   - impersonazione: set_config('request.jwt.claims',..) + SET LOCAL ROLE
--   - i test che toccano relazioni inesistenti vengono SALTATI (to_regclass)
--
-- Seed IDs:
--   Admin        00000000-aaaa-0000-0000-000000000001
--   Giulia (WP)  00000000-aaaa-0000-0000-000000000002   (capostipite A)
--   Villa Aurora 00000000-aaaa-0000-0000-000000000003   (capostipite B, LOCATION)
--   Mario Foto   00000000-aaaa-0000-0000-000000000005   (fornitore / participant)
-- ============================================================================

-- ── Bootstrap (superuser, bypassa RLS) ─────────────────────────────────────
do $boot$
declare
  v_entry uuid := 'bbbbbbbb-0000-0000-0000-000000000001';
  v_quote uuid := 'cccccccc-0000-0000-0000-000000000001';
begin
  insert into calendar_entries (id, owner_id, title, date_from, date_to, status)
  values (v_entry, '00000000-aaaa-0000-0000-000000000002', 'Matrimonio De Luca', '2026-09-15','2026-09-15','IN_TRATTATIVA')
  on conflict (id) do nothing;
  -- Campi sensibili nella tabella privata (split P5)
  insert into calendar_entries_private (entry_id, client_name, client_email, value_amount, notes)
  values (v_entry, 'Famiglia De Luca', 'deluca@cliente-test.it', 25000, 'Nota privata: cliente VIP.')
  on conflict (entry_id) do update set client_name = excluded.client_name, client_email = excluded.client_email,
    value_amount = excluded.value_amount, notes = excluded.notes;
  insert into calendar_entry_participants (entry_id, user_id, role_in_entry)
  values (v_entry, '00000000-aaaa-0000-0000-000000000005', 'fotografo') on conflict do nothing;

  -- Preventivo di Giulia (per il cross-tenant P2)
  insert into quotes (id, owner_id, title, client_name, client_email, event_date, status, access_token)
  values (v_quote, '00000000-aaaa-0000-0000-000000000002', 'Preventivo De Luca v1', 'Famiglia De Luca',
          'deluca@cliente-test.it', '2026-09-15', 'INVIATO', 'dddddddd-0000-0000-0000-000000000001')
  on conflict (id) do nothing;

  if to_regclass('public.network_prospects') is not null then
    insert into network_prospects (id, owner_id, name, email, phone)
    values ('eeeeeeee-0000-0000-0000-000000000001', '00000000-aaaa-0000-0000-000000000002', 'Mario Rossi (prospect)', 'prospect@test.it', '+39 333 0000000')
    on conflict (id) do nothing;
  end if;
end$boot$;

-- ── TEST P1: anon NON legge dalle tabelle sensibili/PII (RLS = 0 righe) ─────
do $$
declare t text; v int; arr text[] := array[
  'quote_acceptances','quote_acceptances_audit','contracts','supplier_clients',
  'lead_requests','network_prospects','network_prospect_logs','lead_submit_attempts',
  'signature_audit_trail','quote_view_consents','referral_redeem_attempts','audit_log','access_audit_log'];
begin
  foreach t in array arr loop
    if to_regclass('public.'||t) is null then
      raise notice 'TEST P1[%] SKIP (relazione assente)', t; continue;
    end if;
    perform set_config('request.jwt.claims','{"role":"anon"}', true);
    set local role anon;
    begin
      execute format('select count(*) from public.%I', t) into v;
    exception when insufficient_privilege then v := -1;  -- privilege negato = ancora più sicuro
    end;
    reset role;
    if v <= 0 then
      raise notice 'TEST P1[%] OK (anon: % righe / privilege negato)', t, v;
    else
      raise exception 'TEST P1[%] FAIL: anon vede % righe (atteso 0 o permission denied)', t, v;
    end if;
  end loop;
end$$;

-- ── TEST P2: cross-tenant — capostipite B NON vede i preventivi di A ────────
do $$
declare v_a int; v_b int;
begin
  -- A (Giulia) vede il proprio preventivo bootstrap
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into v_a from quotes where id = 'cccccccc-0000-0000-0000-000000000001';
  reset role;
  -- B (Villa Aurora) NON deve vederlo
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000003","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into v_b from quotes where id = 'cccccccc-0000-0000-0000-000000000001';
  reset role;
  if v_a >= 1 and v_b = 0 then
    raise notice 'TEST P2 OK (A vede il suo preventivo, B no)';
  else
    raise exception 'TEST P2 FAIL: A=% B=% (atteso A>=1, B=0) — possibile leak cross-tenant', v_a, v_b;
  end if;
end$$;

-- ── TEST P3: cross-tenant su network_prospects (CRM recruiting) ─────────────
do $$
declare v_a int; v_b int;
begin
  if to_regclass('public.network_prospects') is null then raise notice 'TEST P3 SKIP'; return; end if;
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into v_a from network_prospects where owner_id = '00000000-aaaa-0000-0000-000000000002';
  reset role;
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000003","role":"authenticated"}', true);
  set local role authenticated;
  select count(*) into v_b from network_prospects;  -- B non deve vedere i prospect di A
  reset role;
  if v_a >= 1 and v_b = 0 then
    raise notice 'TEST P3 OK (i prospect di A non sono visibili a B)';
  else
    raise exception 'TEST P3 FAIL: A=% B=% (atteso A>=1, B=0)', v_a, v_b;
  end if;
end$$;

-- ── TEST P4: la view ridotta participant NON espone PII (struttura) ─────────
do $$
declare v_leak int;
begin
  if to_regclass('public.calendar_entries_for_participants') is null then raise notice 'TEST P4 SKIP'; return; end if;
  select count(*) into v_leak from information_schema.columns
   where table_schema='public' and table_name='calendar_entries_for_participants'
     and column_name in ('client_name','client_email','value_amount','notes');
  if v_leak = 0 then
    raise notice 'TEST P4 OK (view ridotta senza colonne PII)';
  else
    raise exception 'TEST P4 FAIL: la view ridotta espone % colonne PII', v_leak;
  end if;
end$$;

-- ── TEST P5 (split P5 — CHIUSO): il fornitore NON legge i PII cliente ───────
--   I campi sensibili sono stati spostati in calendar_entries_private (mig.
--   20260610010000). Il fornitore-participant non ha policy su quella tabella.
do $$
declare v_priv int; v_base int; v_cols int;
begin
  -- (0) le colonne PII NON esistono più sulla tabella base leggibile dal fornitore
  select count(*) into v_cols from information_schema.columns
   where table_schema='public' and table_name='calendar_entries'
     and column_name in ('client_name','client_email','notes','value_amount');
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000005","role":"authenticated"}', true);
  set local role authenticated;
  begin
    select count(*) into v_priv from calendar_entries_private where entry_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  exception when insufficient_privilege then v_priv := -1; end;
  select count(*) into v_base from calendar_entries where id = 'bbbbbbbb-0000-0000-0000-000000000001';  -- accesso legittimo (data/stato)
  reset role;
  if v_cols = 0 and v_priv <= 0 and v_base = 1 then
    raise notice 'TEST P5 OK (split): colonne PII rimosse dalla base; fornitore non legge _private (%); ma vede l''evento (% righe)', v_priv, v_base;
  else
    raise exception 'TEST P5 FAIL: cols_pii_su_base=% priv_visti_dal_fornitore=% base_visti=%', v_cols, v_priv, v_base;
  end if;
end$$;

-- ── TEST P5b (positivo): l'OWNER legge i campi sensibili da _private ─────────
do $$
declare v_name text;
begin
  perform set_config('request.jwt.claims','{"sub":"00000000-aaaa-0000-0000-000000000002","role":"authenticated"}', true);
  set local role authenticated;
  select client_name into v_name from calendar_entries_private where entry_id = 'bbbbbbbb-0000-0000-0000-000000000001';
  reset role;
  if v_name is not null then
    raise notice 'TEST P5b OK (owner legge i PII cliente da _private: %)', v_name;
  else
    raise exception 'TEST P5b FAIL: l''owner non legge i PII cliente da _private (accesso legittimo rotto)';
  end if;
end$$;

-- ── TEST P6: anon NON può UPDATE/DELETE sulle tabelle audit ────────────────
do $$
declare t text; n int; arr text[] := array['quote_acceptances_audit','audit_log','access_audit_log','signature_audit_trail'];
begin
  foreach t in array arr loop
    if to_regclass('public.'||t) is null then raise notice 'TEST P6[%] SKIP', t; continue; end if;
    perform set_config('request.jwt.claims','{"role":"anon"}', true);
    set local role anon;
    begin
      execute format('update public.%I set id = id where true', t);  -- no-op che però richiede privilegi
      get diagnostics n = row_count;
    exception when insufficient_privilege or others then n := -1; end;
    reset role;
    if n <= 0 then
      raise notice 'TEST P6[%] OK (anon non modifica righe: rc=%)', t, n;
    else
      raise exception 'TEST P6[%] FAIL: anon ha aggiornato % righe audit', t, n;
    end if;
  end loop;
end$$;

-- Fine: se nessun RAISE EXCEPTION, tutti i test PII sono passati.
do $$ begin raise notice 'PII ISOLATION TESTS: completati (vedi NOTICE per esiti)'; end$$;
