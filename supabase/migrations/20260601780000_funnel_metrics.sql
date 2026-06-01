-- ============================================================================
-- Metriche funnel lead-generation per il professionista autenticato.
-- ----------------------------------------------------------------------------
-- Percentuali "diverse e fatte bene", pensate per stimolare il professionista
-- (soprattutto il fornitore) a restare sulla piattaforma:
--   • tasso di invio       = preventivi inviati / lead ricevuti
--   • tasso di accettazione = preventivi accettati / preventivi inviati
--   • tasso di contratto    = contratti firmati / preventivi accettati
--   • valore medio accettato, valore totale vinto
--   • momentum ultimi 30 giorni
-- Scope: owner = auth.uid(). Lead = lead_requests (WP) + supplier_clients (FORN).
-- ============================================================================

create or replace function public.professional_funnel_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_leads int := 0;
  v_quotes_total int := 0;
  v_quotes_sent int := 0;
  v_quotes_accepted int := 0;
  v_quotes_rejected int := 0;
  v_contracts_signed int := 0;
  v_accepted_value numeric := 0;
  v_won_30d int := 0;
  v_sent_30d int := 0;
  v_accept_rate numeric;
  v_send_rate numeric;
  v_contract_rate numeric;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'auth_required');
  end if;

  -- Lead ricevuti (entrambe le sorgenti, in base al ruolo dell'utente)
  select
    coalesce((select count(*) from lead_requests where wp_id = v_uid), 0)
    + coalesce((select count(*) from supplier_clients where supplier_id = v_uid), 0)
  into v_leads;

  select
    count(*),
    count(*) filter (where status in ('INVIATO','ACCETTATO','RIFIUTATO','CONVERTITO_IN_CONTRATTO')),
    count(*) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')),
    count(*) filter (where status = 'RIFIUTATO'),
    coalesce(sum(total_client) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')), 0),
    count(*) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') and updated_at >= now() - interval '30 days'),
    count(*) filter (where status in ('INVIATO','ACCETTATO','RIFIUTATO','CONVERTITO_IN_CONTRATTO') and updated_at >= now() - interval '30 days')
  into v_quotes_total, v_quotes_sent, v_quotes_accepted, v_quotes_rejected, v_accepted_value, v_won_30d, v_sent_30d
  from quotes where owner_id = v_uid;

  select count(*) into v_contracts_signed
  from contracts where owner_id = v_uid and status = 'FIRMATO';

  v_accept_rate   := case when v_quotes_sent > 0 then round(100.0 * v_quotes_accepted / v_quotes_sent) else null end;
  v_send_rate     := case when v_leads > 0 then round(100.0 * v_quotes_sent / v_leads) else null end;
  v_contract_rate := case when v_quotes_accepted > 0 then round(100.0 * v_contracts_signed / v_quotes_accepted) else null end;

  return jsonb_build_object(
    'ok', true,
    'leads', v_leads,
    'quotes_total', v_quotes_total,
    'quotes_sent', v_quotes_sent,
    'quotes_accepted', v_quotes_accepted,
    'quotes_rejected', v_quotes_rejected,
    'contracts_signed', v_contracts_signed,
    'accepted_value', v_accepted_value,
    'avg_accepted_value', case when v_quotes_accepted > 0 then round(v_accepted_value / v_quotes_accepted) else 0 end,
    'acceptance_rate', v_accept_rate,
    'send_rate', v_send_rate,
    'contract_rate', v_contract_rate,
    'won_last_30d', v_won_30d,
    'sent_last_30d', v_sent_30d
  );
end$$;

grant execute on function public.professional_funnel_metrics() to authenticated;

comment on function public.professional_funnel_metrics() is
  'Metriche funnel (lead→inviato→accettato→contratto) per owner=auth.uid(). Percentuali motivazionali per WP e fornitori.';
