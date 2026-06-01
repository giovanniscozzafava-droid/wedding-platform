-- ============================================================================
-- Bug A: il "budget" e` un concetto esclusivo dei capostipiti (WP/Location).
-- Un preventivo di un FORNITORE verso il proprio cliente diretto NON ha
-- budget da approvare: il contratto si firma all'accettazione, punto.
-- ----------------------------------------------------------------------------
-- Prima quote_budget_readiness, non trovando un calendar_entry, faceva
-- coalesce(ambito,'COMPLETO') e contava le voci del fornitore stesso come
-- "fornitori terzi non confermati" → bloccava il fornitore con "In attesa di
-- conferma del budget totale". Sbagliato.
--
-- Fix: se il quote ha direct_client_id (= preventivo fornitore→cliente
-- diretto), ritorna subito ready=(status ACCETTATO), ambito='FORNITORE_DIRETTO',
-- senza alcuna logica di budget.
-- ============================================================================

create or replace function public.quote_budget_readiness(p_quote_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status text;
  v_direct uuid;
  v_ambito text;
  v_total_items int := 0;
  v_supplier_items int := 0;
  v_confirmed_supplier_items int := 0;
  v_ready boolean := false;
  v_reason text;
begin
  select q.status::text, q.direct_client_id into v_status, v_direct
    from public.quotes q where q.id = p_quote_id;
  if v_status is null then
    return jsonb_build_object('error', 'quote_not_found');
  end if;

  select count(*) into v_total_items
    from public.quote_items qi where qi.quote_id = p_quote_id;

  -- Preventivo FORNITORE → cliente diretto: nessun concetto di budget.
  if v_direct is not null then
    v_ready := v_status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO');
    return jsonb_build_object(
      'ambito', 'FORNITORE_DIRETTO',
      'quote_status', v_status,
      'total_items', v_total_items,
      'supplier_items', 0,
      'confirmed_supplier_items', 0,
      'ready_for_contract', v_ready,
      'reason', case when v_ready
                     then 'Preventivo diretto: il contratto si firma all''accettazione.'
                     else 'Il preventivo non e` ancora stato accettato dal cliente.' end
    );
  end if;

  -- Flusso capostipite: ambito dell'incarico (default COMPLETO).
  select coalesce(ce.ambito_capostipite::text, 'COMPLETO') into v_ambito
    from public.calendar_entries ce
   where ce.quote_id = p_quote_id
   limit 1;
  v_ambito := coalesce(v_ambito, 'COMPLETO');

  select
    count(*) filter (where qi.supplier_id is not null and coalesce(qi.erogatore_e_capostipite, false) = false),
    count(*) filter (where qi.supplier_id is not null and coalesce(qi.erogatore_e_capostipite, false) = false and qi.supplier_confirmed_at is not null)
    into v_supplier_items, v_confirmed_supplier_items
    from public.quote_items qi where qi.quote_id = p_quote_id;

  if v_status not in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO') then
    v_ready := false;
    v_reason := 'Il preventivo non e` ancora stato accettato dal cliente.';
  elsif v_ambito = 'COMPLETO' then
    if v_supplier_items = 0 then
      v_ready := true;
      v_reason := 'Budget completo accettato (nessun fornitore terzo da confermare).';
    elsif v_confirmed_supplier_items >= v_supplier_items then
      v_ready := true;
      v_reason := 'Budget totale approvato: tutti i fornitori hanno confermato.';
    else
      v_ready := false;
      v_reason := format('In attesa di conferma del budget totale: %s di %s fornitori confermati.',
                         v_confirmed_supplier_items, v_supplier_items);
    end if;
  else
    v_ready := true;
    v_reason := 'Ambito ristretto: il contratto puo` essere firmato all''accettazione del preventivo.';
  end if;

  return jsonb_build_object(
    'ambito', v_ambito,
    'quote_status', v_status,
    'total_items', v_total_items,
    'supplier_items', v_supplier_items,
    'confirmed_supplier_items', v_confirmed_supplier_items,
    'ready_for_contract', v_ready,
    'reason', v_reason
  );
end$$;

grant execute on function public.quote_budget_readiness(uuid) to authenticated;
