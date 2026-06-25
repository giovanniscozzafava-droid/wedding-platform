do $$ declare pid uuid := '1d0177ba-bfd9-4e2e-a997-7201f9273d55';
begin
  raise notice 'bookings=% | busy-slot=%',
    (select count(*) from public.bookings where professional_id=pid and status='CONFIRMED'),
    (select count(*) from public.supplier_availability_slots where fornitore_id=pid and label ilike 'Appuntamento%');
  raise notice 'dettaglio slot: %', (select string_agg(date::text||' '||coalesce(start_time::text,'')||' '||coalesce(label,''), ' | ') from public.supplier_availability_slots where fornitore_id=pid and label ilike 'Appuntamento%');
end $$;
