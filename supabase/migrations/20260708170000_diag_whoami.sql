create or replace function public._diag_whoami()
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('current_user', current_user, 'jwt_role',
    coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'none'),
    'uid', (select auth.uid())::text);
$$;
grant execute on function public._diag_whoami() to anon, authenticated, service_role;
