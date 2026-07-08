-- ============================================================================
-- STRIPE CONNECT (Express) — Planfully è il TRAMITE.
-- Ogni professionista (FORNITORE/WEDDING_PLANNER/LOCATION) collega il PROPRIO account Stripe e
-- incassa dai suoi clienti con DIRECT CHARGES: il pro è merchant of record (incasso, payout e
-- ricevuta sono suoi). In beta la commissione piattaforma (application_fee) è 0 → nessun money-talk
-- di Planfully verso l'utente. Motore GENERICO riusabile da qualunque flusso (preventivo/acconto,
-- commissione album, negozio stampe, ...).
-- Guardrail: nessun grant a anon; RLS restrittiva; scrittura solo via SERVICE ROLE (edge/webhook).
-- ============================================================================

-- Account Connect del professionista (1:1 col profilo). Stato onboarding aggiornato dal webhook
-- (account.updated). charges_enabled=true ⇒ può incassare.
create table if not exists public.stripe_connect_accounts (
  profile_id        uuid primary key references public.profiles(id) on delete cascade,
  account_id        text not null unique,                 -- acct_...
  charges_enabled   boolean not null default false,
  payouts_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  country           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.stripe_connect_accounts enable row level security;
-- il professionista legge SOLO il proprio stato onboarding; scrittura solo service role.
drop policy if exists connect_acct_self_read on public.stripe_connect_accounts;
create policy connect_acct_self_read on public.stripe_connect_accounts
  for select using (profile_id = auth.uid());

-- Ledger generico dei pagamenti. Ogni riga = una richiesta di pagamento cliente → professionista.
-- ref_type/ref_id sono un legame polimorfico al "cosa" si sta pagando (preventivo, commissione, ...).
create table if not exists public.payments (
  id                    uuid primary key default gen_random_uuid(),
  payee_id              uuid not null references public.profiles(id) on delete restrict,  -- il pro che incassa
  kind                  text not null check (kind in ('QUOTE_DEPOSIT','QUOTE_BALANCE','ALBUM_COMMISSION','PRINT_ORDER','OTHER')),
  ref_type              text,
  ref_id                text,
  description           text,
  amount_cents          integer not null check (amount_cents > 0),
  currency              text not null default 'eur',
  application_fee_cents integer not null default 0 check (application_fee_cents >= 0),
  payer_name            text,
  payer_email           text,
  status                text not null default 'PENDING' check (status in ('PENDING','PAID','FAILED','CANCELED','REFUNDED')),
  checkout_session_id   text,
  payment_intent_id     text,
  connected_account_id  text,                              -- acct_ su cui è stato fatto l'addebito diretto
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  paid_at               timestamptz
);
create index if not exists idx_payments_payee   on public.payments(payee_id, created_at desc);
create index if not exists idx_payments_ref     on public.payments(ref_type, ref_id);
create index if not exists idx_payments_session on public.payments(checkout_session_id);
alter table public.payments enable row level security;
-- il pro vede i propri incassi; il creatore vede quelli creati da sé; scrittura solo service role.
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select using (payee_id = auth.uid() or created_by = auth.uid());
