-- ============================================================================
-- LEAD REQUESTS — il cliente finale (sposi, famiglie, aziende) cerca
-- WP/Location/Event Planner sul portale, atterra sul profilo pubblico,
-- clicca "Richiedi preventivo" e compila un form. Il WP riceve il lead
-- nella propria inbox. Modello pay-on-success: il WP paga solo €7/lead
-- quando lo marca come CLOSED_WON (primo anno: 50% sconto = €3,50/lead).
-- ============================================================================

-- 1) Tabella lead_requests
create table if not exists lead_requests (
  id              uuid primary key default gen_random_uuid(),
  wp_id           uuid not null references profiles(id) on delete cascade,

  -- Identita cliente (no auth required, raccolta da form pubblico)
  client_name     varchar(160) not null,
  client_email    varchar(200) not null,
  client_phone    varchar(40),

  -- Dati evento
  event_kind      text not null default 'matrimonio',
  event_date      date,
  event_location  varchar(200),
  guests_estimate int,
  budget_range    text,   -- '<5k','5-10k','10-20k','20-50k','>50k','undecided'
  message         text,
  source          text default 'public_form', -- 'public_form','discover_page','blog_post','referral'

  -- Stato workflow
  status          text not null default 'NEW' check (status in (
    'NEW','VIEWED','CONTACTED','QUOTED','CLOSED_WON','CLOSED_LOST','SPAM'
  )),
  viewed_at       timestamptz,
  contacted_at    timestamptz,
  quoted_at       timestamptz,
  closed_at       timestamptz,
  close_amount    numeric(12,2),  -- valore contratto se WON (per stat)
  close_notes     text,

  -- Billing (success fee)
  is_billable     boolean not null default false,  -- true quando CLOSED_WON
  billed_at       timestamptz,
  billed_amount   numeric(8,2),                    -- success fee charged
  billing_note    text,

  -- Anti-spam / verifica
  ip_address      inet,
  user_agent      text,
  honeypot_field  text,                            -- se popolato = bot

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_lead_wp_status   on lead_requests(wp_id, status, created_at desc);
create index if not exists idx_lead_status      on lead_requests(status);
create index if not exists idx_lead_billable    on lead_requests(is_billable, billed_at) where is_billable = true;

create trigger trg_lead_requests_updated_at before update on lead_requests
  for each row execute function set_updated_at();

-- 2) RLS
alter table lead_requests enable row level security;

-- WP/Location vedono solo i propri lead
drop policy if exists "lead_wp_owner_all" on lead_requests;
create policy "lead_wp_owner_all" on lead_requests for all using (
  wp_id = auth.uid()
) with check (
  wp_id = auth.uid()
);

drop policy if exists "lead_admin_all" on lead_requests;
create policy "lead_admin_all" on lead_requests for all
  using (is_admin()) with check (is_admin());

-- 3) RPC pubblica: submit lead (anon-safe, anti-spam basic)
create or replace function submit_lead_request(
  p_wp_slug       text,
  p_client_name   text,
  p_client_email  text,
  p_client_phone  text default null,
  p_event_kind    text default 'matrimonio',
  p_event_date    date default null,
  p_event_location text default null,
  p_guests_estimate int default null,
  p_budget_range  text default null,
  p_message       text default null,
  p_honeypot      text default null,
  p_source        text default 'public_form'
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
begin
  if p_honeypot is not null and p_honeypot <> '' then
    -- Bot detected: ritorna success fake
    return jsonb_build_object('ok', true, 'id', gen_random_uuid());
  end if;
  if p_client_name is null or trim(p_client_name) = '' then
    return jsonb_build_object('error', 'name_required');
  end if;
  if p_client_email is null or p_client_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('error', 'invalid_email');
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

-- 4) RPC: WP transition stato lead (con auto-billing su CLOSED_WON)
create or replace function lead_transition(
  p_lead_id     uuid,
  p_new_status  text,
  p_close_amount numeric default null,
  p_close_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead lead_requests%rowtype;
  v_uid uuid := auth.uid();
  v_success_fee_full numeric := 7.00;
  v_year_one_discount numeric := 0.50;  -- 50% sconto primo anno
  v_now timestamptz := now();
begin
  if v_uid is null then return jsonb_build_object('error', 'auth_required'); end if;

  select * into v_lead from lead_requests where id = p_lead_id;
  if v_lead.id is null then return jsonb_build_object('error', 'lead_not_found'); end if;
  if v_lead.wp_id <> v_uid and not is_admin() then
    return jsonb_build_object('error', 'forbidden');
  end if;

  if p_new_status not in ('NEW','VIEWED','CONTACTED','QUOTED','CLOSED_WON','CLOSED_LOST','SPAM') then
    return jsonb_build_object('error', 'invalid_status');
  end if;

  update lead_requests
     set status        = p_new_status,
         viewed_at     = case when v_lead.viewed_at is null and p_new_status <> 'NEW' then v_now else v_lead.viewed_at end,
         contacted_at  = case when p_new_status = 'CONTACTED' and v_lead.contacted_at is null then v_now else v_lead.contacted_at end,
         quoted_at     = case when p_new_status = 'QUOTED' and v_lead.quoted_at is null then v_now else v_lead.quoted_at end,
         closed_at     = case when p_new_status in ('CLOSED_WON','CLOSED_LOST') then v_now else v_lead.closed_at end,
         close_amount  = case when p_new_status = 'CLOSED_WON' then p_close_amount else v_lead.close_amount end,
         close_notes   = case when p_new_status in ('CLOSED_WON','CLOSED_LOST') then p_close_notes else v_lead.close_notes end,
         -- Success fee: solo CLOSED_WON è fatturabile
         is_billable   = case when p_new_status = 'CLOSED_WON' then true else false end,
         billed_amount = case
           when p_new_status = 'CLOSED_WON' then v_success_fee_full * (1 - v_year_one_discount)
           else v_lead.billed_amount
         end
   where id = p_lead_id;

  return jsonb_build_object('ok', true, 'status', p_new_status);
end$$;

grant execute on function lead_transition(uuid, text, numeric, text) to authenticated;

-- 5) RPC: stats lead per WP (per dashboard)
create or replace function wp_lead_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_total int;
  v_new int;
  v_contacted int;
  v_won int;
  v_lost int;
  v_total_revenue numeric;
  v_billed numeric;
  v_pending_billing numeric;
begin
  if v_uid is null then return jsonb_build_object('error', 'auth_required'); end if;

  select count(*) into v_total from lead_requests where wp_id = v_uid;
  select count(*) into v_new from lead_requests where wp_id = v_uid and status = 'NEW';
  select count(*) into v_contacted from lead_requests where wp_id = v_uid and status in ('CONTACTED','QUOTED');
  select count(*) into v_won from lead_requests where wp_id = v_uid and status = 'CLOSED_WON';
  select count(*) into v_lost from lead_requests where wp_id = v_uid and status = 'CLOSED_LOST';
  select coalesce(sum(close_amount), 0) into v_total_revenue from lead_requests where wp_id = v_uid and status = 'CLOSED_WON';
  select coalesce(sum(billed_amount), 0) into v_billed from lead_requests where wp_id = v_uid and billed_at is not null;
  select coalesce(sum(billed_amount), 0) into v_pending_billing from lead_requests where wp_id = v_uid and is_billable = true and billed_at is null;

  return jsonb_build_object(
    'total', v_total,
    'new', v_new,
    'contacted', v_contacted,
    'won', v_won,
    'lost', v_lost,
    'conversion_rate', case when v_total > 0 then round((v_won::numeric / v_total) * 100, 1) else 0 end,
    'total_revenue', v_total_revenue,
    'billed', v_billed,
    'pending_billing', v_pending_billing
  );
end$$;

grant execute on function wp_lead_stats() to authenticated;

comment on table lead_requests is
  'Lead inbound dal portale pubblico: cliente compila form su profilo WP/Location, qui arrivano. Workflow NEW→VIEWED→CONTACTED→QUOTED→CLOSED_WON/LOST. Success fee €7/lead solo su CLOSED_WON (primo anno 50% sconto = €3.50).';
