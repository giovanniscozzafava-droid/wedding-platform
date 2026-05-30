-- ============================================================================
-- FASE 0 / SIMULAZIONE COMPLETA — Resend hook per il digest giornaliero.
-- ----------------------------------------------------------------------------
-- Sostituisce il placeholder `invia_digest_giornaliero()` (che faceva solo
-- RAISE NOTICE) con una vera invocazione della edge function `send-digest`,
-- una chiamata per ogni destinatario con notifiche PENDING del giorno.
--
-- Il dispatch e' best-effort: l'estensione `pg_net` puo' non essere abilitata
-- in tutti gli ambienti (legacy / locali minimi). In tale caso la funzione
-- esegue il fallback "raise notice" originale e ritorna comunque il count.
--
-- Configurazione richiesta (GUC di sessione o impostazione a livello DB):
--   - app.supabase_url       : base URL dell'API (es. http://kong:8000/functions/v1
--                              per supabase locale, o https://<ref>.functions.supabase.co/<fn>)
--   - app.functions_anon_key : chiave per autenticare la chiamata (anon o service_role).
--
-- In assenza di GUC, la funzione tenta valori sicuri di default per ambiente
-- supabase locale (kong gateway) — in produzione, settare i GUC via:
--   alter database postgres set app.supabase_url = '...';
--   alter database postgres set app.functions_anon_key = '...';
-- ============================================================================

create or replace function public.invia_digest_giornaliero()
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r            record;
  v_oggi       date := (now() at time zone 'Europe/Rome')::date;
  v_tot        int := 0;
  v_pg_net_ok  boolean := false;
  v_url        text;
  v_key        text;
  v_body       jsonb;
begin
  -- Verifica disponibilita' di pg_net.
  select exists (
    select 1 from pg_extension where extname = 'pg_net'
  ) into v_pg_net_ok;

  if v_pg_net_ok then
    -- Legge endpoint+chiave da GUC, con fallback per supabase locale.
    v_url := coalesce(
      current_setting('app.supabase_url', true),
      'http://kong:8000/functions/v1'
    );
    v_key := coalesce(
      current_setting('app.functions_anon_key', true),
      ''
    );

    -- Normalizza URL (rimuove trailing slash).
    v_url := regexp_replace(v_url, '/+$', '');

    for r in
      select destinatario_id, totale, primi_10
        from public.v_notifiche_digest_per_utente
       where data_digest = v_oggi
         and totale > 0
    loop
      v_body := jsonb_build_object(
        'destinatario_id', r.destinatario_id,
        'totale',          r.totale,
        'primi_10',        r.primi_10
      );

      -- Best-effort: ogni invocazione e' indipendente, errore HTTP non blocca le altre.
      begin
        perform net.http_post(
          url     := v_url || '/send-digest',
          headers := case
                       when v_key <> '' then jsonb_build_object(
                         'Content-Type',  'application/json',
                         'Authorization', 'Bearer ' || v_key
                       )
                       else jsonb_build_object('Content-Type', 'application/json')
                     end,
          body    := v_body,
          timeout_milliseconds := 8000
        );
        v_tot := v_tot + 1;
      exception when others then
        raise notice 'invia_digest_giornaliero: http_post fallita per user=% (%, %)',
          r.destinatario_id, SQLSTATE, SQLERRM;
      end;
    end loop;

    return v_tot;
  end if;

  -- Fallback senza pg_net: logga via RAISE NOTICE (comportamento legacy).
  raise notice 'invia_digest_giornaliero: pg_net non disponibile, fallback notice-only';
  for r in
    select destinatario_id, totale, primi_10
      from public.v_notifiche_digest_per_utente
     where data_digest = v_oggi
       and totale > 0
  loop
    raise notice 'digest user=% count=% primi=%',
      r.destinatario_id, r.totale, r.primi_10;
    v_tot := v_tot + 1;
  end loop;
  return v_tot;
end;
$$;

comment on function public.invia_digest_giornaliero() is
  'Invia digest giornaliero notifiche PENDING via edge function send-digest (Resend). Best-effort: se pg_net non disponibile, fallback su RAISE NOTICE. Schedulare via pg_cron quotidianamente.';

revoke all on function public.invia_digest_giornaliero() from public;
grant execute on function public.invia_digest_giornaliero() to authenticated;
