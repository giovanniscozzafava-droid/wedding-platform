-- Aggancia notify_guc_ready a notify_on_lead_request: se le GUC non sono configurate, invece di
-- fare una POST a vuoto (host locale) e inghiottire l'errore, REGISTRA il fallimento in
-- notification_dispatch_failures (visibile) e salta la POST. La notifica in-app parte comunque.
create or replace function public.notify_on_lead_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_url text; v_key text;
begin
  -- 1) notifica in-app al WP/Location destinatario (sempre, indipendente dalle GUC)
  perform public.push_user_notification(
    new.wp_id, 'NEW_LEAD',
    'Nuova richiesta cliente',
    coalesce(nullif(trim(new.client_name), ''), 'Un cliente') || ' — ' || coalesce(new.event_kind, 'evento'),
    '/leads', new.id);

  -- 2) email lato server via edge lead-notify — SOLO se le GUC sono pronte. Altrimenti il
  --    fallimento viene loggato (notify_guc_ready) invece di sparire.
  if public.notify_guc_ready('lead-notify', new.id) then
    begin
      v_url := regexp_replace(current_setting('app.supabase_url', true), '/+$', '');
      v_key := coalesce(current_setting('app.functions_anon_key', true), '');
      perform net.http_post(
        url     := v_url || '/lead-notify',
        headers := jsonb_build_object('Content-Type', 'application/json')
                   || case when v_key <> '' then jsonb_build_object('Authorization', 'Bearer ' || v_key) else '{}'::jsonb end,
        body    := jsonb_build_object('lead_id', new.id));
    exception when others then
      insert into public.notification_dispatch_failures(hook, entity_id, reason)
      values ('lead-notify', new.id, 'http_post_error: ' || SQLERRM);
    end;
  end if;

  return new;
end$$;
