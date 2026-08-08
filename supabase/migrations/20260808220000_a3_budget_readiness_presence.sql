-- ============================================================================
-- A3: quote_budget_readiness contava una voce come "confermata" se
-- client_decision='ACCETTATO', ANCHE quando il fornitore aveva dichiarato
-- presenza = NO (supplier_presence='NO' azzera supplier_confirmed_at ma non
-- client_decision). Risultato: il gate sblocca il contratto includendo una voce
-- il cui fornitore ha esplicitamente rifiutato di esserci.
-- Fix: una voce con supplier_presence='NO' NON conta come confermata (resta nel
-- denominatore → budget non pronto finché il capostipite non la rimuove o il
-- fornitore non torna a SI). Resto della funzione invariato.
-- ============================================================================

create or replace function public.quote_budget_readiness(p_quote_id uuid)
returns jsonb
language plpgsql
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

  select count(*) into v_total_items from public.quote_items qi where qi.quote_id = p_quote_id;

  if v_direct is not null then
    v_ready := v_status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO');
    return jsonb_build_object(
      'ambito', 'FORNITORE_DIRETTO', 'quote_status', v_status, 'total_items', v_total_items,
      'supplier_items', 0, 'confirmed_supplier_items', 0, 'ready_for_contract', v_ready,
      'reason', case when v_ready then 'Preventivo diretto: il contratto si firma all''accettazione.'
                     else 'Il preventivo non e` ancora stato accettato dal cliente.' end);
  end if;

  select coalesce(ce.ambito_capostipite::text, 'COMPLETO') into v_ambito
    from public.calendar_entries ce where ce.quote_id = p_quote_id limit 1;
  v_ambito := coalesce(v_ambito, 'COMPLETO');

  -- Voci fornitore che CONTANO = terze (non erogate dal capostipite) e NON scartate dal cliente
  -- (esclude RIFIUTATO e FORSE; le cancellate spariscono da sole). "Confermata" = accettata dal
  -- cliente OPPURE confermata dal fornitore, MA il fornitore non deve aver dichiarato presenza NO.
  select
    count(*) filter (where qi.supplier_id is not null and coalesce(qi.erogatore_e_capostipite,false)=false
                       and qi.client_decision not in ('RIFIUTATO','FORSE')),
    count(*) filter (where qi.supplier_id is not null and coalesce(qi.erogatore_e_capostipite,false)=false
                       and qi.client_decision not in ('RIFIUTATO','FORSE')
                       and coalesce(qi.supplier_presence,'') <> 'NO'
                       and (qi.supplier_confirmed_at is not null or qi.client_decision = 'ACCETTATO'))
    into v_supplier_items, v_confirmed_supplier_items
    from public.quote_items qi where qi.quote_id = p_quote_id;

  if v_status not in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO') then
    v_ready := false;
    v_reason := 'Il preventivo non e` ancora stato accettato dal cliente.';
  elsif v_ambito = 'COMPLETO' then
    if v_supplier_items = 0 then
      v_ready := true;
      v_reason := 'Budget confermato (nessuna voce fornitore in sospeso).';
    elsif v_confirmed_supplier_items >= v_supplier_items then
      v_ready := true;
      v_reason := 'Budget confermato: tutte le voci fornitore sono accettate dal cliente o confermate dai fornitori.';
    else
      v_ready := false;
      v_reason := format('Budget: %s di %s voci fornitore confermate. Fai accettare al cliente le voci in sospeso o rimuovile (le voci rifiutate o in forse non bloccano).',
                         v_confirmed_supplier_items, v_supplier_items);
    end if;
  else
    v_ready := true;
    v_reason := 'Ambito ristretto: il contratto puo` essere firmato all''accettazione del preventivo.';
  end if;

  return jsonb_build_object(
    'ambito', v_ambito, 'quote_status', v_status, 'total_items', v_total_items,
    'supplier_items', v_supplier_items, 'confirmed_supplier_items', v_confirmed_supplier_items,
    'ready_for_contract', v_ready, 'reason', v_reason);
end$$;
