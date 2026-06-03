-- ============================================================================
-- AUTOMAZIONE FUNNEL sui preventivi.
--  * Follow-up automatici a +3 / +7 / +14 giorni dall'invio (se non accettato).
--  * Archiviazione automatica dopo 30 giorni senza risposta.
--  * Email "data contesa": quando un altro preventivo nasce sulla STESSA data,
--    avvisa il cliente la cui richiesta è ancora in fase NON accettata.
-- Lo stato lo gestisce la edge function funnel-cron (eseguita ogni giorno).
-- Qui aggiungo solo le colonne di tracciamento.
-- ----------------------------------------------------------------------------

alter table public.quotes
  add column if not exists followup_count smallint not null default 0,
  add column if not exists last_followup_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists date_contested_notified_at timestamptz,
  add column if not exists funnel_paused boolean not null default false;

comment on column public.quotes.followup_count is 'Quanti follow-up automatici inviati (0..3).';
comment on column public.quotes.archived_at is 'Quando il preventivo è stato archiviato (perso/scaduto) dal funnel.';
comment on column public.quotes.date_contested_notified_at is 'Quando è stata inviata l''email "data contesa" (max 1).';
comment on column public.quotes.funnel_paused is 'Se true, niente automatismi del funnel su questo preventivo.';

create index if not exists idx_quotes_funnel_active
  on public.quotes (sent_at)
  where status = 'INVIATO' and archived_at is null and accepted_at is null and funnel_paused = false;
