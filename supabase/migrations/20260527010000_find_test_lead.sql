-- Verifica lead esistenti per test SES
do $$
declare
  rec_lead record;
begin
  raise notice '════ Lead esistenti nel DB ════';
  for rec_lead in
    select id::text as id_str, client_email as ce, client_name as cn, status as st, created_at as ca
      from lead_requests order by created_at desc limit 5
  loop
    raise notice 'id=% | client=% | name=% | status=%',
      rec_lead.id_str, rec_lead.ce, rec_lead.cn, rec_lead.st;
  end loop;
end $$;

-- Crea un lead dedicato al test SES con email reale utente
do $$
declare
  v_sara uuid;
  v_lead_id uuid;
begin
  select id into v_sara from auth.users where email = 'wp-mini@planfully-demo.it';

  -- Cleanup eventuali lead test SES precedenti
  delete from lead_requests where client_email = 'giovanni.scozzafava@gmail.com';

  insert into lead_requests (
    wp_id, client_name, client_email, event_kind, event_date,
    event_location, guests_estimate, budget_range, message, status, source
  ) values (
    v_sara, 'Giovanni Scozzafava', 'giovanni.scozzafava@gmail.com',
    'matrimonio', current_date + interval '180 days', 'Cosenza',
    100, '10-20k', 'Test SES delivery — questa email arriva via Amazon SES eu-west-1.',
    'NEW', 'ses_test'
  ) returning id into v_lead_id;

  raise notice '════════════════════════════════════════';
  raise notice '✓ Lead test SES creato';
  raise notice '  ID:  %', v_lead_id;
  raise notice '  WP:  Sara De Luca (%)', v_sara;
  raise notice '  client_email: giovanni.scozzafava@gmail.com';
  raise notice '════════════════════════════════════════';
end $$;
