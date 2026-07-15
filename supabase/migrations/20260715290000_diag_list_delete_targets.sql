-- DIAGNOSTICA (no-op, SOLO SELECT): elenca i 45 account test candidati all'eliminazione
-- con nome/ruolo/email/creazione. Nessuna modifica ai dati. (p.* qualificato: auth.users ha anch'esso "role")
do $$
declare r record; n int := 0;
  where_targets text := $q$
      p.role in ('FORNITORE','WEDDING_PLANNER')
   and (
        trim(coalesce(p.business_name,p.full_name,'')) ilike '%test%'
     or trim(coalesce(p.business_name,p.full_name,'')) ilike '%diagn%'
     or p.business_name ilike 'Villa Klop%' or p.business_name ilike 'Giuseppe Aras%'
     or p.business_name ilike 'Black Mamba%' or p.business_name ilike 'Alfredo Muraca%'
     or p.business_name ilike 'Giangianni Flow%'
     or trim(coalesce(p.business_name,p.full_name,'')) ilike 'Marco Fotografo'
     or p.business_name in ('Band','Make-up artist')
   )
   and coalesce(p.business_name,p.full_name,'') !~* 'gisko|daisylab|scura'
  $q$;
begin
  raise notice '==== CANDIDATI ELIMINAZIONE (nome | ruolo | email) ====';
  for r in execute
    'select coalesce(p.business_name,p.full_name) nm, p.role::text rl, u.email, to_char(u.created_at,''YYYY-MM-DD'') cr '||
    'from public.profiles p join auth.users u on u.id=p.id where '||where_targets||' order by 2, 1'
  loop
    n := n + 1;
    raise notice '% | % | % | % | creato %', lpad(n::text,2,'0'), r.nm, r.rl, r.email, r.cr;
  end loop;
  raise notice '==== TOTALE candidati: % ====', n;
end $$;
