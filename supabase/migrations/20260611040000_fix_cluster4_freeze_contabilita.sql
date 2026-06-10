-- ============================================================================
-- CLUSTER 4 — "Contabilità: CONGELARE, non aggiustare"
-- Decisione: NON si patcha la matematica dei soldi finché Stripe non incassa.
-- Si SPEGNE la superficie: il dominio referral/MRR/commissioni/recruiting è
-- dietro un feature flag OFF; le funzioni che coniano/saldano crediti diventano
-- NO-OP finché il flag è spento. I bug BRK-E-* restano documentati (expected-fail)
-- come "da risolvere contro denaro reale al collegamento di Stripe".
-- ============================================================================

insert into public.feature_flags(key, enabled, description)
values ('referral_accounting_enabled', false,
        'Dominio contabile referral/MRR/commissioni/recruiting. OFF finché Stripe non incassa: la matematica dei crediti ha bug noti (BRK-E-*) da sistemare contro denaro reale.')
on conflict (key) do update set enabled = false, description = excluded.description;

-- ── Trigger conia-crediti: NO-OP a flag spento ──────────────────────────────
create or replace function public.autocredit_on_referred_contract()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare r record; v_credit uuid; v_amt numeric := 39; v_first boolean := true;
begin
  if not public.feature_enabled('referral_accounting_enabled') then return new; end if;  -- CONGELATO
  if new.status = 'FIRMATO' and (old.status is distinct from 'FIRMATO') and new.client_email is not null then
    for r in
      select * from public.supplier_referrals
       where suggested_id = new.owner_id and lower(client_email) = lower(new.client_email) and status = 'SUGGESTED'
       order by created_at asc
    loop
      if v_first then
        insert into public.supplier_credits(creditor_id, debtor_id, amount, platform_commission, reason, event_kind, client_label, created_by, status)
        values (r.referrer_id, new.owner_id, v_amt, public.referral_commission_for(v_amt),
                'Segnalazione convertita in contratto', coalesce(new.event_kind, r.event_kind), coalesce(new.client_name, r.client_name), r.referrer_id, 'ACCEPTED')
        returning id into v_credit;
        update public.supplier_referrals set status='CONVERTED', credit_id=v_credit, contract_id=new.id, converted_at=now() where id = r.id;
        perform public.push_user_notification(r.referrer_id, 'CREDIT_AUTO', 'Segnalazione andata a buon fine',
          'Un cliente che hai segnalato ha firmato un contratto: +39€ di credito', '/crediti', v_credit);
        v_first := false;
      else
        update public.supplier_referrals set status='CONVERTED', contract_id=new.id, converted_at=now() where id = r.id;
      end if;
    end loop;
  end if;
  return new;
end$function$;

create or replace function public.on_supplier_subscription_change()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_referral referrals%rowtype; v_tier jsonb; v_pct numeric; v_amount int; v_base_mrr int;
begin
  if not public.feature_enabled('referral_accounting_enabled') then return new; end if;  -- CONGELATO
  if NEW.subscription_status not in ('PLUS','PREMIUM') then return NEW; end if;
  if OLD.subscription_status = NEW.subscription_status then return NEW; end if;
  select * into v_referral from referrals where referee_id = NEW.id and status = 'ACTIVE';
  if v_referral.id is null then return NEW; end if;
  v_tier := get_referral_tier(v_referral.referrer_id);
  v_pct := (v_tier->>'percentage')::numeric;
  v_base_mrr := case NEW.subscription_status when 'PREMIUM' then 7900 when 'PLUS' then 2900 else 0 end;
  v_amount := (v_base_mrr * v_pct / 100)::int;
  if v_amount > 0 then
    insert into referral_credits (wp_id, referral_id, amount_cents, period, reason, description)
    values (v_referral.referrer_id, v_referral.id, v_amount, date_trunc('month', now())::date, 'FORNITORE_MRR',
      format('%s %% MRR mese - %s (%s)', v_pct, NEW.business_name, NEW.subscription_status));
  end if;
  return NEW;
end$function$;

create or replace function public.on_lead_closed_won()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_referral referrals%rowtype; v_amount int; v_pct numeric := 10;
begin
  if not public.feature_enabled('referral_accounting_enabled') then return new; end if;  -- CONGELATO
  if NEW.status <> 'CLOSED_WON' or OLD.status = 'CLOSED_WON' then return NEW; end if;
  if NEW.billed_amount is null or NEW.billed_amount <= 0 then return NEW; end if;
  select * into v_referral from referrals
   where referee_id = NEW.wp_id and status = 'ACTIVE' and referee_role in ('WEDDING_PLANNER','LOCATION');
  if v_referral.id is null then return NEW; end if;
  v_amount := round(NEW.billed_amount * 100 * v_pct / 100)::int;
  if v_amount <= 0 then return NEW; end if;
  insert into referral_credits (wp_id, referral_id, amount_cents, period, reason, description)
  values (v_referral.referrer_id, v_referral.id, v_amount, date_trunc('month', now())::date, 'WP_LEAD',
    format('%s %% lead chiuso da WP %s', v_pct, (select business_name from profiles where id = NEW.wp_id)));
  return NEW;
end$function$;

create or replace function public.recruiting_activate_reward()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare r public.recruiting_rewards%rowtype; v_today numeric; v_grant numeric;
begin
  if not public.feature_enabled('referral_accounting_enabled') then return new; end if;  -- CONGELATO
  if coalesce(NEW.onboarding_complete,false) and not coalesce(OLD.onboarding_complete,false) then
    select * into r from public.recruiting_rewards where recruited_id = NEW.id and status = 'PENDING';
    if r.id is not null then
      update public.recruiting_rewards set activated_at = coalesce(activated_at, now()) where id = r.id;
      if now() >= date '2027-01-01' then
        select coalesce(sum(amount),0) into v_today from public.recruiting_rewards
          where recruiter_id = r.recruiter_id and status in ('EARNED','PAID') and earned_at::date = now()::date;
        v_grant := least(r.amount, greatest(0, 100 - v_today));
        update public.recruiting_rewards set status = 'EARNED', amount = v_grant, earned_at = now() where id = r.id;
        if v_grant > 0 then
          perform public.push_user_notification(r.recruiter_id, 'RECRUIT_EARNED', 'Hai guadagnato dal recruiting',
            '+' || trim(to_char(v_grant,'FM999990')) || '€: un professionista che hai portato è ora attivo su Planfully.', '/recruiting', r.id);
        end if;
      end if;
    end if;
  end if;
  return NEW;
end$function$;

-- ── RPC di saldo/liquidazione: 'disabled' a flag spento ─────────────────────
create or replace function public.recruiting_settle_due()
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_admin boolean; r record; v_today numeric; v_grant numeric; v_n int := 0;
begin
  if not public.feature_enabled('referral_accounting_enabled') then return jsonb_build_object('ok', false, 'reason', 'disabled'); end if;
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if now() < date '2027-01-01' then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  v_admin := public.is_admin();
  for r in select * from public.recruiting_rewards
            where status = 'PENDING' and activated_at is not null and (v_admin or recruiter_id = v_uid)
            order by activated_at
  loop
    select coalesce(sum(amount),0) into v_today from public.recruiting_rewards
      where recruiter_id = r.recruiter_id and status in ('EARNED','PAID') and earned_at::date = now()::date;
    v_grant := least(r.amount, greatest(0, 100 - v_today));
    update public.recruiting_rewards set status = 'EARNED', amount = v_grant, earned_at = now() where id = r.id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'settled', v_n);
end$function$;

create or replace function public.settle_supplier_credit(p_id uuid, p_type text, p_offset_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_uid uuid := auth.uid(); v_c public.supplier_credits%rowtype; v_o public.supplier_credits%rowtype;
begin
  if not public.feature_enabled('referral_accounting_enabled') then return jsonb_build_object('error','disabled'); end if;
  if p_type not in ('CASH','RECIPROCAL') then return jsonb_build_object('error','invalid_type'); end if;
  select * into v_c from public.supplier_credits where id = p_id;
  if v_c.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_c.status = 'SETTLED' then return jsonb_build_object('error','already_settled'); end if;
  if v_uid not in (v_c.creditor_id, v_c.debtor_id) and not public.is_admin() then return jsonb_build_object('error','not_party'); end if;
  if p_type = 'RECIPROCAL' and p_offset_id is not null then
    select * into v_o from public.supplier_credits where id = p_offset_id;
    if v_o.id is null or v_o.creditor_id <> v_c.debtor_id or v_o.debtor_id <> v_c.creditor_id then return jsonb_build_object('error','invalid_offset'); end if;
    if v_o.status in ('SETTLED','CANCELLED') then return jsonb_build_object('error','offset_not_open'); end if;
    if v_o.amount <> v_c.amount then return jsonb_build_object('error','offset_amount_mismatch'); end if;
    update public.supplier_credits set status='SETTLED', settlement_type='RECIPROCAL', offset_credit_id = p_offset_id, settled_at = now() where id = p_id;
    update public.supplier_credits set status='SETTLED', settlement_type='RECIPROCAL', offset_credit_id = p_id, settled_at = now() where id = p_offset_id;
  else
    update public.supplier_credits set status='SETTLED', settlement_type = p_type, settled_at = now() where id = p_id;
  end if;
  perform public.push_user_notification(case when v_uid = v_c.debtor_id then v_c.creditor_id else v_c.debtor_id end,
    'CREDIT_SETTLED', 'Credito saldato', 'Un credito tra colleghi è stato segnato come saldato (' || p_type || ')', '/crediti', p_id);
  return jsonb_build_object('ok', true);
end$function$;
