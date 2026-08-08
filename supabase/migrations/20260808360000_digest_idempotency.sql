-- FN-3 (residuo): send-digest Modo 2 (per-utente) non ha auth né idempotenza → un anon con la
-- anon key + un destinatario_id poteva innescare invii DUPLICATI ripetuti (email-bomb mirato), e
-- pg_net è at-least-once (doppioni anche legittimi). Registro "un digest per destinatario al giorno":
-- l'edge fa un claim atomico su questa tabella e salta se gia' inviato oggi. Solo service_role (edge).
create table if not exists public.digest_sends (
  destinatario_id uuid not null,
  data_digest date not null,
  sent_at timestamptz not null default now(),
  primary key (destinatario_id, data_digest)
);
alter table public.digest_sends enable row level security;
-- Nessuna policy: la tabella è scritta/letta solo dall'edge send-digest (service_role, bypassa RLS).
revoke all on public.digest_sends from anon, authenticated;
