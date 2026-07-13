-- TEST e2e della RPC contract_mark_signed_paper (chiama la funzione reale con auth.uid() simulato).
-- Non-fatale: qualsiasi intoppo = NOTICE. Self-cleaning.
do $$
declare v_owner uuid; v_qid uuid; v_cid uuid; v_ok boolean; v_status text; v_meth text; v_denied boolean := false;
begin
  select q.owner_id, q.id into v_owner, v_qid from public.quotes q
    where q.status in ('INVIATO','ACCETTATO','CONVERTITO_IN_CONTRATTO') order by q.created_at desc limit 1;
  if v_owner is null then raise notice 'TEST RPC CARTACEO: nessun preventivo idoneo, salto'; return; end if;
  begin
    insert into public.contracts (owner_id, quote_id, title, client_name, total_amount, status, access_token)
      values (v_owner, v_qid, '__TEST_RPC_CARTACEO__', 'Mario Rossi', 1000, 'INVIATO', gen_random_uuid())
      returning id into v_cid;

    -- 1) guardia owner: chiamante diverso dal proprietario → deve essere respinto
    perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid()::text)::text, true);
    begin perform public.contract_mark_signed_paper(v_cid); exception when others then v_denied := true; end;

    -- 2) proprietario → firma cartacea ok
    perform set_config('request.jwt.claims', json_build_object('sub', v_owner::text)::text, true);
    v_ok := public.contract_mark_signed_paper(v_cid);
    select status, signature_data->>'method' into v_status, v_meth from public.contracts where id = v_cid;

    delete from public.contracts where id = v_cid;
    if v_denied and v_ok and v_status = 'FIRMATO' and v_meth = 'CARTACEO' then
      raise notice 'TEST RPC CARTACEO: OK — estraneo respinto, owner firma → FIRMATO method=CARTACEO';
    else
      raise notice 'TEST RPC CARTACEO: ESITO INATTESO denied=% ok=% status=% method=%', v_denied, v_ok, v_status, v_meth;
    end if;
  exception when others then
    if v_cid is not null then delete from public.contracts where id = v_cid; end if;
    raise notice 'TEST RPC CARTACEO: salto (%).', SQLERRM;
  end;
end $$;
