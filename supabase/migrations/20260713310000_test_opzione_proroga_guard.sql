-- TEST proroga + guardia doppia-prenotazione + "firma se data disponibile" (self-cleaning).
do $$
declare
  v_owner uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27';
  v_date  date := '2031-08-23';
  v_e1 uuid; v_e2 uuid; v_q1 uuid; v_q2 uuid; v_t1 uuid := gen_random_uuid(); v_t2 uuid := gen_random_uuid();
  v_r jsonb; v_s text; v_exp timestamptz; v_blocked boolean := false;
begin
  if not exists (select 1 from public.profiles where id = v_owner) then raise notice 'TEST SALTATO'; return; end if;

  -- ── A) PROROGA ────────────────────────────────────────────────────────────
  insert into public.calendar_entries(owner_id,title,date_from,date_to,status) values (v_owner,'TEST PROROGA',v_date,v_date,'IN_TRATTATIVA') returning id into v_e1;
  insert into public.quotes(owner_id,title,event_date,access_token,option_allowed,option_days) values (v_owner,'TEST PROROGA',v_date,v_t1,true,15) returning id into v_q1;
  update public.calendar_entries set quote_id=v_q1 where id=v_e1;

  perform public.richiedi_opzione_da_preventivo(v_t1::text);
  -- forzo scadenza + scadi_opzioni → deve tornare IN_TRATTATIVA (data non assegnata)
  update public.calendar_entries set option_expires_at = now() - interval '1 day' where id=v_e1;
  perform public.scadi_opzioni();
  select status into v_s from public.calendar_entries where id=v_e1;
  if v_s <> 'IN_TRATTATIVA' then raise exception 'FALLITO scadenza: %', v_s; end if;
  -- proroga → rinnova
  v_r := public.proroga_opzione(v_t1::text, 20);
  if not coalesce((v_r->>'ok')::boolean,false) then raise exception 'FALLITO proroga: %', v_r; end if;
  select status, option_expires_at into v_s, v_exp from public.calendar_entries where id=v_e1;
  if v_s <> 'OPZIONATA' or v_exp is null or v_exp < now() + interval '19 days' then raise exception 'FALLITO proroga stato/countdown: %,%', v_s, v_exp; end if;

  -- ── B) GUARDIA doppia-prenotazione + firma-se-disponibile ──────────────────
  insert into public.calendar_entries(owner_id,title,date_from,date_to,status) values (v_owner,'TEST GUARD B',v_date,v_date,'IN_TRATTATIVA') returning id into v_e2;
  insert into public.quotes(owner_id,title,event_date,access_token,option_allowed,option_days) values (v_owner,'TEST GUARD B',v_date,v_t2,true,15) returning id into v_q2;
  update public.calendar_entries set quote_id=v_q2 where id=v_e2;
  perform public.richiedi_opzione_da_preventivo(v_t2::text);

  -- il PRIMO (e1) firma → CONFERMATA (capacità 1, nessun altro confermato → OK)
  update public.calendar_entries set status='CONFERMATA' where id=v_e1;
  select status into v_s from public.calendar_entries where id=v_e1;
  if v_s <> 'CONFERMATA' then raise exception 'FALLITO: e1 doveva confermarsi (%)', v_s; end if;

  -- il SECONDO (e2) prova a firmare la stessa data → la guardia deve BLOCCARLO
  begin
    update public.calendar_entries set status='CONFERMATA' where id=v_e2;
  exception when check_violation then v_blocked := true;
  end;
  if not v_blocked then raise exception 'FALLITO GUARDIA: la doppia prenotazione NON e stata bloccata'; end if;
  select status into v_s from public.calendar_entries where id=v_e2;
  if v_s = 'CONFERMATA' then raise exception 'FALLITO: e2 non doveva confermarsi'; end if;

  -- "firma se data disponibile": libero e1 → ora e2 puo confermarsi
  update public.calendar_entries set status='IN_TRATTATIVA' where id=v_e1;
  update public.calendar_entries set status='CONFERMATA' where id=v_e2;
  select status into v_s from public.calendar_entries where id=v_e2;
  if v_s <> 'CONFERMATA' then raise exception 'FALLITO: e2 doveva potersi confermare a data libera (%)', v_s; end if;

  -- pulizia
  delete from public.quote_option_requests where quote_id in (v_q1,v_q2);
  delete from public.supplier_date_options where supplier_id=v_owner and date_from=v_date;
  delete from public.supplier_availability where fornitore_id=v_owner and date=v_date;
  delete from public.quotes where id in (v_q1,v_q2);
  delete from public.calendar_entries where id in (v_e1,v_e2);

  raise notice 'TEST OPZIONE PROROGA+GUARDIA: OK (scadenza→IN_TRATTATIVA, proroga rinnova, doppia prenotazione BLOCCATA, firma a data libera OK)';
end $$;
