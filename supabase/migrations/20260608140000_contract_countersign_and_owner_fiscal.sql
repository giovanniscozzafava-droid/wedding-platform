-- ============================================================================
-- Contratto = atto BILATERALE. Il cliente deve vedere anche la firma della
-- controparte (professionista): esponiamo countersign_at + nome controfirmatario.
-- Inoltre includiamo l'anagrafica fiscale del professionista, così il contratto
-- è completo con i dati di ENTRAMBE le parti, pronto da firmare e basta.
-- ============================================================================
create or replace function contract_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_c       contracts%rowtype;
  v_owner   record;
  v_acc     quote_acceptances%rowtype;
  v_prefill jsonb;
begin
  select * into v_c from contracts where access_token = p_token;
  if v_c.id is null then return null; end if;

  select full_name, business_name, brand_logo_url, brand_primary_color,
         business_legal_name, legal_form, vat_number, fiscal_code,
         address, city, zip, province, country, pec_email
    into v_owner from profiles where id = v_c.owner_id;

  if v_c.quote_id is not null then
    select * into v_acc
      from quote_acceptances
     where quote_id = v_c.quote_id
     order by accepted_at desc
     limit 1;
  end if;

  v_prefill := jsonb_build_object(
    'client_name',        coalesce(nullif(trim(v_c.client_name), ''), v_acc.signer_name),
    'client_fiscal_code', coalesce(nullif(trim(v_c.client_fiscal_code), ''), v_acc.client_fiscal_code),
    'doc_type',           v_acc.doc_type,
    'doc_number',         v_acc.doc_number,
    'doc_issued_by',      v_acc.doc_issued_by,
    'client_vat_number',  coalesce(nullif(trim(v_c.client_vat_number), ''), v_acc.client_vat_number),
    'client_address',     coalesce(nullif(trim(v_c.client_address), ''), v_acc.client_address),
    'client_city',        coalesce(nullif(trim(v_c.client_city), ''), v_acc.client_city),
    'client_zip',         coalesce(nullif(trim(v_c.client_zip), ''), v_acc.client_zip),
    'client_province',    coalesce(nullif(trim(v_c.client_province), ''), v_acc.client_province),
    'from_quote',         (v_acc.id is not null)
  );

  return jsonb_build_object(
    'id', v_c.id, 'title', v_c.title, 'client_name', v_c.client_name,
    'client_email', v_c.client_email, 'event_date', v_c.event_date,
    'total_amount', v_c.total_amount, 'status', v_c.status,
    'sections', v_c.sections,
    'signed_at', v_c.signed_at,
    'signer_name', coalesce(v_c.signature_data->>'name', v_c.client_name),
    'countersign_at', v_c.countersign_at,
    'countersign_name', coalesce(v_c.countersign_data->>'name', v_owner.business_name, v_owner.full_name),
    'owner', to_jsonb(v_owner),
    'prefill', v_prefill
  );
end$$;
grant execute on function contract_get_by_token(uuid) to anon, authenticated;
