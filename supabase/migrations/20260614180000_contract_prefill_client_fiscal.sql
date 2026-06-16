-- I CONTRATTI pre-importano i dati fiscali del CLIENTE già presenti, così il pro (e il cliente)
-- non li devono reinserire. Fonti, in ordine: la firma del preventivo (quote_acceptances, dove
-- il cliente li ha già inseriti), un contratto già presente sullo stesso evento (eredità nel
-- "cerchio": un fornitore che entra trova i dati già caricati dal capostipite), oppure un
-- contratto precedente dello stesso pro con lo stesso cliente (per email).
-- I dati fiscali del PROFESSIONISTA arrivano già dal suo profilo al momento del render/PDF.
create or replace function public.create_contract_from_clauses(
  p_entry_id     uuid,
  p_party_kind   text,
  p_title        text,
  p_sections     jsonb,
  p_supplier_id  uuid default null
)
returns contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_entry  calendar_entries%rowtype;
  v_priv   calendar_entries_private%rowtype;   -- PII (client_name/email) separate dal 20260610010000
  v_quote  quotes%rowtype;
  v_acc    quote_acceptances%rowtype;
  v_prev   contracts%rowtype;
  v_new    contracts%rowtype;
  v_ready  jsonb;
begin
  if v_uid is null then
    raise exception 'auth_required';
  end if;

  if p_party_kind not in ('CLIENT_WP', 'SUPPLIER_WP', 'SUPPLIER_CLIENT') then
    raise exception 'invalid_party_kind: %', p_party_kind;
  end if;

  select * into v_entry from public.calendar_entries where id = p_entry_id;
  if v_entry.id is null then
    raise exception 'entry_not_found';
  end if;

  if v_entry.owner_id <> v_uid
     and not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'ADMIN')
  then
    raise exception 'not_authorized';
  end if;

  select * into v_priv from public.calendar_entries_private where entry_id = p_entry_id;

  if v_entry.quote_id is not null then
    select * into v_quote from public.quotes where id = v_entry.quote_id;
  end if;

  if p_party_kind = 'CLIENT_WP' and v_entry.quote_id is not null then
    v_ready := public.quote_budget_readiness(v_entry.quote_id);
    if coalesce((v_ready->>'ready_for_contract')::boolean, false) = false then
      raise exception 'budget_not_ready: %', coalesce(v_ready->>'reason', 'Budget non ancora approvato');
    end if;
  end if;

  -- ── PRE-IMPORT dati fiscali cliente ───────────────────────────────────────
  if v_entry.quote_id is not null then
    select * into v_acc from public.quote_acceptances
      where quote_id = v_entry.quote_id
      order by accepted_at desc nulls last limit 1;
  end if;
  -- contratto già presente sull'evento (stesso cerchio) con fiscale valorizzato
  select * into v_prev from public.contracts
    where entry_id = p_entry_id
      and (client_fiscal_code is not null or client_vat_number is not null or client_address is not null)
    order by created_at desc limit 1;
  -- fallback: un contratto precedente del pro con lo stesso cliente (per email)
  if v_prev.id is null and v_quote.client_email is not null then
    select * into v_prev from public.contracts
      where owner_id = v_uid and lower(client_email) = lower(v_quote.client_email)
        and (client_fiscal_code is not null or client_vat_number is not null or client_address is not null)
      order by created_at desc limit 1;
  end if;

  insert into public.contracts (
    owner_id, quote_id, entry_id, supplier_id, party_kind,
    title, client_name, client_email,
    client_fiscal_code, client_vat_number, client_business_name,
    client_address, client_city, client_zip, client_province, client_country,
    client_sdi_code, client_pec_email,
    sections, access_token, status, total_amount
  ) values (
    v_uid,
    v_entry.quote_id,
    p_entry_id,
    p_supplier_id,
    p_party_kind::contract_party_kind,
    coalesce(nullif(trim(p_title), ''), v_entry.title || ' — Contratto'),
    coalesce(v_quote.client_name, v_priv.client_name),
    coalesce(v_quote.client_email, v_priv.client_email),
    coalesce(v_acc.client_fiscal_code,    v_prev.client_fiscal_code),
    coalesce(v_acc.client_vat_number,     v_prev.client_vat_number),
    coalesce(v_acc.client_business_name,  v_prev.client_business_name),
    coalesce(v_acc.client_address,        v_prev.client_address),
    coalesce(v_acc.client_city,           v_prev.client_city),
    coalesce(v_acc.client_zip,            v_prev.client_zip),
    coalesce(v_acc.client_province,       v_prev.client_province),
    coalesce(v_acc.client_country,        v_prev.client_country),
    coalesce(v_acc.client_sdi_code,       v_prev.client_sdi_code),
    coalesce(v_acc.client_pec_email,      v_prev.client_pec_email),
    coalesce(p_sections, '[]'::jsonb),
    gen_random_uuid(),
    'BOZZA'::contract_status,
    coalesce(v_quote.total_client, 0)
  )
  returning * into v_new;

  return v_new;
end$$;

revoke all on function public.create_contract_from_clauses(uuid, text, text, jsonb, uuid) from public;
grant execute on function public.create_contract_from_clauses(uuid, text, text, jsonb, uuid) to authenticated;
