-- ============================================================================
-- BASTA RIPETIZIONI: i dati anagrafici che il cliente dichiara alla firma del
-- PREVENTIVO (quote_acceptances: nome, codice fiscale, documento, indirizzo)
-- devono ritrovarsi PRE-COMPILATI alla firma del CONTRATTO. Niente CF inserito
-- due volte. contract_get_by_token ora restituisce un blocco `prefill` ripreso
-- dall'ultima accettazione del preventivo collegato (contracts.quote_id).
-- ----------------------------------------------------------------------------
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

  select full_name, business_name, brand_logo_url, brand_primary_color
    into v_owner from profiles where id = v_c.owner_id;

  -- Ultima accettazione del preventivo collegato: è qui che il cliente ha già
  -- dichiarato CF + documento + indirizzo con valore legale (FES).
  if v_c.quote_id is not null then
    select * into v_acc
      from quote_acceptances
     where quote_id = v_c.quote_id
     order by accepted_at desc
     limit 1;
  end if;

  -- Precedenza allo snapshot già sul contratto, poi a quanto dichiarato sul preventivo.
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
    'sections', v_c.sections, 'signed_at', v_c.signed_at,
    'owner', to_jsonb(v_owner),
    'prefill', v_prefill
  );
end$$;

revoke all on function contract_get_by_token(uuid) from public;
grant execute on function contract_get_by_token(uuid) to anon, authenticated;

-- Bonus fail-safe: se alla firma del contratto un campo resta vuoto, la RPC lo
-- recupera comunque dall'accettazione del preventivo. Firma IDENTICA a quella
-- esistente (default sui parametri) per fare REPLACE, non overload.
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
declare
  v_id uuid; v_quote uuid; v_acc quote_acceptances%rowtype;
  v_name text; v_fiscal text; v_dtype text; v_dnum text; v_dissued text;
begin
  if not (coalesce(p_consent_terms, false) and coalesce(p_consent_privacy, false)) then
    raise exception 'consents_required';
  end if;
  if coalesce(trim(p_signature_data_url), '') = '' then
    raise exception 'signature_required';
  end if;

  select quote_id into v_quote from public.contracts where access_token = p_token;
  if v_quote is not null then
    select * into v_acc from public.quote_acceptances
     where quote_id = v_quote order by accepted_at desc limit 1;
  end if;

  -- valore digitato > valore dichiarato sul preventivo
  v_name    := coalesce(nullif(trim(p_signer_name), ''),    v_acc.signer_name);
  v_fiscal  := coalesce(nullif(trim(p_signer_fiscal), ''),  v_acc.client_fiscal_code);
  v_dtype   := coalesce(nullif(trim(p_doc_type), ''),       v_acc.doc_type);
  v_dnum    := coalesce(nullif(trim(p_doc_number), ''),     v_acc.doc_number);
  v_dissued := coalesce(nullif(trim(p_doc_issued_by), ''),  v_acc.doc_issued_by);

  if coalesce(trim(v_name), '') = '' then
    raise exception 'signer_name_required';
  end if;

  update public.contracts
     set status = 'FIRMATO',
         signed_at = coalesce(signed_at, now()),
         client_fiscal_code = coalesce(nullif(trim(v_fiscal), ''), client_fiscal_code),
         signature_data = coalesce(signature_data, '{}'::jsonb) || jsonb_build_object(
            'name', v_name,
            'fiscal_code', v_fiscal,
            'doc_type', v_dtype,
            'doc_number', v_dnum,
            'doc_issued_by', v_dissued,
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
