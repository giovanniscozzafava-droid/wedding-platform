-- Pulizia dati di test e2e (prenotazioni di @planfully.dev) + relativi slot BUSY.
delete from public.supplier_availability_slots where id in (
  select b.avail_slot_id from public.bookings b where b.client_email like '%@planfully.dev' and b.avail_slot_id is not null);
delete from public.bookings where client_email like '%@planfully.dev';
