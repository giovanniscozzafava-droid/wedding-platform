-- FIX "Preventivo non trovato" nel Compila-con-AI: l'edge contract-ai-draft (e la firma estero)
-- leggono quotes.client_country, ma la colonna non esisteva → la select PostgREST andava in errore →
-- l'edge trattava il preventivo come inesistente. Aggiungo la colonna (nullable: se vuota, la giurisdizione
-- del contratto resta Italia, come da default).
alter table public.quotes add column if not exists client_country text;
comment on column public.quotes.client_country is 'Paese/nazionalità del cliente (per giurisdizione+lingua del contratto). Null = Italia di default.';
