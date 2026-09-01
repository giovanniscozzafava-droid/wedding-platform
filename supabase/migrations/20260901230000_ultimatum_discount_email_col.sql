-- La controproposta deve restare nella posta, non solo sullo schermo: chi chiude la
-- pagina non ha più traccia dello sconto che gli hai appena fatto.
alter table public.quote_ultimatums
  add column if not exists discount_email_at timestamptz;
comment on column public.quote_ultimatums.discount_email_at is
  'Quando è stata mandata la mail con la nuova cifra. Serve a non mandarla due volte.';
