do $$
declare t text; c text;
begin
  foreach t in array array['calendar_entries','lead_requests','quotes','quote_items','contracts','event_guests','event_gadgets'] loop
    select string_agg(column_name, ', ' order by ordinal_position)
      into c from information_schema.columns
      where table_schema='public' and table_name=t and is_nullable='NO' and column_default is null;
    raise notice 'REQUIRED % => %', t, coalesce(c,'(nessuna)');
  end loop;
  -- valori enum dei campi USER-DEFINED critici
  for t in select unnest(array['entry_status','ceremony_status','evento_stato','quote_status','quote_margin_mode','contract_party_kind','guest_age_group']) loop
    select string_agg(e.enumlabel, ', ') into c from pg_enum e join pg_type ty on ty.oid=e.enumtypid where ty.typname=t;
    raise notice 'ENUM % => %', t, coalesce(c,'(non e enum)');
  end loop;
  -- business_model: text con check?
  select pg_get_constraintdef(oid) into c from pg_constraint where conname like '%business_model%' limit 1;
  raise notice 'BUSINESS_MODEL_CHK => %', coalesce(c,'(nessun check)');
end $$;
