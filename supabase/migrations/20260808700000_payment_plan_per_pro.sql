-- ============================================================================
-- Piano pagamenti PER PROFESSIONISTA (decisione Giovanni): ogni pro sceglie come
-- farsi pagare in 3 rate (acconto / seconda / saldo). Default 30/50/20.
-- Sostituisce il 30/40/30 fisso del contratto e guida l'acconto Stripe.
-- È un'impostazione del professionista (self-update, come capostipite_sale_mode).
-- ============================================================================

alter table public.profiles
  add column if not exists pay_deposit_pct numeric not null default 30,
  add column if not exists pay_second_pct  numeric not null default 50,
  add column if not exists pay_balance_pct numeric not null default 20;

-- Le tre rate devono sommare a 100 ed essere non negative.
alter table public.profiles drop constraint if exists profiles_pay_plan_sum;
alter table public.profiles add constraint profiles_pay_plan_sum
  check (pay_deposit_pct >= 0 and pay_second_pct >= 0 and pay_balance_pct >= 0
         and (pay_deposit_pct + pay_second_pct + pay_balance_pct) = 100);

comment on column public.profiles.pay_deposit_pct is 'Piano pagamenti del pro: % acconto alla firma (default 30). Somma delle 3 rate = 100.';
