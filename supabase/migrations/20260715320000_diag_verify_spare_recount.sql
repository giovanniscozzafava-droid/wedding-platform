-- DIAGNOSTICA (no-op, SOLO SELECT): (1) verifica che "Alfredo Muraca" base sia presente
-- e visibile; (2) ricalcola la lista eliminazione dopo aver risparmiato Black Mamba +
-- Villa Klope (guardia esclude anche loro).
do $$
declare r record; n int := 0;
  where_del text := $q$
      p.role in ('FORNITORE','WEDDING_PLANNER')
   and (
        trim(coalesce(p.business_name,p.full_name,'')) ilike '%test%'
     or trim(coalesce(p.business_name,p.full_name,'')) ilike '%diagn%'
     or p.business_name ilike 'Giuseppe Aras%'
     or p.business_name ilike 'Alfredo Muraca%'
     or p.business_name ilike 'Giangianni Flow%'
     or trim(coalesce(p.business_name,p.full_name,'')) ilike 'Marco Fotografo'
     or p.business_name in ('Band','Make-up artist')
   )
   and coalesce(p.business_name,p.full_name,'') !~* 'gisko|daisylab|scura|black mamba|villa klop'
  $q$;
begin
  raise notice '==== tutti gli "alfredo muraca" (base va tenuto) ====';
  for r in
    select coalesce(business_name,full_name) nm, is_discoverable d, u.email
    from public.profiles p join auth.users u on u.id=p.id
    where coalesce(business_name,full_name,'') ilike '%alfredo muraca%' order by 1
  loop raise notice 'A: % | disc=% | %', r.nm, r.d, r.email; end loop;

  raise notice '==== NUOVA LISTA ELIMINAZIONE ====';
  for r in execute
    'select coalesce(p.business_name,p.full_name) nm, p.role::text rl from public.profiles p where '||where_del||' order by 2,1'
  loop n:=n+1; raise notice '% | % | %', lpad(n::text,2,'0'), r.nm, r.rl; end loop;
  raise notice '==== TOTALE da eliminare: % (atteso 43) ====', n;
end $$;
