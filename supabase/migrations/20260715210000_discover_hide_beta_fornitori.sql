-- Pre-lancio: nascondi TUTTI i fornitori (seed/beta/test) dalla vetrina pubblica
-- "Scopri fornitori", tranne i 3 indicati da Giovanni: Gisko, DaisyLab, Clorinda
-- Scura·Wedsign. is_discoverable=false → reversibile, nessun account cancellato.
do $$
declare n int; r record;
begin
  update public.profiles set is_discoverable = false
  where role = 'FORNITORE' and is_discoverable = true
    and coalesce(business_name, full_name, '') !~* '(gisko|daisylab|scura)';
  get diagnostics n = row_count; raise notice 'FORNITORI nascosti: % righe', n;

  raise notice '---- FORNITORI ANCORA VISIBILI (attesi: Gisko, DaisyLab, Scura) ----';
  for r in
    select coalesce(business_name, full_name) as nm
    from public.profiles where role = 'FORNITORE' and is_discoverable = true order by 1
  loop
    raise notice 'VISIBILE: %', r.nm;
  end loop;
end $$;
