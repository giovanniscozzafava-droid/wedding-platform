-- ============================================================================
-- REGRESSIONE VERDE — Cluster 4 "Contabilità CONGELATA"
-- NON prova che la matematica sia corretta (non lo è: vedi tests/adversarial/
-- E_accounting.sql, ancora expected-fail). Prova che, col flag OFF (default), la
-- SUPERFICIE è INERTE: niente crediti coniati, niente saldi. Verde = nessun ERROR.
-- ============================================================================

-- ── C4-T0 · il flag è OFF di default ───────────────────────────────────────
do $$ begin
  if public.feature_enabled('referral_accounting_enabled') then
    raise exception 'FAIL C4-T0: referral_accounting_enabled dovrebbe essere OFF';
  end if;
  raise notice 'C4-T0 OK (referral_accounting_enabled = OFF)';
end$$;

-- ── C4-T1 · settle_supplier_credit congelato (E-02/E-06) ───────────────────
begin;
  do $$
  declare v_cid uuid := gen_random_uuid(); v_res jsonb; v_status text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub','00000000-aaaa-0000-0000-000000000005','role','authenticated')::text, true);
    insert into supplier_credits(id,creditor_id,debtor_id,amount,status)
    values (v_cid,'00000000-aaaa-0000-0000-000000000003','00000000-aaaa-0000-0000-000000000005',39,'PENDING');
    v_res := settle_supplier_credit(v_cid,'CASH');
    if v_res->>'error' is distinct from 'disabled' then raise exception 'FAIL C4-T1: settle non congelato (%)',v_res; end if;
    select status into v_status from supplier_credits where id=v_cid;
    if v_status <> 'PENDING' then raise exception 'FAIL C4-T1: credito modificato a flag spento (status=%)',v_status; end if;
    raise notice 'C4-T1 OK (settle_supplier_credit = disabled, credito intatto)';
  end$$;
rollback;

-- ── C4-T2 · recruiting_settle_due congelato (E-08) ─────────────────────────
begin;
  do $$
  declare v_res jsonb;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub','00000000-aaaa-0000-0000-000000000005','role','authenticated')::text, true);
    v_res := recruiting_settle_due();
    if v_res->>'reason' is distinct from 'disabled' then raise exception 'FAIL C4-T2: recruiting_settle non congelato (%)',v_res; end if;
    raise notice 'C4-T2 OK (recruiting_settle_due = disabled)';
  end$$;
rollback;

-- ── C4-T3 · autocredit inerte: firmare un contratto referenziato conia 0 (E-01)
begin;
  do $$
  declare v_cid uuid := gen_random_uuid(); v_tok uuid := gen_random_uuid(); v_q uuid := gen_random_uuid();
          v_before int; v_after int;
  begin
    -- segnalazione SUGGESTED del referrer ...003 verso il suggerito ...005
    insert into supplier_referrals(referrer_id, suggested_id, client_email, status)
    values ('00000000-aaaa-0000-0000-000000000003','00000000-aaaa-0000-0000-000000000005','referred@test.it','SUGGESTED');
    insert into quotes(id,owner_id,title,client_email,event_date,status,accepted_at,access_token,revision)
    values (v_q,'00000000-aaaa-0000-0000-000000000005','Q','referred@test.it','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
    insert into contracts(id,owner_id,quote_id,party_kind,title,client_email,status,access_token,access_token_expires_at)
    values (v_cid,'00000000-aaaa-0000-0000-000000000005',v_q,'CLIENT_WP','C','referred@test.it','BOZZA',v_tok,now()+interval '1 day');
    select count(*) into v_before from supplier_credits;
    -- firma → trigger autocredit (a flag spento NON deve coniare)
    perform contract_sign_full(v_tok,'Cliente','CLFISCAL00A01H501U',null,null,null,'data:image/png;base64,AAAA',true,true);
    select count(*) into v_after from supplier_credits;
    if v_after <> v_before then raise exception 'FAIL C4-T3: autocredit ha coniato % credito/i a flag spento', v_after - v_before; end if;
    raise notice 'C4-T3 OK (firma di contratto referenziato: 0 crediti coniati, dominio inerte)';
  end$$;
rollback;

do $$ begin raise notice 'CLUSTER 4 — freeze verificato (superficie inerte; matematica NON toccata)'; end$$;
