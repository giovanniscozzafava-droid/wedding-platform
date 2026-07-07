-- Quando il fotografo segna l'album come FINALE (album_projects.status → 'FINAL'), avvisa la COPPIA:
-- notifica in-app (campanella) + email con link diretto a visionare l'album. Pattern lato server
-- (trigger), come notify_on_lead_request: affidabile, non dipende dal browser.
create or replace function public.tg_album_final_notify()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare r record; v_url text; v_key text;
begin
  if new.status = 'FINAL' and (tg_op = 'INSERT' or coalesce(old.status, '') <> 'FINAL') then
    -- notifica in-app a ogni membro della coppia
    for r in select user_id from public.wedding_couple_members where entry_id = new.entry_id and user_id is not null loop
      begin
        perform public.push_user_notification(
          r.user_id, 'ALBUM_FINAL', 'Il tuo album è pronto',
          'Il fotografo ha completato il tuo album: guardalo ora.',
          '/album/' || new.entry_id::text, new.entry_id);
      exception when others then null; end;
    end loop;
    -- email alla coppia via edge album-final-notify (best-effort, non blocca il salvataggio)
    begin
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

drop trigger if exists trg_album_final_notify on public.album_projects;
create trigger trg_album_final_notify
  after insert or update of status on public.album_projects
  for each row execute function public.tg_album_final_notify();
