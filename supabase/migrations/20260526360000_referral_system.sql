-- ============================================================================
-- REFERRAL / NETWORK REWARDS SYSTEM
--
-- Le WP/Location guadagnano portando professionisti nel network:
-- 1) Fornitore pagante portato → 15/20/25% lifetime MRR (tier dinamico)
-- 2) Altra WP portata → 10% lifetime sui suoi success-fee da lead
-- 3) Lead cross-WP → 5% una-tantum
--
-- Founding Member (primi 100 WP) → parte direttamente da tier Argento (20%).
-- Payout iniziale = credito accumulato (no Stripe Connect ancora).
-- ============================================================================

-- 1) Colonne profilo: codice referral univoco + tracking referred_by
alter table profiles
  add column if not exists referral_code  varchar(16) unique,
  add column if not exists referred_by    varchar(16);

create index if not exists idx_profiles_referred_by on profiles(referred_by);

-- Helper: genera codice random readable (no caratteri ambigui)
create or replace function gen_referral_code() returns varchar(16)
language plpgsql as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_len int := 6;
  v_exists boolean;
begin
  loop
    v_code := '';
    for i in 1..v_len loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    select exists(select 1 from profiles where referral_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;
  return v_code;
end$$;

-- Backfill codici per profili WP/Location esistenti
update profiles set referral_code = gen_referral_code()
 where referral_code is null
   and role in ('WEDDING_PLANNER','LOCATION');

-- Trigger: assegna automaticamente al signup (WP/Location)
create or replace function assign_referral_code()
returns trigger language plpgsql as $$
begin
  if NEW.role in ('WEDDING_PLANNER','LOCATION') and NEW.referral_code is null then
    NEW.referral_code := gen_referral_code();
  end if;
  return NEW;
end$$;

drop trigger if exists trg_assign_referral_code on profiles;
create trigger trg_assign_referral_code
  before insert on profiles
  for each row execute function assign_referral_code();

-- 2) Tabella referrals
create table if not exists referrals (
  id              uuid primary key default gen_random_uuid(),
  referrer_id     uuid not null references profiles(id) on delete cascade,
  referee_id      uuid not null references profiles(id) on delete cascade,
  referee_role    user_role not null,
  code_used       varchar(16),
  source          text not null default 'signup_link',
  status          text not null default 'ACTIVE' check (status in ('ACTIVE','TERMINATED')),
  tier_at_creation text,
  terminated_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (referee_id) -- un solo referrer per profilo
);

create index if not exists idx_referrals_referrer on referrals(referrer_id, status);

create trigger trg_referrals_updated_at before update on referrals
  for each row execute function set_updated_at();

-- 3) Tabella credits (payout maturati, in centesimi)
create table if not exists referral_credits (
  id              uuid primary key default gen_random_uuid(),
  wp_id           uuid not null references profiles(id) on delete cascade,
  referral_id     uuid references referrals(id) on delete set null,
  amount_cents    int not null check (amount_cents >= 0),
  currency        char(3) not null default 'EUR',
  period          date,
  reason          text not null check (reason in (
    'FORNITORE_MRR','WP_LEAD','CROSS_LEAD','WELCOME_BONUS','ADJUSTMENT'
  )),
  description     text,
  status          text not null default 'APPROVED' check (status in (
    'PENDING','APPROVED','PAID','REVERSED'
  )),
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_credits_wp on referral_credits(wp_id, status, created_at desc);

-- 4) RLS
alter table referrals        enable row level security;
alter table referral_credits enable row level security;

drop policy if exists "referrals_select_owner" on referrals;
create policy "referrals_select_owner" on referrals for select using (
  referrer_id = auth.uid() or referee_id = auth.uid() or is_admin()
);

drop policy if exists "referrals_admin_write" on referrals;
create policy "referrals_admin_write" on referrals for all
  using (is_admin()) with check (is_admin());

drop policy if exists "credits_select_owner" on referral_credits;
create policy "credits_select_owner" on referral_credits for select using (
  wp_id = auth.uid() or is_admin()
);

drop policy if exists "credits_admin_write" on referral_credits;
create policy "credits_admin_write" on referral_credits for all
  using (is_admin()) with check (is_admin());

-- 5) RPC: redeem codice durante signup (chiamata client side post-insert profile)
create or replace function referral_redeem_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me profiles%rowtype;
  v_referrer profiles%rowtype;
  v_existing referrals%rowtype;
  v_tier text;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_me from profiles where id = v_uid;
  if v_me.id is null then return jsonb_build_object('error','no_profile'); end if;
  if v_me.referred_by is not null then return jsonb_build_object('error','already_referred'); end if;

  select * into v_referrer from profiles where referral_code = upper(p_code);
  if v_referrer.id is null then return jsonb_build_object('error','invalid_code'); end if;
  if v_referrer.id = v_uid then return jsonb_build_object('error','self_referral'); end if;
  if v_referrer.role not in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    return jsonb_build_object('error','only_wp_can_refer');
  end if;

  -- Founding Member parte da Argento, altri da Bronzo
  v_tier := case when v_referrer.is_founding_member then 'ARGENTO' else 'BRONZO' end;

  select * into v_existing from referrals where referee_id = v_uid;
  if v_existing.id is not null then return jsonb_build_object('error','already_exists'); end if;

  insert into referrals (referrer_id, referee_id, referee_role, code_used, tier_at_creation)
  values (v_referrer.id, v_uid, v_me.role, upper(p_code), v_tier);

  update profiles set referred_by = upper(p_code) where id = v_uid;

  return jsonb_build_object('ok', true, 'referrer_id', v_referrer.id, 'tier', v_tier);
end$$;

grant execute on function referral_redeem_code(text) to authenticated;

-- 6) Helper: calcola tier dinamico in base ai paying referee attivi
create or replace function get_referral_tier(p_referrer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_paying_count int;
  v_founding boolean;
  v_tier text;
  v_pct numeric;
begin
  select is_founding_member into v_founding from profiles where id = p_referrer_id;
  v_founding := coalesce(v_founding, false);

  -- Conta fornitori paganti portati attivamente (subscription PLUS/PREMIUM)
  select count(*) into v_paying_count
   from referrals r
   join profiles p on p.id = r.referee_id
  where r.referrer_id = p_referrer_id
    and r.status = 'ACTIVE'
    and r.referee_role = 'FORNITORE'
    and p.subscription_status in ('PLUS','PREMIUM');

  -- Founding parte da Argento di default
  if v_founding and v_paying_count < 10 then
    v_tier := 'ARGENTO'; v_pct := 20;
  elsif v_paying_count >= 30 then
    v_tier := 'ORO'; v_pct := 25;
  elsif v_paying_count >= 10 then
    v_tier := 'ARGENTO'; v_pct := 20;
  else
    v_tier := 'BRONZO'; v_pct := 15;
  end if;

  return jsonb_build_object(
    'tier', v_tier,
    'percentage', v_pct,
    'paying_referees', v_paying_count,
    'is_founding', v_founding,
    'next_tier_at',
      case v_tier
        when 'BRONZO' then 10
        when 'ARGENTO' then 30
        else null
      end
  );
end$$;

grant execute on function get_referral_tier(uuid) to authenticated;

-- 7) RPC: my referral stats (per dashboard /rewards)
create or replace function my_referral_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_me profiles%rowtype;
  v_tier jsonb;
  v_total_referees int;
  v_total_paying int;
  v_credits_total bigint;
  v_credits_pending bigint;
  v_credits_paid bigint;
  v_recent_credits jsonb;
  v_referees jsonb;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_me from profiles where id = v_uid;
  v_tier := get_referral_tier(v_uid);

  select count(*) into v_total_referees
   from referrals where referrer_id = v_uid and status = 'ACTIVE';

  select count(*) into v_total_paying
   from referrals r join profiles p on p.id = r.referee_id
   where r.referrer_id = v_uid and r.status = 'ACTIVE'
     and ((r.referee_role = 'FORNITORE' and p.subscription_status in ('PLUS','PREMIUM'))
       or (r.referee_role in ('WEDDING_PLANNER','LOCATION')));

  select
    coalesce(sum(amount_cents) filter (where status in ('APPROVED','PAID')), 0),
    coalesce(sum(amount_cents) filter (where status = 'APPROVED'), 0),
    coalesce(sum(amount_cents) filter (where status = 'PAID'), 0)
   into v_credits_total, v_credits_pending, v_credits_paid
   from referral_credits where wp_id = v_uid;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',           c.id,
    'amount_cents', c.amount_cents,
    'reason',       c.reason,
    'description',  c.description,
    'status',       c.status,
    'period',       c.period,
    'created_at',   c.created_at
  ) order by c.created_at desc), '[]'::jsonb)
   into v_recent_credits
   from (
     select * from referral_credits where wp_id = v_uid
     order by created_at desc limit 20
   ) c;

  select coalesce(jsonb_agg(jsonb_build_object(
    'referral_id',  r.id,
    'referee_id',   p.id,
    'business_name',p.business_name,
    'full_name',    p.full_name,
    'role',         p.role,
    'subrole',      p.subrole,
    'subscription', p.subscription_status,
    'city',         p.city,
    'created_at',   r.created_at,
    'status',       r.status,
    'logo',         p.brand_logo_url
  ) order by r.created_at desc), '[]'::jsonb)
   into v_referees
   from referrals r join profiles p on p.id = r.referee_id
   where r.referrer_id = v_uid;

  return jsonb_build_object(
    'referral_code',   v_me.referral_code,
    'tier',            v_tier,
    'total_referees',  v_total_referees,
    'paying_referees', v_total_paying,
    'credits_pending_cents', v_credits_pending,
    'credits_paid_cents',    v_credits_paid,
    'credits_total_cents',   v_credits_total,
    'recent_credits',  v_recent_credits,
    'referees',        v_referees
  );
end$$;

grant execute on function my_referral_stats() to authenticated;

-- 8) Trigger: quando un fornitore passa a PLUS/PREMIUM → crea credit mensile
-- (per ora: solo riga di partenza WELCOME_BONUS al primo upgrade dal trial).
-- Il payment mensile ricorrente arriverà quando Stripe sarà collegato.
create or replace function on_supplier_subscription_change()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_referral referrals%rowtype;
  v_tier jsonb;
  v_pct numeric;
  v_amount int;
  v_base_mrr int;
begin
  -- Solo upgrade verso PLUS o PREMIUM
  if NEW.subscription_status not in ('PLUS','PREMIUM') then return NEW; end if;
  if OLD.subscription_status = NEW.subscription_status then return NEW; end if;

  select * into v_referral from referrals where referee_id = NEW.id and status = 'ACTIVE';
  if v_referral.id is null then return NEW; end if;

  v_tier := get_referral_tier(v_referral.referrer_id);
  v_pct := (v_tier->>'percentage')::numeric;

  -- Base MRR in centesimi
  v_base_mrr := case NEW.subscription_status when 'PREMIUM' then 7900 when 'PLUS' then 2900 else 0 end;
  v_amount := (v_base_mrr * v_pct / 100)::int;

  if v_amount > 0 then
    insert into referral_credits (wp_id, referral_id, amount_cents, period, reason, description)
    values (
      v_referral.referrer_id, v_referral.id, v_amount, date_trunc('month', now())::date,
      'FORNITORE_MRR',
      format('%s %% MRR mese - %s (%s)', v_pct, NEW.business_name, NEW.subscription_status)
    );
  end if;
  return NEW;
end$$;

drop trigger if exists trg_supplier_subscription_credit on profiles;
create trigger trg_supplier_subscription_credit
  after update of subscription_status on profiles
  for each row execute function on_supplier_subscription_change();

-- 9) Trigger: lead CLOSED_WON → 10% al referrer della WP (se esiste)
create or replace function on_lead_closed_won()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_referral referrals%rowtype;
  v_amount int;
  v_pct numeric := 10;  -- WP→WP fee 10%
begin
  if NEW.status <> 'CLOSED_WON' or OLD.status = 'CLOSED_WON' then return NEW; end if;
  if NEW.billed_amount is null or NEW.billed_amount <= 0 then return NEW; end if;

  select * into v_referral from referrals
   where referee_id = NEW.wp_id
     and status = 'ACTIVE'
     and referee_role in ('WEDDING_PLANNER','LOCATION');
  if v_referral.id is null then return NEW; end if;

  v_amount := round(NEW.billed_amount * 100 * v_pct / 100)::int;  -- billed_amount è EUR → cents
  if v_amount <= 0 then return NEW; end if;

  insert into referral_credits (wp_id, referral_id, amount_cents, period, reason, description)
  values (
    v_referral.referrer_id, v_referral.id, v_amount, date_trunc('month', now())::date,
    'WP_LEAD',
    format('%s %% lead chiuso da WP %s', v_pct, (select business_name from profiles where id = NEW.wp_id))
  );
  return NEW;
end$$;

drop trigger if exists trg_lead_won_referral_credit on lead_requests;
create trigger trg_lead_won_referral_credit
  after update of status on lead_requests
  for each row execute function on_lead_closed_won();

comment on table referrals is
  'Sistema referral: WP/Location guadagnano portando professionisti. Referral one-shot (un referee = un referrer), status ACTIVE finche il referee non termina.';
comment on table referral_credits is
  'Credit maturati dai referrer. Status APPROVED = pronto, PAID = liquidato (Stripe Connect futuro). Per ora i credit valgono come riduzione su fee future della WP referrer.';
