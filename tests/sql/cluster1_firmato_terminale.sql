-- ============================================================================
-- REGRESSIONE VERDE — Cluster 1 "FIRMATO è terminale" (ex BRK-A-06/07/07b/08/09/
-- 10/11, BRK-C-01/02/05/09/10). Verde = nessun ERROR. Ogni test in begin/rollback.
--   docker exec -i supabase_db_wedding-platform psql -U postgres -d postgres \
--     -v ON_ERROR_STOP=0 -f tests/sql/cluster1_firmato_terminale.sql
-- Owner di test: Giulia 00000000-aaaa-0000-0000-000000000002 (seed).
-- ============================================================================
\set OWNER '00000000-aaaa-0000-0000-000000000002'

-- ── C1-T1 · firma legittima OK + ri-firma idempotente NON sovrascrive (A-07/07b)
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_tok uuid := gen_random_uuid(); v_cid uuid := gen_random_uuid();
          v_ok boolean; v_signer text; v_signer2 text; v_status contract_status;
  begin
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
    insert into contracts(id,owner_id,quote_id,party_kind,title,status,access_token,access_token_expires_at)
    values (v_cid,'00000000-aaaa-0000-0000-000000000002',v_q,'CLIENT_WP','Contratto','BOZZA'::contract_status,v_tok,now()+interval '1 day');
    -- firma legittima (da BOZZA)
    v_ok := contract_sign_full(v_tok,'Mario Vero','RSSMRA80A01H501U',null,null,null,'data:image/png;base64,AAAA',true,true);
    select status, signature_data->>'name' into v_status, v_signer from contracts where id=v_cid;
    if not v_ok or v_status<>'FIRMATO' then raise exception 'FAIL C1-T1: firma legittima non riuscita (ok=% status=%)',v_ok,v_status; end if;
    -- ri-firma con dati ATTACKER: idempotente, NON deve sovrascrivere il firmatario
    v_ok := contract_sign_full(v_tok,'ATTACKER Impostore','XXXYYY00A01H501Z',null,null,null,'data:image/png;base64,BBBB',true,true);
    select signature_data->>'name' into v_signer2 from contracts where id=v_cid;
    if v_signer2 is distinct from v_signer then raise exception 'FAIL C1-T1: ri-firma ha sovrascritto il firmatario (% -> %)',v_signer,v_signer2; end if;
    raise notice 'C1-T1 OK (firma ok; ri-firma idempotente, firmatario resta %)',v_signer;
  end$$;
rollback;

-- ── C1-T2 · ri-firma addendum FIRMATO non sovrascrive (A-08)
begin;
  do $$
  declare v_aid uuid := gen_random_uuid(); v_tok uuid := gen_random_uuid(); v_cid uuid := gen_random_uuid(); v_n2 text;
  begin
    insert into contracts(id,owner_id,party_kind,title,status,access_token)
    values (v_cid,'00000000-aaaa-0000-0000-000000000002','SUPPLIER_WP','C','BOZZA',gen_random_uuid());
    insert into contract_addendums(id,contract_id,access_token,status,title,access_token_expires_at,signed_at,signer_data)
    values (v_aid,v_cid,v_tok,'FIRMATO','Add',now()+interval '1 day',now(),jsonb_build_object('name','Firmatario Originale'));
    perform addendum_sign_full(v_tok,'ATTACKER Add','XXX',null,null,null,'data:image/png;base64,CCCC',true,true);
    select signer_data->>'name' into v_n2 from contract_addendums where id=v_aid;
    if v_n2 <> 'Firmatario Originale' then raise exception 'FAIL C1-T2: addendum FIRMATO ri-firmato (name=%)',v_n2; end if;
    raise notice 'C1-T2 OK (addendum FIRMATO non sovrascritto)';
  end$$;
rollback;

-- ── C1-T3 · countersign solo dopo la firma; prima → blocca (A-09) + positivo
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_tok uuid := gen_random_uuid(); v_cid uuid := gen_random_uuid(); v_blocked boolean := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub','00000000-aaaa-0000-0000-000000000002','role','authenticated')::text, true);
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
    insert into contracts(id,owner_id,quote_id,party_kind,title,status,access_token,access_token_expires_at)
    values (v_cid,'00000000-aaaa-0000-0000-000000000002',v_q,'CLIENT_WP','Contratto','BOZZA',v_tok,now()+interval '1 day');
    -- controfirma PRIMA della firma → deve bloccare
    begin
      perform countersign_contract(v_cid,'WP Nome','WPFISCAL');
    exception when others then
      if sqlerrm like '%contract_not_signed_yet%' then v_blocked := true; else raise; end if;
    end;
    if not v_blocked then raise exception 'FAIL C1-T3: controfirma su contratto non firmato non bloccata'; end if;
    -- firma e poi controfirma legittima
    perform contract_sign_full(v_tok,'Cliente','CLFISCAL00A01H501U',null,null,null,'data:image/png;base64,AAAA',true,true);
    perform countersign_contract(v_cid,'WP Nome','WPFISCAL');
    if (select countersign_at from contracts where id=v_cid) is null then raise exception 'FAIL C1-T3: controfirma legittima non registrata'; end if;
    raise notice 'C1-T3 OK (controfirma bloccata prima, ok dopo la firma)';
  end$$;
rollback;

-- ── C1-T4 · token revocato/scaduto bloccano la firma (A-10/A-11)
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_tok uuid := gen_random_uuid(); v_cid uuid := gen_random_uuid();
          v_rev boolean := false; v_exp boolean := false;
  begin
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
    insert into contracts(id,owner_id,quote_id,party_kind,title,status,access_token,access_token_expires_at,token_revoked_at)
    values (v_cid,'00000000-aaaa-0000-0000-000000000002',v_q,'CLIENT_WP','Contratto','BOZZA',v_tok,now()+interval '1 day',now());
    begin perform contract_sign_full(v_tok,'X','XFISCAL00A01H501U',null,null,null,'data:image/png;base64,AAAA',true,true);
    exception when others then if sqlerrm like '%token_revoked%' then v_rev:=true; else raise; end if; end;
    update contracts set token_revoked_at=null, access_token_expires_at=now()-interval '1 day' where id=v_cid;
    begin perform contract_sign_full(v_tok,'X','XFISCAL00A01H501U',null,null,null,'data:image/png;base64,AAAA',true,true);
    exception when others then if sqlerrm like '%token_expired%' then v_exp:=true; else raise; end if; end;
    if not (v_rev and v_exp) then raise exception 'FAIL C1-T4: revoca=% scadenza=% (atteso entrambi bloccati)',v_rev,v_exp; end if;
    if (select status from contracts where id=v_cid) = 'FIRMATO' then raise exception 'FAIL C1-T4: contratto firmato nonostante token invalido'; end if;
    raise notice 'C1-T4 OK (token revocato e scaduto bloccano la firma)';
  end$$;
rollback;

-- ── C1-T5 · no re-link di contratto FIRMATO + no link a quote non accettato (A-06)
begin;
  do $$
  declare v_qa uuid := gen_random_uuid(); v_qb uuid := gen_random_uuid(); v_tok uuid := gen_random_uuid();
          v_cid uuid := gen_random_uuid(); v_blocked boolean := false;
  begin
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision)
    values (v_qa,'00000000-aaaa-0000-0000-000000000002','QA','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision)
    values (v_qb,'00000000-aaaa-0000-0000-000000000002','QB','2027-05-01','BOZZA',gen_random_uuid(),1);
    insert into contracts(id,owner_id,quote_id,party_kind,title,status,access_token,access_token_expires_at)
    values (v_cid,'00000000-aaaa-0000-0000-000000000002',v_qa,'CLIENT_WP','Contratto','BOZZA',v_tok,now()+interval '1 day');
    perform contract_sign_full(v_tok,'Cliente','CLFISCAL00A01H501U',null,null,null,'data:image/png;base64,AAAA',true,true);
    -- re-link del contratto FIRMATO a un altro preventivo → blocca
    begin update contracts set quote_id=v_qb where id=v_cid;
    exception when others then v_blocked := true; end;
    if not v_blocked then raise exception 'FAIL C1-T5: re-link di contratto FIRMATO non bloccato'; end if;
    if (select quote_id from contracts where id=v_cid) <> v_qa then raise exception 'FAIL C1-T5: quote_id cambiato su contratto FIRMATO'; end if;
    raise notice 'C1-T5 OK (re-link di contratto FIRMATO bloccato)';
  end$$;
rollback;

-- ── C1-T6 · atto firmato non cancellabile (RPC + DELETE diretto/superuser) +
--            cancellazione legittima di un preventivo NON firmato (C-01/05/10)
begin;
  do $$
  declare v_q uuid := gen_random_uuid(); v_tok uuid := gen_random_uuid(); v_cid uuid := gen_random_uuid();
          v_qf uuid := gen_random_uuid(); v_b1 boolean := false; v_b2 boolean := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub','00000000-aaaa-0000-0000-000000000002','role','authenticated')::text, true);
    -- preventivo CON atto firmato
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q firmato','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
    insert into contracts(id,owner_id,quote_id,party_kind,title,status,access_token,access_token_expires_at)
    values (v_cid,'00000000-aaaa-0000-0000-000000000002',v_q,'CLIENT_WP','C','BOZZA',v_tok,now()+interval '1 day');
    perform contract_sign_full(v_tok,'Cliente','CLFISCAL00A01H501U',null,null,null,'data:image/png;base64,AAAA',true,true);
    -- (a) via RPC
    begin perform delete_quote_cascade(v_q); exception when others then if sqlerrm like '%cannot_delete_quote_with_signed_act%' then v_b1:=true; else raise; end if; end;
    -- (b) DELETE diretto come superuser (il backstop trigger deve scattare comunque)
    begin delete from quotes where id=v_q; exception when others then if sqlerrm like '%cannot_delete_quote_with_signed_act%' then v_b2:=true; else raise; end if; end;
    if not (v_b1 and v_b2) then raise exception 'FAIL C1-T6: rpc_bloccata=% direct_bloccato=%',v_b1,v_b2; end if;
    if not exists (select 1 from contracts where id=v_cid and status='FIRMATO') then raise exception 'FAIL C1-T6: contratto FIRMATO distrutto'; end if;
    -- positivo: preventivo NON firmato è cancellabile
    insert into quotes(id,owner_id,title,event_date,status,access_token,revision)
    values (v_qf,'00000000-aaaa-0000-0000-000000000002','Q libero','2027-05-01','BOZZA',gen_random_uuid(),1);
    perform delete_quote_cascade(v_qf);
    if exists (select 1 from quotes where id=v_qf) then raise exception 'FAIL C1-T6: preventivo non firmato non cancellato (regressione)'; end if;
    raise notice 'C1-T6 OK (atto firmato non cancellabile via RPC e diretto; bozza cancellabile)';
  end$$;
rollback;

-- ── C1-T7 · evento con atto firmato non cancellabile + evento libero sì (C-02/09)
begin;
  do $$
  declare v_e uuid := gen_random_uuid(); v_q uuid := gen_random_uuid(); v_tok uuid := gen_random_uuid();
          v_cid uuid := gen_random_uuid(); v_e2 uuid := gen_random_uuid(); v_b1 boolean := false; v_b2 boolean := false;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub','00000000-aaaa-0000-0000-000000000002','role','authenticated')::text, true);
    insert into quotes(id,owner_id,title,event_date,status,accepted_at,access_token,revision)
    values (v_q,'00000000-aaaa-0000-0000-000000000002','Q','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
    insert into calendar_entries(id,owner_id,title,date_from,date_to,status,quote_id)
    values (v_e,'00000000-aaaa-0000-0000-000000000002','Evento','2027-05-01','2027-05-01','OPZIONATA',v_q);
    insert into contracts(id,owner_id,quote_id,entry_id,party_kind,title,status,access_token,access_token_expires_at)
    values (v_cid,'00000000-aaaa-0000-0000-000000000002',v_q,v_e,'CLIENT_WP','C','BOZZA',v_tok,now()+interval '1 day');
    perform contract_sign_full(v_tok,'Cliente','CLFISCAL00A01H501U',null,null,null,'data:image/png;base64,AAAA',true,true);
    begin perform delete_wedding_cascade(v_e); exception when others then if sqlerrm like '%cannot_delete_entry_with_signed_act%' then v_b1:=true; else raise; end if; end;
    begin delete from calendar_entries where id=v_e; exception when others then if sqlerrm like '%cannot_delete_entry_with_signed_act%' then v_b2:=true; else raise; end if; end;
    if not (v_b1 and v_b2) then raise exception 'FAIL C1-T7: rpc=% direct=%',v_b1,v_b2; end if;
    if not exists (select 1 from contracts where id=v_cid and status='FIRMATO') then raise exception 'FAIL C1-T7: contratto distrutto'; end if;
    -- positivo: evento libero cancellabile
    insert into calendar_entries(id,owner_id,title,date_from,date_to,status)
    values (v_e2,'00000000-aaaa-0000-0000-000000000002','Evento libero','2027-06-01','2027-06-01','IN_TRATTATIVA');
    perform delete_wedding_cascade(v_e2);
    if exists (select 1 from calendar_entries where id=v_e2) then raise exception 'FAIL C1-T7: evento libero non cancellato (regressione)'; end if;
    raise notice 'C1-T7 OK (evento con atto firmato non cancellabile; evento libero sì)';
  end$$;
rollback;

do $$ begin raise notice 'CLUSTER 1 — regressione verde: completata (nessun FAIL sopra = tutto verde)'; end$$;
