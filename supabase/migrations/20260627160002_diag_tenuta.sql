do $$ declare v text; r text; begin
  select p.id::text||' | '||p.role::text||' | '||coalesce(p.business_name,p.full_name,'?')||' | conferma='||coalesce(u.email_confirmed_at::text,'NO')||' | email='||coalesce(u.email,'?')
    into v from public.profiles p left join auth.users u on u.id=p.id where p.slug='tenuta-delle-grazie-bfca21';
  raise notice 'TENUTA=%', v;
  select string_agg(e.enumlabel, ', ') into r from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='user_role';
  raise notice 'ENUM_user_role=%', r;
end $$;
