-- ============================================================================
-- quote_budget_readiness: stabilisce quando un preventivo puo` diventare
-- contratto, in base all'ambito dell'incarico del capostipite.
-- ----------------------------------------------------------------------------
-- Regola di business (richiesta dogfood):
--
--  * COMPLETO              → il capostipite ribalta TUTTO il budget. Il
--                            contratto si firma SOLO ad approvazione totale del
--                            budget: il preventivo dev'essere ACCETTATO e ogni
--                            voce con fornitore terzo dev'essere CONFERMATA dal
--                            fornitore (supplier_confirmed_at). Le voci erogate
--                            dal capostipite stesso (erogatore_e_capostipite) e
--                            quelle senza fornitore non richiedono conferma.
--
--  * SOLO_COORDINAMENTO    → il capostipite coordina soltanto / vende i propri
--  * SOLO_PROPRI_SERVIZI     servizi senza ribaltare il budget altrui. Il
--                            contratto puo` essere generato appena il preventivo
--                            e` ACCETTATO (nessuna attesa sui fornitori terzi).
--
-- NULL ambito → trattato come COMPLETO (default conservativo).
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
  v_ambito text;
  v_total_items int := 0;
  v_supplier_items int := 0;       -- voci con fornitore terzo (non capostipite)
  v_confirmed_supplier_items int := 0;
  v_ready boolean := false;
  v_reason text;
begin
  select q.status::text into v_status from public.quotes q where q.id = p_quote_id;
  if v_status is null then
    return jsonb_build_object('error', 'quote_not_found');
  end if;

  select coalesce(ce.ambito_capostipite::text, 'COMPLETO') into v_ambito
    from public.calendar_entries ce
   where ce.quote_id = p_quote_id
   limit 1;
  v_ambito := coalesce(v_ambito, 'COMPLETO');

  select count(*) into v_total_items
    from public.quote_items qi where qi.quote_id = p_quote_id;

  -- Voci che richiedono conferma di un fornitore TERZO:
  -- hanno supplier_id, non sono erogate dal capostipite.
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
    -- SOLO_COORDINAMENTO / SOLO_PROPRI_SERVIZI
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

comment on function public.quote_budget_readiness(uuid) is
  'Ritorna se un preventivo puo` diventare contratto in base all''ambito_capostipite. COMPLETO richiede conferma di tutti i fornitori terzi; ambiti ristretti bastano ACCETTATO.';
