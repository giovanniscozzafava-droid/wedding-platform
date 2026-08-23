-- ============================================================================
-- Fix cruscotto "Il tuo funnel" (professional_funnel_metrics): numeri sballati.
--  1) VALORE VINTO: sommava total_client PIENO → gonfiato. Ora usa il valore
--     IMPEGNATO (selezionato se >0, altrimenti pieno), coerente con tutto il resto
--     (regola R1 / pipelineValue). Es. Gisko: 18.875 € → 15.105 €.
--  2) "Vinti ultimi 30 giorni": filtrava su updated_at (spinto a "oggi" da
--     backfill/ricalcoli) → mostrava tutti gli accettati come vinti nel mese. Ora
--     usa accepted_at (la data reale dell'accettazione).
--  3) "Inviati ultimi 30 giorni": stessa cosa, ora su sent_at.
-- I conteggi totali (lead/inviati/accettati/firmati) e i tassi restano invariati.
-- ============================================================================
create or replace function public.professional_funnel_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
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
    -- VALORE IMPEGNATO (non il totale pieno): selezionato se il cliente ha scelto,
    -- altrimenti pieno (firma intera). Coerente con contratto/atto/liste.
    coalesce(sum(case when coalesce(total_client_selected,0) > 0 then total_client_selected else total_client end)
             filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')), 0),
    -- Vinti/inviati negli ultimi 30 giorni sulle DATE REALI (accepted_at / sent_at),
    -- non su updated_at (che cambia a ogni modifica).
    count(*) filter (where status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') and accepted_at >= now() - interval '30 days'),
    count(*) filter (where sent_at is not null and sent_at >= now() - interval '30 days')
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
end
$$;

grant execute on function public.professional_funnel_metrics() to public, anon, authenticated, service_role;
