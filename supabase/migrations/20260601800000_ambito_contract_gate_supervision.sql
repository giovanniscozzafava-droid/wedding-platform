-- ============================================================================
-- Regola ambito capostipite ↔ contratto (lato SERVER, non solo UI)
-- ----------------------------------------------------------------------------
-- Regola di business richiesta:
--   • Se il capostipite gestisce l'INTERO budget (ambito COMPLETO), il contratto
--     col cliente si firma SOLO quando tutto il budget è approvato (tutti i
--     fornitori terzi confermati). Finora era controllato solo nel frontend →
--     ora è imposto anche dalla RPC create_contract_from_clauses.
--   • Se il capostipite NON gestisce l'intero budget (SOLO_COORDINAMENTO /
--     SOLO_PROPRI_SERVIZI), il fornitore firma il contratto direttamente col
--     cliente; il capostipite SUPERVISIONA (vede quei contratti per il suo
--     evento) tramite capostipite_event_supplier_contracts().
-- ============================================================================

-- 1) Gate server-side nel contratto CLIENT_WP -------------------------------
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

  if v_entry.quote_id is not null then
    select * into v_quote from public.quotes where id = v_entry.quote_id;
  end if;

  -- GATE: contratto col cliente (CLIENT_WP) in ambito COMPLETO richiede budget
  -- pronto (tutti i fornitori terzi confermati). In ambito ristretto la
  -- readiness ritorna ready=true e il gate passa (il fornitore contratta col
  -- cliente, il capostipite supervisiona).
  if p_party_kind = 'CLIENT_WP' and v_entry.quote_id is not null then
    v_ready := public.quote_budget_readiness(v_entry.quote_id);
    if coalesce((v_ready->>'ready_for_contract')::boolean, false) = false then
      raise exception 'budget_not_ready: %', coalesce(v_ready->>'reason', 'Budget non ancora approvato');
    end if;
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
  'Crea contratto con sezioni custom. GATE server-side: CLIENT_WP in ambito COMPLETO richiede budget pronto (tutti i fornitori confermati). Ambito ristretto passa (fornitore contratta col cliente, capostipite supervisiona).';

-- 2) Supervisione: il capostipite (owner dell'evento) vede i contratti che i
--    fornitori firmano direttamente col cliente per quel suo evento. ---------
create or replace function public.capostipite_event_supplier_contracts(p_entry_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_res   jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'auth_required');
  end if;
  select owner_id into v_owner from public.calendar_entries where id = p_entry_id;
  if v_owner is null then
    return jsonb_build_object('error', 'entry_not_found');
  end if;
  if v_owner <> v_uid and not public.is_admin() then
    return jsonb_build_object('error', 'not_event_owner');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'status', c.status,
    'total_amount', c.total_amount,
    'signed_at', c.signed_at,
    'supplier', jsonb_build_object(
      'id', pr.id,
      'business_name', coalesce(pr.business_name, pr.full_name),
      'subrole', pr.subrole
    )
  ) order by c.created_at desc), '[]'::jsonb)
  into v_res
  from public.contracts c
  join public.profiles pr on pr.id = c.owner_id
  where c.entry_id = p_entry_id
    and c.owner_id <> v_owner   -- contratti dei fornitori, non quelli del capostipite
    and pr.role = 'FORNITORE';

  return jsonb_build_object('ok', true, 'contracts', v_res);
end$$;

grant execute on function public.capostipite_event_supplier_contracts(uuid) to authenticated;

comment on function public.capostipite_event_supplier_contracts(uuid) is
  'Supervisione capostipite: contratti che i fornitori firmano direttamente col cliente per un evento del capostipite (ambito ristretto). Solo owner dell''evento o admin.';
