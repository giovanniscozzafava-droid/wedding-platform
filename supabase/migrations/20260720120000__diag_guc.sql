create or replace function public._diag_guc() returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'url_set',  coalesce(nullif(current_setting('app.supabase_url', true),''),'') <> '',
    'key_set',  coalesce(nullif(current_setting('app.functions_anon_key', true),''),'') <> '',
    'url_head', left(coalesce(current_setting('app.supabase_url', true),''), 24));
$$;
revoke all on function public._diag_guc() from anon, public;
grant execute on function public._diag_guc() to authenticated;
