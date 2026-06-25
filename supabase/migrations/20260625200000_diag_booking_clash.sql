-- TEST: prenotando uno slot, deve sparire dagli slot liberi (anti doppia prenotazione).
do $$
declare v_id uuid; v_slug text; v_n0 int; v_n1 int; v_iso timestamptz; v_bid uuid;
begin
  select id, slug into v_id, v_slug from public.profiles
   where slug is not null and role in ('FORNITORE','WEDDING_PLANNER','LOCATION') order by created_at limit 1;
  if v_id is null then raise notice 'TEST clash: nessun pro'; return; end if;

  v_n0 := jsonb_array_length(public.booking_free_slots(v_slug, current_date, current_date + 7));
  v_iso := ((public.booking_free_slots(v_slug, current_date, current_date + 7)) -> 0 ->> 'iso')::timestamptz;

  insert into public.bookings(professional_id, starts_at, ends_at, client_name, client_email)
    values (v_id, v_iso, v_iso + interval '30 min', 'Test Clash', 'test@example.com')
    returning id into v_bid;

  v_n1 := jsonb_array_length(public.booking_free_slots(v_slug, current_date, current_date + 7));

  raise notice 'TEST clash → prima=% dopo=% (atteso dopo = prima-1) slot_tolto=%', v_n0, v_n1, (v_n1 = v_n0 - 1);

  delete from public.bookings where id = v_bid;  -- pulizia
end $$;
