-- Verifica E2E finale dello stato del network di Sara De Luca.
-- Read-only, stampa report completo.

do $$
declare
  v_sara uuid;
  v_sara_profile profiles%rowtype;
  v_tier jsonb;
  v_collabs int;
  v_referrals_total int;
  v_referrals_fornitore int;
  v_referrals_wp int;
  v_services int;
  v_posts_network int;
  v_credit_total bigint;
  v_credit_fornitore_mrr bigint;
  v_credit_wp_lead bigint;
  v_breakdown record;
  v_leads int;
begin
  select id into v_sara from auth.users where email = 'wp-mini@planfully-demo.it';
  if v_sara is null then
    raise notice 'Sara De Luca NON trovata. Abort.'; return;
  end if;
  select * into v_sara_profile from profiles where id = v_sara;
  v_tier := get_referral_tier(v_sara);

  -- Counts
  select count(*) into v_collabs
    from collaborations where capostipite_id = v_sara and status = 'ACTIVE';
  select count(*) into v_referrals_total
    from referrals where referrer_id = v_sara and status = 'ACTIVE';
  select count(*) into v_referrals_fornitore
    from referrals where referrer_id = v_sara and status = 'ACTIVE' and referee_role = 'FORNITORE';
  select count(*) into v_referrals_wp
    from referrals where referrer_id = v_sara and status = 'ACTIVE' and referee_role in ('WEDDING_PLANNER','LOCATION');

  select count(distinct s.id) into v_services
    from services s
    join collaborations c on c.fornitore_id = s.fornitore_id
   where c.capostipite_id = v_sara and c.status = 'ACTIVE' and s.is_active = true;

  select count(*) into v_posts_network
    from posts p
    join collaborations c on c.fornitore_id = p.author_id
   where c.capostipite_id = v_sara and c.status = 'ACTIVE' and p.visibility = 'PUBLIC';

  select coalesce(sum(amount_cents), 0) into v_credit_total
    from referral_credits where wp_id = v_sara;
  select coalesce(sum(amount_cents), 0) into v_credit_fornitore_mrr
    from referral_credits where wp_id = v_sara and reason = 'FORNITORE_MRR';
  select coalesce(sum(amount_cents), 0) into v_credit_wp_lead
    from referral_credits where wp_id = v_sara and reason = 'WP_LEAD';

  select count(*) into v_leads from lead_requests where wp_id = v_sara;

  raise notice '╔══════════════════════════════════════════════════════════╗';
  raise notice '║  REPORT E2E — SARA DE LUCA (wp-mini@planfully-demo.it)   ║';
  raise notice '╠══════════════════════════════════════════════════════════╣';
  raise notice '║  Codice referral:  %', v_sara_profile.referral_code;
  raise notice '║  Slug:             %', v_sara_profile.slug;
  raise notice '║  Founding Member:  %', v_sara_profile.is_founding_member;
  raise notice '║  Tier:             %  (% percento)', v_tier->>'tier', v_tier->>'percentage';
  raise notice '╠══════════════════════════════════════════════════════════╣';
  raise notice '║  RETE FORNITORI:';
  raise notice '║    Collaborations ACTIVE (pancia):  %', v_collabs;
  raise notice '║    Referrals FORNITORE:             %', v_referrals_fornitore;
  raise notice '║    Referrals WP/LOCATION:           %', v_referrals_wp;
  raise notice '║    Referrals TOTALI:                %', v_referrals_total;
  raise notice '╠══════════════════════════════════════════════════════════╣';
  raise notice '║  CATALOGO + FEED:';
  raise notice '║    Servizi visibili nel catalogo:   %', v_services;
  raise notice '║    Post nel feed network:           %', v_posts_network;
  raise notice '║    Lead ricevuti:                   %', v_leads;
  raise notice '╠══════════════════════════════════════════════════════════╣';
  raise notice '║  CREDIT MATURATI:';
  raise notice '║    Totale:           € %', round((v_credit_total::numeric)/100, 2);
  raise notice '║    FORNITORE_MRR:    € %', round((v_credit_fornitore_mrr::numeric)/100, 2);
  raise notice '║    WP_LEAD:          € %', round((v_credit_wp_lead::numeric)/100, 2);
  raise notice '╠══════════════════════════════════════════════════════════╣';
  raise notice '║  HEALTH CHECK:';
  if v_collabs >= v_referrals_fornitore then
    raise notice '║    ✓ Trigger referral→collab funziona';
  else
    raise notice '║    ✗ Mismatch: % collabs < % referrals fornitore', v_collabs, v_referrals_fornitore;
  end if;
  if v_services >= v_referrals_fornitore - 5 then
    raise notice '║    ✓ Servizi catalogo popolati per i fornitori';
  end if;
  raise notice '╚══════════════════════════════════════════════════════════╝';
end $$;
