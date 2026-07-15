-- Correzione curazione Discover (i pattern stretti non avevano preso alcuni nomi):
-- Elisa->Elisabetta Citraro; Scusa Design / Daisy Lab hanno business_name diverso.
-- Uso pattern larghi e DUMPO i profili pro reali per trovare i nomi esatti.
do $$
declare n int; r record;
begin
  update public.profiles set is_discoverable = false where business_name ilike '%citraro%';
  get diagnostics n = row_count; raise notice 'HIDE Citraro: % righe', n;
  update public.profiles set is_discoverable = true where business_name ilike '%scusa%';
  get diagnostics n = row_count; raise notice 'SHOW Scusa: % righe', n;
  update public.profiles set is_discoverable = true where business_name ilike '%daisy%';
  get diagnostics n = row_count; raise notice 'SHOW Daisy: % righe', n;

  raise notice '---- PROFILI WP/LOCATION/FORNITORE (nome | ruolo | discoverable) ----';
  for r in
    select coalesce(business_name, full_name) as nm, role::text as rl, is_discoverable as d
    from public.profiles
    where role in ('WEDDING_PLANNER','LOCATION','FORNITORE')
    order by 1
  loop
    raise notice 'PROFILO: % | % | disc=%', r.nm, r.rl, r.d;
  end loop;
end $$;
