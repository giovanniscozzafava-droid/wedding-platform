-- ============================================================================
-- NEW-05: quote-send controllava se il cliente ha già un account con
-- admin.auth.admin.listUsers({perPage:200}), SENZA paginare oltre la prima
-- pagina: oltre i primi 200 utenti Auth della piattaforma il controllo
-- diventa silenziosamente inaffidabile (falsi negativi). Fix: RPC dedicata,
-- una singola query indicizzata su auth.users, niente paginazione da gestire.
-- ============================================================================

create or replace function public.email_has_account(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (select 1 from auth.users where lower(email) = lower(trim(p_email)));
$$;

revoke all on function public.email_has_account(text) from public, anon, authenticated;
grant execute on function public.email_has_account(text) to service_role;
