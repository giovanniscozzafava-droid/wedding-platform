-- Chiudi il cerchio dei post-it: quando il fotografo segna una richiesta come DONE (incluso
-- l'"Inserisci la foto" dei post-it "sostituisci con"), avvisa l'AUTORE (la coppia) che la sua
-- modifica è stata fatta. Prima notificavamo solo il fotografo all'arrivo della richiesta.
create or replace function public._notify_album_rev_done() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'DONE' and coalesce(old.status, '') <> 'DONE'
     and new.user_id is not null and new.user_id <> auth.uid() then
    perform public.push_user_notification(new.user_id, 'album_revision_done',
      'Modifica all''album completata',
      'Il fotografo ha sistemato la tua richiesta' || coalesce(' (tav. ' || (new.tavola_index + 1) || ')', '') || '.',
      '/album/' || new.entry_id, new.entry_id);
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_album_rev_done on public.album_revision_requests;
create trigger trg_notify_album_rev_done after update of status on public.album_revision_requests
  for each row execute function public._notify_album_rev_done();
