create or replace function public._diag_final(p_token uuid, p_qid uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare v_force bool; v_secdef bool; v_rows int := -1; v_err text;
begin
  select relforcerowsecurity into v_force from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='quotes';
  select bool_or(prosecdef) into v_secdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='track_quote_open';
  begin
    update public.quotes set open_count = open_count + 1 where access_token = p_token and token_revoked_at is null;
    get diagnostics v_rows = row_count;
  exception when others then v_err := SQLERRM; end;
  update public.quotes set open_count = 0 where id = p_qid;
  return jsonb_build_object('quotes_force_rls', v_force, 'track_is_secdef', v_secdef, 'secdef_update_rows', v_rows, 'err', v_err);
end $$;
revoke all on function public._diag_final(uuid, uuid) from public, anon, authenticated;
grant execute on function public._diag_final(uuid, uuid) to service_role;
