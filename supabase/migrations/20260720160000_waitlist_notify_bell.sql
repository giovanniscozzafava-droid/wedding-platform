-- La notifica "nuovo iscritto Maestranze" andava nella tabella `notifiche` (Prossima
-- Mossa). Ma il CAMPANELLO (NotificationBell) legge `user_notifications` via
-- push_user_notification: sono due sistemi diversi. Se l'admin guarda il campanello e non
-- la Prossima Mossa, non vede l'iscritto. La sposto nel campanello (canale universale).
create or replace function public.trg_waitlist_notify_confirm()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record; v_mestiere text; v_prov text;
begin
  if new.email_confirmed_at is null or old.email_confirmed_at is not null then
    return new;
  end if;
  v_mestiere := coalesce((select name from maestranze_skills where id = new.skill_id),
                         new.professione_altro, 'mestiere non indicato');
  v_prov := coalesce((select nome from province_regioni where provincia = new.provincia), new.provincia);
  for a in select id from public.profiles where role = 'ADMIN' loop
    perform public.push_user_notification(
      a.id, 'MAESTRANZA_WAITLIST', 'Nuovo iscritto Maestranze',
      new.nome || ' · ' || v_mestiere || ' · ' || v_prov,
      '/admin/maestranze/waitlist', new.id);
  end loop;
  return new;
end$$;
