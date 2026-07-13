-- VERIFY: la select esatta dell'edge sul preventivo del contratto Napoleone ora deve tornare 1 riga.
do $$
declare v_qid uuid; v_row record;
begin
  select quote_id into v_qid from public.contracts where title ilike '%Napoleone%' order by created_at desc limit 1;
  if v_qid is null then raise notice 'VERIFY: contratto senza quote_id'; return; end if;
  select id, owner_id, title, client_name, client_email, event_date, event_location, event_kind,
         guest_count, total_client, client_country
    into v_row from public.quotes where id = v_qid;
  if v_row.id is not null then
    raise notice 'VERIFY OK: select edge riuscita — preventivo % (%), country=%', v_row.id, v_row.title, coalesce(v_row.client_country,'(null→Italia)');
  else
    raise notice 'VERIFY: preventivo % non trovato', v_qid;
  end if;
end $$;
