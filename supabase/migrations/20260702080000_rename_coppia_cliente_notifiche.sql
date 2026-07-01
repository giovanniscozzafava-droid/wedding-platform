-- Rename "coppia" → "cliente" nei testi delle notifiche (il termine "coppia" ha senso solo per il
-- matrimonio; la piattaforma gestisce ogni tipo evento). "Cliente" è generico e corretto ovunque.
-- Solo TESTO: la logica, i tipi di notifica e i trigger restano identici.

create or replace function public._notify_couple_joined() returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text;
begin
  if old.user_id is null and new.user_id is not null then
    select owner_id, coalesce(nullif(title, ''), 'un evento') into v_owner, v_title from public.calendar_entries where id = new.entry_id;
    if v_owner is not null and v_owner <> new.user_id then
      perform public.push_user_notification(v_owner, 'couple_joined', 'Il cliente si è registrato',
        coalesce(nullif(new.full_name, ''), 'Il cliente') || ' ha accettato l''invito a ' || v_title || '.', '/weddings/' || new.entry_id::text, new.entry_id);
    end if;
  end if;
  return new;
end$$;

create or replace function public._notify_ccr_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.calendar_entries where id = new.wedding_id limit 1;
  if v_owner is not null and v_owner <> new.requested_by then
    perform public.push_user_notification(v_owner, 'change_request',
      'Nuova richiesta di modifica',
      coalesce(new.title, 'Il cliente ha chiesto una modifica'),
      '/weddings/' || new.wedding_id, new.wedding_id);
  end if;
  return new;
end$$;
