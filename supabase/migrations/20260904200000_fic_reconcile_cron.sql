-- «Sistema dei pagamenti, sempre tramite Fatture in Cloud traccia i pagamenti
-- e li riconcilia ogni giorno in automatico» (Giovanni, 04/09/2026).
-- Stesso schema di album-nudge-daily: il cron chiama una funzione SQL minima
-- che fa un POST via pg_net all'edge fic-reconcile-daily (la logica vera).

create or replace function public.fic_reconcile_kick() returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  v_url := regexp_replace(coalesce(current_setting('app.supabase_url', true), 'http://kong:8000/functions/v1'), '/+$', '');
  v_key := coalesce(current_setting('app.functions_anon_key', true), '');
  perform net.http_post(
    url     := v_url || '/fic-reconcile-daily',
    headers := jsonb_build_object('Content-Type', 'application/json')
               || case when v_key <> '' then jsonb_build_object('Authorization', 'Bearer ' || v_key) else '{}'::jsonb end,
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end$$;

-- Ogni giorno alle 06:00 UTC, prima che il professionista inizi la giornata
-- (best-effort: se pg_cron non c'è, non blocca la migration).
do $$ begin
  perform cron.schedule('fic-reconcile-daily', '0 6 * * *', 'select public.fic_reconcile_kick();');
exception when others then raise notice 'pg_cron non disponibile: fic-reconcile non schedulato'; end $$;
