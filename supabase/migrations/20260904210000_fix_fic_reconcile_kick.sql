-- Bug di infrastruttura trovato collaudando fic-reconcile-daily: le GUC
-- app.supabase_url / app.functions_anon_key, da cui dipende OGNI cron che
-- chiama un'edge function via pg_net (album-nudge-daily, invia-digest-
-- giornaliero, rigenera-promemoria, gallery-deadline-daily), non erano mai
-- state impostate: ogni chiamata falliva con "Couldn't resolve host name"
-- (fallback all'hostname interno "kong", inesistente in produzione),
-- silenziosamente, senza errore visibile in UI.
--
-- ALTER DATABASE SET per la GUC è negato dalla piattaforma hosted (permission
-- denied): il fix è nella funzione stessa, non nella GUC — url e chiave
-- pubblica (anon key: protetta da RLS, non da segretezza, già nel bundle
-- frontend) come default diretto, la GUC resta un override facoltativo.
create or replace function public.fic_reconcile_kick() returns void language plpgsql security definer set search_path = public as $fn$
declare v_url text; v_key text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  v_url := regexp_replace(coalesce(current_setting('app.supabase_url', true), 'https://zfwlkvqxfzvubmfyxofs.supabase.co/functions/v1'), '/+$', '');
  v_key := coalesce(nullif(current_setting('app.functions_anon_key', true), ''), 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmd2xrdnF4Znp2dWJtZnl4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDA4ODgsImV4cCI6MjA5NTAxNjg4OH0.30t-8rH4_3Sa9RGRDMdPqERoDEWvrCY2GDBjQD0BZ64');
  perform net.http_post(
    url     := v_url || '/fic-reconcile-daily',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end
$fn$;
