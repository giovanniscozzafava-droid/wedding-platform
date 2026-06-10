-- ============================================================================
-- ADVERSARIAL — Famiglia C (orfani e cascate distruttive)  [EXPECTED-FAIL]
-- ----------------------------------------------------------------------------
-- Ogni blocco DOCUMENTA una rottura: costruisce un repro minimo (quote +
-- contract FIRMATO + quote_acceptances firmata + signature_audit_trail), esegue
-- la cancellazione, poi `raise exception 'BRK-C-NN: ...'` SOLO quando la rottura
-- e' presente (orfano rilevato / colonna messa a NULL / FK che blocca, ecc.).
--
-- Ogni blocco e' avvolto in `begin; ... rollback;` AUTONOMO: nessun commit,
-- nessuna dipendenza tra blocchi. Le cancellazioni rollbackano. Eseguire a mano:
--   docker exec -i supabase_db_wedding-platform psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=0 -f tests/adversarial/C_cascades.sql 2>&1
--
-- NOTA repro:
--  * profiles.id ha FK -> auth.users: creiamo prima auth.users.
--  * owner = ADMIN + JWT sub = owner  => auth.uid()=owner, is_admin()=true.
--    Questo serve SOLO a bypassare i trigger di enforce in fase di SETUP
--    (contracts_enforce_quote_accettato / enforce_contract_party_kind).
--  * signature_audit_trail e' IMMUTABILE (trigger block_mutation su UPDATE/DELETE)
--    e NON ha FK verso quotes/contracts: lega i documenti in modo polimorfico
--    via (document_type, document_id). Quando quote/contract spariscono, le
--    sue righe NON cascadano -> restano ORFANE e immortali.
--  * L'audit 'contract' nasce SOLO via UPDATE status->FIRMATO (trigger AFTER
--    UPDATE). L'audit 'quote' nasce all'INSERT della quote_acceptances.
-- ============================================================================


-- ── BRK-C-01 🔴 delete_quote_cascade su quote con contratto FIRMATO + accettazione
--    firmata: distrugge l'atto (quote+contract+acceptance) e lascia >=1 riga
--    signature_audit_trail IMMUTABILE ORFANA.
begin;
  insert into auth.users(id) values
    ('c1000000-0000-0000-0000-000000000001'),('c1000000-0000-0000-0000-000000000002')
    on conflict do nothing;
  insert into public.profiles(id, role) values ('c1000000-0000-0000-0000-000000000001','ADMIN')
    on conflict (id) do update set role='ADMIN';
  insert into public.profiles(id, role) values ('c1000000-0000-0000-0000-000000000002','FORNITORE')
    on conflict (id) do update set role='FORNITORE';
  select set_config('request.jwt.claims','{"sub":"c1000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  insert into public.quotes(id, owner_id, title, status, revision, accepted_at)
    values ('c1000000-0000-0000-0000-0000000000aa','c1000000-0000-0000-0000-000000000001','BRK-C-01 QUOTE','ACCETTATO',1, now());
  insert into public.quote_acceptances(quote_id, access_token, quote_revision, signer_name, signer_email, doc_type, signature_url)
    values ('c1000000-0000-0000-0000-0000000000aa', gen_random_uuid(), 1, 'Mario Rossi','m@x.it','CARTA_IDENTITA','sig://x');
  insert into public.contracts(id, owner_id, quote_id, supplier_id, title, status, party_kind)
    values ('c1000000-0000-0000-0000-0000000000bb','c1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-0000000000aa','c1000000-0000-0000-0000-000000000002','BRK-C-01 CONTRACT','INVIATO','CLIENT_WP');
  update public.contracts set status='FIRMATO', signed_at=now(), signature_data='{"name":"Mario Rossi"}'::jsonb
    where id='c1000000-0000-0000-0000-0000000000bb';

  do $$ begin perform public.delete_quote_cascade('c1000000-0000-0000-0000-0000000000aa'); end $$;
  do $$
  declare v_orphan int; v_quote int; v_contract int; v_acc int;
  begin
    select count(*) into v_quote    from public.quotes    where id='c1000000-0000-0000-0000-0000000000aa';
    select count(*) into v_contract from public.contracts where id='c1000000-0000-0000-0000-0000000000bb';
    select count(*) into v_acc      from public.quote_acceptances where quote_id='c1000000-0000-0000-0000-0000000000aa';
    select count(*) into v_orphan   from public.signature_audit_trail s
      where not exists (select 1 from public.quotes q where s.document_type='quote' and q.id=s.document_id)
        and not exists (select 1 from public.contracts c where s.document_type='contract' and c.id=s.document_id)
        and s.document_id in ('c1000000-0000-0000-0000-0000000000aa','c1000000-0000-0000-0000-0000000000bb');
    if v_orphan >= 1 then
      raise exception 'BRK-C-01: delete_quote_cascade ha distrutto atto firmato (quote=%, contract=%, acc=%) e lasciato % riga/e signature_audit_trail ORFANE e immutabili', v_quote, v_contract, v_acc, v_orphan;
    end if;
    raise notice 'BRK-C-01 non riprodotta (orfani=%)', v_orphan;
  end$$;
rollback;


-- ── BRK-C-02 🔴 delete_wedding_cascade su evento con quote+contratto FIRMATO:
--    idem, audit orfane. La funzione cancella la calendar_entry, poi la quote
--    collegata e i suoi contracts -> audit di quote E contract restano orfane.
begin;
  insert into auth.users(id) values
    ('c2000000-0000-0000-0000-000000000001'),('c2000000-0000-0000-0000-000000000002')
    on conflict do nothing;
  insert into public.profiles(id, role) values ('c2000000-0000-0000-0000-000000000001','ADMIN')
    on conflict (id) do update set role='ADMIN';
  insert into public.profiles(id, role) values ('c2000000-0000-0000-0000-000000000002','FORNITORE')
    on conflict (id) do update set role='FORNITORE';
  select set_config('request.jwt.claims','{"sub":"c2000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  insert into public.calendar_entries(id, owner_id, title, date_from, date_to)
    values ('c2000000-0000-0000-0000-0000000000ee','c2000000-0000-0000-0000-000000000001','BRK-C-02 EVENT','2027-01-01','2027-01-01');
  insert into public.quotes(id, owner_id, title, status, revision, accepted_at)
    values ('c2000000-0000-0000-0000-0000000000aa','c2000000-0000-0000-0000-000000000001','BRK-C-02 QUOTE','ACCETTATO',1, now());
  -- aggancia la quote alla entry (FK SET NULL -> la funzione la cancella esplicitamente)
  update public.calendar_entries set quote_id='c2000000-0000-0000-0000-0000000000aa' where id='c2000000-0000-0000-0000-0000000000ee';
  insert into public.quote_acceptances(quote_id, access_token, quote_revision, signer_name, signer_email, doc_type, signature_url)
    values ('c2000000-0000-0000-0000-0000000000aa', gen_random_uuid(), 1, 'Mario Rossi','m@x.it','CARTA_IDENTITA','sig://x');
  insert into public.contracts(id, owner_id, quote_id, entry_id, supplier_id, title, status, party_kind)
    values ('c2000000-0000-0000-0000-0000000000bb','c2000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-0000000000aa','c2000000-0000-0000-0000-0000000000ee','c2000000-0000-0000-0000-000000000002','BRK-C-02 CONTRACT','INVIATO','CLIENT_WP');
  update public.contracts set status='FIRMATO', signed_at=now(), signature_data='{"name":"Mario Rossi"}'::jsonb
    where id='c2000000-0000-0000-0000-0000000000bb';

  do $$ begin perform public.delete_wedding_cascade('c2000000-0000-0000-0000-0000000000ee'); end $$;
  do $$
  declare v_orphan int; v_quote int; v_entry int;
  begin
    select count(*) into v_quote from public.quotes where id='c2000000-0000-0000-0000-0000000000aa';
    select count(*) into v_entry from public.calendar_entries where id='c2000000-0000-0000-0000-0000000000ee';
    select count(*) into v_orphan from public.signature_audit_trail s
      where not exists (select 1 from public.quotes q where s.document_type='quote' and q.id=s.document_id)
        and not exists (select 1 from public.contracts c where s.document_type='contract' and c.id=s.document_id)
        and s.document_id in ('c2000000-0000-0000-0000-0000000000aa','c2000000-0000-0000-0000-0000000000bb');
    if v_orphan >= 1 then
      raise exception 'BRK-C-02: delete_wedding_cascade (entry rimaste=%, quote rimaste=%) ha lasciato % riga/e signature_audit_trail ORFANE', v_entry, v_quote, v_orphan;
    end if;
    raise notice 'BRK-C-02 non riprodotta (orfani=%)', v_orphan;
  end$$;
rollback;


-- ── BRK-C-03 🟡 cancellare un profilo che ha un event_documents.uploaded_by e'
--    BLOCCATO da FK NO ACTION (event_documents_uploaded_by_fkey): l'utente non
--    si puo' cancellare. Prova: il DELETE FROM profiles solleva foreign_key_violation.
begin;
  insert into auth.users(id) values
    ('c3000000-0000-0000-0000-000000000001'),('c3000000-0000-0000-0000-000000000009')
    on conflict do nothing;
  insert into public.profiles(id, role) values ('c3000000-0000-0000-0000-000000000001','ADMIN')
    on conflict (id) do update set role='ADMIN';
  insert into public.profiles(id, role) values ('c3000000-0000-0000-0000-000000000009','FORNITORE')
    on conflict (id) do update set role='FORNITORE';
  insert into public.calendar_entries(id, owner_id, title, date_from, date_to)
    values ('c3000000-0000-0000-0000-0000000000ee','c3000000-0000-0000-0000-000000000001','BRK-C-03 EVENT','2027-01-01','2027-01-01');
  -- l'utente ...009 ha caricato un documento
  insert into public.event_documents(entry_id, name, storage_path, uploaded_by)
    values ('c3000000-0000-0000-0000-0000000000ee','doc.pdf','path/doc.pdf','c3000000-0000-0000-0000-000000000009');

  do $$
  declare v_blocked boolean := false;
  begin
    begin
      -- tenta la cancellazione del profilo che ha caricato il documento
      delete from public.profiles where id='c3000000-0000-0000-0000-000000000009';
    exception when foreign_key_violation then
      v_blocked := true;
    end;
    if v_blocked then
      raise exception 'BRK-C-03: DELETE FROM profiles BLOCCATO da event_documents_uploaded_by_fkey (NO ACTION) -> utente NON cancellabile finche'' esiste il documento';
    end if;
    raise notice 'BRK-C-03 non riprodotta (delete profilo non bloccato)';
  end$$;
rollback;


-- ── BRK-C-04 🟠 cancellare il profilo FORNITORE mette contracts.supplier_id=NULL
--    su contratto FIRMATO (FK contracts_supplier_id_fkey SET NULL): si perde
--    traccia di QUALE fornitore aveva firmato l'atto.
begin;
  insert into auth.users(id) values
    ('c4000000-0000-0000-0000-000000000001'),('c4000000-0000-0000-0000-000000000002')
    on conflict do nothing;
  insert into public.profiles(id, role) values ('c4000000-0000-0000-0000-000000000001','ADMIN')
    on conflict (id) do update set role='ADMIN';
  insert into public.profiles(id, role) values ('c4000000-0000-0000-0000-000000000002','FORNITORE')
    on conflict (id) do update set role='FORNITORE';
  select set_config('request.jwt.claims','{"sub":"c4000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  insert into public.quotes(id, owner_id, title, status, revision, accepted_at)
    values ('c4000000-0000-0000-0000-0000000000aa','c4000000-0000-0000-0000-000000000001','BRK-C-04 QUOTE','ACCETTATO',1, now());
  insert into public.contracts(id, owner_id, quote_id, supplier_id, title, status, party_kind)
    values ('c4000000-0000-0000-0000-0000000000bb','c4000000-0000-0000-0000-000000000001','c4000000-0000-0000-0000-0000000000aa','c4000000-0000-0000-0000-000000000002','BRK-C-04 CONTRACT','INVIATO','CLIENT_WP');
  update public.contracts set status='FIRMATO', signed_at=now(), signature_data='{"name":"Mario Rossi"}'::jsonb
    where id='c4000000-0000-0000-0000-0000000000bb';

  delete from public.profiles where id='c4000000-0000-0000-0000-000000000002';
  do $$
  declare v_status text; v_supplier uuid;
  begin
    select status::text, supplier_id into v_status, v_supplier
      from public.contracts where id='c4000000-0000-0000-0000-0000000000bb';
    if v_status='FIRMATO' and v_supplier is null then
      raise exception 'BRK-C-04: contratto ancora FIRMATO ma supplier_id messo a NULL dopo delete del fornitore -> chi ha firmato l''atto e'' irrintracciabile';
    end if;
    raise notice 'BRK-C-04 non riprodotta (status=%, supplier=%)', v_status, v_supplier;
  end$$;
rollback;


-- ── BRK-C-05 🔴 cancellare il profilo WP/owner CASCADE-distrugge quote+acceptance+
--    contratto FIRMATO (quotes/contracts.owner_id FK CASCADE) -> audit orfane.
--    Owner NON-admin: e' il titolare reale dei record.
begin;
  insert into auth.users(id) values
    ('c5000000-0000-0000-0000-000000000001'),('c5000000-0000-0000-0000-000000000002'),
    ('c5000000-0000-0000-0000-00000000000a')
    on conflict do nothing;
  -- un ADMIN separato esegue il setup (bypass enforce), poi cancelliamo l'OWNER reale (WP)
  insert into public.profiles(id, role) values ('c5000000-0000-0000-0000-00000000000a','ADMIN')
    on conflict (id) do update set role='ADMIN';
  insert into public.profiles(id, role) values ('c5000000-0000-0000-0000-000000000001','WEDDING_PLANNER')
    on conflict (id) do update set role='WEDDING_PLANNER';
  insert into public.profiles(id, role) values ('c5000000-0000-0000-0000-000000000002','FORNITORE')
    on conflict (id) do update set role='FORNITORE';
  select set_config('request.jwt.claims','{"sub":"c5000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

  insert into public.quotes(id, owner_id, title, status, revision, accepted_at)
    values ('c5000000-0000-0000-0000-0000000000aa','c5000000-0000-0000-0000-000000000001','BRK-C-05 QUOTE','ACCETTATO',1, now());
  insert into public.quote_acceptances(quote_id, access_token, quote_revision, signer_name, signer_email, doc_type, signature_url)
    values ('c5000000-0000-0000-0000-0000000000aa', gen_random_uuid(), 1, 'Mario Rossi','m@x.it','CARTA_IDENTITA','sig://x');
  insert into public.contracts(id, owner_id, quote_id, supplier_id, title, status, party_kind)
    values ('c5000000-0000-0000-0000-0000000000bb','c5000000-0000-0000-0000-000000000001','c5000000-0000-0000-0000-0000000000aa','c5000000-0000-0000-0000-000000000002','BRK-C-05 CONTRACT','INVIATO','CLIENT_WP');
  update public.contracts set status='FIRMATO', signed_at=now(), signature_data='{"name":"Mario Rossi"}'::jsonb
    where id='c5000000-0000-0000-0000-0000000000bb';

  -- cancella l'OWNER reale (WP) -> CASCADE su quotes/contracts
  delete from public.profiles where id='c5000000-0000-0000-0000-000000000001';
  do $$
  declare v_orphan int; v_quote int; v_contract int;
  begin
    select count(*) into v_quote    from public.quotes    where id='c5000000-0000-0000-0000-0000000000aa';
    select count(*) into v_contract from public.contracts where id='c5000000-0000-0000-0000-0000000000bb';
    select count(*) into v_orphan from public.signature_audit_trail s
      where not exists (select 1 from public.quotes q where s.document_type='quote' and q.id=s.document_id)
        and not exists (select 1 from public.contracts c where s.document_type='contract' and c.id=s.document_id)
        and s.document_id in ('c5000000-0000-0000-0000-0000000000aa','c5000000-0000-0000-0000-0000000000bb');
    if v_orphan >= 1 then
      raise exception 'BRK-C-05: delete profilo WP/owner ha CASCADE-distrutto quote(rimaste=%)+contract(rimasti=%) FIRMATO e lasciato % audit ORFANE', v_quote, v_contract, v_orphan;
    end if;
    raise notice 'BRK-C-05 non riprodotta (orfani=%)', v_orphan;
  end$$;
rollback;


-- ── BRK-C-06 🟠 cancellare il supplier su quote APERTA: quote_supplier_markups
--    CASCADE sparisce, quote_items SOPRAVVIVE con supplier_id NULL -> il prezzo
--    di riga include ancora un markup il cui record e' ormai sparito.
begin;
  insert into auth.users(id) values
    ('c6000000-0000-0000-0000-000000000001'),('c6000000-0000-0000-0000-000000000002')
    on conflict do nothing;
  insert into public.profiles(id, role) values ('c6000000-0000-0000-0000-000000000001','ADMIN')
    on conflict (id) do update set role='ADMIN';
  insert into public.profiles(id, role) values ('c6000000-0000-0000-0000-000000000002','FORNITORE')
    on conflict (id) do update set role='FORNITORE';
  select set_config('request.jwt.claims','{"sub":"c6000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  insert into public.quotes(id, owner_id, title, status, revision)
    values ('c6000000-0000-0000-0000-0000000000aa','c6000000-0000-0000-0000-000000000001','BRK-C-06 QUOTE','INVIATO',1);
  insert into public.quote_supplier_markups(quote_id, supplier_id, markup_percent)
    values ('c6000000-0000-0000-0000-0000000000aa','c6000000-0000-0000-0000-000000000002', 25.00);
  insert into public.quote_items(id, quote_id, supplier_id, name_snapshot, snapshot_price, quantity, line_cost, line_client)
    values ('c6000000-0000-0000-0000-0000000000c1','c6000000-0000-0000-0000-0000000000aa','c6000000-0000-0000-0000-000000000002','Servizio X', 100.00, 1, 100.00, 125.00);

  delete from public.profiles where id='c6000000-0000-0000-0000-000000000002';
  do $$
  declare v_markup int; v_item_supplier uuid; v_item_client numeric; v_item int;
  begin
    select count(*) into v_markup from public.quote_supplier_markups where quote_id='c6000000-0000-0000-0000-0000000000aa';
    select count(*), max(supplier_id::text)::uuid, max(line_client) into v_item, v_item_supplier, v_item_client
      from public.quote_items where id='c6000000-0000-0000-0000-0000000000c1';
    if v_markup = 0 and v_item = 1 and v_item_supplier is null then
      raise exception 'BRK-C-06: markup CASCADE-sparito (markup rimasti=%) ma quote_item SOPRAVVIVE (supplier=NULL, line_client=%) -> prezzo include un markup ormai inesistente', v_markup, v_item_client;
    end if;
    raise notice 'BRK-C-06 non riprodotta (markup=%, item=%, item_supplier=%)', v_markup, v_item, v_item_supplier;
  end$$;
rollback;


-- ── BRK-C-08 🟠 supplier_leads resta status='WON' dopo cancellazione della sua
--    quote (converted_quote_id FK SET NULL -> punta al nulla): lead "vinto" ma
--    senza piu' il preventivo che lo aveva convertito.
begin;
  insert into auth.users(id) values ('c8000000-0000-0000-0000-000000000002') on conflict do nothing;
  insert into public.profiles(id, role) values ('c8000000-0000-0000-0000-000000000002','FORNITORE')
    on conflict (id) do update set role='FORNITORE';
  select set_config('request.jwt.claims','{"sub":"c8000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

  insert into public.quotes(id, owner_id, title, status, revision)
    values ('c8000000-0000-0000-0000-0000000000aa','c8000000-0000-0000-0000-000000000002','BRK-C-08 QUOTE','INVIATO',1);
  insert into public.supplier_leads(id, supplier_id, status, converted_quote_id, converted_at)
    values ('c8000000-0000-0000-0000-0000000000d1','c8000000-0000-0000-0000-000000000002','WON','c8000000-0000-0000-0000-0000000000aa', now());

  -- la quote viene cancellata (qualsiasi via): FK SET NULL su converted_quote_id
  delete from public.quotes where id='c8000000-0000-0000-0000-0000000000aa';
  do $$
  declare v_status text; v_conv uuid;
  begin
    select status, converted_quote_id into v_status, v_conv
      from public.supplier_leads where id='c8000000-0000-0000-0000-0000000000d1';
    if v_status='WON' and v_conv is null then
      raise exception 'BRK-C-08: supplier_lead ancora status=WON ma converted_quote_id=NULL dopo delete della quote -> lead "vinto" che punta al nulla';
    end if;
    raise notice 'BRK-C-08 non riprodotta (status=%, converted=%)', v_status, v_conv;
  end$$;
rollback;


-- ── BRK-C-09 🟠 RAW DELETE FROM calendar_entries (policy calentry_delete_owner,
--    bypassa la RPC delete_wedding_cascade) DETACCA il contratto FIRMATO:
--    contracts.entry_id FK SET NULL -> l'atto perde il legame con l'evento.
--    Il DELETE qui e' eseguito da superuser dentro begin/rollback: la policy
--    dimostra solo la raggiungibilita' (owner_id=auth.uid()); cio' che asseriamo
--    e' l'effetto detach.
begin;
  insert into auth.users(id) values
    ('c9000000-0000-0000-0000-000000000001'),('c9000000-0000-0000-0000-000000000002')
    on conflict do nothing;
  insert into public.profiles(id, role) values ('c9000000-0000-0000-0000-000000000001','ADMIN')
    on conflict (id) do update set role='ADMIN';
  insert into public.profiles(id, role) values ('c9000000-0000-0000-0000-000000000002','FORNITORE')
    on conflict (id) do update set role='FORNITORE';
  select set_config('request.jwt.claims','{"sub":"c9000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  insert into public.calendar_entries(id, owner_id, title, date_from, date_to)
    values ('c9000000-0000-0000-0000-0000000000ee','c9000000-0000-0000-0000-000000000001','BRK-C-09 EVENT','2027-01-01','2027-01-01');
  insert into public.quotes(id, owner_id, title, status, revision, accepted_at)
    values ('c9000000-0000-0000-0000-0000000000aa','c9000000-0000-0000-0000-000000000001','BRK-C-09 QUOTE','ACCETTATO',1, now());
  insert into public.contracts(id, owner_id, quote_id, entry_id, supplier_id, title, status, party_kind)
    values ('c9000000-0000-0000-0000-0000000000bb','c9000000-0000-0000-0000-000000000001','c9000000-0000-0000-0000-0000000000aa','c9000000-0000-0000-0000-0000000000ee','c9000000-0000-0000-0000-000000000002','BRK-C-09 CONTRACT','INVIATO','CLIENT_WP');
  update public.contracts set status='FIRMATO', signed_at=now(), signature_data='{"name":"Mario Rossi"}'::jsonb
    where id='c9000000-0000-0000-0000-0000000000bb';

  -- RAW DELETE (via policy calentry_delete_owner) — NON la RPC
  delete from public.calendar_entries where id='c9000000-0000-0000-0000-0000000000ee';
  do $$
  declare v_status text; v_entry uuid;
  begin
    select status::text, entry_id into v_status, v_entry
      from public.contracts where id='c9000000-0000-0000-0000-0000000000bb';
    if v_status='FIRMATO' and v_entry is null then
      raise exception 'BRK-C-09: RAW DELETE calendar_entries (policy, bypassa la RPC) ha DETACCATO un contratto FIRMATO (entry_id=NULL) -> atto orfano dell''evento';
    end if;
    raise notice 'BRK-C-09 non riprodotta (status=%, entry=%)', v_status, v_entry;
  end$$;
rollback;


-- ── BRK-C-10 🔴 RAW DELETE FROM quotes (policy quotes_delete_owner, bypassa la RPC):
--    accettazione firmata CASCADE-persa (quote_acceptances FK CASCADE), contratto
--    FIRMATO SOPRAVVIVE con quote_id=NULL (FK SET NULL) -> audit 'quote' orfana e
--    contratto firmato slegato dal preventivo che lo giustificava.
begin;
  insert into auth.users(id) values
    ('ca000000-0000-0000-0000-000000000001'),('ca000000-0000-0000-0000-000000000002')
    on conflict do nothing;
  insert into public.profiles(id, role) values ('ca000000-0000-0000-0000-000000000001','ADMIN')
    on conflict (id) do update set role='ADMIN';
  insert into public.profiles(id, role) values ('ca000000-0000-0000-0000-000000000002','FORNITORE')
    on conflict (id) do update set role='FORNITORE';
  select set_config('request.jwt.claims','{"sub":"ca000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

  insert into public.quotes(id, owner_id, title, status, revision, accepted_at)
    values ('ca000000-0000-0000-0000-0000000000aa','ca000000-0000-0000-0000-000000000001','BRK-C-10 QUOTE','ACCETTATO',1, now());
  insert into public.quote_acceptances(quote_id, access_token, quote_revision, signer_name, signer_email, doc_type, signature_url)
    values ('ca000000-0000-0000-0000-0000000000aa', gen_random_uuid(), 1, 'Mario Rossi','m@x.it','CARTA_IDENTITA','sig://x');
  insert into public.contracts(id, owner_id, quote_id, supplier_id, title, status, party_kind)
    values ('ca000000-0000-0000-0000-0000000000bb','ca000000-0000-0000-0000-000000000001','ca000000-0000-0000-0000-0000000000aa','ca000000-0000-0000-0000-000000000002','BRK-C-10 CONTRACT','INVIATO','CLIENT_WP');
  update public.contracts set status='FIRMATO', signed_at=now(), signature_data='{"name":"Mario Rossi"}'::jsonb
    where id='ca000000-0000-0000-0000-0000000000bb';

  -- RAW DELETE (via policy quotes_delete_owner) — NON la RPC
  delete from public.quotes where id='ca000000-0000-0000-0000-0000000000aa';
  do $$
  declare v_acc int; v_cstatus text; v_cquote uuid; v_orphan int;
  begin
    select count(*) into v_acc from public.quote_acceptances where quote_id='ca000000-0000-0000-0000-0000000000aa';
    select status::text, quote_id into v_cstatus, v_cquote from public.contracts where id='ca000000-0000-0000-0000-0000000000bb';
    select count(*) into v_orphan from public.signature_audit_trail s
      where s.document_type='quote' and s.document_id='ca000000-0000-0000-0000-0000000000aa'
        and not exists (select 1 from public.quotes q where q.id=s.document_id);
    if v_acc=0 and v_cstatus='FIRMATO' and v_cquote is null and v_orphan>=1 then
      raise exception 'BRK-C-10: RAW DELETE quotes (policy) ha CASCADE-perso l''accettazione firmata (acc rimaste=%); contratto FIRMATO sopravvive con quote_id=NULL e % audit ''quote'' ORFANE', v_acc, v_orphan;
    end if;
    raise notice 'BRK-C-10 non riprodotta (acc=%, contract_status=%, contract_quote=%, orfani=%)', v_acc, v_cstatus, v_cquote, v_orphan;
  end$$;
rollback;
