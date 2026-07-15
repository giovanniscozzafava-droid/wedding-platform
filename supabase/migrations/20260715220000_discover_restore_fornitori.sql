-- ANNULLA 20260715210000: rimette TUTTI i fornitori a disposizione della rete
-- (is_discoverable=true). Giovanni indicherà poi quali togliere singolarmente.
do $$
declare n int;
begin
  update public.profiles set is_discoverable = true where role = 'FORNITORE' and is_discoverable is distinct from true;
  get diagnostics n = row_count; raise notice 'FORNITORI ri-attivati: % righe', n;
end $$;
