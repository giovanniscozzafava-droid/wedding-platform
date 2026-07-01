-- BUG FIX: un WP/Location che riceve un lead (tabella lead_requests) NON riceveva né notifica
-- in-app né email. Esisteva il trigger di notifica solo su supplier_leads; su lead_requests niente.
-- E l'email era fire-and-forget dal browser (.catch(()=>{})): se non partiva, silenzio totale.
-- (Caso reale: nuovo iscritto Antonio Mancuso — lead ricevuto, zero notifica/email.)
--
-- Ora un trigger su lead_requests fa TUTTO lato server, affidabile e indipendente dal front:
--   1) notifica in-app al destinatario (push_user_notification → campanella + badge)
--   2) invoca l'edge lead-notify via net.http_post → email al WP e al cliente
-- Le invoke dal browser sono state rimosse (niente doppioni).

create or replace function public.notify_on_lead_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_url text; v_key text;
begin
  -- 1) notifica in-app al WP/Location destinatario
  perform public.push_user_notification(
    new.wp_id, 'NEW_LEAD',
    'Nuova richiesta cliente',
    coalesce(nullif(trim(new.client_name), ''), 'Un cliente') || ' — ' || coalesce(new.event_kind, 'evento'),
    '/leads', new.id);

  -- 2) email lato server (best-effort): edge lead-notify. Se pg_net/GUC non disponibili,
  --    la notifica in-app è comunque già passata.
  begin
    v_url := regexp_replace(coalesce(current_setting('app.supabase_url', true), 'http://kong:8000/functions/v1'), '/+$', '');
    v_key := coalesce(current_setting('app.functions_anon_key', true), '');
    perform net.http_post(
      url     := v_url || '/lead-notify',
      headers := jsonb_build_object('Content-Type', 'application/json')
                 || case when v_key <> '' then jsonb_build_object('Authorization', 'Bearer ' || v_key) else '{}'::jsonb end,
      body    := jsonb_build_object('lead_id', new.id));
  exception when others then null;
  end;

  return new;
end$$;

drop trigger if exists trg_notify_on_lead_request on public.lead_requests;
create trigger trg_notify_on_lead_request
  after insert on public.lead_requests
  for each row execute function public.notify_on_lead_request();
