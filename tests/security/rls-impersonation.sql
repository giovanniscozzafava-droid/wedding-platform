-- ════════════════════════════════════════════════════════════════════════════
-- RLS IMPERSONATION HARNESS (audit §6) — verifica che le policy RLS tengano davvero,
-- impersonando "l'utente sbagliato". Va oltre "RLS abilitata": prova che A NON vede/tocca
-- i dati di B e che nessuno può auto-promuoversi. Girare in CI su ogni PR che tocca
-- supabase/migrations/ ed è la definition-of-done di ogni PRP che tocca una tabella.
--
-- USO (locale o su un DB di staging — NON in produzione fuori da una transazione con ROLLBACK):
--   psql "$DB_URL" -v A='<uuid-utente-A>' -v B='<uuid-utente-B>' -f rls-impersonation.sql
--   oppure adattare gli UUID sotto e lanciare in una singola transazione begin;…;rollback;
--
-- Pattern: impostiamo il ruolo `authenticated` + le claim JWT dell'utente A, poi contiamo
-- quante righe ALTRUI A riesce a vedere. Atteso: 0 ovunque (tranne dati pubblici per natura).
-- Ogni riga con esito != atteso è un BUG di sicurezza da chiudere PRIMA del merge.
-- ════════════════════════════════════════════════════════════════════════════

\set A '423c48ed-47ba-43c8-814d-b980427610e5'
\set B 'bb191e59-c0a0-4931-89e9-42884505eabc'

begin;
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', :'A', 'role', 'authenticated')::text, true);

-- 1) ISOLAMENTO CROSS-TENANT (atteso: 0 righe altrui visibili)
select 'quotes_altrui'            as check, count(*) as got, 0 as expected from quotes             where owner_id  <> :'A'
union all
select 'stripe_subscriptions_altrui', count(*), 0 from stripe_subscriptions where profile_id <> :'A'
union all
select 'contracts_altrui',            count(*), 0 from contracts          where owner_id  <> :'A'
union all
select 'fb_ai_wallet_altrui',         count(*), 0 from fb_ai_wallet       -- A (fornitore) non è location: atteso 0
;

-- 2) PRIVILEGE ESCALATION (SEC-01) — atteso: role/tier NON cambiano
update profiles set role = 'ADMIN', subscription_tier = 'PREMIUM', is_support_staff = true where id = :'A';
select 'escalation_role'  as check, (role::text)              as got, 'FORNITORE (o ruolo originale)' as expected from profiles where id = :'A'
union all
select 'escalation_tier',  (subscription_tier::text),          'FREE (o tier originale)'              from profiles where id = :'A'
union all
select 'escalation_staff', (is_support_staff::text),           'false'                                from profiles where id = :'A';

-- 3) FUNZIONI PERICOLOSE non chiamabili da anon/authenticated (atteso: errore/forbidden)
--    (verifica manuale: seed_user, push_user_notification, fb_ai_charge, stripe_apply_subscription
--     devono avere has_function_privilege('authenticated', …, 'execute') = false)

rollback; -- NESSUNA modifica persiste: l'harness è read-only di fatto.

-- Nota: per dati "semi-pubblici" per natura (services attivi = catalogo pubblico, profili pubblici)
-- l'isolamento cross-tenant NON si applica: quelli si testano diversamente (non-PII).
