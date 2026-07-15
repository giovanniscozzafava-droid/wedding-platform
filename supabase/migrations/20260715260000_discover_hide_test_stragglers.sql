-- Sfuggiti al primo passaggio: match su TRIM(coalesce(business_name,full_name))
-- (spazi in coda / nome solo in full_name). Prende "Marco Fotografo" ed "Elisa Test WP".
do $$
declare n int; r record;
  cond text := $q$
       trim(coalesce(business_name,full_name,'')) ilike '%test%'
    or trim(coalesce(business_name,full_name,'')) ilike '%diagn%'
    or trim(coalesce(business_name,full_name,'')) ilike 'Marco Fotografo'
  $q$;
begin
  execute 'update public.profiles set is_discoverable=false where is_discoverable=true and ('||cond||')';
  get diagnostics n=row_count; raise notice 'NASCOSTI extra: % righe', n;
  for r in execute 'select coalesce(business_name,full_name) nm, role::text rl from public.profiles where ('||cond||') and is_discoverable=false order by 1'
  loop raise notice 'X: % | %', r.nm, r.rl; end loop;
end $$;
