-- Wallet AI a CREDITI per le location che usano le funzioni AI del gestionale (lettura bolle/scontrini/
-- fatture). Ogni chiamata scala dal credito il costo reale (token Anthropic × tariffa con markup).
-- Credito a zero → funzione bloccata. Minimo mensile 1€, 1€ di prova alla prima attivazione.
-- Ricarica vera = Stripe (progetto separato): qui solo top-up manuale admin.

create table if not exists public.fb_ai_pricing (
  id int primary key default 1,
  input_eur_per_mtok  numeric(10,2) not null,   -- €/milione token input  (markup incluso)
  output_eur_per_mtok numeric(10,2) not null,   -- €/milione token output (markup incluso)
  constraint fb_ai_pricing_single check (id = 1)
);
insert into public.fb_ai_pricing(id, input_eur_per_mtok, output_eur_per_mtok)
  values (1, 9, 45) on conflict (id) do nothing;

create table if not exists public.fb_ai_wallet (
  location_id     uuid primary key references public.profiles(id) on delete cascade,
  balance_eur     numeric(10,4) not null default 0,
  monthly_min_eur numeric(10,2) not null default 1,
  trial_granted   boolean not null default false,
  active          boolean not null default true,
  updated_at      timestamptz not null default now()
);
create table if not exists public.fb_ai_usage (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.profiles(id) on delete cascade,
  fn            text not null,
  input_tokens  int not null default 0,
  output_tokens int not null default 0,
  cost_eur      numeric(10,4) not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_fb_ai_usage_loc on public.fb_ai_usage(location_id, created_at desc);

alter table public.fb_ai_pricing enable row level security;
alter table public.fb_ai_wallet  enable row level security;
alter table public.fb_ai_usage   enable row level security;
drop policy if exists fb_ai_pricing_read on public.fb_ai_pricing;
create policy fb_ai_pricing_read on public.fb_ai_pricing for select using (auth.role() = 'authenticated');
drop policy if exists fb_ai_wallet_read on public.fb_ai_wallet;
create policy fb_ai_wallet_read on public.fb_ai_wallet for select using (location_id = auth.uid() or public.is_admin());
drop policy if exists fb_ai_wallet_admin on public.fb_ai_wallet;
create policy fb_ai_wallet_admin on public.fb_ai_wallet for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists fb_ai_usage_read on public.fb_ai_usage;
create policy fb_ai_usage_read on public.fb_ai_usage for select using (location_id = auth.uid() or public.is_admin());

-- assicura il wallet (+ 1€ di prova una tantum) e ritorna il saldo
create or replace function public.fb_ai_precheck(p_location uuid)
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  insert into public.fb_ai_wallet(location_id, balance_eur, trial_granted)
    values (p_location, 1.00, true) on conflict (location_id) do nothing;
  select balance_eur into v from public.fb_ai_wallet where location_id = p_location;
  return coalesce(v, 0);
end$$;

-- addebito: scala il saldo e logga l'uso (solo edge function via service role)
create or replace function public.fb_ai_charge(p_location uuid, p_cost numeric, p_in int, p_out int, p_fn text)
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  update public.fb_ai_wallet set balance_eur = balance_eur - greatest(coalesce(p_cost,0),0), updated_at = now()
    where location_id = p_location returning balance_eur into v;
  insert into public.fb_ai_usage(location_id, fn, input_tokens, output_tokens, cost_eur)
    values (p_location, p_fn, coalesce(p_in,0), coalesce(p_out,0), greatest(coalesce(p_cost,0),0));
  return coalesce(v, 0);
end$$;

-- top-up manuale (admin) — segnaposto della ricarica a pagamento
create or replace function public.fb_ai_topup(p_location uuid, p_amount numeric)
returns numeric language plpgsql security definer set search_path = public as $$
declare v numeric;
begin
  if not public.is_admin() then return -1; end if;
  insert into public.fb_ai_wallet(location_id, balance_eur) values (p_location, p_amount)
    on conflict (location_id) do update set balance_eur = public.fb_ai_wallet.balance_eur + p_amount, updated_at = now()
    returning balance_eur into v;
  return v;
end$$;

revoke all on function public.fb_ai_precheck(uuid) from public;
revoke all on function public.fb_ai_charge(uuid, numeric, int, int, text) from public;
grant execute on function public.fb_ai_precheck(uuid) to service_role;
grant execute on function public.fb_ai_charge(uuid, numeric, int, int, text) to service_role;
grant execute on function public.fb_ai_topup(uuid, numeric) to authenticated;
