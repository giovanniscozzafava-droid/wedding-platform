-- TEST END-TO-END dell'opzione data (self-cleaning: NON lascia residui). Se un assert fallisce,
-- RAISE EXCEPTION → la migration fallisce (test rosso). Se passa → NOTICE 'OK' e pulizia.
do $$
declare
  v_owner uuid := 'c117d389-0626-4a9e-8dd4-b2751902df27';  -- La Baronella
  v_date  date := '2031-06-17';                            -- data lontana e improbabile (no overlap reale)
  v_entry uuid; v_quote uuid; v_tok uuid := gen_random_uuid();
  v_res jsonb; v_status text; v_exp timestamptz; v_opt_status text; v_n int;
begin
  if not exists (select 1 from public.profiles where id = v_owner) then
    raise notice 'TEST SALTATO: profilo La Baronella non trovato'; return;
  end if;

  -- pulizia di eventuali residui di run precedenti
  delete from public.supplier_date_options where supplier_id = v_owner and date_from = v_date and reason like 'TEST%';
  delete from public.supplier_availability where fornitore_id = v_owner and date = v_date;

  -- scenario minimo: evento + preventivo con opzione abilitata
  insert into public.calendar_entries(owner_id, title, date_from, date_to, status)
    values (v_owner, 'TEST OPZIONE DATA', v_date, v_date, 'IN_TRATTATIVA') returning id into v_entry;
  insert into public.quotes(owner_id, title, event_date, access_token, option_allowed, option_days)
    values (v_owner, 'TEST OPZIONE DATA', v_date, v_tok, true, 15) returning id into v_quote;
  update public.calendar_entries set quote_id = v_quote where id = v_entry;  -- legame corretto: entry.quote_id → quote

  -- 1) il cliente richiede l'opzione (via token) → deve concedere
  v_res := public.richiedi_opzione_da_preventivo(v_tok::text);
  if not coalesce((v_res->>'ok')::boolean, false) then
    raise exception 'FALLITO richiedi_opzione: %', v_res;
  end if;

  -- 2) evento OPZIONATA + countdown ~ +15gg + disponibilità OPTIONED
  select status, option_expires_at into v_status, v_exp from public.calendar_entries where id = v_entry;
  if v_status <> 'OPZIONATA' then raise exception 'FALLITO: atteso OPZIONATA, trovato %', v_status; end if;
  if v_exp is null or v_exp < now() + interval '14 days' then raise exception 'FALLITO: countdown non impostato (exp=%)', v_exp; end if;
  select status into v_opt_status from public.supplier_date_options where supplier_id = v_owner and date_from = v_date and status = 'OPTIONED';
  if v_opt_status is null then raise exception 'FALLITO: nessuna supplier_date_option OPTIONED'; end if;

  -- 3) forzo la scadenza e faccio girare il cron di scadenza
  update public.calendar_entries set option_expires_at = now() - interval '1 day' where id = v_entry;
  update public.supplier_date_options set expires_at = now() - interval '1 day' where supplier_id = v_owner and date_from = v_date and status = 'OPTIONED';
  v_n := public.scadi_opzioni();

  -- 4) la data deve essersi liberata da sola
  select status, option_expires_at into v_status, v_exp from public.calendar_entries where id = v_entry;
  if v_status <> 'IN_TRATTATIVA' then raise exception 'FALLITO scadenza: atteso IN_TRATTATIVA, trovato %', v_status; end if;
  if v_exp is not null then raise exception 'FALLITO scadenza: countdown non azzerato'; end if;
  if not exists (select 1 from public.supplier_date_options where supplier_id = v_owner and date_from = v_date and status = 'EXPIRED') then
    raise exception 'FALLITO scadenza: opzione non EXPIRED';
  end if;

  -- pulizia totale (nessun residuo)
  delete from public.quote_option_requests where quote_id = v_quote;
  delete from public.supplier_date_options where supplier_id = v_owner and date_from = v_date;
  delete from public.supplier_availability where fornitore_id = v_owner and date = v_date;
  delete from public.quotes where id = v_quote;
  delete from public.calendar_entries where id = v_entry;

  raise notice 'TEST OPZIONE DATA: OK (richiesta→OPZIONATA+countdown→scadenza→IN_TRATTATIVA, scadi_opzioni=% righe)', v_n;
end $$;
