-- ============================================================================
-- SEC-06 — RPC interne raggiungibili da chiunque, senza login.
--
-- Trovato in audit il 07/09/2026. In Postgres le funzioni nascono con
-- `execute` concesso a PUBLIC: ogni funzione creata in `public` finisce quindi
-- esposta via PostgREST anche al ruolo `anon`, cioè a chiunque abbia la chiave
-- pubblica (che sta nel bundle JS del sito). 526 funzioni SECURITY DEFINER
-- risultavano chiamabili da anon; la maggior parte ha un controllo interno
-- (auth.uid(), admin_guard(), token), ma un gruppo no — sono helper interni,
-- lavori pianificati e funzioni che chiamano solo le edge function con la
-- chiave service_role.
--
-- Prova raccolta prima del fix, con la sola chiave anonima:
--   POST /rest/v1/rpc/api_key_resolve {"p_hash":"prova-non-esiste"}
--   → 200 {"error":"invalid_key"}
-- cioè un oracolo per validare hash di chiavi API e leggerne proprietario e
-- scope. Altri esempi dello stesso gruppo:
--   _grant_referral_credit  → creare debiti fra fornitori a piacere
--   ultimatum_freeze_silent → congelare le automazioni di TUTTI i clienti
--   scadi_opzioni           → far scadere le opzioni data di TUTTI
--   refresh_notifiche_*     → generare notifiche su eventi altrui
--
-- Nessuna di queste è chiamata dal frontend (verificato su tutto
-- `frontend/src`): le usano le edge function, che passano dal service_role e
-- non sono toccate dai grant. Gli unici chiamanti interni sono a loro volta
-- SECURITY DEFINER, quindi continuano a funzionare.
-- ============================================================================

-- Helper interni, lavori pianificati e funzioni chiamate solo da edge function.
do $$
declare
  v_nome text;
  v_sig  text;
begin
  foreach v_nome in array array[
    '_circle_email',
    '_event_ring_seed',
    '_grant_referral_credit',
    '_teardown_dead_supplier_participants',
    '_wp_seed_parcelle_for',
    'api_call_log',
    'api_key_resolve',
    'certify_referral_contact',
    'fb_procure_event',
    'notifiche_genera_promemoria_per_evento',
    'notify_guc_ready',
    'quote_promote_to_inviato',
    'recompute_day_availability',
    'record_auto_suggestions',
    'refresh_notifiche_per_evento',
    'scadi_opzioni',
    'ultimatum_freeze_silent'
  ]
  loop
    for v_sig in
      select format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = v_nome
    loop
      execute format('revoke execute on function %s from public, anon, authenticated', v_sig);
    end loop;
  end loop;
end$$;

-- Ricalcolo totali: lo chiama l'editor preventivi, quindi resta a chi ha fatto
-- login. Fuori solo l'anonimo, che non ha motivo di ricalcolare un preventivo.
do $$
declare v_sig text;
begin
  for v_sig in
    select format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'quotes_recalc_totals'
  loop
    execute format('revoke execute on function %s from public, anon', v_sig);
    execute format('grant execute on function %s to authenticated', v_sig);
  end loop;
end$$;

-- NB: restano volutamente pubbliche le porte d'ingresso vere del sito —
-- submit_public_lead, submit_lead_request, waitlist_submit, wedding_site_rsvp —
-- che hanno honeypot e rate limit propri.
