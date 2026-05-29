-- ============================================================================
-- Fase D — RPC create_contract_from_clauses
-- ============================================================================
-- Permette al WP di creare un contratto direttamente passando una lista di
-- sections (jsonb), tipicamente costruita dal builder StandardClausesBuilder.
-- Alternativa a create_supplier_contract che richiede template_id.
-- ============================================================================

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
  v_quote  quotes%rowtype;
  v_new    contracts%rowtype;
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

  -- Solo owner del wedding o ADMIN
  if v_entry.owner_id <> v_uid
     and not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'ADMIN')
  then
    raise exception 'not_authorized';
  end if;

  -- Se CLIENT_WP, il trigger contracts_enforce_quote_accettato verifica quote ACCETTATO
  if v_entry.quote_id is not null then
    select * into v_quote from public.quotes where id = v_entry.quote_id;
  end if;

  insert into public.contracts (
    owner_id, quote_id, entry_id, supplier_id, party_kind,
    title, client_name, client_email,
    sections, access_token, status, total_amount
  ) values (
    v_uid,
    v_entry.quote_id,
    p_entry_id,
    p_supplier_id,
    p_party_kind::contract_party_kind,
    coalesce(nullif(trim(p_title), ''), v_entry.title || ' — Contratto'),
    coalesce(v_quote.client_name, v_entry.client_name),
    v_quote.client_email,
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

comment on function public.create_contract_from_clauses(uuid, text, text, jsonb, uuid) is
  'Fase D workflow: crea un contratto con sezioni custom (composte dal builder clausole standard). Riusa il trigger di chain enforcement per CLIENT_WP.';
