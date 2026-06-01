-- ============================================================================
-- HOTFIX SICUREZZA CRITICO — lockdown delle 3 tabelle interne/audit esposte.
-- ----------------------------------------------------------------------------
-- Audit (stress test 2026-06-01) ha trovato che queste tabelle avevano RLS
-- DISABILITATA + GRANT ALL (incl. TRUNCATE) a anon/authenticated:
--
--   * quote_acceptances_audit  → un ANONIMO leggeva PII complete delle firme
--     (signer_name, signer_email, signer_phone, doc_number = n. documento
--     d'identita`, ip_address, access_token) di TUTTI i tenant, e poteva
--     UPDATE/DELETE l'audit trail legale delle accettazioni. [CRITICAL]
--     In piu`, l'access_token trapelato consentiva di leggere/accettare/
--     rifiutare preventivi altrui via le RPC by-token. [catena CRITICAL→HIGH]
--   * contracts_legacy_audit   → anon leggeva e CANCELLAVA l'audit firme
--     contratti legacy (integrita` probatoria). [HIGH]
--   * lead_submit_attempts     → anon leggeva gli IP e poteva azzerare
--     (TRUNCATE/DELETE) il meccanismo anti-abuso dei form lead. [HIGH]
--
-- Queste tabelle sono SOLO interne: vengono scritte da migration e da funzioni
-- SECURITY DEFINER / service_role (che bypassano la RLS in quanto owner).
-- Nessun client deve accedervi direttamente.
--
-- Fix: abilita RLS + revoca OGNI privilegio a anon/authenticated/PUBLIC.
-- Senza policy e senza grant, i ruoli client non vedono/toccano nulla; le
-- scritture legittime (definer/service_role) continuano a funzionare.
-- ============================================================================

-- 1) quote_acceptances_audit ------------------------------------------------
alter table public.quote_acceptances_audit enable row level security;
revoke all on public.quote_acceptances_audit from anon, authenticated, public;

-- 2) contracts_legacy_audit -------------------------------------------------
alter table public.contracts_legacy_audit enable row level security;
revoke all on public.contracts_legacy_audit from anon, authenticated, public;

-- 3) lead_submit_attempts ---------------------------------------------------
alter table public.lead_submit_attempts enable row level security;
revoke all on public.lead_submit_attempts from anon, authenticated, public;

-- Nota: nessuna policy aggiunta di proposito → accesso consentito solo a
-- service_role e alle funzioni SECURITY DEFINER (owner postgres, BYPASSRLS).
-- Se in futuro serve esporne una in lettura a un ruolo, usare una RPC
-- SECURITY DEFINER con whitelist di colonne (mai le colonne PII/token).

comment on table public.quote_acceptances_audit is
  'Audit interno accettazioni (PII + token). RLS ON, nessun grant client. Accesso solo service_role / SECURITY DEFINER. NON esporre direttamente.';
comment on table public.contracts_legacy_audit is
  'Audit interno firme contratti legacy. RLS ON, nessun grant client. Insert-only via migration/definer.';
comment on table public.lead_submit_attempts is
  'Rate-limit interno submit lead. RLS ON, nessun grant client. Scritto solo da submit_lead_request (SECURITY DEFINER).';
