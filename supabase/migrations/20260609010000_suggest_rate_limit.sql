-- ============================================================================
-- Rate-limit anti-abuso per la funzione suggest-alternatives (email alternative).
-- Migrazione ADDITIVA: solo nuova tabella + indici + cleanup. Nessun ALTER
-- distruttivo. Riusa il pattern di lead_submit_attempts.
-- ============================================================================
create table if not exists public.suggest_attempts (
  id           bigint generated always as identity primary key,
  ip_address   inet,
  email        text,
  attempted_at timestamptz not null default now()
);
create index if not exists idx_suggest_attempts_ip on public.suggest_attempts(ip_address, attempted_at desc);
create index if not exists idx_suggest_attempts_email on public.suggest_attempts(lower(email), attempted_at desc);

-- Deny-all alle sessioni client: la edge function scrive/legge con service_role.
alter table public.suggest_attempts enable row level security;

create or replace function public.cleanup_suggest_attempts() returns void
language sql as $$
  delete from public.suggest_attempts where attempted_at < now() - interval '1 day';
$$;

comment on table public.suggest_attempts is
  'Tentativi di invio "alternative" (suggest-alternatives) per IP/email: rate-limit anti-abuso. Solo service_role.';
