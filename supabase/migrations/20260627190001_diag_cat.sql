do $$ declare c text; pid uuid := 'bfca21ff-3654-4826-bfb5-5e248d5dee34'; begin
  -- esiste una tabella categorie?
  select string_agg(table_name,', ') into c from information_schema.tables where table_schema='public' and table_name ilike '%categ%';
  raise notice 'TAB_CATEG=%', c;
  -- categorie usate dai servizi del Tenuta
  for c in select distinct coalesce(sc.name,'?')||' ('||s.category_id::text||')' from public.services s left join public.service_categories sc on sc.id=s.category_id where s.fornitore_id=pid loop
    raise notice 'CAT=%', c;
  end loop;
exception when others then raise notice 'ERR=% (categorie forse senza tabella service_categories)', sqlerrm; end $$;
