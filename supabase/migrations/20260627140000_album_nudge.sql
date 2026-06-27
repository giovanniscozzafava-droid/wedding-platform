-- Nudge automatico: dopo 3 mesi dall'evento, se il cliente non ha ancora chiuso la selezione album
-- (nessuna approvazione), gli si manda una email che spinge a completarla. Ri-nudge ogni 30 giorni.

create table if not exists public.album_nudges (
  entry_id uuid primary key,
  last_nudge_at timestamptz not null default now(),
  count int not null default 1
);
alter table public.album_nudges enable row level security; -- nessuna policy → solo service role

-- Kick: il cron chiama l'edge album-nudge-run (che fa la logica + invio email).
create or replace function public.album_nudge_kick() returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  v_url := regexp_replace(coalesce(current_setting('app.supabase_url', true), 'http://kong:8000/functions/v1'), '/+$', '');
  v_key := coalesce(current_setting('app.functions_anon_key', true), '');
  perform net.http_post(
    url     := v_url || '/album-nudge-run',
    headers := jsonb_build_object('Content-Type', 'application/json')
               || case when v_key <> '' then jsonb_build_object('Authorization', 'Bearer ' || v_key) else '{}'::jsonb end,
    body    := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end$$;

-- Schedula ogni giorno alle 09:00 UTC (best-effort: se pg_cron non c'è, ignora).
do $$ begin
  perform cron.schedule('album-nudge-daily', '0 9 * * *', 'select public.album_nudge_kick();');
exception when others then raise notice 'pg_cron non disponibile: album-nudge non schedulato'; end $$;
