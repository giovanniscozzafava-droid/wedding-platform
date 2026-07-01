-- ============================================================================
-- CLUSTER 5 — "PII dei fornitori NON accessibile all'anonimo"
-- ----------------------------------------------------------------------------
-- public.suggest_alternatives_full(text, date) è SECURITY DEFINER e restituisce
-- phone + email dei fornitori, con `grant execute ... to anon`. L'anon key vive
-- nel bundle frontend → chiunque poteva chiamare la RPC via PostgREST
-- (/rest/v1/rpc/suggest_alternatives_full) variando slug+data ed enumerare i
-- contatti di tutti i fornitori, bypassando il rate-limit (che vive solo nella
-- edge function suggest-alternatives).
--
-- FIX chirurgico: revoca esecuzione ad anon/authenticated. La funzione resta
-- invariata. La edge la chiama con SERVICE_ROLE_KEY (bypassa i grant) → il flusso
-- "email con 2 alternative" continua identico. Nessun frontend la chiama diretta.
-- ============================================================================
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'suggest_alternatives_full'
  ) then
    revoke execute on function public.suggest_alternatives_full(text, date) from anon;
    revoke execute on function public.suggest_alternatives_full(text, date) from authenticated;
    revoke execute on function public.suggest_alternatives_full(text, date) from public;
    raise notice 'PII revoke: suggest_alternatives_full -> solo service_role';
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'suggest_alternatives_contacts'
  ) then
    revoke execute on function public.suggest_alternatives_contacts(text, date) from anon;
    revoke execute on function public.suggest_alternatives_contacts(text, date) from authenticated;
    revoke execute on function public.suggest_alternatives_contacts(text, date) from public;
    raise notice 'PII revoke: suggest_alternatives_contacts -> solo service_role';
  end if;
end$$;

-- Verifica post-push (manuale in prod, deve tornare false per entrambi):
--   select r.rolname, has_function_privilege(r.oid,
--     'public.suggest_alternatives_full(text,date)', 'execute') as can_exec
--   from pg_roles r where r.rolname in ('anon','authenticated');
