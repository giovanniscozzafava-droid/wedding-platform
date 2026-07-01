-- Le GUC app.supabase_url/app.functions_anon_key NON sono impostabili in questo progetto Supabase
-- ('permission denied to set parameter'), quindi il POST server-side dal trigger non può essere
-- configurato per via GUC. Semplifichiamo: il trigger fa SOLO la notifica in-app (sempre affidabile,
-- insert diretto). L'EMAIL torna a partire dal frontend (invoke lead-notify col la anon key già nel
-- bundle di produzione — nessuna GUC richiesta). Niente più POST a vuoto né rumore nella spia.
create or replace function public.notify_on_lead_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_user_notification(
    new.wp_id, 'NEW_LEAD',
    'Nuova richiesta cliente',
    coalesce(nullif(trim(new.client_name), ''), 'Un cliente') || ' — ' || coalesce(new.event_kind, 'evento'),
    '/leads', new.id);
  return new;
end$$;
