-- Puntine catalogo album: notifica in-app (campanella) + deep-link AL PUNTO.
-- Prima non c'era nessuna notifica DB su album_pins (solo email best-effort su messaggio, con CTA
-- generica a /album-lab). Ora: quando un CLIENTE lascia una puntina (con domanda) o scrive nel
-- thread, il FOTOGRAFO (owner dell'evento) riceve la notifica con link /scegli-album/:entryId?pin=<id>
-- che lo porta esattamente sulla puntina. Quando il fotografo risponde, notifichiamo la coppia.

-- 1) Nuova puntina con domanda dal cliente -> notifica il fotografo.
create or replace function public.tg_album_pin_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.calendar_entries where id = new.entry_id;
  if v_owner is not null
     and coalesce(new.created_by, '00000000-0000-0000-0000-000000000000'::uuid) <> v_owner
     and coalesce(nullif(btrim(new.comment), ''), null) is not null then
    begin
      perform public.push_user_notification(
        v_owner, 'album_pin', 'Nuova puntina sul catalogo album',
        left(new.comment, 140),
        '/scegli-album/' || new.entry_id::text || '?pin=' || new.id::text,
        new.id);
    exception when others then null; end;
  end if;
  return new;
end$$;
drop trigger if exists trg_album_pin_notify on public.album_pins;
create trigger trg_album_pin_notify after insert on public.album_pins
  for each row execute function public.tg_album_pin_notify();

-- 2) Messaggio nel thread: cliente -> fotografo; fotografo -> coppia. Sempre con deep-link al pin.
create or replace function public.tg_album_pin_msg_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_uid uuid;
        v_link text := '/scegli-album/' || new.entry_id::text || '?pin=' || new.pin_id::text;
begin
  if new.author_role = 'client' then
    select owner_id into v_owner from public.calendar_entries where id = new.entry_id;
    if v_owner is not null and coalesce(new.author_id,'00000000-0000-0000-0000-000000000000'::uuid) <> v_owner then
      begin
        perform public.push_user_notification(v_owner, 'album_pin', 'Domanda sul catalogo album',
          left(new.body, 140), v_link, new.pin_id);
      exception when others then null; end;
    end if;
  else
    for v_uid in select user_id from public.wedding_couple_members where entry_id = new.entry_id loop
      if coalesce(new.author_id,'00000000-0000-0000-0000-000000000000'::uuid) <> v_uid then
        begin
          perform public.push_user_notification(v_uid, 'album_pin', 'Il fotografo ha risposto sul catalogo',
            left(new.body, 140), v_link, new.pin_id);
        exception when others then null; end;
      end if;
    end loop;
  end if;
  return new;
end$$;
drop trigger if exists trg_album_pin_msg_notify on public.album_pin_messages;
create trigger trg_album_pin_msg_notify after insert on public.album_pin_messages
  for each row execute function public.tg_album_pin_msg_notify();
