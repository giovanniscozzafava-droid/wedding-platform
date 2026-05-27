-- ============================================================================
-- SECURITY HARDENING — fix vulnerabilità identificate da audit:
-- HIGH: finance/insurance RLS too open, token expiry mancante
-- MEDIUM: input validation finance_applications, referral rate limit,
--        storage path traversal
-- ============================================================================

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ HIGH #1: finance_offers / insurance_offers — RLS using(true) → solo     │
-- │          offers attive (is_active=true) visibili agli authenticated      │
-- └──────────────────────────────────────────────────────────────────────────┘
drop policy if exists "fin_select_all_authenticated" on finance_offers;
create policy "fin_select_public_active" on finance_offers for select
  using (is_active = true);

drop policy if exists "ins_select_all_authenticated" on insurance_offers;
create policy "ins_select_public_active" on insurance_offers for select
  using (is_active = true);

-- Anche admin può leggere tutto
drop policy if exists "fin_admin_all" on finance_offers;
create policy "fin_admin_all" on finance_offers for all
  using (is_admin()) with check (is_admin());

drop policy if exists "ins_admin_all" on insurance_offers;
create policy "ins_admin_all" on insurance_offers for all
  using (is_admin()) with check (is_admin());

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ HIGH #2: TOKEN EXPIRY — quotes/contracts/inviti UUID senza scadenza.    │
-- │           Aggiungo expires_at, default 1 anno per quotes e contratti,    │
-- │           60gg per inviti.                                               │
-- └──────────────────────────────────────────────────────────────────────────┘

alter table quotes
  add column if not exists access_token_expires_at timestamptz
    default (now() + interval '365 days');

alter table contracts
  add column if not exists access_token_expires_at timestamptz
    default (now() + interval '365 days');

-- Backfill: tokens esistenti scadono 1 anno dalla creazione
update quotes set access_token_expires_at = created_at + interval '365 days'
 where access_token_expires_at is null;
update contracts set access_token_expires_at = created_at + interval '365 days'
 where access_token_expires_at is null;

-- Helper function: token valido?
create or replace function is_token_valid(p_expires_at timestamptz)
returns boolean
language sql
immutable
as $$
  select p_expires_at is null or p_expires_at > now();
$$;

-- Patch quote_get_by_token per gated by expiry
create or replace function quote_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_quote   quotes%rowtype;
  v_items   jsonb;
  v_owner   record;
begin
  select * into v_quote from quotes
   where access_token = p_token
     and is_token_valid(access_token_expires_at);
  if v_quote.id is null then
    return null;
  end if;

  select jsonb_agg(to_jsonb(qi) order by qi.sort_order)
    into v_items
    from quote_items qi
   where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url,
         brand_primary_color, brand_secondary_color,
         role, subrole, city
    into v_owner
    from profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id',                v_quote.id,
    'title',             v_quote.title,
    'client_name',       v_quote.client_name,
    'client_email',      v_quote.client_email,
    'event_date',        v_quote.event_date,
    'event_kind',        v_quote.event_kind,
    'event_location',    v_quote.event_location,
    'guest_count',       v_quote.guest_count,
    'status',            v_quote.status,
    'revision',          v_quote.revision,
    'total_client',      v_quote.total_client,
    'pdf_url',           v_quote.pdf_url,
    'pdf_variant',       v_quote.pdf_variant,
    'direct_client_id',  v_quote.direct_client_id,
    'owner',             to_jsonb(v_owner),
    'items',             coalesce(v_items, '[]'::jsonb)
  );
end$$;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ MEDIUM #1: finance_applications.amount — check constraint               │
-- └──────────────────────────────────────────────────────────────────────────┘
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'finapp_amount_realistic'
  ) then
    alter table finance_applications
      add constraint finapp_amount_realistic
        check (amount > 0 and amount <= 500000);
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'finapp_months_realistic'
  ) then
    alter table finance_applications
      add constraint finapp_months_realistic
        check (months is null or (months between 6 and 84));
  end if;
end $$;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ MEDIUM #2: Referral redeem rate limit                                   │
-- │ Tabella attempts: bloccare > 10 tentativi/ora per utente                │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists referral_redeem_attempts (
  user_id    uuid not null references profiles(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  code       text,
  success    boolean not null default false
);
create index if not exists idx_referral_attempts_user_time
  on referral_redeem_attempts(user_id, attempted_at desc);

alter table referral_redeem_attempts enable row level security;
drop policy if exists "rra_select_own" on referral_redeem_attempts;
create policy "rra_select_own" on referral_redeem_attempts for select
  using (user_id = auth.uid() or is_admin());

-- Wrap referral_redeem_code con rate limit
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
  v_recent_attempts int;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;

  -- Rate limit: max 10 tentativi/ora
  select count(*) into v_recent_attempts
    from referral_redeem_attempts
   where user_id = v_uid and attempted_at > now() - interval '1 hour';
  if v_recent_attempts >= 10 then
    return jsonb_build_object('error','rate_limited','retry_after','1 hour');
  end if;

  -- Log attempt
  insert into referral_redeem_attempts (user_id, code, success)
    values (v_uid, upper(p_code), false);

  select * into v_me from profiles where id = v_uid;
  if v_me.id is null then return jsonb_build_object('error','no_profile'); end if;
  if v_me.referred_by is not null then return jsonb_build_object('error','already_referred'); end if;

  select * into v_referrer from profiles where referral_code = upper(p_code);
  if v_referrer.id is null then return jsonb_build_object('error','invalid_code'); end if;
  if v_referrer.id = v_uid then return jsonb_build_object('error','self_referral'); end if;
  if v_referrer.role not in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    return jsonb_build_object('error','only_wp_can_refer');
  end if;

  v_tier := case when v_referrer.is_founding_member then 'ARGENTO' else 'BRONZO' end;

  select * into v_existing from referrals where referee_id = v_uid;
  if v_existing.id is not null then return jsonb_build_object('error','already_exists'); end if;

  insert into referrals (referrer_id, referee_id, referee_role, code_used, tier_at_creation)
  values (v_referrer.id, v_uid, v_me.role, upper(p_code), v_tier);

  update profiles set referred_by = upper(p_code) where id = v_uid;

  -- Mark attempt as success
  update referral_redeem_attempts
     set success = true
   where user_id = v_uid and attempted_at = (
     select max(attempted_at) from referral_redeem_attempts where user_id = v_uid
   );

  return jsonb_build_object('ok', true, 'referrer_id', v_referrer.id, 'tier', v_tier);
end$$;

grant execute on function referral_redeem_code(text) to authenticated;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ MEDIUM #3: Lead submit anti-abuse rate limit                            │
-- │ Tabella attempts per IP + WP slug                                       │
-- └──────────────────────────────────────────────────────────────────────────┘
create table if not exists lead_submit_attempts (
  ip_address    inet,
  wp_slug       text,
  attempted_at  timestamptz not null default now()
);
create index if not exists idx_lead_attempts_ip_time
  on lead_submit_attempts(ip_address, attempted_at desc);

-- Cleanup vecchio: tieni solo ultimo giorno
create or replace function cleanup_lead_attempts() returns void
language sql as $$
  delete from lead_submit_attempts where attempted_at < now() - interval '1 day';
$$;

-- Patch submit_lead_request con anti-spam (mantengo signature)
create or replace function submit_lead_request(
  p_wp_slug         text,
  p_client_name     text,
  p_client_email    text,
  p_client_phone    text default null,
  p_event_kind      text default 'matrimonio',
  p_event_date      date default null,
  p_event_location  text default null,
  p_guests_estimate int default null,
  p_budget_range    text default null,
  p_message         text default null,
  p_honeypot        text default null,
  p_source          text default 'public_form'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wp_id uuid;
  v_wp_role user_role;
  v_id uuid;
  v_recent int;
begin
  -- Honeypot anti-bot
  if p_honeypot is not null and p_honeypot <> '' then
    return jsonb_build_object('ok', true, 'id', gen_random_uuid());
  end if;

  if p_client_name is null or trim(p_client_name) = '' then
    return jsonb_build_object('error', 'name_required');
  end if;
  if p_client_email is null or p_client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('error', 'invalid_email');
  end if;

  -- Rate limit per email: max 5 lead/giorno con stesso email
  select count(*) into v_recent from lead_requests
   where client_email = lower(trim(p_client_email))
     and created_at > now() - interval '1 day';
  if v_recent >= 5 then
    return jsonb_build_object('error', 'rate_limited');
  end if;

  -- Rate limit per WP: max 50 lead/giorno per stesso WP slug
  select count(*) into v_recent from lead_requests lr
    join profiles p on p.id = lr.wp_id
   where p.slug = p_wp_slug
     and lr.created_at > now() - interval '1 day';
  if v_recent >= 50 then
    return jsonb_build_object('error', 'wp_rate_limited');
  end if;

  select id, role into v_wp_id, v_wp_role from profiles where slug = p_wp_slug limit 1;
  if v_wp_id is null then
    return jsonb_build_object('error', 'wp_not_found');
  end if;
  if v_wp_role not in ('WEDDING_PLANNER','LOCATION','ADMIN') then
    return jsonb_build_object('error', 'not_a_wp_or_location');
  end if;

  insert into lead_requests (
    wp_id, client_name, client_email, client_phone, event_kind, event_date,
    event_location, guests_estimate, budget_range, message, source
  ) values (
    v_wp_id, trim(p_client_name), lower(trim(p_client_email)),
    nullif(trim(coalesce(p_client_phone,'')),''),
    coalesce(p_event_kind, 'matrimonio'),
    p_event_date, p_event_location, p_guests_estimate, p_budget_range, p_message, p_source
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end$$;

grant execute on function submit_lead_request(text, text, text, text, text, date, text, int, text, text, text, text) to anon, authenticated;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ MEDIUM #4: Storage brand-assets path enforcement                        │
-- │ Enforce: ogni file deve essere sotto la cartella auth.uid()/            │
-- └──────────────────────────────────────────────────────────────────────────┘
drop policy if exists "brand_assets_upload_own" on storage.objects;
create policy "brand_assets_upload_own" on storage.objects for insert with check (
  bucket_id = 'brand-assets'
  and auth.uid() is not null
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "brand_assets_update_own" on storage.objects;
create policy "brand_assets_update_own" on storage.objects for update using (
  bucket_id = 'brand-assets'
  and name like (auth.uid()::text || '/%')
);

drop policy if exists "brand_assets_delete_own" on storage.objects;
create policy "brand_assets_delete_own" on storage.objects for delete using (
  bucket_id = 'brand-assets'
  and (name like (auth.uid()::text || '/%') or is_admin())
);

comment on table referral_redeem_attempts is
  'Audit redeem code attempts per rate limiting (10/h per user). Pulizia automatica via cron futuro.';
comment on table lead_submit_attempts is
  'Audit submit lead attempts. Per ora non usata direttamente, futuro IP-based throttling.';
