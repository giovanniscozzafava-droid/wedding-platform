-- RACE / DOPPIA PRENOTAZIONE: book-appointment (pubblico) controllava lo slot con un SELECT di
-- overlap e poi faceva l'INSERT — non atomico. Due richieste concorrenti per lo stesso slot passano
-- entrambe il controllo e inseriscono entrambe (status default 'CONFIRMED') → slot prenotato due
-- volte. La tabella bookings non aveva alcun vincolo di esclusione.
--
-- Fix: EXCLUDE constraint GIST che impedisce, a livello DB e in modo atomico, due prenotazioni
-- CONFIRMED sovrapposte per lo stesso professionista. La seconda insert concorrente fallisce con
-- 23P01 (l'edge lo traduce in slot_taken). Range [) → slot adiacenti (fine == inizio) NON collidono.

create extension if not exists btree_gist;

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (professional_id with =, tstzrange(starts_at, ends_at) with &&)
  where (status = 'CONFIRMED');
