do $$ declare c text; begin
  select pg_get_constraintdef(oid) into c from pg_constraint where conname='fb_menu_items_course_chk';
  raise notice 'COURSE_CHK=%', c;
end $$;
