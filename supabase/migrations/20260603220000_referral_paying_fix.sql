-- ============================================================================
-- FIX KPI "Paganti attivi": v_total_paying contava anche WP/LOCATION, che però
-- sono LIFETIME-free e non pagano mai → metrica gonfiata e fuorviante.
-- Allineo il conteggio a get_referral_tier: solo FORNITORE con PLUS/PREMIUM.
-- (Non tocca crediti/tier, solo il numero mostrato in dashboard.)
-- ----------------------------------------------------------------------------

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

  -- Solo fornitori realmente paganti (PLUS/PREMIUM). I capostipiti sono gratuiti.
  select count(*) into v_total_paying
   from referrals r join profiles p on p.id = r.referee_id
   where r.referrer_id = v_uid and r.status = 'ACTIVE'
     and r.referee_role = 'FORNITORE'
     and p.subscription_status in ('PLUS','PREMIUM');

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
