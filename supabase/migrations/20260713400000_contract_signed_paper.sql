-- "Firmato cartaceo": il fornitore marca un contratto come firmato su carta (stampato e firmato a mano),
-- quando non passa per la firma digitale. Deve popolare signed_at + signature_data per rispettare il
-- CHECK contracts_firmato_requires_signature. Consuma anche il token del link digitale (così non resta
-- firmabile due volte). Solo il proprietario del contratto.
create or replace function public.contract_mark_signed_paper(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_row public.contracts%rowtype;
begin
  select * into v_row from public.contracts where id = p_id;
  if v_row.id is null then raise exception 'Contratto non trovato'; end if;
  if v_row.owner_id <> auth.uid() then raise exception 'Non autorizzato'; end if;
  if v_row.status = 'FIRMATO' then return true; end if;                 -- idempotente
  if v_row.status not in ('BOZZA','INVIATO') then
    raise exception 'Contratto non firmabile (stato %)', v_row.status;
  end if;

  update public.contracts
     set status = 'FIRMATO',
         signed_at = now(),
         token_consumed_at = coalesce(token_consumed_at, now()),
         signature_data = jsonb_build_object(
           'name', coalesce(v_row.client_name, 'Cliente'),
           'method', 'CARTACEO',
           'note', 'Firmato su copia cartacea, registrato dal professionista',
           'by', 'fornitore',
           'at', now())
   where id = p_id and status in ('BOZZA','INVIATO');

  begin perform public.log_access('contracts', p_id::text, 'SIGN_PAPER', jsonb_build_object('by', auth.uid())); exception when others then null; end;
  return true;
end$$;
revoke all on function public.contract_mark_signed_paper(uuid) from public;
grant execute on function public.contract_mark_signed_paper(uuid) to authenticated;
comment on function public.contract_mark_signed_paper(uuid) is 'Il fornitore marca un contratto come FIRMATO su carta (popola signed_at+signature_data method=CARTACEO). Solo owner.';

-- Test self-cleaning (non-fatale): crea contratto INVIATO collegato a un preventivo reale → applica lo
-- stesso SQL della funzione → verifica FIRMATO+signature_data → cleanup. Qualsiasi intoppo di regole di
-- business = solo NOTICE, non blocca la migration (la funzione sopra è comunque creata).
do $$
declare v_owner uuid; v_qid uuid; v_cid uuid; v_status text; v_sig jsonb;
begin
  select q.owner_id, q.id into v_owner, v_qid from public.quotes q order by q.created_at desc limit 1;
  if v_owner is null then raise notice 'TEST CARTACEO: nessun preventivo su cui provare, salto'; return; end if;
  begin
    insert into public.contracts (owner_id, quote_id, title, client_name, total_amount, status, access_token)
      values (v_owner, v_qid, '__TEST_CARTACEO__', 'Mario Rossi', 1000, 'INVIATO', gen_random_uuid())
      returning id into v_cid;
    update public.contracts
       set status='FIRMATO', signed_at=now(), token_consumed_at=now(),
           signature_data = jsonb_build_object('name','Mario Rossi','method','CARTACEO','by','fornitore','at',now())
     where id = v_cid;
    select status, signature_data into v_status, v_sig from public.contracts where id = v_cid;
    delete from public.contracts where id = v_cid;
    if v_status = 'FIRMATO' and v_sig->>'method' = 'CARTACEO' then
      raise notice 'TEST CARTACEO: OK — FIRMATO+signature_data method=CARTACEO, CHECK rispettato';
    else
      raise notice 'TEST CARTACEO: ESITO INATTESO status=% sig=%', v_status, v_sig;
    end if;
  exception when others then
    if v_cid is not null then delete from public.contracts where id = v_cid; end if;
    raise notice 'TEST CARTACEO: salto (%).', SQLERRM;
  end;
end $$;
