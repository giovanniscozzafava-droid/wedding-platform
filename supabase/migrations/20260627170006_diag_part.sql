do $$ declare c text; begin
  select string_agg(column_name||':'||data_type||case when is_nullable='NO' and column_default is null then '!' else '' end,', ' order by ordinal_position) into c
    from information_schema.columns where table_schema='public' and table_name='calendar_entry_participants';
  raise notice 'CEP=%', c;
  select string_agg(e.enumlabel,', ') into c from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname like '%participant%role%' or t.typname like '%cep%';
  raise notice 'CEP_ROLE_ENUM=%', coalesce(c,'(?)');
end $$;
