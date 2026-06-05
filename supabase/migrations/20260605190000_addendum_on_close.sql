-- ============================================================================
-- ADDENDUM ALLA CHIUSURA: quando il WP chiude un preventivo "vivo" e le voci
-- ACCETTATE dal cliente differiscono dal contratto già firmato, si genera un
-- addendum da firmare (stesso valore legale del contratto). Riusa la tabella
-- contract_addendums esistente. Tutto from noreply@planfully.it via edge fn.
-- ----------------------------------------------------------------------------

-- 1) Crea/aggiorna l'addendum SE le voci accettate divergono dal contratto firmato.
--    Owner-gated. Ritorna {created, addendum_id, token, amount_delta} oppure {created:false}.
create or replace function public.addendum_create_if_changed(p_quote_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner    uuid;
  v_contract record;
  v_new_total numeric;
  v_delta     numeric;
  v_items     jsonb;
  v_add_id    uuid;
  v_token     uuid;
  v_num       int;
  v_body      text;
  v_date_fmt  text;
begin
  select owner_id into v_owner from public.quotes where id = p_quote_id;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if v_owner is distinct from auth.uid() and not is_admin() then
    return jsonb_build_object('error','forbidden');
  end if;

  -- Contratto FIRMATO collegato al preventivo (il più recente).
  select id, total_amount, created_at, title
    into v_contract
    from public.contracts
   where quote_id = p_quote_id and status = 'FIRMATO'
   order by signed_at desc nulls last, created_at desc
   limit 1;
  if v_contract.id is null then
    return jsonb_build_object('created', false, 'reason', 'no_signed_contract');
  end if;

  -- Totale concordato = somma delle voci ACCETTATE dal cliente.
  select
    coalesce(sum(line_client) filter (where client_decision = 'ACCETTATO'), 0),
    coalesce(jsonb_agg(jsonb_build_object(
      'name', name_snapshot, 'qty', quantity, 'line_client', line_client,
      'decision', client_decision
    ) order by sort_order, created_at) filter (where client_decision in ('ACCETTATO','RIFIUTATO')), '[]'::jsonb)
    into v_new_total, v_items
    from public.quote_items where quote_id = p_quote_id;

  v_delta := v_new_total - coalesce(v_contract.total_amount, 0);

  -- Nessuna variazione economica → nessun addendum.
  if abs(v_delta) < 0.01 then
    return jsonb_build_object('created', false, 'reason', 'no_change');
  end if;

  v_date_fmt := to_char(v_contract.created_at, 'DD/MM/YYYY');
  v_body :=
    'Con il presente atto integrativo le parti concordano la modifica dell''oggetto e del corrispettivo del contratto "'
    || coalesce(v_contract.title, 'Contratto') || '" del ' || v_date_fmt || '.' || chr(10) || chr(10)
    || 'Nuovo corrispettivo complessivo concordato: € ' || trim(to_char(v_new_total, 'FM999G999G990D00')) || '.' || chr(10)
    || 'Variazione rispetto al contratto originario: € ' || trim(to_char(v_delta, 'FM999G999G990D00')) || '.' || chr(10) || chr(10)
    || 'Resta fermo e invariato ogni altro patto e condizione del contratto originario.';

  -- Riusa un addendum ancora da firmare, altrimenti creane uno nuovo.
  select id into v_add_id
    from public.contract_addendums
   where contract_id = v_contract.id and status in ('BOZZA','INVIATO')
   order by addendum_number desc limit 1;

  if v_add_id is not null then
    update public.contract_addendums
       set quote_id = p_quote_id,
           title = 'Addendum al contratto',
           body = v_body,
           amount_delta = v_delta,
           service_changes = jsonb_build_object(
             'old_total', v_contract.total_amount, 'new_total', v_new_total,
             'delta', v_delta, 'items', v_items),
           access_token = gen_random_uuid(),
           access_token_expires_at = now() + interval '30 days',
           status = 'BOZZA',
           updated_at = now()
     where id = v_add_id
     returning access_token into v_token;
  else
    select coalesce(max(addendum_number), 0) + 1 into v_num
      from public.contract_addendums where contract_id = v_contract.id;
    insert into public.contract_addendums(
      contract_id, quote_id, addendum_number, status, title, body,
      amount_delta, service_changes, created_by, access_token, access_token_expires_at)
    values (
      v_contract.id, p_quote_id, v_num, 'BOZZA', 'Addendum al contratto', v_body,
      v_delta,
      jsonb_build_object('old_total', v_contract.total_amount, 'new_total', v_new_total,
                         'delta', v_delta, 'items', v_items),
      auth.uid(), gen_random_uuid(), now() + interval '30 days')
    returning id, access_token into v_add_id, v_token;
  end if;

  return jsonb_build_object('created', true, 'addendum_id', v_add_id,
                            'token', v_token, 'amount_delta', v_delta);
end$$;

revoke all on function public.addendum_create_if_changed(uuid) from public;
grant execute on function public.addendum_create_if_changed(uuid) to authenticated;

-- 2) Lettura pubblica dell'addendum via token (per la pagina di firma) ---------
create or replace function public.addendum_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_a     contract_addendums%rowtype;
  v_c     contracts%rowtype;
  v_owner record;
  v_acc   quote_acceptances%rowtype;
  v_prefill jsonb;
begin
  select * into v_a from public.contract_addendums where access_token = p_token;
  if v_a.id is null then return null; end if;
  if v_a.access_token_expires_at is not null and v_a.access_token_expires_at <= now() then
    return jsonb_build_object('error','expired');
  end if;

  select * into v_c from public.contracts where id = v_a.contract_id;
  select full_name, business_name, brand_primary_color
    into v_owner from public.profiles where id = v_c.owner_id;

  if v_a.quote_id is not null then
    select * into v_acc from public.quote_acceptances
     where quote_id = v_a.quote_id order by accepted_at desc limit 1;
  end if;

  v_prefill := jsonb_build_object(
    'client_name',        coalesce(nullif(trim(v_c.client_name), ''), v_acc.signer_name),
    'client_fiscal_code', coalesce(nullif(trim(v_c.client_fiscal_code), ''), v_acc.client_fiscal_code),
    'doc_type',           v_acc.doc_type,
    'doc_number',         v_acc.doc_number,
    'doc_issued_by',      v_acc.doc_issued_by,
    'from_quote',         (v_acc.id is not null)
  );

  return jsonb_build_object(
    'id', v_a.id,
    'title', coalesce(v_a.title, 'Addendum al contratto'),
    'body', v_a.body,
    'amount_delta', v_a.amount_delta,
    'service_changes', v_a.service_changes,
    'status', v_a.status,
    'signed_at', v_a.signed_at,
    'contract_title', v_c.title,
    'owner', to_jsonb(v_owner),
    'prefill', v_prefill
  );
end$$;

revoke all on function public.addendum_get_by_token(uuid) from public;
grant execute on function public.addendum_get_by_token(uuid) to anon, authenticated;

-- 3) Firma completa addendum (anagrafica + documento + firma grafica + GDPR) ----
create or replace function public.addendum_sign_full(
  p_token uuid,
  p_signer_name text,
  p_signer_fiscal text,
  p_doc_type text default null,
  p_doc_number text default null,
  p_doc_issued_by text default null,
  p_signature_data_url text default null,
  p_consent_terms boolean default false,
  p_consent_privacy boolean default false
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid; v_quote uuid; v_acc quote_acceptances%rowtype;
  v_name text; v_fiscal text; v_dtype text; v_dnum text; v_dissued text;
begin
  if not (coalesce(p_consent_terms,false) and coalesce(p_consent_privacy,false)) then
    raise exception 'consents_required';
  end if;
  if coalesce(trim(p_signature_data_url),'') = '' then
    raise exception 'signature_required';
  end if;

  select id, quote_id into v_id, v_quote from public.contract_addendums
   where access_token = p_token
     and status in ('BOZZA','INVIATO','FIRMATO')
     and (access_token_expires_at is null or access_token_expires_at > now());
  if v_id is null then return false; end if;

  if v_quote is not null then
    select * into v_acc from public.quote_acceptances
     where quote_id = v_quote order by accepted_at desc limit 1;
  end if;
  v_name    := coalesce(nullif(trim(p_signer_name), ''),    v_acc.signer_name);
  v_fiscal  := coalesce(nullif(trim(p_signer_fiscal), ''),  v_acc.client_fiscal_code);
  v_dtype   := coalesce(nullif(trim(p_doc_type), ''),       v_acc.doc_type);
  v_dnum    := coalesce(nullif(trim(p_doc_number), ''),     v_acc.doc_number);
  v_dissued := coalesce(nullif(trim(p_doc_issued_by), ''),  v_acc.doc_issued_by);
  if coalesce(trim(v_name),'') = '' then raise exception 'signer_name_required'; end if;

  update public.contract_addendums
     set status = 'FIRMATO',
         signed_at = coalesce(signed_at, now()),
         signer_data = jsonb_build_object(
            'name', v_name, 'fiscal_code', v_fiscal,
            'doc_type', v_dtype, 'doc_number', v_dnum, 'doc_issued_by', v_dissued,
            'signature_image', p_signature_data_url,
            'consent_terms', p_consent_terms, 'consent_privacy', p_consent_privacy,
            'at', now())
   where id = v_id
   returning id into v_id;
  return v_id is not null;
end$$;

revoke all on function public.addendum_sign_full(uuid,text,text,text,text,text,text,boolean,boolean) from public;
grant execute on function public.addendum_sign_full(uuid,text,text,text,text,text,text,boolean,boolean) to anon, authenticated;
