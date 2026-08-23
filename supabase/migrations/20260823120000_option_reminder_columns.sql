-- ============================================================================
-- Funnel "opzione data": quando una coppia tiene la data senza firmare
-- (calendar_entries.option_expires_at nel futuro), il cron manda 2 promemoria
-- gentili al cliente prima della scadenza. Qui le colonne di idempotenza, così
-- ogni promemoria parte UNA volta sola.
--   • option_reminder1_at → promemoria "gentile" (~5 giorni alla scadenza)
--   • option_reminder2_at → promemoria "ultimo" (~1 giorno alla scadenza)
-- ============================================================================
alter table public.calendar_entries
  add column if not exists option_reminder1_at timestamptz,
  add column if not exists option_reminder2_at timestamptz;

comment on column public.calendar_entries.option_reminder1_at is 'Funnel opzione: inviato il promemoria gentile (~5gg alla scadenza della tenuta data).';
comment on column public.calendar_entries.option_reminder2_at is 'Funnel opzione: inviato il promemoria finale (~1gg alla scadenza della tenuta data).';
