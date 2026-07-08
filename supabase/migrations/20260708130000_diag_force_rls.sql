-- Diagnostica: stato RLS/force di quotes (solo service_role).
create or replace function public._diag_force(p_qid uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_catalog as $$
declare v jsonb; v_rows int := -1;
begin
  select jsonb_build_object('relrowsecurity', c.relrowsecurity, 'relforcerowsecurity', c.relforcerowsecurity,
           'owner', pg_get_userbyid(c.relowner))
    into v from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='quotes';
  -- prova: update come definer (postgres) su una riga per id — se force RLS blocca postgres, 0 righe
  update public.quotes set open_count = open_count where id = p_qid;
  get diagnostics v_rows = row_count;
  return v || jsonb_build_object('definer_update_by_id_rows', v_rows);
end $$;
revoke all on function public._diag_force(uuid) from public, anon, authenticated;
grant execute on function public._diag_force(uuid) to service_role;
