-- ============================================================================
-- FIX: il seed precedente ha attribuito i referees al PRIMO WP creato,
-- ma Sara De Luca è wp-mini@planfully.it. Migriamo tutto a lei.
-- ============================================================================

do $$
declare
  v_sara uuid;
  v_old_owner uuid;
begin
  select id into v_sara from auth.users where email = 'wp-mini@planfully.it';
  if v_sara is null then
    raise notice 'Sara De Luca (wp-mini@planfully.it) NON trovata. Abort.';
    return;
  end if;

  -- Garantiamo che Sara sia Founding Member (per tier Argento di partenza)
  update profiles set is_founding_member = true,
                      founding_member_at = coalesce(founding_member_at, now())
   where id = v_sara;

  -- Trasferisci TUTTI i referrals con codice TEST-SEED al Sara giusto
  select referrer_id into v_old_owner
    from referrals where code_used = 'TEST-SEED'
    group by referrer_id order by count(*) desc limit 1;

  if v_old_owner is not null and v_old_owner <> v_sara then
    raise notice 'Trasferimento da % a Sara (%)', v_old_owner, v_sara;
    update referrals set referrer_id = v_sara
     where referrer_id = v_old_owner and code_used = 'TEST-SEED';
    update referral_credits set wp_id = v_sara
     where wp_id = v_old_owner;
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
  select id into v_sara from auth.users where email = 'wp-mini@planfully.it';
  if v_sara is null then return; end if;

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
  raise notice 'SARA DE LUCA (wp-mini@planfully.it)';
  raise notice '  Referees totali: %', v_count_referees;
  raise notice '  Fornitori paganti: %', v_count_paying;
  raise notice '  Tier: % (% percento)', v_tier->>'tier', v_tier->>'percentage';
  raise notice '  Credit totale: € %', round((v_credits_cents::numeric)/100, 2);
  raise notice '  Founding: %', v_tier->>'is_founding';
  for v_breakdown in
    select reason, sum(amount_cents) as c, count(*) as n
      from referral_credits where wp_id = v_sara
      group by reason order by c desc
  loop
    raise notice '    % :  € %  (% righe)', v_breakdown.reason, round(v_breakdown.c::numeric/100, 2), v_breakdown.n;
  end loop;
  raise notice '════════════════════════════════════════';
end $$;
