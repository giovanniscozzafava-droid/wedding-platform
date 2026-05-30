-- FASE 1.1 — Questionario-once: timestamp di completamento onboarding
-- Aggiungiamo profiles.onboarding_completato_il (timestamptz) per registrare
-- quando l'utente ha completato il questionario di onboarding. Una volta valorizzato,
-- il gate RequireAuth eviterà di rimandarlo su /onboarding.

alter table public.profiles
  add column if not exists onboarding_completato_il timestamptz;

comment on column public.profiles.onboarding_completato_il is
  'Istante (UTC) in cui l''utente ha completato il wizard di onboarding. Se valorizzato, il gate /onboarding non riapre il wizard.';

-- Backfill: chi ha onboarding_complete = true ma non ha ancora il timestamp,
-- impostiamo l''istante a updated_at (best-effort, evita NULL su utenti esistenti).
update public.profiles
   set onboarding_completato_il = coalesce(updated_at, now())
 where onboarding_complete = true
   and onboarding_completato_il is null;

create index if not exists idx_profiles_onboarding_completato_il
  on public.profiles(onboarding_completato_il)
  where onboarding_completato_il is not null;
