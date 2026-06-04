-- Fix: admin_list_users dichiarava text ma full_name/business_name/email sono
-- varchar → "Returned type character varying does not match expected type text".
-- Cast esplicito a text.
create or replace function public.admin_list_users(p_search text default null)
returns table (
  id uuid, full_name text, business_name text, role text, email text,
  is_support_staff boolean, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select p.id, p.full_name::text, p.business_name::text, p.role::text, u.email::text,
           p.is_support_staff, p.created_at
    from profiles p
    join auth.users u on u.id = p.id
    where p_search is null or p_search = ''
       or p.full_name ilike '%'||p_search||'%'
       or p.business_name ilike '%'||p_search||'%'
       or u.email ilike '%'||p_search||'%'
    order by p.is_support_staff desc, p.created_at desc
    limit 100;
end$$;
grant execute on function public.admin_list_users(text) to authenticated;
