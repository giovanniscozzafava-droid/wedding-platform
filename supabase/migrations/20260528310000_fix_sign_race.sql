-- HOTFIX (CRITICAL): contract_sign_by_token() accettava FIRMATO come stato
-- di partenza valido, permettendo a piu firme parallele di sovrascrivere
-- signature_data sullo stesso contratto.
--
-- Scenario riprodotto in concurrency-e2e.mjs C2: 5 firme parallele con
-- nomi diversi tutte ritornavano true; signature_data finiva con i dati
-- dell'ultimo signer. Manipolazione/firma plurima possibile.
--
-- Fix: rimuovere FIRMATO da status accettati. Postgres MVCC con UPDATE row-lock
-- garantisce che solo la PRIMA tx commit la transizione BOZZA/INVIATO -> FIRMATO;
-- le successive trovano status FIRMATO e UPDATE matcha 0 righe -> return false.
-- Aggiungo anche un coalesce stretto su signature_data per idempotenza in caso
-- di retry legittimo dal frontend dopo una risposta interrotta.

create or replace function contract_sign_by_token(p_token uuid, p_signer_name text, p_signer_fiscal text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  -- Idempotenza: se gia FIRMATO con lo stesso signer, ritorno true senza modificare.
  select id into v_id from contracts
   where access_token = p_token
     and status = 'FIRMATO'
     and signature_data ->> 'fiscal_code' = p_signer_fiscal;
  if v_id is not null then return true; end if;

  -- Firma reale: SOLO da BOZZA/INVIATO. Lock di riga via UPDATE.
  update contracts
     set status = 'FIRMATO',
         signed_at = now(),
         signature_data = jsonb_build_object(
            'name', p_signer_name,
            'fiscal_code', p_signer_fiscal,
            'at', now()
         )
   where access_token = p_token
     and status in ('BOZZA', 'INVIATO')
   returning id into v_id;
  return v_id is not null;
end$$;
revoke all on function contract_sign_by_token(uuid, text, text) from public;
grant execute on function contract_sign_by_token(uuid, text, text) to anon, authenticated;

comment on function contract_sign_by_token(uuid, text, text) is
  'Firma contratto via token cliente. v4 (28-05-2026): blocca firma quando status=FIRMATO, '
  'impedendo race overwrite (5 firme parallele tutte ok). Idempotenza solo se stesso fiscal_code.';
