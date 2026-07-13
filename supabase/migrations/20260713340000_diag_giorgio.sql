-- DIAGNOSTICA (read-only): la firma di Giorgio Gatto verrebbe bloccata dalla guardia doppia-prenotazione?
do $$
declare v_owner uuid; v_date date; v_cap int; v_conf int; v_qstatus text; v_cf text;
begin
  select q.owner_id, q.event_date, q.status, q.client_name
    into v_owner, v_date, v_qstatus, v_cf
    from public.quotes q
    where q.client_name ilike '%Giorgio Gatto%' or q.title ilike '%destination weekend%'
    order by q.created_at desc limit 1;
  if v_owner is null then raise notice 'DIAG: preventivo Giorgio non trovato'; return; end if;
  select coalesce(daily_capacity,1) into v_cap from public.profiles where id = v_owner;
  select count(*) into v_conf from public.calendar_entries where owner_id=v_owner and date_from=v_date and status='CONFERMATA';
  raise notice 'DIAG Giorgio: quote_status=% | data=% | capacita=% | CONFERMATA gia'' su quella data=% → guardia %',
    v_qstatus, v_date, v_cap, v_conf, case when v_conf >= v_cap then 'BLOCCHEREBBE' else 'OK (passa)' end;
end $$;
