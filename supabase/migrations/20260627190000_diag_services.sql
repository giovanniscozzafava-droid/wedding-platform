do $$ declare c text; pid uuid := 'bfca21ff-3654-4826-bfb5-5e248d5dee34'; begin
  select string_agg(column_name||':'||data_type||case when is_nullable='NO' and column_default is null then '!' else '' end,', ' order by ordinal_position) into c
    from information_schema.columns where table_schema='public' and table_name='services';
  raise notice 'SERVICES_COLS=%', c;
  raise notice 'SERVIZI_TENUTA=% | FB_MENUS_TENUTA=%',
    (select count(*) from public.services where fornitore_id=pid),
    (select string_agg(name,', ') from public.fb_menus where location_id=pid);
  select string_agg(e.enumlabel,', ') into c from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='service_unit';
  raise notice 'SERVICE_UNIT=%', c;
end $$;
