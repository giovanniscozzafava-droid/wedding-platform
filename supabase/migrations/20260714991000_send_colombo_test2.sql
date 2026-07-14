-- Prova del nove (corretta): access_token è UUID. Esegue il passaggio a INVIATO del contratto Colombo.
do $$
declare v_cid uuid; v_status text;
begin
  select id, status::text into v_cid, v_status from public.contracts where client_name ilike '%colombo%' order by created_at desc limit 1;
  if v_cid is null then raise notice 'SENDTEST2: contratto Colombo non trovato.'; return; end if;
  if v_status = 'FIRMATO' then raise notice 'SENDTEST2: già FIRMATO.'; return; end if;
  begin
    update public.contracts
       set status = 'INVIATO', access_token = coalesce(access_token, gen_random_uuid())
     where id = v_cid;
    select status::text into v_status from public.contracts where id = v_cid;
    raise notice 'SENDTEST2: passaggio a firma OK -> stato ora = % (contratto Colombo pronto per la firma).', v_status;
  exception when others then
    raise notice 'SENDTEST2: passaggio a firma FALLITO -> %', sqlerrm;
  end;
end $$;
