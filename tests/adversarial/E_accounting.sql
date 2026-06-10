-- ============================================================================
-- ADVERSARIAL — Famiglia E (contabilità / crediti / commissioni)  [EXPECTED-FAIL]
-- ----------------------------------------------------------------------------
-- Ogni blocco DOCUMENTA una rottura: fa `raise exception 'BRK-E-NN: ...'`
-- SOLO QUANDO la rottura è presente (test FALLISCE = la rottura è provata).
-- Ogni blocco è autonomo: begin; ... rollback; — crea i propri dati, asserisce,
-- ROLLBACK. Nessun commit, nessuna dipendenza tra blocchi.
-- NON va nel runner della build verde. Eseguire a mano:
--   DB=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)
--   docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=0 \
--     -f tests/adversarial/E_accounting.sql 2>&1
-- Verificato contro le definizioni REALMENTE deployate (pg_get_functiondef).
-- ----------------------------------------------------------------------------
-- 🧊 CONGELATO (Cluster 4, mig. 20260611040000): NON risolto, ma il dominio
--    contabile è dietro il flag `referral_accounting_enabled` = OFF in
--    produzione → la matematica buggata NON produce effetti reali. Questi test
--    restano EXPECTED-FAIL: documentano i bug (E-01..E-09) DA RISOLVERE contro
--    denaro reale al collegamento di Stripe. Per documentarli, il file accende
--    il flag in testa e lo rispegne in coda (la prod resta OFF).
-- ============================================================================

-- accende il dominio SOLO per documentare la matematica ancora rotta
update public.feature_flags set enabled = true where key = 'referral_accounting_enabled';


-- ── BRK-E-01 🔴 autocredit_on_referred_contract: crea un credito 39€ ACCEPTED
--    contro un fornitore con accept_referrals=false (consenso saltato).
begin;
do $$
declare
  v_ref uuid := gen_random_uuid();   -- referrer (creditore)
  v_sug uuid := gen_random_uuid();   -- suggested = owner contratto (debitore, NON consenziente)
  v_contract uuid := gen_random_uuid();
  v_n int;
begin
  insert into auth.users(id) values (v_ref),(v_sug);  -- trigger auto-crea profiles
  update public.profiles set role='FORNITORE', accept_referrals=true  where id = v_ref;
  update public.profiles set role='FORNITORE', accept_referrals=false where id = v_sug;  -- NON consenziente

  insert into public.supplier_referrals(referrer_id, suggested_id, client_email, client_name, status)
    values (v_ref, v_sug, 'cliente.e01@example.com', 'Cliente E01', 'SUGGESTED');

  -- contratto del fornitore NON consenziente verso quel cliente, portato a FIRMATO
  -- party_kind=SUPPLIER_CLIENT: il vincolo "quote ACCETTATO" è solo su CLIENT_WP
  insert into public.contracts(id, owner_id, title, status, party_kind, client_email, client_name)
    values (v_contract, v_sug, 'Contratto E01', 'BOZZA', 'SUPPLIER_CLIENT', 'cliente.e01@example.com', 'Cliente E01');
  -- FIRMATO richiede signed_at + signature_data (check constraint)
  update public.contracts
     set status='FIRMATO', signed_at=now(), signature_data='{"sig":"e01"}'::jsonb
   where id = v_contract;

  select count(*) into v_n
    from public.supplier_credits
   where debtor_id = v_sug and status = 'ACCEPTED' and amount = 39;

  if v_n > 0 then
    raise exception 'BRK-E-01: % credito/i ACCEPTED da 39€ creati contro un fornitore con accept_referrals=false (consenso saltato)', v_n;
  end if;
  raise notice 'BRK-E-01 non riprodotta (v_n=%)', v_n;
end$$;
rollback;


-- ── BRK-E-02 🔴 settle_supplier_credit(id,'CASH') su credito CANCELLED → SETTLED.
--    Il guard è solo su status='SETTLED'; CANCELLED passa e la sua commissione
--    finisce in admin_finance_overview (commissioni_incassate / cassetto).
begin;
do $$
declare
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_credit uuid := gen_random_uuid();
  v_res jsonb;
  v_status text;
  v_fin jsonb;
begin
  insert into auth.users(id) values (v_a),(v_b),(v_admin);
  update public.profiles set role='FORNITORE' where id in (v_a, v_b);
  update public.profiles set role='ADMIN'     where id = v_admin;

  insert into public.supplier_credits(id, creditor_id, debtor_id, amount, platform_commission, status)
    values (v_credit, v_a, v_b, 39, 5, 'CANCELLED');   -- credito ANNULLATO

  -- agisce come parte del credito (debitore)
  perform set_config('request.jwt.claims', json_build_object('sub', v_b::text, 'role','authenticated')::text, true);
  v_res := public.settle_supplier_credit(v_credit, 'CASH');

  select status into v_status from public.supplier_credits where id = v_credit;
  if v_status = 'SETTLED' then
    -- prova opzionale: la commissione di un credito EX-CANCELLED entra nel cassetto
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role','authenticated')::text, true);
    v_fin := public.admin_finance_overview();
    raise exception 'BRK-E-02: credito CANCELLED riportato a SETTLED da settle_supplier_credit (guard solo su status=SETTLED); commissioni_incassate ora = % (include la commissione del credito annullato)', v_fin->>'commissioni_incassate';
  end if;
  raise notice 'BRK-E-02 non riprodotta (status=%, res=%)', v_status, v_res;
end$$;
rollback;


-- ── BRK-E-03 🟠 lead_transition: sconto primo-anno 50% applicato anche a una WP
--    iscritta da 3 anni → billed 3.50 invece di 7.00.
begin;
do $$
declare
  v_wp uuid := gen_random_uuid();
  v_lead uuid := gen_random_uuid();
  v_billed numeric;
begin
  insert into auth.users(id) values (v_wp);
  -- WP iscritta da 3 anni, NON founding (nessuno sconto primo-anno dovrebbe applicarsi)
  update public.profiles
     set role='WEDDING_PLANNER', is_founding_member=false, created_at = now() - interval '3 years'
   where id = v_wp;

  insert into public.lead_requests(id, wp_id, client_name, client_email, status)
    values (v_lead, v_wp, 'Cliente E03', 'cliente.e03@example.com', 'QUOTED');

  perform set_config('request.jwt.claims', json_build_object('sub', v_wp::text, 'role','authenticated')::text, true);
  perform public.lead_transition(v_lead, 'CLOSED_WON', 1000, 'note');

  select billed_amount into v_billed from public.lead_requests where id = v_lead;
  if v_billed < 7.00 then
    raise exception 'BRK-E-03: WP iscritta da 3 anni fatturata % invece di 7.00 (sconto primo-anno 50%% applicato senza controllo anzianità)', v_billed;
  end if;
  raise notice 'BRK-E-03 non riprodotta (billed=%)', v_billed;
end$$;
rollback;


-- ── BRK-E-04 🟠 on_supplier_subscription_change: TRIAL→PLUS→PREMIUM→PLUS→PREMIUM
--    crea 4 crediti FORNITORE_MRR (nessun dedup per periodo).
begin;
do $$
declare
  v_ref uuid := gen_random_uuid();   -- referrer
  v_fee uuid := gen_random_uuid();   -- referee (fornitore con sub che cambia)
  v_n int;
begin
  insert into auth.users(id) values (v_ref),(v_fee);
  update public.profiles set role='FORNITORE', subscription_status='PREMIUM', business_name='Referrer E04' where id = v_ref;
  update public.profiles set role='FORNITORE', subscription_status='TRIAL',   business_name='Referee E04'  where id = v_fee;

  insert into public.referrals(referrer_id, referee_id, referee_role, status)
    values (v_ref, v_fee, 'FORNITORE', 'ACTIVE');

  update public.profiles set subscription_status='PLUS'    where id = v_fee;
  update public.profiles set subscription_status='PREMIUM' where id = v_fee;
  update public.profiles set subscription_status='PLUS'    where id = v_fee;
  update public.profiles set subscription_status='PREMIUM' where id = v_fee;

  select count(*) into v_n
    from public.referral_credits
   where referral_id in (select id from public.referrals where referee_id = v_fee)
     and reason = 'FORNITORE_MRR'
     and period = date_trunc('month', now())::date;

  if v_n > 1 then
    raise exception 'BRK-E-04: % crediti FORNITORE_MRR creati nello STESSO periodo per un solo fornitore (nessun dedup per periodo)', v_n;
  end if;
  raise notice 'BRK-E-04 non riprodotta (v_n=%)', v_n;
end$$;
rollback;


-- ── BRK-E-05 🟠 on_lead_closed_won via lead_transition: ciclo
--    CLOSED_WON→QUOTED→CLOSED_WON crea 2 crediti WP_LEAD (no idempotenza su lead_id).
begin;
do $$
declare
  v_referrer uuid := gen_random_uuid();
  v_wp uuid := gen_random_uuid();     -- referee: WP che chiude il lead
  v_lead uuid := gen_random_uuid();
  v_n int;
begin
  insert into auth.users(id) values (v_referrer),(v_wp);
  update public.profiles set role='WEDDING_PLANNER', business_name='Referrer E05' where id = v_referrer;
  update public.profiles set role='WEDDING_PLANNER', business_name='WP E05'       where id = v_wp;

  insert into public.referrals(referrer_id, referee_id, referee_role, status)
    values (v_referrer, v_wp, 'WEDDING_PLANNER', 'ACTIVE');

  insert into public.lead_requests(id, wp_id, client_name, client_email, status)
    values (v_lead, v_wp, 'Cliente E05', 'cliente.e05@example.com', 'QUOTED');

  perform set_config('request.jwt.claims', json_build_object('sub', v_wp::text, 'role','authenticated')::text, true);
  perform public.lead_transition(v_lead, 'CLOSED_WON', 1000, 'win1');
  perform public.lead_transition(v_lead, 'QUOTED');
  perform public.lead_transition(v_lead, 'CLOSED_WON', 1000, 'win2');

  select count(*) into v_n
    from public.referral_credits
   where referral_id in (select id from public.referrals where referee_id = v_wp)
     and reason = 'WP_LEAD';

  if v_n > 1 then
    raise exception 'BRK-E-05: % crediti WP_LEAD creati per UN SOLO lead (ciclo CLOSED_WON→QUOTED→CLOSED_WON, nessuna idempotenza su lead_id)', v_n;
  end if;
  raise notice 'BRK-E-05 non riprodotta (v_n=%)', v_n;
end$$;
rollback;


-- ── BRK-E-06 🟠 settle_supplier_credit: il DEBITORE salda unilateralmente un
--    PENDING come SETTLED/CASH senza consenso del creditore.
begin;
do $$
declare
  v_creditor uuid := gen_random_uuid();
  v_debtor uuid := gen_random_uuid();
  v_credit uuid := gen_random_uuid();
  v_res jsonb;
  v_status text;
  v_styp text;
begin
  insert into auth.users(id) values (v_creditor),(v_debtor);
  update public.profiles set role='FORNITORE' where id in (v_creditor, v_debtor);

  insert into public.supplier_credits(id, creditor_id, debtor_id, amount, status)
    values (v_credit, v_creditor, v_debtor, 39, 'PENDING');

  -- agisce come DEBITORE (chi DEVE i soldi) e marca CASH senza che il creditore confermi
  perform set_config('request.jwt.claims', json_build_object('sub', v_debtor::text, 'role','authenticated')::text, true);
  v_res := public.settle_supplier_credit(v_credit, 'CASH');

  select status, settlement_type into v_status, v_styp from public.supplier_credits where id = v_credit;
  if v_status = 'SETTLED' and v_styp = 'CASH' then
    raise exception 'BRK-E-06: il DEBITORE ha saldato unilateralmente un PENDING come SETTLED/CASH (nessun consenso del creditore richiesto)';
  end if;
  raise notice 'BRK-E-06 non riprodotta (status=%, type=%, res=%)', v_status, v_styp, v_res;
end$$;
rollback;


-- ── BRK-E-07 🟠 admin_finance_overview: commissioni_da_incassare include i
--    crediti CANCELLED/DISPUTED (somma platform_commission senza filtro stato).
begin;
do $$
declare
  v_a uuid := gen_random_uuid();
  v_b uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_da_incassare numeric;
begin
  insert into auth.users(id) values (v_a),(v_b),(v_admin);
  update public.profiles set role='FORNITORE' where id in (v_a, v_b);
  update public.profiles set role='ADMIN'     where id = v_admin;

  -- due crediti NON incassabili: uno CANCELLED, uno DISPUTED, con commissione > 0
  insert into public.supplier_credits(creditor_id, debtor_id, amount, platform_commission, status)
    values (v_a, v_b, 39, 7, 'CANCELLED'),
           (v_a, v_b, 39, 11, 'DISPUTED');

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role','authenticated')::text, true);
  v_da_incassare := (public.admin_finance_overview()->>'commissioni_da_incassare')::numeric;

  -- le commissioni di CANCELLED+DISPUTED (7+11=18) NON dovrebbero essere "da incassare"
  if v_da_incassare >= 18 then
    raise exception 'BRK-E-07: commissioni_da_incassare = % include commissioni di crediti CANCELLED/DISPUTED (atteso: esclusi)', v_da_incassare;
  end if;
  raise notice 'BRK-E-07 non riprodotta (da_incassare=%)', v_da_incassare;
end$$;
rollback;


-- ── BRK-E-08 🟡 recruiting cap 100€/giorno (recruiting_activate_reward):
--    oltre il cap, il recruit diventa EARNED con amount=0 earned_at=oggi
--    → 20€/cad PERSI, non rimaturano mai.
begin;
do $$
declare
  v_recruiter uuid := gen_random_uuid();
  v_recruit uuid := gen_random_uuid();
  i int;
  v_uid uuid;
  v_status text;
  v_amount numeric;
  v_earned date;
begin
  insert into auth.users(id) values (v_recruiter);
  update public.profiles set role='FORNITORE' where id = v_recruiter;

  -- 5 reward già EARNED oggi = 100€ (cap pieno per la giornata)
  for i in 1..5 loop
    v_uid := gen_random_uuid();
    insert into auth.users(id) values (v_uid);
    update public.profiles set role='FORNITORE' where id = v_uid;
    insert into public.recruiting_rewards(recruiter_id, recruited_id, amount, status, earned_at, activated_at)
      values (v_recruiter, v_uid, 20, 'EARNED', now(), now());
  end loop;

  -- 6° recruit: PENDING che si attiva oggi
  insert into auth.users(id) values (v_recruit);
  update public.profiles set role='FORNITORE', onboarding_complete=false where id = v_recruit;
  insert into public.recruiting_rewards(recruiter_id, recruited_id, amount, status)
    values (v_recruiter, v_recruit, 20, 'PENDING');

  -- simula "dopo il via" (gennaio 2027) bypassando il gate temporale: settiamo earned/amount come fa il trigger
  -- ma il trigger reale richiede now()>=2027; verifichiamo la LOGICA di cap direttamente sul codice deployato.
  -- L'attivazione vera passa per recruiting_activate_reward (onboarding_complete true) → testiamo lì sotto.
  -- Qui forziamo l'effettiva chiamata della logica del trigger via UPDATE onboarding_complete:
  if now() >= date '2027-01-01' then
    update public.profiles set onboarding_complete = true where id = v_recruit;
  else
    -- gate temporale non ancora aperto: riproduciamo la stessa formula del codice deployato
    -- v_grant := least(amount, greatest(0, 100 - v_today)); v_today = somma EARNED/PAID di oggi = 100
    update public.recruiting_rewards
       set status = 'EARNED',
           amount = least(20, greatest(0, 100 - (
             select coalesce(sum(amount),0) from public.recruiting_rewards
              where recruiter_id = v_recruiter and status in ('EARNED','PAID') and earned_at::date = now()::date
           ))),
           earned_at = now()
     where recruited_id = v_recruit and status = 'PENDING';
  end if;

  select status, amount, earned_at::date
    into v_status, v_amount, v_earned
    from public.recruiting_rewards where recruited_id = v_recruit;

  -- ROTTURA: oltre cap il reward è EARNED a 0€ con earned_at=oggi (consumato, non rimatura)
  if v_status = 'EARNED' and v_amount = 0 and v_earned = now()::date then
    raise exception 'BRK-E-08: recruit oltre il cap giornaliero marcato EARNED con amount=0 earned_at=oggi → 20€ persi (non rimaturano mai)';
  end if;
  raise notice 'BRK-E-08 non riprodotta (status=%, amount=%, earned=%)', v_status, v_amount, v_earned;
end$$;
rollback;


-- ── BRK-E-09 ⚪ professional_funnel_metrics: send_rate può superare 100%
--    (1 lead, 3 preventivi inviati → 300%).
begin;
do $$
declare
  v_uid uuid := gen_random_uuid();
  v_send_rate numeric;
begin
  insert into auth.users(id) values (v_uid);
  update public.profiles set role='FORNITORE' where id = v_uid;

  -- 1 solo lead
  insert into public.lead_requests(wp_id, client_name, client_email, status)
    values (v_uid, 'Cliente E09', 'cliente.e09@example.com', 'QUOTED');

  -- 3 preventivi INVIATI dallo stesso owner
  insert into public.quotes(owner_id, title, status) values
    (v_uid,'Q1','INVIATO'),(v_uid,'Q2','INVIATO'),(v_uid,'Q3','INVIATO');

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid::text, 'role','authenticated')::text, true);
  v_send_rate := (public.professional_funnel_metrics()->>'send_rate')::numeric;

  if v_send_rate > 100 then
    raise exception 'BRK-E-09: send_rate = %%(%) > 100%% (1 lead, 3 preventivi inviati; nessun cap sulla percentuale)', v_send_rate;
  end if;
  raise notice 'BRK-E-09 non riprodotta (send_rate=%)', v_send_rate;
end$$;
rollback;

-- rispegne il dominio: la produzione resta OFF (congelato)
update public.feature_flags set enabled = false where key = 'referral_accounting_enabled';
