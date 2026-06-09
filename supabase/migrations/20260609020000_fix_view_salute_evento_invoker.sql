-- ============================================================================
-- FIX isolamento vista (audit notturno, punto 2).
-- `v_salute_evento` era SENZA security_invoker → girava coi privilegi del owner
-- della vista, **bypassando la RLS** di calendar_entries: un `anon` leggeva lo
-- stato/salute per-evento (cross-tenant). Test: tests/sql/views_isolation_tests.sql
--   (rosso prima: anon vede 1 riga; verde dopo: 0 / permission denied).
-- Fix: la vista rispetta la RLS del CHIAMANTE (owner vede i suoi eventi, anon 0)
-- + revoke del grant anon (la salute-evento non è un dato pubblico).
-- ============================================================================
alter view public.v_salute_evento set (security_invoker = on);
revoke select on public.v_salute_evento from anon;

-- Nota: `user_rating_summary` resta com'è: è un AGGREGATO pubblico voluto
-- (avg(stars), count(*) per utente) senza colonne identificative né cross-tenant.
