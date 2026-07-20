-- Accende le email di album-final-notify e album-nudge: non chiamavano notify_guc_ready,
-- quindi il gate restava chiuso (le GUC non erano iniettate) e la POST partiva verso un url
-- vuoto. Aggiungo una sola riga — perform public._notify_load_config() — prima di leggere
-- le GUC. Stesso identico corpo, nessun'altra modifica.

create or replace function public.tg_album_final_notify()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r record; v_url text; v_key text;
begin
  if new.status = 'FINAL' and (tg_op = 'INSERT' or coalesce(old.status, '') <> 'FINAL') then
    for r in select user_id from public.wedding_couple_members where entry_id = new.entry_id and user_id is not null loop
      begin
        perform public.push_user_notification(
          r.user_id, 'ALBUM_FINAL', 'Il tuo album è pronto',
          'Il fotografo ha completato il tuo album: guardalo ora.',
          '/album/' || new.entry_id::text, new.entry_id);
      exception when others then null; end;
    end loop;
    begin
      perform public._notify_load_config();   -- <-- accende il gate email
      v_url := regexp_replace(current_setting('app.supabase_url', true), '/+$', '');
      v_key := current_setting('app.functions_anon_key', true);
      perform net.http_post(
        url := v_url || '/album-final-notify',
        headers := jsonb_build_object('Content-Type', 'application/json')
                   || case when coalesce(v_key, '') <> '' then jsonb_build_object('Authorization', 'Bearer ' || v_key) else '{}'::jsonb end,
        body := jsonb_build_object('entry_id', new.entry_id));
    exception when others then null; end;
  end if;
  return new;
end$$;

create or replace function public.album_nudge_kick() returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  perform public._notify_load_config();   -- <-- accende il gate email
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
