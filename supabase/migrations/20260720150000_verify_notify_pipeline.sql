-- Verifica che il gate email sia ora APERTO (config caricata da tabella via set_config).
-- Se _notify_load_config() è true, ogni hook (lead-notify, circle-notify) manderà la POST.
do $$
declare v_loaded boolean; v_ready boolean; v_url text;
begin
  v_loaded := public._notify_load_config();
  v_url := current_setting('app.supabase_url', true);   -- settata da _notify_load_config, stessa tx
  raise notice '_notify_load_config = %  | app.supabase_url ora = %', v_loaded, left(coalesce(v_url,''), 40);
  v_ready := public.notify_guc_ready('verify', null);
  raise notice 'notify_guc_ready = %  (true = email ACCESE per lead + cerchio)', v_ready;
  if not (v_loaded and v_ready) then
    raise exception 'gate email ancora chiuso: notify_config non popolata?';
  end if;
  -- pulizia dell'eventuale log 'verify' appena creato (non era un vero fallimento)
  delete from public.notification_dispatch_failures where hook = 'verify';
  raise notice 'OK  gate email aperto';
end $$;
