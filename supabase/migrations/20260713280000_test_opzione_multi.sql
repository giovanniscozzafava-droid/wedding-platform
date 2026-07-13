-- TEST END-TO-END opzione MULTI-CLIENTE + priorità + "primo che firma vince" (self-cleaning).
do $$
declare
  v_owner uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27';  -- La Baronella
  v_date  date := '2031-07-19';
  v_e1 uuid; v_e2 uuid; v_q1 uuid; v_q2 uuid; v_t1 uuid := gen_random_uuid(); v_t2 uuid := gen_random_uuid();
  v_r1 jsonb; v_r2 jsonb; v_s1 text; v_s2 text; v_req2 text; v_req1 text;
begin
  if not exists (select 1 from public.profiles where id = v_owner) then raise notice 'TEST SALTATO: no Baronella'; return; end if;

  -- due clienti, due eventi, STESSA data, opzione abilitata
  insert into public.calendar_entries(owner_id, title, date_from, date_to, status) values (v_owner,'TEST MULTI A',v_date,v_date,'IN_TRATTATIVA') returning id into v_e1;
  insert into public.quotes(owner_id, title, event_date, access_token, option_allowed, option_days) values (v_owner,'TEST MULTI A',v_date,v_t1,true,15) returning id into v_q1;
  update public.calendar_entries set quote_id=v_q1 where id=v_e1;
  insert into public.calendar_entries(owner_id, title, date_from, date_to, status) values (v_owner,'TEST MULTI B',v_date,v_date,'IN_TRATTATIVA') returning id into v_e2;
  insert into public.quotes(owner_id, title, event_date, access_token, option_allowed, option_days) values (v_owner,'TEST MULTI B',v_date,v_t2,true,15) returning id into v_q2;
  update public.calendar_entries set quote_id=v_q2 where id=v_e2;

  -- 1) entrambi opzionano la STESSA data → devono riuscire entrambi (multi), con priorità
  v_r1 := public.richiedi_opzione_da_preventivo(v_t1::text);
  v_r2 := public.richiedi_opzione_da_preventivo(v_t2::text);
  if not coalesce((v_r1->>'ok')::boolean,false) then raise exception 'FALLITO opzione 1: %', v_r1; end if;
  if not coalesce((v_r2->>'ok')::boolean,false) then raise exception 'FALLITO opzione 2 (multi non permesso?): %', v_r2; end if;
  if (v_r1->>'posizione')::int <> 1 then raise exception 'FALLITO: posizione1 attesa 1, %', v_r1->>'posizione'; end if;
  if (v_r2->>'posizione')::int <> 2 or not (v_r2->>'contesa')::boolean then raise exception 'FALLITO: posizione2 attesa 2/contesa, %', v_r2; end if;

  select status into v_s1 from public.calendar_entries where id=v_e1;
  select status into v_s2 from public.calendar_entries where id=v_e2;
  if v_s1 <> 'OPZIONATA' or v_s2 <> 'OPZIONATA' then raise exception 'FALLITO: entrambi dovevano essere OPZIONATA (%,%)', v_s1, v_s2; end if;

  -- 2) il PRIMO firma (evento A → CONFERMATA) → il trigger deve rilasciare B
  update public.calendar_entries set status='CONFERMATA' where id=v_e1;

  select status into v_s1 from public.calendar_entries where id=v_e1;
  select status into v_s2 from public.calendar_entries where id=v_e2;
  select status into v_req1 from public.quote_option_requests where quote_id=v_q1;
  select status into v_req2 from public.quote_option_requests where quote_id=v_q2;
  if v_s1 <> 'CONFERMATA' then raise exception 'FALLITO: A doveva restare CONFERMATA (%)', v_s1; end if;
  if v_s2 <> 'IN_TRATTATIVA' then raise exception 'FALLITO: B doveva essere rilasciato IN_TRATTATIVA (%)', v_s2; end if;
  if v_req2 <> 'RILASCIATA' then raise exception 'FALLITO: richiesta B doveva essere RILASCIATA (%)', v_req2; end if;

  -- pulizia
  delete from public.quote_option_requests where quote_id in (v_q1, v_q2);
  delete from public.quotes where id in (v_q1, v_q2);
  delete from public.calendar_entries where id in (v_e1, v_e2);

  raise notice 'TEST OPZIONE MULTI: OK (2 opzioni stessa data pos1+pos2/contesa → A firma CONFERMATA, B rilasciato IN_TRATTATIVA + richiesta RILASCIATA)';
end $$;
