-- ============================================================================
-- PROGRAMMA RECRUITING — per TUTTI i professionisti (anche fornitori)
-- ----------------------------------------------------------------------------
-- Ogni professionista ha un codice invito e può reclutare colleghi (i mesi
-- "fermi", es. inverno, diventano occasione di reddito). Ricompensa:
--   • 20€ per ogni professionista ISCRITTO e ATTIVO (= onboarding completato),
--   • fino a 100€/giorno (cap; oltre, l'eccedenza del giorno non matura).
-- Pagato SOLO se l'iscritto usa davvero la piattaforma (attivazione).
-- È un canale separato dal modello capostipite (% MRR su referred_by): qui si
-- usa `recruited_by` e il ledger `recruiting_rewards`.
-- ============================================================================

-- 1) Codice invito per TUTTI i professionisti (anche fornitori)
create or replace function assign_referral_code() returns trigger
language plpgsql as $$
begin
  if NEW.role in ('WEDDING_PLANNER','LOCATION','FORNITORE') and NEW.referral_code is null then
    NEW.referral_code := gen_referral_code();
  end if;
  return NEW;
end$$;
update profiles set referral_code = gen_referral_code()
 where referral_code is null and role in ('WEDDING_PLANNER','LOCATION','FORNITORE');

-- 2) recruited_by: chi mi ha reclutato (separato da referred_by del capostipite)
alter table profiles add column if not exists recruited_by varchar(16);
create index if not exists idx_profiles_recruited_by on profiles(recruited_by);

-- 3) Ledger ricompense recruiting
create table if not exists public.recruiting_rewards (
  id            uuid primary key default gen_random_uuid(),
  recruiter_id  uuid not null references public.profiles(id) on delete cascade,
  recruited_id  uuid not null references public.profiles(id) on delete cascade,
  amount        numeric(10,2) not null default 20,
  status        text not null default 'PENDING' check (status in ('PENDING','EARNED','PAID','VOID')),
  created_at    timestamptz not null default now(),
  earned_at     timestamptz,
  paid_at       timestamptz,
  unique (recruited_id),
  check (recruiter_id <> recruited_id)
);
create index if not exists idx_recr_rewards_recruiter on public.recruiting_rewards(recruiter_id, status);
alter table public.recruiting_rewards enable row level security;
drop policy if exists "recr_rewards_select" on public.recruiting_rewards;
create policy "recr_rewards_select" on public.recruiting_rewards
  for select using (recruiter_id = auth.uid() or is_admin());
drop policy if exists "recr_rewards_admin" on public.recruiting_rewards;
create policy "recr_rewards_admin" on public.recruiting_rewards
  for all using (is_admin()) with check (is_admin());

-- 4) Validazione codice: ora accetta anche i fornitori (recruiting aperto a tutti)
create or replace function public.invite_code_valid(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_inviter text;
begin
  if p_code is null or length(trim(p_code)) < 4 then return jsonb_build_object('valid', false); end if;
  select coalesce(business_name, full_name) into v_inviter
    from public.profiles
   where referral_code = upper(trim(p_code))
     and role in ('WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN')
   limit 1;
  if v_inviter is null then return jsonb_build_object('valid', false); end if;
  return jsonb_build_object('valid', true, 'inviter', v_inviter);
end$$;
grant execute on function public.invite_code_valid(text) to anon, authenticated;

-- 5) Attribuzione recruiting al signup (chiamata dal form dopo la registrazione)
create or replace function public.recruiting_attribute(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rec uuid; v_email text; v_phone text;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'reason', 'auth_required'); end if;
  if p_code is null or length(trim(p_code)) < 4 then return jsonb_build_object('ok', false, 'reason', 'no_code'); end if;

  select id into v_rec from public.profiles
   where referral_code = upper(trim(p_code))
     and role in ('WEDDING_PLANNER','LOCATION','FORNITORE','ADMIN') limit 1;
  if v_rec is null or v_rec = v_uid then return jsonb_build_object('ok', false, 'reason', 'invalid_code'); end if;

  update public.profiles set recruited_by = upper(trim(p_code)) where id = v_uid and recruited_by is null;

  insert into public.recruiting_rewards(recruiter_id, recruited_id)
  values (v_rec, v_uid) on conflict (recruited_id) do nothing;

  -- Marca il contatto ISCRITTO nel CRM del recruiter (match email/telefono)
  select email into v_email from auth.users where id = v_uid;
  select phone into v_phone from public.profiles where id = v_uid;
  update public.network_prospects p set status = 'ISCRITTO', registered_profile_id = v_uid
   where p.owner_id = v_rec and p.status <> 'ISCRITTO'
     and ((v_email is not null and lower(p.email) = lower(v_email))
       or (length(regexp_replace(coalesce(v_phone,''),'[^0-9]','','g')) >= 6
           and regexp_replace(coalesce(p.phone,''),'[^0-9]','','g') = regexp_replace(v_phone,'[^0-9]','','g')));

  perform public.push_user_notification(v_rec, 'PROSPECT_JOINED',
    'Un contatto si è iscritto',
    'Un professionista che hai reclutato si è registrato. Sarà premiato quando inizia a usare Planfully.',
    '/recruiting', v_uid);

  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.recruiting_attribute(text) to authenticated;

-- 6) Attivazione ricompensa quando l'iscritto diventa ATTIVO (onboarding completo)
--    Applica il cap giornaliero di 100€ per recruiter.
create or replace function public.recruiting_activate_reward()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.recruiting_rewards%rowtype; v_today numeric; v_grant numeric;
begin
  if coalesce(NEW.onboarding_complete,false) and not coalesce(OLD.onboarding_complete,false) then
    select * into r from public.recruiting_rewards where recruited_id = NEW.id and status = 'PENDING';
    if r.id is not null then
      select coalesce(sum(amount),0) into v_today from public.recruiting_rewards
        where recruiter_id = r.recruiter_id and status in ('EARNED','PAID')
          and earned_at::date = now()::date;
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
  return NEW;
end$$;
drop trigger if exists trg_recruiting_activate on public.profiles;
create trigger trg_recruiting_activate after update of onboarding_complete on public.profiles
  for each row execute function public.recruiting_activate_reward();

-- 7) Riepilogo guadagni recruiting (per la UI)
create or replace function public.my_recruiting_earnings()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  return (
    select jsonb_build_object(
      'earned_total', coalesce(sum(amount) filter (where status in ('EARNED','PAID')), 0),
      'paid_total',   coalesce(sum(amount) filter (where status = 'PAID'), 0),
      -- maturato e non ancora bonificato: è quello che conta per il payout
      'available',    coalesce(sum(amount) filter (where status = 'EARNED'), 0),
      'today',        coalesce(sum(amount) filter (where status in ('EARNED','PAID') and earned_at::date = now()::date), 0),
      'pending',      count(*) filter (where status = 'PENDING'),
      'active',       count(*) filter (where status in ('EARNED','PAID')),
      'payout_threshold', 200,
      'payout_eligible', coalesce(sum(amount) filter (where status = 'EARNED'), 0) >= 200
    )
    from public.recruiting_rewards where recruiter_id = v_uid
  );
end$$;
grant execute on function public.my_recruiting_earnings() to authenticated;

-- 8) Admin: registra il bonifico effettuato (EARNED → PAID) al raggiungimento dei 200€
create or replace function public.admin_recruiting_mark_paid(p_recruiter uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_n int;
begin
  if not public.is_admin() then return jsonb_build_object('error','forbidden'); end if;
  update public.recruiting_rewards set status = 'PAID', paid_at = now()
   where recruiter_id = p_recruiter and status = 'EARNED';
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'marked', v_n);
end$$;
grant execute on function public.admin_recruiting_mark_paid(uuid) to authenticated;

comment on table public.recruiting_rewards is
  'Ricompense recruiting: 20€ per professionista iscritto e attivo (onboarding completo), cap 100€/giorno per recruiter. Aperto a tutti i professionisti.';
