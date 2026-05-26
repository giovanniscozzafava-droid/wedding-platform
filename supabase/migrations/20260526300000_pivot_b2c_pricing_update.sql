-- ============================================================================
-- PIVOT B2C — Aggiornamento modello pricing definitivo:
-- - Cliente finale: gratis sempre (è la domanda)
-- - WP/Location/Event Planner: account gratis + €7/lead (primo anno €3,50)
--   solo su CLOSED_WON. ZERO rischio: paghi solo se vendi.
-- - Fornitori: subscription mensile per essere "in pancia" dei capostipiti
--   (modello precedente confermato — Trial 90gg → Plus €29 / Premium €79)
-- - Founding member 100 WP: tariffe ridotte lifetime + bonus
-- ============================================================================

update beta_status
   set is_beta       = false,
       free_until    = null,
       planned_price = null,
       message_short = 'Account gratuito. Paghi €3,50 solo per ogni lead che concludi (primo anno; poi €7).',
       message_long  = 'Su Planfully non paghi mai un canone. Quando un cliente ti contatta via portale e tu chiudi il contratto, addebitiamo una success fee di €3,50 (primo anno di abbonamento, poi €7). Se non chiudi, non paghi. I primi 100 wedding planner / location iscritti ricevono lo status "Founding Member" con tariffe ridotte permanentemente.'
 where role = 'wedding_planner';

update beta_status
   set is_beta       = true,
       free_until    = null,
       planned_price = 29.00,
       planned_period = 'mensile',
       message_short = '90 giorni di prova gratis. Poi €29/mese (Plus) per restare nelle reti dei capostipiti.',
       message_long  = 'Per i fornitori il primo trimestre è gratuito: completa il profilo, fatti scegliere dai wedding planner, lavora ai primi eventi. Dopo: Plus €29/mese (profilo, calendario, preventivi illimitati) o Premium €79/mese (boost SEO + candidatura proattiva agli eventi pubblicati).'
 where role = 'supplier';

-- Founding Member badge: i primi 100 WP/Location ricevono uno status speciale
alter table profiles
  add column if not exists is_founding_member boolean not null default false,
  add column if not exists founding_member_at timestamptz;

-- Assegna automaticamente FOUNDING ai primi 100 WP/Location esistenti
with ranked as (
  select id, row_number() over (order by created_at asc) as rn
  from profiles
  where role in ('WEDDING_PLANNER','LOCATION')
    and deletion_requested_at is null
)
update profiles p
   set is_founding_member = true,
       founding_member_at = now()
 from ranked r
 where p.id = r.id and r.rn <= 100;

comment on column profiles.is_founding_member is
  'True per i primi 100 WP/Location iscritti. Beneficiano di success fee ridotte lifetime + badge "Founding Member" + bonus lead bonus iniziali.';

-- Adatta lead_transition per applicare sconto founding member
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
  v_wp profiles%rowtype;
  v_base_fee numeric := 7.00;
  v_year_one_discount numeric := 0.50;   -- primo anno tutti
  v_founding_discount numeric := 0.30;   -- ulteriore 30% per Founding
  v_fee numeric;
  v_now timestamptz := now();
begin
  if v_uid is null then return jsonb_build_object('error', 'auth_required'); end if;
  select * into v_lead from lead_requests where id = p_lead_id;
  if v_lead.id is null then return jsonb_build_object('error', 'lead_not_found'); end if;
  if v_lead.wp_id <> v_uid and not is_admin() then return jsonb_build_object('error', 'forbidden'); end if;
  if p_new_status not in ('NEW','VIEWED','CONTACTED','QUOTED','CLOSED_WON','CLOSED_LOST','SPAM') then
    return jsonb_build_object('error', 'invalid_status');
  end if;

  select * into v_wp from profiles where id = v_lead.wp_id;

  -- Calcolo fee: base * (1 - year_one_discount) * (1 - founding_discount se applicabile)
  v_fee := v_base_fee * (1 - v_year_one_discount);
  if v_wp.is_founding_member then
    v_fee := v_fee * (1 - v_founding_discount);
  end if;

  update lead_requests
     set status        = p_new_status,
         viewed_at     = case when v_lead.viewed_at is null and p_new_status <> 'NEW' then v_now else v_lead.viewed_at end,
         contacted_at  = case when p_new_status = 'CONTACTED' and v_lead.contacted_at is null then v_now else v_lead.contacted_at end,
         quoted_at     = case when p_new_status = 'QUOTED' and v_lead.quoted_at is null then v_now else v_lead.quoted_at end,
         closed_at     = case when p_new_status in ('CLOSED_WON','CLOSED_LOST') then v_now else v_lead.closed_at end,
         close_amount  = case when p_new_status = 'CLOSED_WON' then p_close_amount else v_lead.close_amount end,
         close_notes   = case when p_new_status in ('CLOSED_WON','CLOSED_LOST') then p_close_notes else v_lead.close_notes end,
         is_billable   = case when p_new_status = 'CLOSED_WON' then true else false end,
         billed_amount = case when p_new_status = 'CLOSED_WON' then v_fee else v_lead.billed_amount end
   where id = p_lead_id;

  return jsonb_build_object('ok', true, 'status', p_new_status, 'fee_applied', v_fee, 'founding', v_wp.is_founding_member);
end$$;
