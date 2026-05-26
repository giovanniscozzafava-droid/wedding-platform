-- Trova chi è "Sara De Luca" cercando per nome
do $$
declare
  rec_row record;
begin
  raise notice '════ Tutti gli account WP/LOCATION/ADMIN ════';
  for rec_row in
    select u.email as email_addr,
           p.full_name as fn,
           p.business_name as biz,
           p.role::text as role_str,
           p.is_founding_member as fm,
           p.created_at as ca
      from profiles p
      join auth.users u on u.id = p.id
     where p.role in ('WEDDING_PLANNER','LOCATION','ADMIN')
     order by p.created_at asc
  loop
    raise notice '  email=% role=% name=% business=% founding=%',
      rec_row.email_addr, rec_row.role_str, coalesce(rec_row.fn,''), coalesce(rec_row.biz,''), rec_row.fm;
  end loop;
end $$;
