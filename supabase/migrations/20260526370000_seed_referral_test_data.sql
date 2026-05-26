-- ============================================================================
-- SEED TEST referral tier system
-- Crea 12 fornitori (mix PLUS/PREMIUM) + 3 WP, tutti referred da Sara De Luca.
-- Verifica trigger credit FORNITORE_MRR + WP_LEAD funzionino correttamente.
-- Tutto idempotente: cleanup + reseed.
-- Account test riconoscibili da prefix email '@planfully.test'
-- ============================================================================

do $$
declare
  v_sara uuid;
  v_sara_founding boolean;
  v_uid uuid;
  v_email text;
  v_subrole text;
  v_subscription text;
  v_business text;
  v_city text;
  v_tier text;
  i int;
  v_lead_id uuid;
begin
  -- 1) CLEANUP: rimuovi seed esistenti per re-run pulito
  delete from auth.users where email like '%@planfully.test';
  -- (cascade su profiles + referrals + referral_credits via FK)

  -- 2) Trova Sara De Luca (primo WP)
  select id, coalesce(is_founding_member, false)
    into v_sara, v_sara_founding
    from profiles
   where role = 'WEDDING_PLANNER' and deletion_requested_at is null
   order by created_at asc limit 1;

  if v_sara is null then
    raise notice 'Nessun WP trovato — abort seed';
    return;
  end if;

  v_tier := case when v_sara_founding then 'ARGENTO' else 'BRONZO' end;

  raise notice 'Sara id: %, founding: %, tier iniziale: %', v_sara, v_sara_founding, v_tier;

  -- 3) Crea 12 fornitori paganti (5 PREMIUM + 7 PLUS)
  for i in 1..12 loop
    v_uid := gen_random_uuid();
    v_email := format('test-fornitore-%s@planfully.test', i);
    v_subrole := case (i % 7)
                  when 0 then 'fotografo' when 1 then 'fioraio' when 2 then 'catering'
                  when 3 then 'musica' when 4 then 'allestimenti' when 5 then 'pasticcere'
                  else 'make_up' end;
    v_subscription := case when i <= 5 then 'PREMIUM' else 'PLUS' end;
    v_business := format('Studio %s Test %s',
      initcap(v_subrole), i);
    v_city := case (i % 4) when 0 then 'Cosenza' when 1 then 'Milano'
                            when 2 then 'Roma' else 'Palermo' end;

    -- 3a) Insert auth.users (password fissa per test)
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated',
      v_email, extensions.crypt('test-password-2026', extensions.gen_salt('bf')),
      now() - interval '7 days',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'role', 'FORNITORE',
        'subrole', v_subrole,
        'full_name', format('Test Fornitore %s', i),
        'business_name', v_business
      ),
      now() - interval '7 days',
      now(),
      now() - interval '1 day'
    );
    -- Il trigger handle_new_auth_user crea automaticamente la riga profiles

    -- 3b) Arricchisci profilo (city, slug, tagline, discoverable)
    update profiles set
      business_name = v_business,
      city = v_city,
      tagline = format('Test fornitore %s — %s', v_subrole, i),
      is_discoverable = true,
      slug = format('test-%s-%s', v_subrole, substring(v_uid::text, 1, 6))
    where id = v_uid;

    -- 3c) Crea referral PRIMA dell'upgrade subscription (così il trigger scatta col referral attivo)
    insert into referrals (referrer_id, referee_id, referee_role, code_used, source, tier_at_creation)
    values (v_sara, v_uid, 'FORNITORE', 'TEST-SEED', 'demo_seed', v_tier);

    -- 3d) Promozione a PAGANTE → trigger on_supplier_subscription_change crea il credit
    update profiles set subscription_status = v_subscription
     where id = v_uid;
  end loop;

  raise notice '✓ 12 fornitori paganti creati e referred a Sara';

  -- 4) Crea 3 WP test referred da Sara (per testare WP→WP referral)
  for i in 1..3 loop
    v_uid := gen_random_uuid();
    v_email := format('test-wp-%s@planfully.test', i);
    v_business := format('Wedding Studio Test %s', i);
    v_city := case i when 1 then 'Cosenza' when 2 then 'Napoli' else 'Bari' end;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, last_sign_in_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_uid, 'authenticated', 'authenticated',
      v_email, extensions.crypt('test-password-2026', extensions.gen_salt('bf')),
      now() - interval '3 days',
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object(
        'role', 'WEDDING_PLANNER',
        'full_name', format('Test WP %s', i),
        'business_name', v_business
      ),
      now() - interval '3 days',
      now(),
      now()
    );

    update profiles set
      business_name = v_business,
      city = v_city,
      tagline = format('Wedding Planner test #%s', i),
      is_discoverable = true,
      slug = format('test-wp-%s-%s', i, substring(v_uid::text, 1, 6))
    where id = v_uid;

    insert into referrals (referrer_id, referee_id, referee_role, code_used, source, tier_at_creation)
    values (v_sara, v_uid, 'WEDDING_PLANNER', 'TEST-SEED', 'demo_seed', v_tier);
  end loop;

  raise notice '✓ 3 WP test creati e referred a Sara';

  -- 5) Simula 1 lead CLOSED_WON da una WP referred → trigger genera 10% credit per Sara
  -- Prendi il primo WP test creato
  select id into v_uid from profiles where business_name = 'Wedding Studio Test 1';

  insert into lead_requests (
    wp_id, client_name, client_email, event_kind, event_date,
    event_location, guests_estimate, budget_range, message,
    status, close_amount, billed_amount, is_billable, closed_at
  ) values (
    v_uid, 'Cliente Test', 'cliente.test@example.com', 'matrimonio',
    current_date + interval '180 days', 'Tropea', 120, '20-50k',
    'Lead test per verifica trigger referral',
    'CLOSED_WON', 18500.00, 3.50, true, now()
  )
  returning id into v_lead_id;

  raise notice '✓ Lead CLOSED_WON test creato (id %): trigger dovrebbe aver dato 0.35€ a Sara', v_lead_id;
end $$;

-- 6) Report finale: cosa è in DB
do $$
declare
  v_sara uuid;
  v_count_referees int;
  v_count_paying int;
  v_credits_cents bigint;
  v_tier jsonb;
begin
  select id into v_sara from profiles where role = 'WEDDING_PLANNER' order by created_at asc limit 1;

  select count(*) into v_count_referees from referrals where referrer_id = v_sara and status = 'ACTIVE';
  select count(*) into v_count_paying from referrals r
    join profiles p on p.id = r.referee_id
    where r.referrer_id = v_sara
      and ((r.referee_role = 'FORNITORE' and p.subscription_status in ('PLUS','PREMIUM'))
        or r.referee_role in ('WEDDING_PLANNER','LOCATION'));

  select sum(amount_cents) into v_credits_cents
    from referral_credits where wp_id = v_sara and status in ('APPROVED','PAID');

  v_tier := get_referral_tier(v_sara);

  raise notice '════════════════════════════════════';
  raise notice 'REPORT SEED:';
  raise notice '  Referees totali Sara: %', v_count_referees;
  raise notice '  Di cui paganti attivi: %', v_count_paying;
  raise notice '  Credit maturati: € %', round((coalesce(v_credits_cents,0)::numeric)/100, 2);
  raise notice '  Tier corrente: % (% percento)', v_tier->>'tier', v_tier->>'percentage';
  raise notice '════════════════════════════════════';
end $$;
