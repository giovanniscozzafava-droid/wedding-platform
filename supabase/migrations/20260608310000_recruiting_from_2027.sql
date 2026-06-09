-- ============================================================================
-- Il programma recruiting matura SOLO dal 1° gennaio 2027 — quando i fornitori
-- iniziano a pagare (gratis fino al 31/12/2026). Durante la beta si può già
-- reclutare: i premi restano in attesa (PENDING) e maturano dall'avvio.
-- ============================================================================
alter table public.recruiting_rewards add column if not exists activated_at timestamptz;

-- Trigger: alla "attivazione" del reclutato (onboarding completo) segna sempre
-- activated_at; matura (EARNED) solo se siamo già nel 2027, con cap 100€/giorno.
create or replace function public.recruiting_activate_reward()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.recruiting_rewards%rowtype; v_today numeric; v_grant numeric;
begin
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
          perform public.push_user_notification(r.recruiter_id, 'RECRUIT_EARNED',
            'Hai guadagnato dal recruiting',
            '+' || trim(to_char(v_grant,'FM999990')) || '€: un professionista che hai portato è ora attivo su Planfully.',
            '/recruiting', r.id);
        end if;
      end if;
    end if;
  end if;
  return NEW;
end$$;

-- Dal 2027: matura i premi già attivi rimasti in attesa (idempotente, cap giornaliero).
-- Chiamata pigra dalla pagina /recruiting (e dall'admin) → non serve un cron.
create or replace function public.recruiting_settle_due()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_admin boolean; r record; v_today numeric; v_grant numeric; v_n int := 0;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if now() < date '2027-01-01' then return jsonb_build_object('ok', false, 'reason', 'not_started'); end if;
  v_admin := public.is_admin();
  for r in select * from public.recruiting_rewards
            where status = 'PENDING' and activated_at is not null
              and (v_admin or recruiter_id = v_uid)
            order by activated_at
  loop
    select coalesce(sum(amount),0) into v_today from public.recruiting_rewards
      where recruiter_id = r.recruiter_id and status in ('EARNED','PAID') and earned_at::date = now()::date;
    v_grant := least(r.amount, greatest(0, 100 - v_today));
    update public.recruiting_rewards set status = 'EARNED', amount = v_grant, earned_at = now() where id = r.id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'settled', v_n);
end$$;
grant execute on function public.recruiting_settle_due() to authenticated;

-- Riepilogo: aggiunge stato del programma (attivo dal 2027).
create or replace function public.my_recruiting_earnings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  return (
    select jsonb_build_object(
      'earned_total', coalesce(sum(amount) filter (where status in ('EARNED','PAID')), 0),
      'paid_total',   coalesce(sum(amount) filter (where status = 'PAID'), 0),
      'available',    coalesce(sum(amount) filter (where status = 'EARNED'), 0),
      'today',        coalesce(sum(amount) filter (where status in ('EARNED','PAID') and earned_at::date = now()::date), 0),
      'pending',      count(*) filter (where status = 'PENDING'),
      'waiting',      count(*) filter (where status = 'PENDING' and activated_at is not null),
      'active',       count(*) filter (where status in ('EARNED','PAID')),
      'payout_threshold', 200,
      'payout_eligible', coalesce(sum(amount) filter (where status = 'EARNED'), 0) >= 200,
      'program_start', '2027-01-01',
      'program_active', (now() >= date '2027-01-01')
    )
    from public.recruiting_rewards where recruiter_id = v_uid
  );
end$$;
grant execute on function public.my_recruiting_earnings() to authenticated;
