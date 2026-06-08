-- ============================================================================
-- "Cliente verificato": flag per distinguere i clienti VERI (verificati dallo
-- staff) dagli account di test. Mostrato come badge e usabile nei filtri/finance.
-- ============================================================================
alter table public.profiles
  add column if not exists is_verified_customer boolean not null default false;
comment on column public.profiles.is_verified_customer is 'Cliente reale verificato dallo staff (non un account di test).';

-- admin_list_users: include il flag verificato.
create or replace function public.admin_list_users(p_search text default null)
returns table (
  id uuid, full_name text, business_name text, role text, email text,
  is_support_staff boolean, is_verified_customer boolean, created_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select p.id, p.full_name::text, p.business_name::text, p.role::text, u.email::text,
           p.is_support_staff, p.is_verified_customer, p.created_at
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

create or replace function public.admin_set_verified(p_user_id uuid, p_value boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update public.profiles set is_verified_customer = coalesce(p_value, false) where id = p_user_id;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.admin_set_verified(uuid, boolean) to authenticated;
