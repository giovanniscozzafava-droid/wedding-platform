-- ============================================================================
-- HOTFIX: contract_sign_by_token() rifiutava la firma se il contratto era
-- in stato BOZZA. Ma il flusso "Genera contratto" (Wave 4 fix) crea direttamente
-- BOZZA con access_token, e il cliente puo` firmare via /p/contract/:token
-- senza un passaggio esplicito "Invia". Quindi la firma DEVE essere permessa
-- anche da BOZZA — il cliente che ha il token ha legittimamente accesso.
--
-- Wave 4 agent T ha verificato: form passa, RPC ritorna false (no row matched),
-- UI mostra "Contratto non firmabile". Il contract resta BOZZA -> blocker UI.
--
-- Fix: aggiungere BOZZA a status in (...) accettati. INVIATO resta legacy.
-- ANNULLATO resta escluso.
-- ============================================================================

create or replace function contract_sign_by_token(p_token uuid, p_signer_name text, p_signer_fiscal text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  update contracts
     set status = 'FIRMATO',
         signed_at = coalesce(signed_at, now()),
         signature_data = coalesce(signature_data, '{}'::jsonb) || jsonb_build_object(
            'name', p_signer_name,
            'fiscal_code', p_signer_fiscal,
            'at', now()
         )
   where access_token = p_token
     and status in ('BOZZA', 'INVIATO', 'FIRMATO')
   returning id into v_id;
  return v_id is not null;
end$$;
revoke all on function contract_sign_by_token(uuid, text, text) from public;
grant execute on function contract_sign_by_token(uuid, text, text) to anon, authenticated;

comment on function contract_sign_by_token(uuid, text, text) is
  'Firma contratto via token cliente. v3: accetta anche status=BOZZA (flusso post Wave 4 Genera contratto crea direttamente BOZZA, cliente ha access_token quindi puo firmare). Idempotente su FIRMATO. ANNULLATO escluso.';
