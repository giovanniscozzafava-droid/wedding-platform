-- P0-4 HOTFIX (audit calendario 13/07/2026): promemoria + digest "documentati, non eseguiti".
-- 20260530400000 ha creato il generatore promemoria (idempotente) e 20260601300000 il digest
-- REALE (pg_net -> edge send-digest). MA nessun pg_cron li ha MAI chiamati:
--   - notifiche_genera_promemoria_per_evento: mai invocata  -> zero promemoria a 30/14/7/2 giorni.
--   - invia_digest_giornaliero: mai schedulata              -> zero digest.
-- pg_cron e' gia' attivo nel progetto (scadi-opzioni, purge-signing-pii, album-nudge-daily).
--
-- Questa migration:
--   1. wrapper notifiche_rigenera_promemoria_futuri() che rigenera i promemoria di TUTTI gli
--      eventi futuri (il generatore fa upsert on conflict + rispetta DONE/SKIPPED -> rerun-safe);
--   2. schedula 'rigenera-promemoria' ogni notte -> promemoria IN-APP (NotificationBell). Sicuro:
--      nessuna email, solo righe PENDING in `notifiche`.
--   3. schedula 'invia-digest-giornaliero' ogni mattina. DARK by design: invia_digest_giornaliero
--      e' no-op finche' NON sono settati i GUC di prod (senza, pg_net posta a kong:8000 e fallisce,
--      best-effort). Per ACCENDERE le email digest a utenti reali (opt-in esplicito):
--        alter database postgres set app.supabase_url = 'https://<ref>.functions.supabase.co';
--        alter database postgres set app.functions_anon_key = '<anon-or-service-key>';

-- 1. Wrapper: rigenera i promemoria di tutti gli eventi futuri ----------------
create or replace function public.notifiche_rigenera_promemoria_futuri()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r      record;
  v_tot  int := 0;
begin
  for r in
    select id from public.calendar_entries
     where date_from is not null and date_from >= current_date
  loop
    v_tot := v_tot + coalesce(public.notifiche_genera_promemoria_per_evento(r.id), 0);
  end loop;
  return v_tot;
end;
$$;

comment on function public.notifiche_rigenera_promemoria_futuri() is
  'Rigenera (idempotente) i promemoria di tutti gli eventi con data_from >= oggi. Schedulata da pg_cron ogni notte. Vedi 20260713220000.';

revoke all on function public.notifiche_rigenera_promemoria_futuri() from public;
grant execute on function public.notifiche_rigenera_promemoria_futuri() to authenticated;

-- 2. Cron: generazione promemoria IN-APP (sicuro, nessuna email) --------------
--    01:15 UTC ogni notte. cron.schedule upserta per jobname -> rerun-safe.
do $$ begin
  perform cron.schedule('rigenera-promemoria', '15 1 * * *',
    'select public.notifiche_rigenera_promemoria_futuri();');
exception when others then
  raise notice 'pg_cron non disponibile: rigenera-promemoria non schedulato (%)', SQLERRM;
end $$;

-- 3. Cron: digest giornaliero (DARK finche' GUC non settati, vedi header) ------
--    08:00 UTC ogni mattina.
do $$ begin
  perform cron.schedule('invia-digest-giornaliero', '0 8 * * *',
    'select public.invia_digest_giornaliero();');
exception when others then
  raise notice 'pg_cron non disponibile: invia-digest non schedulato (%)', SQLERRM;
end $$;

-- Prima esecuzione immediata della generazione (bootstrap): popola subito i
-- promemoria degli eventi gia' in agenda, senza aspettare la notte. In-app only.
do $$
declare v_n int;
begin
  v_n := public.notifiche_rigenera_promemoria_futuri();
  raise notice 'bootstrap promemoria: % righe generate/aggiornate', v_n;
exception when others then
  raise notice 'bootstrap promemoria saltato (%)', SQLERRM;
end $$;
