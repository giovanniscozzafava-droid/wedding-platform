-- ============================================================================
-- ADVERSARIAL — Famiglia A (macchine a stati) + 2 snapshot  [EXPECTED-FAIL]
-- ----------------------------------------------------------------------------
-- ✅ RISOLTI (Cluster 1, mig. 20260611010000) → ora VERDI permanenti in
--    tests/sql/cluster1_firmato_terminale.sql: A-06, A-07, A-07b, A-08, A-09,
--    A-10, A-11. Rilanciando questo file quei blocchi NON fanno più rosso.
-- ⏳ ANCORA APERTI qui: A-12, A-14, A-15, E-SNAPSHOT-02/03 (Cluster 2).
-- ----------------------------------------------------------------------------
-- Ogni blocco DOCUMENTA una rottura: fa `raise exception 'BRK-..-NN: ...'`
-- SOLO QUANDO la rottura e' presente (cioe' quando lo stato illegale viene
-- raggiunto). Se la rottura fosse riparata, il blocco finirebbe senza errore
-- (stampa 'non riprodotta'). Quindi: ROSSO == rottura ancora viva.
--
-- Ogni blocco e' avvolto in `begin; ... rollback;` autonomo: tutti gli
-- insert/delete/sign rollbackano, nessun commit, nessuna dipendenza tra blocchi.
-- Si agisce SEMPRE da owner reale (set request.jwt.claims col sub dell'owner),
-- MAI da admin: percio' anche i guard di transizione status sono in vigore.
--
-- Esecuzione:
--   docker exec -i supabase_db_wedding-platform psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=0 -f tests/adversarial/A_state_machine.sql 2>&1
--
-- Ogni fixture e' costruito fresco dentro il blocco (auth.users + profiles +
-- quote/contract minimi), cosi' il test e' deterministico e indipendente dai
-- dati reali. UUID fissi per leggibilita'; rollback li cancella comunque.
-- ============================================================================

\set ON_ERROR_STOP 0

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-06 🔴  contracts_enforce_quote_accettato e' SOLO BEFORE INSERT.
--   Crea un contratto da un quote ACCETTATO (passa il check), poi
--   UPDATE contracts SET quote_id = <quote in BOZZA>. Nessun trigger su UPDATE
--   -> il contratto resta legato a un preventivo MAI accettato.
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_q_acc uuid := gen_random_uuid();  -- quote ACCETTATO
  v_q_boz uuid := gen_random_uuid();  -- quote BOZZA
  v_ct    uuid := gen_random_uuid();
  v_linked_status quote_status;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- quote che raggiunge ACCETTATO via BOZZA->INVIATO->ACCETTATO (guard in vigore)
  insert into public.quotes(id, owner_id, title, status, client_email)
    values (v_q_acc, v_owner, 'Q accettato', 'BOZZA', 'cli@example.com');
  update public.quotes set status='INVIATO'  where id=v_q_acc;
  update public.quotes set status='ACCETTATO', accepted_at=now() where id=v_q_acc;

  -- quote che resta in BOZZA
  insert into public.quotes(id, owner_id, title, status, client_email)
    values (v_q_boz, v_owner, 'Q bozza', 'BOZZA', 'cli@example.com');

  -- contratto creato dal quote ACCETTATO: il BEFORE INSERT passa
  insert into public.contracts(id, owner_id, title, quote_id, status)
    values (v_ct, v_owner, 'Contratto', v_q_acc, 'BOZZA');

  -- ATTACCO: ridirigo il contratto sul quote in BOZZA (nessun trigger UPDATE)
  update public.contracts set quote_id = v_q_boz where id = v_ct;

  select status into v_linked_status
    from public.quotes
   where id = (select quote_id from public.contracts where id = v_ct);

  if v_linked_status <> 'ACCETTATO' then
    raise exception
      'BRK-A-06: contratto ora legato a quote in stato % (mai accettato): enforce e'' solo BEFORE INSERT, UPDATE non protetto', v_linked_status;
  end if;
  raise notice 'BRK-A-06 non riprodotta (linked=%)', v_linked_status;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-07 🔴  contract_sign_full ha WHERE status in (BOZZA,INVIATO,FIRMATO).
--   Un contratto gia' FIRMATO da "ORIGINALE" puo' essere RI-firmato: la
--   signature_image viene sovrascritta da un signer diverso ("ATTACKER").
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_ct    uuid := gen_random_uuid();
  v_tok   uuid := gen_random_uuid();
  v_signer_after text;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- contratto diretto (party_kind SUPPLIER_WP (non CLIENT_WP) -> niente vincolo quote)
  insert into public.contracts(id, owner_id, title, status, access_token, party_kind)
    values (v_ct, v_owner, 'Contratto', 'INVIATO', v_tok, 'SUPPLIER_WP');

  -- prima firma legittima: ORIGINALE
  perform public.contract_sign_full(v_tok,'ORIGINALE','RSSORI80A01H501U',
    null,null,null,'data:image/png;base64,ORIG', true, true);

  -- ATTACCO: ri-firma a contratto gia' FIRMATO, signer diverso
  perform public.contract_sign_full(v_tok,'ATTACKER','TTCKER90B02H501Z',
    null,null,null,'data:image/png;base64,ATTACK', true, true);

  select signature_data->>'name' into v_signer_after
    from public.contracts where id = v_ct;

  if v_signer_after = 'ATTACKER' then
    raise exception
      'BRK-A-07: contratto gia'' FIRMATO ri-firmato, signature_data.name ora = % (sovrascritto): WHERE include FIRMATO', v_signer_after;
  end if;
  raise notice 'BRK-A-07 non riprodotta (signer=%)', v_signer_after;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-07b 🔴  La re-firma di A-07 lascia status=FIRMATO (old=FIRMATO), quindi
--   il trigger sig_audit_from_contract_sign (WHEN old<>FIRMATO) NON scatta: il
--   contratto dice "ATTACKER" ma il signature_audit_trail dice "ORIGINALE".
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_ct    uuid := gen_random_uuid();
  v_tok   uuid := gen_random_uuid();
  v_contract_signer text;
  v_audit_signer    text;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  insert into public.contracts(id, owner_id, title, status, access_token, party_kind)
    values (v_ct, v_owner, 'Contratto', 'INVIATO', v_tok, 'SUPPLIER_WP');

  perform public.contract_sign_full(v_tok,'ORIGINALE','RSSORI80A01H501U',
    null,null,null,'data:image/png;base64,ORIG', true, true);
  perform public.contract_sign_full(v_tok,'ATTACKER','TTCKER90B02H501Z',
    null,null,null,'data:image/png;base64,ATTACK', true, true);

  select signature_data->>'name' into v_contract_signer
    from public.contracts where id = v_ct;
  select signer_name into v_audit_signer
    from public.signature_audit_trail
   where document_type='contract' and document_id = v_ct
   order by signed_at desc limit 1;

  if v_contract_signer = 'ATTACKER' and coalesce(v_audit_signer,'') <> 'ATTACKER' then
    raise exception
      'BRK-A-07b: divergenza contratto vs audit-trail: contratto.signer=%, audit.signer=% (trigger AFTER UPDATE non rieseguito su FIRMATO->FIRMATO)',
      v_contract_signer, coalesce(v_audit_signer,'<nessuna riga>');
  end if;
  raise notice 'BRK-A-07b non riprodotta (contract=%, audit=%)', v_contract_signer, v_audit_signer;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-08 🔴  addendum_sign_full: stessa re-firma su un addendum gia' FIRMATO
--   (WHERE status in BOZZA,INVIATO,FIRMATO) sovrascrive il signer.
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_ct    uuid := gen_random_uuid();
  v_add   uuid := gen_random_uuid();
  v_tok   uuid := gen_random_uuid();
  v_signer_after text;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- contratto base gia' FIRMATO (signed_at + signature_data per il check FIRMATO)
  insert into public.contracts(id, owner_id, title, status, party_kind, signed_at, signature_data)
    values (v_ct, v_owner, 'Contratto', 'FIRMATO', 'SUPPLIER_WP', now(),
            jsonb_build_object('name','Cliente Base'));
  insert into public.contract_addendums(id, contract_id, status, access_token, title)
    values (v_add, v_ct, 'INVIATO', v_tok, 'Variazione');

  perform public.addendum_sign_full(v_tok,'ORIGINALE','RSSORI80A01H501U',
    null,null,null,'data:image/png;base64,ORIG', true, true);
  perform public.addendum_sign_full(v_tok,'ATTACKER','TTCKER90B02H501Z',
    null,null,null,'data:image/png;base64,ATTACK', true, true);

  select signer_data->>'name' into v_signer_after
    from public.contract_addendums where id = v_add;

  if v_signer_after = 'ATTACKER' then
    raise exception
      'BRK-A-08: addendum gia'' FIRMATO ri-firmato, signer_data.name ora = % (sovrascritto): WHERE include FIRMATO', v_signer_after;
  end if;
  raise notice 'BRK-A-08 non riprodotta (signer=%)', v_signer_after;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-09 🔴  countersign_contract non controlla status=FIRMATO ne' signed_at:
--   controfirma un contratto ancora in BOZZA con signed_at NULL.
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_ct    uuid := gen_random_uuid();
  v_status      contract_status;
  v_signed      timestamptz;
  v_counter     timestamptz;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- contratto in BOZZA, mai firmato dal cliente
  insert into public.contracts(id, owner_id, title, status, party_kind)
    values (v_ct, v_owner, 'Contratto', 'BOZZA', 'SUPPLIER_WP');

  perform public.countersign_contract(v_ct, 'Owner Controfirma', 'WNRCNT80A01H501U');

  select status, signed_at, countersign_at
    into v_status, v_signed, v_counter
    from public.contracts where id = v_ct;

  if v_counter is not null and v_signed is null and v_status = 'BOZZA' then
    raise exception
      'BRK-A-09: controfirmato un contratto status=% con signed_at NULL (countersign_at=%): manca guard status=FIRMATO',
      v_status, v_counter;
  end if;
  raise notice 'BRK-A-09 non riprodotta (status=%, signed=%, counter=%)', v_status, v_signed, v_counter;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-10 🔴  contract_sign_full firma con token REVOCATO: manca il check
--   token_revoked_at (presente invece nel legacy contract_sign_by_token).
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_ct    uuid := gen_random_uuid();
  v_tok   uuid := gen_random_uuid();
  v_ok    boolean;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- token ESPLICITAMENTE REVOCATO
  insert into public.contracts(id, owner_id, title, status, access_token, party_kind, token_revoked_at)
    values (v_ct, v_owner, 'Contratto', 'INVIATO', v_tok, 'SUPPLIER_WP', now() - interval '1 hour');

  v_ok := public.contract_sign_full(v_tok,'Cliente','RSSCLI80A01H501U',
    null,null,null,'data:image/png;base64,SIG', true, true);

  if v_ok then
    raise exception
      'BRK-A-10: firma RIUSCITA con token REVOCATO (token_revoked_at nel passato): contract_sign_full non verifica la revoca';
  end if;
  raise notice 'BRK-A-10 non riprodotta (ok=%)', v_ok;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-11 🔴  contract_sign_full firma con token SCADUTO: manca il check
--   access_token_expires_at (presente nel legacy contract_sign_by_token).
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_ct    uuid := gen_random_uuid();
  v_tok   uuid := gen_random_uuid();
  v_ok    boolean;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- token con scadenza nel PASSATO
  insert into public.contracts(id, owner_id, title, status, access_token, party_kind, access_token_expires_at)
    values (v_ct, v_owner, 'Contratto', 'INVIATO', v_tok, 'SUPPLIER_WP', now() - interval '1 day');

  v_ok := public.contract_sign_full(v_tok,'Cliente','RSSCLI80A01H501U',
    null,null,null,'data:image/png;base64,SIG', true, true);

  if v_ok then
    raise exception
      'BRK-A-11: firma RIUSCITA con token SCADUTO (access_token_expires_at nel passato): contract_sign_full non verifica la scadenza';
  end if;
  raise notice 'BRK-A-11 non riprodotta (ok=%)', v_ok;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-12 🔴  client_decide_quote_item blocca solo su closed_at, ignora
--   contracted_at: il cliente RIFIUTA una voce gia' contrattualizzata.
--   Quote in CONVERTITO_IN_CONTRATTO con closed_at NULL, item con contracted_at.
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_q     uuid := gen_random_uuid();
  v_it    uuid := gen_random_uuid();
  v_res   jsonb;
  v_dec   text;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- quote che arriva a CONVERTITO_IN_CONTRATTO, closed_at lasciato NULL
  insert into public.quotes(id, owner_id, title, status, client_email, closed_at)
    values (v_q, v_owner, 'Q convertito', 'BOZZA', 'cliente@example.com', null);
  update public.quotes set status='INVIATO'                 where id=v_q;
  update public.quotes set status='ACCETTATO', accepted_at=now()               where id=v_q;
  update public.quotes set status='CONVERTITO_IN_CONTRATTO' where id=v_q;
  update public.quotes set closed_at = null where id=v_q;  -- esplicito: non chiuso

  insert into public.quote_items(id, quote_id, name_snapshot, snapshot_price, quantity, contracted_at)
    values (v_it, v_q, 'Servizio contrattualizzato', 100, 1, now());

  -- il cliente (stessa email del quote) rifiuta la voce gia' contrattualizzata
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'email','cliente@example.com','role','authenticated')::text, true);
  v_res := public.client_decide_quote_item(v_it, 'RIFIUTATO', 'ci ho ripensato');

  select client_decision into v_dec from public.quote_items where id = v_it;

  if (v_res->>'ok')::boolean is true and v_dec = 'RIFIUTATO' then
    raise exception
      'BRK-A-12: voce con contracted_at rifiutata dal cliente (decision=%, ret=%): il check guarda solo closed_at, non contracted_at',
      v_dec, v_res::text;
  end if;
  raise notice 'BRK-A-12 non riprodotta (ret=%)', v_res::text;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-14 🟡  quote_conclude_by_client setta closed_at senza check status:
--   congela (closed_at) un quote ancora in INVIATO, mai accettato.
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_q     uuid := gen_random_uuid();
  v_res   jsonb;
  v_status quote_status;
  v_closed timestamptz;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  insert into public.quotes(id, owner_id, title, status, client_email)
    values (v_q, v_owner, 'Q inviato', 'BOZZA', 'cliente@example.com');
  update public.quotes set status='INVIATO' where id=v_q;  -- mai ACCETTATO

  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'email','cliente@example.com','role','authenticated')::text, true);
  v_res := public.quote_conclude_by_client(v_q);

  select status, closed_at into v_status, v_closed from public.quotes where id = v_q;

  if v_closed is not null and v_status = 'INVIATO' then
    raise exception
      'BRK-A-14: quote congelato (closed_at=%) in status % mai accettato: quote_conclude_by_client non controlla lo status',
      v_closed, v_status;
  end if;
  raise notice 'BRK-A-14 non riprodotta (status=%, closed=%)', v_status, v_closed;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-A-15 🟠  quote_reopen senza status guard: riapre (closed_at=NULL) un
--   quote in CONVERTITO_IN_CONTRATTO.
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_q     uuid := gen_random_uuid();
  v_ok    boolean;
  v_status quote_status;
  v_closed timestamptz;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  insert into public.quotes(id, owner_id, title, status, client_email, closed_at)
    values (v_q, v_owner, 'Q convertito', 'BOZZA', 'cliente@example.com', now());
  update public.quotes set status='INVIATO'                 where id=v_q;
  update public.quotes set status='ACCETTATO', accepted_at=now()               where id=v_q;
  update public.quotes set status='CONVERTITO_IN_CONTRATTO' where id=v_q;
  update public.quotes set closed_at = now() where id=v_q;  -- chiuso

  v_ok := public.quote_reopen(v_q);

  select status, closed_at into v_status, v_closed from public.quotes where id = v_q;

  if v_ok and v_closed is null and v_status = 'CONVERTITO_IN_CONTRATTO' then
    raise exception
      'BRK-A-15: quote riaperto (closed_at NULL) in status % (gia'' a contratto): quote_reopen non ha status guard',
      v_status;
  end if;
  raise notice 'BRK-A-15 non riprodotta (ok=%, status=%, closed=%)', v_ok, v_status, v_closed;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-E-SNAPSHOT-02 🔴  quotes_default_markup_after_update senza status guard:
--   su quote ACCETTATO, cambiare default_markup_percent ricalcola line_client
--   (snapshot economico muta) SENZA bump di revision.
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_q     uuid := gen_random_uuid();
  v_it    uuid := gen_random_uuid();
  v_lc_before numeric; v_lc_after numeric;
  v_rev_before int;    v_rev_after int;
begin
  insert into auth.users(id) values (v_owner);  -- profilo WEDDING_PLANNER auto-creato dal trigger
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- quote con markup 30% -> line_client = 180*1.30 = 234
  insert into public.quotes(id, owner_id, title, status, client_email, default_markup_percent)
    values (v_q, v_owner, 'Q snapshot', 'BOZZA', 'cliente@example.com', 30);
  insert into public.quote_items(id, quote_id, name_snapshot, snapshot_price, quantity, supplier_id)
    values (v_it, v_q, 'Servizio', 180, 1, null);

  update public.quotes set status='INVIATO'  where id=v_q;
  update public.quotes set status='ACCETTATO', accepted_at=now() where id=v_q;  -- snapshot "congelato"

  select line_client into v_lc_before from public.quote_items where id=v_it;
  select revision    into v_rev_before from public.quotes      where id=v_q;

  -- ATTACCO: cambio il markup di default su un quote gia' ACCETTATO
  update public.quotes set default_markup_percent = 80 where id=v_q;  -- 180*1.80 = 324

  select line_client into v_lc_after from public.quote_items where id=v_it;
  select revision    into v_rev_after from public.quotes      where id=v_q;

  if v_lc_after <> v_lc_before and v_rev_after = v_rev_before then
    raise exception
      'BRK-E-SNAPSHOT-02: su quote ACCETTATO line_client %→% per cambio default_markup, revision invariata (%): trigger senza status guard ne'' bump revision',
      v_lc_before, v_lc_after, v_rev_after;
  end if;
  raise notice 'BRK-E-SNAPSHOT-02 non riprodotta (lc %→%, rev %→%)', v_lc_before, v_lc_after, v_rev_before, v_rev_after;
end$$;
rollback;

-- ───────────────────────────────────────────────────────────────────────────
-- BRK-E-SNAPSHOT-03 🔴  quote_supplier_markup_after_change: un override markup
--   per fornitore su quote ACCETTATO ricalcola line_client, revision invariata.
-- ───────────────────────────────────────────────────────────────────────────
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_sup   uuid := gen_random_uuid();
  v_q     uuid := gen_random_uuid();
  v_it    uuid := gen_random_uuid();
  v_lc_before numeric; v_lc_after numeric;
  v_rev_before int;    v_rev_after int;
begin
  insert into auth.users(id) values (v_owner), (v_sup);  -- profili auto-creati dal trigger
  update public.profiles set role='FORNITORE' where id=v_sup;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_owner, 'role','authenticated')::text, true);

  -- quote default 30% con una voce del fornitore v_sup -> 180*1.30 = 234
  insert into public.quotes(id, owner_id, title, status, client_email, default_markup_percent)
    values (v_q, v_owner, 'Q snapshot sup', 'BOZZA', 'cliente@example.com', 30);
  insert into public.quote_items(id, quote_id, name_snapshot, snapshot_price, quantity, supplier_id, item_markup_percent)
    values (v_it, v_q, 'Servizio fornitore', 180, 1, v_sup, null);

  update public.quotes set status='INVIATO'  where id=v_q;
  update public.quotes set status='ACCETTATO', accepted_at=now() where id=v_q;

  select line_client into v_lc_before from public.quote_items where id=v_it;
  select revision    into v_rev_before from public.quotes      where id=v_q;

  -- ATTACCO: override markup fornitore al 150% su quote ACCETTATO -> 180*2.50 = 450
  insert into public.quote_supplier_markups(quote_id, supplier_id, markup_percent)
    values (v_q, v_sup, 150);

  select line_client into v_lc_after from public.quote_items where id=v_it;
  select revision    into v_rev_after from public.quotes      where id=v_q;

  if v_lc_after <> v_lc_before and v_rev_after = v_rev_before then
    raise exception
      'BRK-E-SNAPSHOT-03: su quote ACCETTATO line_client %→% per override markup fornitore, revision invariata (%): trigger senza status guard',
      v_lc_before, v_lc_after, v_rev_after;
  end if;
  raise notice 'BRK-E-SNAPSHOT-03 non riprodotta (lc %→%, rev %→%)', v_lc_before, v_lc_after, v_rev_before, v_rev_after;
end$$;
rollback;
