-- DIAGNOSTICA (no-op, read-only): prima di eliminare gli account test controlla
-- quante righe reali dipendono da loro e con quale regola ON DELETE (per capire
-- cosa verrebbe cancellato a cascata o cosa bloccherebbe la delete).
do $$
declare r record; c bigint; total int;
  where_targets text := $q$
       trim(coalesce(business_name,full_name,'')) ilike '%test%'
    or trim(coalesce(business_name,full_name,'')) ilike '%diagn%'
    or business_name ilike 'Villa Klop%' or business_name ilike 'Giuseppe Aras%'
    or business_name ilike 'Black Mamba%' or business_name ilike 'Alfredo Muraca%'
    or business_name ilike 'Giangianni Flow%'
    or trim(coalesce(business_name,full_name,'')) ilike 'Marco Fotografo'
    or business_name in ('Band','Make-up artist')
  $q$;
begin
  execute 'create temp table _targets on commit drop as select id, coalesce(business_name,full_name) nm, role::text rl from public.profiles where '||where_targets;
  select count(*) into total from _targets;
  raise notice '==== TARGET totali: % ====', total;
  for r in select rl, count(*) c from _targets group by rl order by 1 loop
    raise notice '  ruolo % = %', r.rl, r.c;
  end loop;

  raise notice '==== DIPENDENZE (solo tabelle con righe collegate) ====';
  for r in
    select con.conname,
           ns.nspname||'.'||cl.relname as child_tbl,
           att.attname as child_col,
           rns.nspname||'.'||rcl.relname as parent_tbl,
           con.confdeltype as del
    from pg_constraint con
    join pg_class cl on cl.oid=con.conrelid
    join pg_namespace ns on ns.oid=cl.relnamespace
    join pg_class rcl on rcl.oid=con.confrelid
    join pg_namespace rns on rns.oid=rcl.relnamespace
    join pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1]
    where con.contype='f' and array_length(con.conkey,1)=1
      and ((rns.nspname='public' and rcl.relname='profiles')
        or (rns.nspname='auth'   and rcl.relname='users'))
    order by 2
  loop
    execute format('select count(*) from %s ch where ch.%I in (select id from _targets)', r.child_tbl, r.child_col) into c;
    if c > 0 then
      raise notice 'DEP % | %.% -> % | onDel=% (a=NOACT r=RESTRICT c=CASCADE n=SETNULL)', c, r.child_tbl, r.child_col, r.parent_tbl, r.del;
    end if;
  end loop;
  raise notice '==== fine diagnostica ====';
end $$;
