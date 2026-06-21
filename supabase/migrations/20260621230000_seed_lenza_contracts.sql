-- Completa lo snodo CONTRATTI per Casino Lenza: un contratto FIRMATO richiede signed_at + signature_data
-- (vincolo contracts_firmato_requires_signature). Crea i contratti firmati per i preventivi convertiti.
do $c$
declare v_loc uuid; r record;
begin
  select id into v_loc from auth.users where lower(email)=lower('giovanni.scozzafava+lenza@gmail.com');
  if v_loc is null then return; end if;
  for r in
    select q.id as qid, q.client_name, q.total_client, q.event_date, q.event_kind, ce.id as entry_id
    from public.quotes q join public.calendar_entries ce on ce.quote_id = q.id
    where q.owner_id = v_loc and q.status = 'CONVERTITO_IN_CONTRATTO'
      and not exists (select 1 from public.contracts c where c.quote_id = q.id)
  loop
    begin
      insert into public.contracts(owner_id, quote_id, entry_id, title, client_name, total_amount,
                                   status, signed_at, signature_data, event_date, event_kind)
        values (v_loc, r.qid, r.entry_id, 'Contratto '||r.client_name, r.client_name, r.total_client,
                'FIRMATO', (r.event_date - 30)::timestamptz,
                jsonb_build_object('signer_name', r.client_name, 'method', 'demo', 'signed', true),
                r.event_date, r.event_kind);
    exception when others then raise notice 'contratto % saltato: %', r.client_name, sqlerrm;
    end;
  end loop;
  raise notice 'Casino Lenza: contratti firmati creati';
end$c$;
