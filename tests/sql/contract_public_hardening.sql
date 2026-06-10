-- ============================================================================
-- REGRESSIONE VERDE — payload pubblico contratto + eleggibilità controfirma.
-- Verde = nessun ERROR. Difende dal ritorno del leak PII su contract_get_by_token
-- (anon) e dall'esposizione dell'eleggibilità a non-parti.
-- ============================================================================
begin;
do $$
declare v_sup uuid:='00000000-aaaa-0000-0000-000000000005'; v_q uuid:=gen_random_uuid();
        v_tok uuid:=gen_random_uuid(); v_cid uuid:=gen_random_uuid(); v_pub jsonb; v_ctx jsonb;
begin
  insert into quotes(id,owner_id,title,client_email,event_date,status,accepted_at,access_token,revision)
  values (v_q,v_sup,'Q','c@test.it','2027-05-01','ACCETTATO',now(),gen_random_uuid(),1);
  insert into quote_acceptances(quote_id,access_token,quote_revision,signer_name,signer_email,doc_type,doc_number,client_fiscal_code,signature_url,consent_terms,consent_privacy)
  values (v_q,gen_random_uuid(),1,'Cliente','c@test.it','CARTA_IDENTITA','AB1234567','RSSMRA80A01H501U','k',true,true);
  insert into contracts(id,owner_id,supplier_id,quote_id,party_kind,title,client_name,status,access_token,access_token_expires_at)
  values (v_cid,v_sup,v_sup,v_q,'CLIENT_WP','C','Cliente','BOZZA',v_tok,now()+interval '1 day');
  perform contract_sign_full(v_tok,'Cliente','RSSMRA80A01H501U','CARTA_IDENTITA','AB1234567',null,'data:image/png;base64,AAAA',true,true);

  -- (1) payload pubblico post-firma: niente doc_number / fiscal cliente
  v_pub := contract_get_by_token(v_tok);
  if (v_pub->'prefill'->>'doc_number') is not null or (v_pub->'prefill'->>'client_fiscal_code') is not null then
    raise exception 'FAIL hardening: payload pubblico espone doc/CF cliente post-firma';
  end if;
  -- (2) owner = solo branding (niente dati fiscali del professionista)
  if (v_pub->'owner') ? 'fiscal_code' or (v_pub->'owner') ? 'vat_number' or (v_pub->'owner') ? 'pec_email' or (v_pub->'owner') ? 'address' then
    raise exception 'FAIL hardening: owner espone dati fiscali del professionista';
  end if;
  -- (3) eleggibilità: il professionista sì
  perform set_config('request.jwt.claims', json_build_object('sub',v_sup::text,'role','authenticated')::text, true);
  v_ctx := contract_countersign_context(v_tok);
  if (v_ctx->>'can_countersign') is distinct from 'true' or (v_ctx->>'contract_id') is distinct from v_cid::text then
    raise exception 'FAIL: professionista non eleggibile alla controfirma (%)', v_ctx;
  end if;
  -- (4) eleggibilità: anon no, e nessun contract_id trapelato
  perform set_config('request.jwt.claims','{"role":"anon"}',true);
  v_ctx := contract_countersign_context(v_tok);
  if (v_ctx->>'can_countersign') is distinct from 'false' or (v_ctx ? 'contract_id') then
    raise exception 'FAIL: anon ottiene eleggibilità o contract_id (%)', v_ctx;
  end if;
  raise notice 'HARDENING OK (payload pulito; eleggibilità solo al professionista)';
end$$;
rollback;
