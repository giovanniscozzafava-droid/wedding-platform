-- ============================================================================
-- Firma contratto online "come il preventivo": firma grafica + documento
-- d'identità + consensi GDPR. Mantiene contract_sign_by_token (retrocompat) e
-- aggiunge contract_sign_full con i dati completi, archiviati in signature_data.
-- Il trigger di audit firma (sig_audit_from_contract_sign) registra l'evento.
-- ============================================================================

create or replace function public.contract_sign_full(
  p_token             uuid,
  p_signer_name       text,
  p_signer_fiscal     text,
  p_doc_type          text default null,
  p_doc_number        text default null,
  p_doc_issued_by     text default null,
  p_signature_data_url text default null,
  p_consent_terms     boolean default false,
  p_consent_privacy   boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not (coalesce(p_consent_terms, false) and coalesce(p_consent_privacy, false)) then
    raise exception 'consents_required';
  end if;
  if coalesce(trim(p_signer_name), '') = '' then
    raise exception 'signer_name_required';
  end if;
  if coalesce(trim(p_signature_data_url), '') = '' then
    raise exception 'signature_required';
  end if;

  update public.contracts
     set status = 'FIRMATO',
         signed_at = coalesce(signed_at, now()),
         client_fiscal_code = coalesce(nullif(trim(p_signer_fiscal), ''), client_fiscal_code),
         signature_data = coalesce(signature_data, '{}'::jsonb) || jsonb_build_object(
            'name', p_signer_name,
            'fiscal_code', p_signer_fiscal,
            'doc_type', p_doc_type,
            'doc_number', p_doc_number,
            'doc_issued_by', p_doc_issued_by,
            'signature_image', p_signature_data_url,
            'consent_terms', p_consent_terms,
            'consent_privacy', p_consent_privacy,
            'at', now()
         )
   where access_token = p_token
     and status in ('BOZZA', 'INVIATO', 'FIRMATO')
   returning id into v_id;

  return v_id is not null;
end$$;

revoke all on function public.contract_sign_full(uuid, text, text, text, text, text, text, boolean, boolean) from public;
grant execute on function public.contract_sign_full(uuid, text, text, text, text, text, text, boolean, boolean) to anon, authenticated;

comment on function public.contract_sign_full is
  'Firma contratto via token con firma grafica, documento d''identità e consensi GDPR (parità col flusso preventivo). Idempotente su FIRMATO.';
