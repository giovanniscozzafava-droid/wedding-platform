do $$
declare r record;
begin
  for r in select id, slug, full_name, role from public.profiles where slug like 'giovanni-scozzafava%' or full_name ilike '%scozzafava%' loop
    raise notice 'PROFILO id=% slug=% name=% role=%', r.id, r.slug, r.full_name, r.role;
    raise notice '   bookings(CONFIRMED)=% | busy-appuntamenti=%',
      (select count(*) from public.bookings b where b.professional_id=r.id and b.status='CONFIRMED'),
      (select count(*) from public.supplier_availability_slots s where s.fornitore_id=r.id and s.label ilike 'Appuntamento%');
  end loop;
  raise notice 'TOTALE bookings nel DB=% | TOTALE busy-appuntamenti=%',
    (select count(*) from public.bookings), (select count(*) from public.supplier_availability_slots where label ilike 'Appuntamento%');
end $$;
