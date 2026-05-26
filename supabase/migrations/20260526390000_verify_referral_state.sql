-- Read-only verify del sistema referral. Stampa report nel log, no DML.

do $$
declare
  v_sara uuid;
  v_count_referees int;
  v_count_paying int;
  v_credits_cents bigint;
  v_tier jsonb;
  v_breakdown record;
  v_real_count int;
  v_real_referee record;
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
  raise notice '  Founding member: %', v_tier->>'is_founding';
  raise notice '  Breakdown credit per reason:';
  for v_breakdown in
    select reason, sum(amount_cents) as c, count(*) as n
      from referral_credits where wp_id = v_sara
      group by reason order by c desc
  loop
    raise notice '    % :  € %  (% righe)', v_breakdown.reason, round(v_breakdown.c::numeric/100, 2), v_breakdown.n;
  end loop;

  -- Fornitori non-test (signup reali dell'utente)
  select count(*) into v_real_count
    from referrals r
    join auth.users u on u.id = r.referee_id
   where r.referrer_id = v_sara
     and u.email not like '%@planfully.test';

  if v_real_count > 0 then
    raise notice '  Referees NON-test (signup reali): %', v_real_count;
    for v_real_referee in
      select u.email as email_addr,
             p.subscription_status as sub_st,
             p.role::text as role_str,
             p.business_name as biz
        from referrals ref
        join auth.users u on u.id = ref.referee_id
        join profiles p on p.id = ref.referee_id
       where ref.referrer_id = v_sara
         and u.email not like '%@planfully.test'
    loop
      raise notice '    > % | % | % | %',
        v_real_referee.email_addr,
        v_real_referee.role_str,
        v_real_referee.sub_st,
        v_real_referee.biz;
    end loop;
  else
    raise notice '  Nessun referee reale (solo test data)';
  end if;
  raise notice '════════════════════════════════════════';
end $$;
