-- ============================================================================
-- TEST SEED tier ORO: aggiunge altri 20 fornitori paganti per superare la
-- soglia di 30+ (tier ORO 25%). Inoltre fa transition lead via UPDATE per
-- testare il trigger on_lead_closed_won correttamente.
-- ============================================================================

do $$
declare
  v_sara uuid;
  v_uid uuid;
  v_email text;
  v_subrole text;
  v_subscription text;
  v_business text;
  v_city text;
  v_tier text;
  v_lead_id uuid;
  v_wp_test uuid;
  i int;
begin
  select id into v_sara from profiles where role = 'WEDDING_PLANNER' order by created_at asc limit 1;
  v_tier := case when (select is_founding_member from profiles where id = v_sara) then 'ARGENTO' else 'BRONZO' end;

  -- Crea 20 fornitori aggiuntivi (mix PLUS / PREMIUM)
  for i in 13..32 loop
    v_uid := gen_random_uuid();
    v_email := format('test-fornitore-%s@planfully.test', i);

    -- Skip se già esiste
    if exists (select 1 from auth.users where email = v_email) then continue; end if;

    v_subrole := case (i % 8)
                  when 0 then 'photobooth' when 1 then 'estetista' when 2 then 'maitre'
                  when 3 then 'chef' when 4 then 'sommelier' when 5 then 'food_truck'
                  when 6 then 'sweet_table' else 'bartender' end;
    v_subscription := case when i % 3 = 0 then 'PREMIUM' else 'PLUS' end;
    v_business := format('Studio %s Test %s', initcap(v_subrole), i);
    v_city := case (i % 5) when 0 then 'Cosenza' when 1 then 'Milano'
                            when 2 then 'Roma' when 3 then 'Firenze' else 'Napoli' end;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated',
      v_email,
      extensions.crypt('test-password-2026', extensions.gen_salt('bf')),
      now() - interval '5 days',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'role', 'FORNITORE',
        'subrole', v_subrole,
        'full_name', format('Test Fornitore %s', i),
        'business_name', v_business
      ),
      now() - interval '5 days', now(), now() - interval '1 day'
    );

    update profiles set
      business_name = v_business,
      city = v_city,
      tagline = format('%s test #%s', v_subrole, i),
      is_discoverable = true,
      slug = format('test-%s-%s', v_subrole, substring(v_uid::text, 1, 6))
    where id = v_uid;

    insert into referrals (referrer_id, referee_id, referee_role, code_used, source, tier_at_creation)
    values (v_sara, v_uid, 'FORNITORE', 'TEST-SEED', 'demo_seed', v_tier)
    on conflict (referee_id) do nothing;

    update profiles set subscription_status = v_subscription where id = v_uid;
  end loop;

  raise notice '✓ 20 fornitori aggiuntivi creati e marcati paganti';

  -- 2) Test lead UPDATE-driven (il trigger ascolta UPDATE, non INSERT)
  select id into v_wp_test from profiles where business_name = 'Wedding Studio Test 1' limit 1;

  if v_wp_test is not null then
    -- Trova lead esistente o creane uno nuovo in stato QUOTED
    select id into v_lead_id from lead_requests
     where wp_id = v_wp_test and client_email = 'cliente.test.update@example.com'
     limit 1;

    if v_lead_id is null then
      insert into lead_requests (
        wp_id, client_name, client_email, event_kind, event_date,
        event_location, guests_estimate, budget_range, status
      ) values (
        v_wp_test, 'Cliente Update Test', 'cliente.test.update@example.com',
        'matrimonio', current_date + interval '90 days', 'Milano', 150, '20-50k', 'QUOTED'
      ) returning id into v_lead_id;
    end if;

    -- UPDATE → trigger on_lead_closed_won scatta
    update lead_requests
       set status = 'CLOSED_WON',
           is_billable = true,
           billed_amount = 3.50,
           close_amount = 22000,
           closed_at = now()
     where id = v_lead_id;

    raise notice '✓ Lead UPDATE → CLOSED_WON applicato (id %)', v_lead_id;
  end if;
end $$;

-- Report finale
do $$
declare
  v_sara uuid;
  v_count_referees int;
  v_count_paying int;
  v_credits_cents bigint;
  v_tier jsonb;
  v_breakdown record;
begin
  select id into v_sara from profiles where role = 'WEDDING_PLANNER' order by created_at asc limit 1;
  v_tier := get_referral_tier(v_sara);

  select count(*) into v_count_referees from referrals where referrer_id = v_sara and status = 'ACTIVE';
  select count(*) into v_count_paying from referrals r
    join profiles p on p.id = r.referee_id
    where r.referrer_id = v_sara
      and r.referee_role = 'FORNITORE'
      and p.subscription_status in ('PLUS','PREMIUM');
  select coalesce(sum(amount_cents), 0) into v_credits_cents
    from referral_credits where wp_id = v_sara and status in ('APPROVED','PAID');

  raise notice '════════════════════════════════════════';
  raise notice 'REPORT FINALE SARA DE LUCA';
  raise notice '  Referees totali: %', v_count_referees;
  raise notice '  Fornitori paganti: %', v_count_paying;
  raise notice '  Tier: % (% percento)', v_tier->>'tier', v_tier->>'percentage';
  raise notice '  Credit totale: € %', round((v_credits_cents::numeric)/100, 2);
  raise notice '  Breakdown per reason:';
  for v_breakdown in
    select reason, sum(amount_cents) as c, count(*) as n
      from referral_credits where wp_id = v_sara
      group by reason order by c desc
  loop
    raise notice '    % :  € %  (% righe)', v_breakdown.reason, round(v_breakdown.c::numeric/100, 2), v_breakdown.n;
  end loop;
  raise notice '════════════════════════════════════════';
end $$;

-- (verifica fornitori reali rimossa per bug pl/pgsql — gestita in migration 390000)
