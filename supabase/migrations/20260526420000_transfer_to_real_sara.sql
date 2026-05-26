-- Transfer referrals + credits dal "demo@planfully.it" (Demo Planner, primo WP)
-- a Sara De Luca (wp-mini@planfully-demo.it), il vero account capostipite test.

do $$
declare
  v_sara uuid;
  v_old uuid;
begin
  select id into v_sara from auth.users where email = 'wp-mini@planfully-demo.it';
  if v_sara is null then
    raise notice 'Sara NON trovata. Abort.';
    return;
  end if;

  select referrer_id into v_old from referrals
   where code_used = 'TEST-SEED' and referrer_id <> v_sara
   group by referrer_id order by count(*) desc limit 1;

  if v_old is null then
    raise notice 'Nessun referral da trasferire (forse già fatto)';
    return;
  end if;

  raise notice 'Trasferimento da % a Sara (%)', v_old, v_sara;

  update referrals set referrer_id = v_sara
   where referrer_id = v_old and code_used = 'TEST-SEED';

  update referral_credits set wp_id = v_sara
   where wp_id = v_old
     and referral_id in (select id from referrals where referrer_id = v_sara);

  raise notice '✓ Transfer completo';
end $$;

-- Report Sara
do $$
declare
  v_sara uuid;
  v_count_referees int;
  v_count_paying int;
  v_credits_cents bigint;
  v_tier jsonb;
begin
  select id into v_sara from auth.users where email = 'wp-mini@planfully-demo.it';
  v_tier := get_referral_tier(v_sara);
  select count(*) into v_count_referees from referrals where referrer_id = v_sara and status = 'ACTIVE';
  select count(*) into v_count_paying from referrals ref
    join profiles p on p.id = ref.referee_id
    where ref.referrer_id = v_sara
      and ref.referee_role = 'FORNITORE'
      and p.subscription_status in ('PLUS','PREMIUM');
  select coalesce(sum(amount_cents), 0) into v_credits_cents
    from referral_credits where wp_id = v_sara and status in ('APPROVED','PAID');

  raise notice '════════════════════════════════════════';
  raise notice 'SARA DE LUCA — wp-mini@planfully-demo.it';
  raise notice '  Referees totali: %', v_count_referees;
  raise notice '  Paganti: %', v_count_paying;
  raise notice '  Tier: % (% percento)', v_tier->>'tier', v_tier->>'percentage';
  raise notice '  Credit: € %', round((v_credits_cents::numeric)/100, 2);
  raise notice '════════════════════════════════════════';
end $$;
