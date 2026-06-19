-- Il fotografo può RISPONDERE a una richiesta di modifica del cliente con un "perché meglio di no"
-- (motivazioni tecniche: proporzioni, numero pagine, risoluzione, taglio, dorso/piega, ecc.).
-- La richiesta passa a status DECLINED e l'autore (coppia) viene avvisato. La coppia può comunque
-- "insistere" riaprendola (status -> OPEN). RLS già esistente (arr_rw: album_can_edit) copre l'UPDATE
-- sia dal fotografo sia dalla coppia.
alter table public.album_revision_requests
  add column if not exists reply        text,        -- spiegazione del fotografo
  add column if not exists reply_reason text,        -- tag rapido: proporzioni|pagine|qualita|ritaglio|dorso|stampa|estetica|racconto|altro
  add column if not exists reply_at      timestamptz,
  add column if not exists replied_by    uuid;

-- stampa autore/orario della risposta quando il fotografo (o chiunque può editare) risponde
create or replace function public._stamp_album_rev_reply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reply is distinct from old.reply and new.reply is not null then
    new.reply_at := now();
    new.replied_by := auth.uid();
  end if;
  return new;
end$$;
drop trigger if exists trg_stamp_album_rev_reply on public.album_revision_requests;
create trigger trg_stamp_album_rev_reply before update on public.album_revision_requests
  for each row execute function public._stamp_album_rev_reply();

-- avvisa l'AUTORE (coppia) quando arriva la risposta del fotografo
create or replace function public._notify_album_rev_reply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reply is distinct from old.reply and new.reply is not null
     and new.user_id is not null and new.user_id <> auth.uid() then
    perform public.push_user_notification(new.user_id, 'album_revision_reply',
      'Il fotografo ha risposto alla tua richiesta',
      coalesce(nullif(new.reply_reason, '') || ': ', '') || left(new.reply, 120),
      '/album/' || new.entry_id, new.entry_id);
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_album_rev_reply on public.album_revision_requests;
create trigger trg_notify_album_rev_reply after update of reply on public.album_revision_requests
  for each row execute function public._notify_album_rev_reply();
