-- ============================================================================
-- Tabella generica per il rate-limit dei form PUBBLICI (senza login): prenotazioni
-- (book-appointment) e richieste stampa (print-request) erano prive di honeypot e
-- limite per IP -> sabotaggio calendario / email bombing. Una riga per tentativo,
-- interrogata dalle edge (service_role). Nessuna policy = deny-all tranne service.
-- ============================================================================

create table if not exists public.public_form_attempts (
  id         bigint generated always as identity primary key,
  ip         text not null,
  kind       text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_pfa_ip_kind_time
  on public.public_form_attempts (ip, kind, created_at desc);

alter table public.public_form_attempts enable row level security;
