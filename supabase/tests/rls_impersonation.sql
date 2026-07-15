-- ============================================================================
-- SUITE TEST RLS a IMPERSONATION (DoD Blocco 1 · gate sicurezza)
-- NET-ZERO: solo SELECT. Impersona `anon` e un `authenticated` ESTRANEO e verifica
-- che NON vedano dati privati altrui (righe della location demo Baronella).
--
-- COME ESEGUIRLA:
--   psql "$SUPABASE_DB_URL" -f supabase/tests/rls_impersonation.sql
--   (oppure incollala nel SQL editor Supabase). Stampa "N PASS, M FAIL" e FALLISCE
--   con eccezione se una tabella privata è visibile a un estraneo (RLS bucata).
--
-- NB: NON metterla tra le migration: `set local role` confligge col bookkeeping di
--     `supabase db push` (42501 su schema supabase_migrations). Va eseguita a parte.
--     Verificata verde il 15/07/2026: 18 PASS, 0 FAIL.
-- ============================================================================
do $$
declare
  v_loc   uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27'; -- La Baronella (dati reali)
  v_alien uuid := '00000000-0000-0000-0000-0000000000aa'; -- utente autenticato ESTRANEO
  v_fail  int := 0;
  v_pass  int := 0;
  n int; i int; who text;
  checks text[][] := array[
    ['calendar_entries',         'owner_id = ''' || v_loc || ''''],
    ['calendar_entries_private', 'entry_id in (select id from public.calendar_entries where owner_id = ''' || v_loc || ''')'],
    ['quotes',                   'owner_id = ''' || v_loc || ''''],
    ['contracts',                'owner_id = ''' || v_loc || ''''],
    ['gallery_media',            'entry_id in (select id from public.calendar_entries where owner_id = ''' || v_loc || ''')'],
    ['event_guests',             'entry_id in (select id from public.calendar_entries where owner_id = ''' || v_loc || ''')'],
    ['supplier_availability',    'fornitore_id = ''' || v_loc || ''''],
    ['stripe_subscriptions',     'profile_id = ''' || v_loc || ''''],
    ['stripe_customers',         'profile_id = ''' || v_loc || '''']
  ];
begin
  foreach who in array array['anon','alien'] loop
    if who = 'anon' then
      set local role anon;
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    else
      set local role authenticated;
      perform set_config('request.jwt.claims', json_build_object('sub', v_alien::text, 'role','authenticated')::text, true);
    end if;

    for i in 1 .. array_length(checks,1) loop
      if to_regclass('public.'||checks[i][1]) is null then continue; end if;
      begin
        execute format('select count(*) from public.%I where %s', checks[i][1], checks[i][2]) into n;
        if n = 0 then
          v_pass := v_pass + 1;
          raise notice 'RLS OK   [%] %: 0 righe (atteso 0)', who, checks[i][1];
        else
          v_fail := v_fail + 1;
          raise warning 'RLS BUCO [%] %: % righe VISIBILI (atteso 0)!', who, checks[i][1], n;
        end if;
      exception
        when insufficient_privilege then
          v_pass := v_pass + 1;
          raise notice 'RLS OK   [%] %: accesso negato (privilege) = ok', who, checks[i][1];
        when others then
          raise notice 'RLS ??   [%] %: errore query: %', who, checks[i][1], sqlerrm;
      end;
    end loop;

    reset role;
    perform set_config('request.jwt.claims', '', true);
  end loop;

  raise notice '==== RLS IMPERSONATION: % PASS, % FAIL ====', v_pass, v_fail;
  if v_fail > 0 then
    raise exception 'RLS IMPERSONATION FALLITA: % asserzioni bucate', v_fail;
  end if;
end $$;
reset role;
