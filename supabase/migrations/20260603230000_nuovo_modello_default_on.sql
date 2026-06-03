-- ============================================================================
-- "Nuovo modello" (workflow guidato: prossima mossa, salute evento,
-- riconciliazione, chat evento, scadenzario, cambiamenti) diventa DEFAULT ON.
-- Nuovi profili partono attivi; gli esistenti vengono attivati (resta togglabile).
-- ----------------------------------------------------------------------------

alter table public.profiles
  alter column nuovo_modello_attivo set default true;

update public.profiles
   set nuovo_modello_attivo = true
 where nuovo_modello_attivo is not true;
