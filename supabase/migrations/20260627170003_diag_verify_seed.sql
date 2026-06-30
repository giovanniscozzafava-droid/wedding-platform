do $$ declare pid uuid := 'bfca21ff-3654-4826-bfb5-5e248d5dee34'; ev uuid; begin
  raise notice 'RUOLO=% | BUSINESS=%', (select role::text from public.profiles where id=pid), (select business_name from public.profiles where id=pid);
  select id into ev from public.calendar_entries where owner_id=pid limit 1;
  raise notice 'EVENTO: % | stato=% | evento_stato=% | invitati=%',
    (select title from public.calendar_entries where id=ev),
    (select status::text from public.calendar_entries where id=ev),
    (select evento_stato::text from public.calendar_entries where id=ev),
    (select count(*) from public.event_guests where entry_id=ev);
  raise notice 'LEAD=% | TAVOLI=% | TASK=%(fatti %) | TIMELINE=% | BUDGET_VOCI=% | GADGET=% | ALLOGGI=% | COPPIA=%',
    (select count(*) from public.lead_requests where wp_id=pid),
    (select count(*) from public.event_tables where entry_id=ev),
    (select count(*) from public.wedding_tasks where entry_id=ev),
    (select count(*) from public.wedding_tasks where entry_id=ev and done),
    (select count(*) from public.event_timeline where entry_id=ev),
    (select count(*) from public.budget_entries where entry_id=ev),
    (select count(*) from public.event_gadgets where entry_id=ev),
    (select count(*) from public.event_accommodations where entry_id=ev),
    (select count(*) from public.wedding_couple_members where entry_id=ev);
  for ev in select null loop null; end loop;
  raise notice 'PREVENTIVI (totali da trigger):';
  declare r record; begin
    for r in select title, status::text st, total_cost, total_client, margin_amount from public.quotes where owner_id=pid order by created_at loop
      raise notice '  % | % | costo=% cliente=% margine=%', r.title, r.st, r.total_cost, r.total_client, r.margin_amount;
    end loop;
  end;
  raise notice 'CONTRATTO: % | % | tot=%', (select title from public.contracts where owner_id=pid), (select status::text from public.contracts where owner_id=pid), (select total_amount from public.contracts where owner_id=pid);
end $$;
