-- ADMIN notificato su OGNI nuova registrazione (fornitori, WP, location, coppie/clienti, ospiti:
-- tutti creano una riga in profiles). Una notifica nel campanello per ciascun admin.
-- NB: gli eventi a volume altissimo (RSVP/iscrizione galleria dei singoli ospiti) NON sono qui per
-- non intasare: andrebbero in un digest. Qui = le registrazioni vere (basso volume, alto valore).
create or replace function public.trg_admin_notify_new_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare a record; v_who text; v_role text;
begin
  v_role := coalesce(new.role::text, 'utente');
  v_who  := coalesce(nullif(btrim(new.business_name), ''), nullif(btrim(new.full_name), ''), 'Nuovo utente');
  for a in select id from public.profiles where role = 'ADMIN' loop
    insert into public.notifiche(destinatario_id, evento_id, tipo, titolo, descrizione, link_action, owner_della_mossa, priorita)
      values (a.id, null, 'ADMIN_SIGNUP', 'Nuova registrazione', v_role || ' · ' || v_who, '/admin', new.id, 3);
  end loop;
  return new;
end$$;
drop trigger if exists trg_admin_notify_new_profile on public.profiles;
create trigger trg_admin_notify_new_profile after insert on public.profiles
  for each row execute function public.trg_admin_notify_new_profile();
