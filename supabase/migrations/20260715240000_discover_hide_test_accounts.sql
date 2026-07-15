-- Nasconde dalla vetrina "Scopri" gli account test/seed indicati da Giovanni (screenshot).
-- is_discoverable=false → REVERSIBILE (non cancella gli account). L'eliminazione definitiva,
-- se richiesta, va fatta a parte con conferma esplicita (irreversibile + dati collegati).
do $$
declare n int; r record;
  cond text := $q$
       business_name ilike '%test%'
    or business_name ilike '%diagn%' or full_name ilike '%diagn%'
    or business_name ilike 'Villa Klop%'
    or business_name ilike 'Giuseppe Aras%'
    or business_name ilike 'Black Mamba%'
    or business_name ilike 'Alfredo Muraca%'
    or business_name ilike 'Giangianni Flow%'
    or business_name in ('Marco Fotografo','Band','Make-up artist')
  $q$;
begin
  execute 'update public.profiles set is_discoverable = false where is_discoverable = true and (' || cond || ')';
  get diagnostics n = row_count; raise notice 'NASCOSTI ora: % righe', n;

  raise notice '---- account che matchano (verifica) ----';
  for r in execute 'select coalesce(business_name,full_name) nm, role::text rl, is_discoverable d from public.profiles where (' || cond || ') order by 1'
  loop
    raise notice 'MATCH: % | % | disc=%', r.nm, r.rl, r.d;
  end loop;
end $$;
