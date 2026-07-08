create or replace function public._diag_secdef()
returns jsonb language sql security definer set search_path = public, pg_catalog as $$
  select jsonb_agg(jsonb_build_object('secdef', p.prosecdef, 'owner', pg_get_userbyid(p.proowner), 'cfg', p.proconfig))
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='track_quote_open';
$$;
revoke all on function public._diag_secdef() from public, anon, authenticated;
grant execute on function public._diag_secdef() to service_role;
