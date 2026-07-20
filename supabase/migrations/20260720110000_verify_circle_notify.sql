-- Verifica one-shot (net-zero): riproduce il caso Daisy con le notifiche RIPRISTINATE.
-- Impersona Giovanni (owner del cerchio) e ri-propone Daisy sull'evento Ilaria&Giuseppe,
-- poi controlla che sposi e fornitore abbiano ricevuto la notifica in-app. Rollback finale.
do $$
declare
  v_entry uuid := 'bd6ab599-04de-4b39-8f13-d12ddc1a95b1';   -- Ilaria e Giuseppe (futuro, 26/07)
  v_giovanni uuid := '1d0177ba-bfd9-4e2e-a997-7201f9273d55'; -- owner cerchio (fotografo)
  v_daisy uuid := '1d5b5670-1e36-43a5-9219-d680f01ad889';    -- Elisabetta / DaisyLab
  v_sposo uuid := 'fbb45497-a09b-42d1-a2b0-f9de795f787c';
  v_res jsonb; v_n_sposi int; v_n_daisy int;
begin
  -- conteggio notifiche PRIMA
  select count(*) into v_n_sposi from public.user_notifications where user_id = v_sposo and type = 'circle_request';
  select count(*) into v_n_daisy from public.user_notifications where user_id = v_daisy and type = 'circle_proposed';
  raise notice 'PRIMA: sposo circle_request=%, daisy circle_proposed=%', v_n_sposi, v_n_daisy;

  -- impersona Giovanni e ri-propone Daisy (kind SHARE)
  perform set_config('request.jwt.claim.sub', v_giovanni::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_giovanni, 'role','authenticated')::text, true);
  v_res := public.suggest_supplier_to_event(v_entry, v_daisy, 'SHARE');
  raise notice 'RPC: %', v_res;

  -- conteggio DOPO (in SECURITY DEFINER le notifiche sono già scritte)
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into v_n_sposi from public.user_notifications where user_id = v_sposo and type = 'circle_request';
  select count(*) into v_n_daisy from public.user_notifications where user_id = v_daisy and type = 'circle_proposed';
  raise notice 'DOPO: sposo circle_request=%, daisy circle_proposed=%', v_n_sposi, v_n_daisy;

  if v_n_sposi >= 1 and v_n_daisy >= 1 then
    raise notice 'OK  notifiche in-app ripristinate: sposi E fornitore avvisati';
  else
    raise exception 'FALLITO: notifiche mancanti (sposo=%, daisy=%)', v_n_sposi, v_n_daisy;
  end if;

  -- NET-ZERO: rimuovo le notifiche di prova create da questa verifica
  delete from public.user_notifications
   where (user_id = v_sposo and type = 'circle_request')
      or (user_id = v_daisy and type = 'circle_proposed');
  raise notice 'pulite le notifiche di prova (net-zero)';
end $$;
