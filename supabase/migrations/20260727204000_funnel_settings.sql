-- Impostazioni funnel PER-PROFESSIONISTA: ogni professionista puo' accendere/spegnere le funzioni
-- automatiche del funnel preventivi dalle Impostazioni. Default TRUE = comportamento attuale invariato
-- (chi non tocca nulla resta col funnel acceso). Il cron funnel-cron rispetta questi flag per owner.
--   * funnel_followup_enabled  → follow-up automatici al cliente a +3/+7/+14 giorni dall'invio
--   * funnel_contested_enabled → email "data contesa" (stessa data richiesta da piu' preventivi)
-- Colonne NON privilegiate (fuori dal deny-list del lock SEC-01) → scrivibili dal professionista
-- sul proprio profilo, come i colori brand.

alter table public.profiles
  add column if not exists funnel_followup_enabled  boolean not null default true,
  add column if not exists funnel_contested_enabled boolean not null default true;
