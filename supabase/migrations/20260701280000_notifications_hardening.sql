-- ============================================================================
-- HARDENING NOTIFICHE — "se la POST verso l'edge fallisce, NON in silenzio"
-- ----------------------------------------------------------------------------
-- PROBLEMA (rosso, latente):
--   I trigger di notifica (notify_on_lead_request, album_nudge, digest) fanno
--   net.http_post verso `current_setting('app.supabase_url')` con FALLBACK a
--   'http://kong:8000/functions/v1' (URL del solo ambiente Docker locale) e
--   avvolgono tutto in `exception when others then null`.
--   Se in PRODUZIONE le GUC app.supabase_url / app.functions_anon_key non sono
--   state impostate a mano (l'ALTER DATABASE esiste solo come COMMENTO nelle
--   migrazioni), ogni lead reale fa una POST verso un host inesistente,
--   l'errore viene inghiottito, e NESSUNA email parte. Perdita invisibile.
--
-- QUESTA MIGRAZIONE NON "indovina" l'URL di produzione (non può: dipende dal
-- progetto Supabase). Fa due cose oneste:
--   1) Una funzione di health-check che dice a voce se le GUC sono configurate.
--   2) Una tabella-spia che registra i fallimenti di invocazione, così un invio
--      mancato diventa VISIBILE invece che silenzioso.
-- L'umano imposta le GUC una volta sola (istruzioni sotto) e poi verifica con
-- select public.notifications_healthcheck();
-- ============================================================================

-- 1) Health-check leggibile da chiunque debba fare diagnosi -------------------
create or replace function public.notifications_healthcheck()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_url text := current_setting('app.supabase_url', true);
  v_key text := current_setting('app.functions_anon_key', true);
  v_url_ok boolean := v_url is not null and v_url <> '' and v_url not like 'http://kong:%';
  v_key_ok boolean := v_key is not null and v_key <> '';
begin
  return jsonb_build_object(
    'url_configured', v_url_ok,
    'key_configured', v_key_ok,
    'url_seen', case when v_url is null then '(NULL)'
                     when v_url like 'http://kong:%' then '(fallback locale — NON valido in prod)'
                     else 'ok' end,
    'ready', (v_url_ok and v_key_ok),
    'hint', case when (v_url_ok and v_key_ok) then 'Notifiche configurate.'
                 else 'ESEGUIRE (una volta) come owner del DB: '
                      || 'alter database postgres set app.supabase_url = ''https://<PROJECT_REF>.supabase.co/functions/v1''; '
                      || 'alter database postgres set app.functions_anon_key = ''<ANON_KEY>''; '
                      || 'poi: select pg_reload_conf();'
            end
  );
end$$;

grant execute on function public.notifications_healthcheck() to authenticated;

-- 2) Tabella-spia: i fallimenti di invocazione edge diventano visibili --------
create table if not exists public.notification_dispatch_failures (
  id          uuid primary key default gen_random_uuid(),
  hook        text not null,              -- es. 'lead-notify', 'album-nudge'
  entity_id   uuid,                       -- lead_id / entry_id coinvolto
  reason      text,                       -- 'guc_not_configured' | messaggio errore
  created_at  timestamptz not null default now()
);

alter table public.notification_dispatch_failures enable row level security;
drop policy if exists "ndf_admin_read" on public.notification_dispatch_failures;
create policy "ndf_admin_read" on public.notification_dispatch_failures
  for select using (public.is_support_staff());

-- Helper che i trigger possono chiamare PRIMA del net.http_post: se le GUC non
-- sono pronte registra il fallimento invece di sparare a vuoto. È OPT-IN: i
-- trigger esistenti non cambiano finché non li si aggancia (fatto separatamente,
-- fuori da questa migrazione, per non toccare le catene in un colpo solo).
create or replace function public.notify_guc_ready(p_hook text, p_entity uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := current_setting('app.supabase_url', true);
  v_key text := current_setting('app.functions_anon_key', true);
begin
  if v_url is null or v_url = '' or v_url like 'http://kong:%' or v_key is null or v_key = '' then
    insert into public.notification_dispatch_failures(hook, entity_id, reason)
    values (p_hook, p_entity, 'guc_not_configured');
    return false;
  end if;
  return true;
end$$;

-- Diagnosi rapida in prod:
--   select public.notifications_healthcheck();          -- "ready": true/false
--   select * from public.notification_dispatch_failures  -- deve restare VUOTA
--     order by created_at desc limit 20;

-- Diagnosi immediata a questo push: stampa lo stato delle GUC in produzione.
do $$ begin raise notice 'NOTIF_HEALTHCHECK=%', public.notifications_healthcheck()::text; end $$;
