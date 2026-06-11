-- Puntino rosso come GUIDA: dal campanello fin dentro l'evento.
-- unread_by_entry: per l'utente, gli eventi con notifiche non lette + i tipi (per capire
-- QUALE tab evidenziare). mark_entry_notifications_read: spegne il puntino di una sezione.
create or replace function public.unread_by_entry()
returns table(entry_id uuid, types text[], n integer)
language sql stable security definer set search_path = public as $$
  select ref_id, array_agg(distinct type), count(*)::int
    from public.user_notifications
   where user_id = auth.uid() and read_at is null and ref_id is not null
   group by ref_id;
$$;
grant execute on function public.unread_by_entry() to authenticated;

create or replace function public.mark_entry_notifications_read(p_entry uuid, p_types text[])
returns void language sql security definer set search_path = public as $$
  update public.user_notifications
     set read_at = now()
   where user_id = auth.uid() and read_at is null and ref_id = p_entry
     and (p_types is null or type = any(p_types));
$$;
grant execute on function public.mark_entry_notifications_read(uuid, text[]) to authenticated;
