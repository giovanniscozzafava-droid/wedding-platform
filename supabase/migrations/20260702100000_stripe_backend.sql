-- ============================================================================
-- STRIPE — backend minimo per l'abbonamento (webhook stripe-webhook).
-- Guardrail: nessun grant a anon; RLS restrittiva; idempotenza via stripe_events;
-- il tier scritto su profiles.subscription_status (TRIAL/PLUS/PREMIUM/EXPIRED/LIFETIME).
-- Le chiamate arrivano dal webhook con SERVICE_ROLE (bypassa RLS).
-- ============================================================================

-- Link profilo <-> customer Stripe (letto da resolveProfile nel webhook).
create table if not exists public.stripe_customers (
  profile_id         uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

-- Idempotenza: ogni event.id processato una sola volta.
create table if not exists public.stripe_events (
  id         text primary key,          -- Stripe event.id
  type       text,
  created_at timestamptz not null default now()
);

-- Stato abbonamento (audit + fonte per il tier del profilo).
create table if not exists public.stripe_subscriptions (
  subscription_id      text primary key,  -- Stripe sub id
  profile_id           uuid not null references public.profiles(id) on delete cascade,
  status               text,              -- status Stripe grezzo (active/trialing/canceled/...)
  price_id             text,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at           timestamptz not null default now()
);
create index if not exists idx_stripe_sub_profile on public.stripe_subscriptions(profile_id);

-- Mappa price -> tier (config: popolare con i price ID reali). Se un price non è
-- mappato, si assume 'PLUS' (tier a pagamento base).
create table if not exists public.stripe_price_map (
  price_id text primary key,
  tier     text not null check (tier in ('PLUS','PREMIUM')),
  note     text
);

-- RLS: owner legge i propri record; staff/admin tutto; nessun accesso anon.
alter table public.stripe_customers      enable row level security;
alter table public.stripe_subscriptions  enable row level security;
alter table public.stripe_events         enable row level security;
alter table public.stripe_price_map      enable row level security;

drop policy if exists stripe_customers_read on public.stripe_customers;
create policy stripe_customers_read on public.stripe_customers for select
  using (profile_id = auth.uid() or public.is_support_staff());
drop policy if exists stripe_sub_read on public.stripe_subscriptions;
create policy stripe_sub_read on public.stripe_subscriptions for select
  using (profile_id = auth.uid() or public.is_support_staff());
drop policy if exists stripe_events_staff on public.stripe_events;
create policy stripe_events_staff on public.stripe_events for select using (public.is_support_staff());
drop policy if exists stripe_price_map_read on public.stripe_price_map;
create policy stripe_price_map_read on public.stripe_price_map for select using (auth.uid() is not null);

-- RPC applicata dal webhook (SERVICE_ROLE). Upsert dell'abbonamento + tier sul profilo.
create or replace function public.stripe_apply_subscription(
  p_profile uuid, p_sub_id text, p_status text, p_price text,
  p_period_end timestamptz, p_cancel_at_end boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_tier text; v_active boolean;
begin
  insert into public.stripe_subscriptions(subscription_id, profile_id, status, price_id, current_period_end, cancel_at_period_end, updated_at)
    values (p_sub_id, p_profile, p_status, p_price, p_period_end, coalesce(p_cancel_at_end, false), now())
  on conflict (subscription_id) do update set
    status = excluded.status, price_id = excluded.price_id,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end, updated_at = now();

  v_active := p_status in ('active', 'trialing', 'past_due');
  if v_active then
    v_tier := coalesce((select tier from public.stripe_price_map where price_id = p_price), 'PLUS');
  else
    v_tier := 'EXPIRED';   -- canceled / unpaid / incomplete_expired / paused / incomplete
  end if;

  -- Non declassare mai un LIFETIME (concesso a mano).
  update public.profiles
     set subscription_status   = case when subscription_status = 'LIFETIME' then 'LIFETIME' else v_tier end,
         subscription_renews_at = p_period_end
   where id = p_profile;

  return jsonb_build_object('ok', true, 'tier', v_tier);
end$$;

-- Solo il webhook (service_role) la chiama. Niente grant ad anon/authenticated.
grant execute on function public.stripe_apply_subscription(uuid, text, text, text, timestamptz, boolean) to service_role;
