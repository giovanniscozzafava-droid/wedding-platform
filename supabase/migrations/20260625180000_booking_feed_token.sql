-- Token per il feed iCal abbonabile (webcal): il professionista lo aggiunge UNA volta al suo
-- calendario (Apple/Google/Outlook) e tutte le prenotazioni gli compaiono lì, sempre aggiornate.
alter table public.booking_settings add column if not exists feed_token uuid not null default gen_random_uuid();
