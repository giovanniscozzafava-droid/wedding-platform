-- ============================================================================
-- REGRESSIONE VERDE — Cluster 2 "I numeri accettati sono congelati"
-- (ex BRK-E-SNAPSHOT-02/03, BRK-A-12/14/15). Verde = nessun ERROR.
-- Ogni test in begin/rollback. Owner Giulia 00000000-aaaa-0000-0000-000000000002.
-- ============================================================================

-- ── C2-T1 · SNAPSHOT-02: su quote ACCETTATO il cambio default_markup NON tocca
--    line_client; su BOZZA invece ricalcola (positivo) ─────────────────────────
begin;
  do $$
  declare v_qa uuid := gen_random_uuid(); v_qb uuid := gen_random_uuid();
          v_l_acc1 numeric; v_l_acc2 numeric; v_l_boz1 numeric; v_l_boz2 numeric;
  begin
    -- ACCETTATO
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision,default_markup_percent)
    values (v_qa,'00000000-aaaa-0000-0000-000000000002','QA','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1,30);
    insert into quote_items(quote_id,name_snapshot,snapshot_price,client_decision) values (v_qa,'Voce',100,'ACCETTATO');
    select line_client into v_l_acc1 from quote_items where quote_id=v_qa;
    update quotes set default_markup_percent=80 where id=v_qa;
    select line_client into v_l_acc2 from quote_items where quote_id=v_qa;
    if v_l_acc2 is distinct from v_l_acc1 then raise exception 'FAIL C2-T1: line_client cambiato su ACCETTATO (% -> %)',v_l_acc1,v_l_acc2; end if;
    -- BOZZA (positivo: deve ricalcolare)
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision,default_markup_percent)
    values (v_qb,'00000000-aaaa-0000-0000-000000000002','QB','2027-05-01','BOZZA',gen_random_uuid(),1,30);
    insert into quote_items(quote_id,name_snapshot,snapshot_price) values (v_qb,'Voce',100);
    select line_client into v_l_boz1 from quote_items where quote_id=v_qb;
    update quotes set default_markup_percent=80 where id=v_qb;
    select line_client into v_l_boz2 from quote_items where quote_id=v_qb;
    if v_l_boz2 = v_l_boz1 then raise exception 'FAIL C2-T1: su BOZZA il markup NON ha ricalcolato (regressione) (=%)',v_l_boz1; end if;
    raise notice 'C2-T1 OK (ACCETTATO congelato %=%; BOZZA ricalcola % -> %)',v_l_acc1,v_l_acc2,v_l_boz1,v_l_boz2;
  end$$;
rollback;

-- ── C2-T2 · SNAPSHOT-03: su quote ACCETTATO l'override markup-per-fornitore NON
--    tocca line_client; su BOZZA sì (positivo) ────────────────────────────────
begin;
  do $$
  declare v_qa uuid := gen_random_uuid(); v_qb uuid := gen_random_uuid();
          v_sup uuid := '00000000-aaaa-0000-0000-000000000005';
          v_a1 numeric; v_a2 numeric; v_b1 numeric; v_b2 numeric;
  begin
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision,default_markup_percent)
    values (v_qa,'00000000-aaaa-0000-0000-000000000002','QA','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1,30);
    insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id,client_decision) values (v_qa,'Voce',100,v_sup,'ACCETTATO');
    select line_client into v_a1 from quote_items where quote_id=v_qa;
    insert into quote_supplier_markups(quote_id,supplier_id,markup_percent) values (v_qa,v_sup,150);
    select line_client into v_a2 from quote_items where quote_id=v_qa;
    if v_a2 is distinct from v_a1 then raise exception 'FAIL C2-T2: override ha cambiato line_client su ACCETTATO (% -> %)',v_a1,v_a2; end if;
    -- BOZZA positivo
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision,default_markup_percent)
    values (v_qb,'00000000-aaaa-0000-0000-000000000002','QB','2027-05-01','BOZZA',gen_random_uuid(),1,30);
    insert into quote_items(quote_id,name_snapshot,snapshot_price,supplier_id) values (v_qb,'Voce',100,v_sup);
    select line_client into v_b1 from quote_items where quote_id=v_qb;
    insert into quote_supplier_markups(quote_id,supplier_id,markup_percent) values (v_qb,v_sup,150);
    select line_client into v_b2 from quote_items where quote_id=v_qb;
    if v_b2 = v_b1 then raise exception 'FAIL C2-T2: su BOZZA l''override NON ha ricalcolato (regressione) (=%)',v_b1; end if;
    raise notice 'C2-T2 OK (ACCETTATO congelato %; BOZZA ricalcola % -> %)',v_a1,v_b1,v_b2;
  end$$;
rollback;

-- ── C2-T3 · A-15: quote_reopen blocca un CONVERTITO_IN_CONTRATTO; riapre un
--    ACCETTATO chiuso (positivo) ─────────────────────────────────────────────
begin;
  do $$
  declare v_qc uuid := gen_random_uuid(); v_qa uuid := gen_random_uuid(); v_r boolean;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub','00000000-aaaa-0000-0000-000000000002','role','authenticated')::text, true);
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision,closed_at)
    values (v_qc,'00000000-aaaa-0000-0000-000000000002','QC','2027-05-01','CONVERTITO_IN_CONTRATTO',now(),gen_random_uuid(),1,now());
    v_r := quote_reopen(v_qc);
    if v_r or (select closed_at from quotes where id=v_qc) is null then raise exception 'FAIL C2-T3: CONVERTITO riaperto (r=%)',v_r; end if;
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision,closed_at)
    values (v_qa,'00000000-aaaa-0000-0000-000000000002','QA','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1,now());
    v_r := quote_reopen(v_qa);
    if not v_r or (select closed_at from quotes where id=v_qa) is not null then raise exception 'FAIL C2-T3: ACCETTATO chiuso NON riaperto (regressione)'; end if;
    raise notice 'C2-T3 OK (CONVERTITO non riaperto; ACCETTATO riaperto)';
  end$$;
rollback;

-- ── C2-T4 · A-14: quote_conclude_by_client rifiuta un INVIATO non accettato;
--    conclude un ACCETTATO (positivo) ────────────────────────────────────────
begin;
  do $$
  declare v_qi uuid := gen_random_uuid(); v_qa uuid := gen_random_uuid(); v_res jsonb;
  begin
    perform set_config('request.jwt.claims', json_build_object('email','cli@test.it','role','authenticated')::text, true);
    insert into quotes(id,owner_id,title,client_email,event_date,status,access_token,revision)
    values (v_qi,'00000000-aaaa-0000-0000-000000000002','QI','cli@test.it','2027-05-01','INVIATO',gen_random_uuid(),1);
    v_res := quote_conclude_by_client(v_qi);
    if v_res->>'error' is distinct from 'not_accepted' then raise exception 'FAIL C2-T4: INVIATO concluso (res=%)',v_res; end if;
    if (select closed_at from quotes where id=v_qi) is not null then raise exception 'FAIL C2-T4: INVIATO ha closed_at'; end if;
    insert into quotes(id,owner_id,title,client_email,event_date,status,accepted_at,access_token,revision)
    values (v_qa,'00000000-aaaa-0000-0000-000000000002','QA','cli@test.it','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
    v_res := quote_conclude_by_client(v_qa);
    if v_res->>'ok' is distinct from 'true' then raise exception 'FAIL C2-T4: ACCETTATO non concluso (regressione) (res=%)',v_res; end if;
    raise notice 'C2-T4 OK (INVIATO rifiutato not_accepted; ACCETTATO concluso)';
  end$$;
rollback;

-- ── C2-T5 · A-12: client_decide_quote_item rifiuta una voce contrattualizzata;
--    decide una voce viva (positivo) ─────────────────────────────────────────
begin;
  do $$
  declare v_qa uuid := gen_random_uuid(); v_it1 uuid := gen_random_uuid(); v_it2 uuid := gen_random_uuid(); v_res jsonb;
  begin
    perform set_config('request.jwt.claims', json_build_object('email','cli@test.it','role','authenticated')::text, true);
    insert into quotes(id,owner_id,title,client_email,event_date,status,accepted_at,access_token,revision)
    values (v_qa,'00000000-aaaa-0000-0000-000000000002','QA','cli@test.it','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
    -- voce già contrattualizzata
    insert into quote_items(id,quote_id,name_snapshot,snapshot_price,client_decision,contracted_at) values (v_it1,v_qa,'Voce contratto',100,'ACCETTATO',now());
    v_res := client_decide_quote_item(v_it1,'RIFIUTATO','ci ripenso');
    if v_res->>'error' is distinct from 'contracted' then raise exception 'FAIL C2-T5: voce contrattualizzata ridecisa (res=%)',v_res; end if;
    if (select client_decision from quote_items where id=v_it1) <> 'ACCETTATO' then raise exception 'FAIL C2-T5: decisione voce contratto cambiata'; end if;
    -- voce viva (positivo)
    insert into quote_items(id,quote_id,name_snapshot,snapshot_price,client_decision) values (v_it2,v_qa,'Voce viva',100,'IN_ATTESA');
    v_res := client_decide_quote_item(v_it2,'ACCETTATO');
    if v_res->>'ok' is distinct from 'true' then raise exception 'FAIL C2-T5: voce viva non decisa (regressione) (res=%)',v_res; end if;
    raise notice 'C2-T5 OK (voce contrattualizzata congelata; voce viva decisa)';
  end$$;
rollback;

do $$ begin raise notice 'CLUSTER 2 — regressione verde: completata'; end$$;
