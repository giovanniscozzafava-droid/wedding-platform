-- Prova del nove sul contratto "Cristoforo Colombo": esegue davvero il passaggio a INVIATO
-- (ciò che il fornitore voleva: portarlo alla firma). I trigger scattano comunque → se qualcosa
-- blocca il passaggio, lo cattura e lo stampa. Se va, il contratto è pronto per la firma.
do $$
declare v_cid uuid; v_owner uuid; v_status text; v_tok boolean;
begin
  select id, owner_id, status::text, access_token is not null
    into v_cid, v_owner, v_status, v_tok
    from public.contracts where client_name ilike '%colombo%' order by created_at desc limit 1;
  if v_cid is null then raise notice 'SENDTEST: contratto Colombo non trovato.'; return; end if;
  raise notice 'SENDTEST: contratto % | stato=% | token=%', v_cid, v_status, v_tok;
  if v_status = 'FIRMATO' then raise notice 'SENDTEST: già FIRMATO, niente da fare.'; return; end if;
  begin
    update public.contracts
       set status = 'INVIATO', access_token = coalesce(access_token, gen_random_uuid()::text)
     where id = v_cid;
    select status::text into v_status from public.contracts where id = v_cid;
    raise notice 'SENDTEST: passaggio a firma OK -> stato ora = % (link di firma pronto).', v_status;
  exception when others then
    raise notice 'SENDTEST: passaggio a firma FALLITO -> %', sqlerrm;
  end;
end $$;
