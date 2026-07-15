-- VERIFICA (no-op): stato vetrina dopo l'hide dei test account.
-- 1) elenco account target ora nascosti  2) conferma keeper ancora visibili.
do $$
declare r record; n int;
begin
  raise notice '==== TARGET NASCOSTI (disc=f tra i match) ====';
  for r in
    select coalesce(business_name,full_name) nm, role::text rl, is_discoverable d
    from public.profiles
    where business_name ilike '%test%'
       or business_name ilike '%diagn%' or full_name ilike '%diagn%'
       or business_name ilike 'Villa Klop%' or business_name ilike 'Giuseppe Aras%'
       or business_name ilike 'Black Mamba%' or business_name ilike 'Alfredo Muraca%'
       or business_name ilike 'Giangianni Flow%'
       or business_name in ('Marco Fotografo','Band','Make-up artist','Elisa Test WP')
    order by 2,1
  loop
    raise notice 'T: % | % | disc=%', r.nm, r.rl, r.d;
  end loop;

  select count(*) into n from public.profiles where role='FORNITORE' and is_discoverable=true;
  raise notice '==== FORNITORI ANCORA VISIBILI: % ====', n;
  for r in select coalesce(business_name,full_name) nm from public.profiles
    where role='FORNITORE' and is_discoverable=true order by 1
  loop
    raise notice 'V: %', r.nm;
  end loop;
end $$;
