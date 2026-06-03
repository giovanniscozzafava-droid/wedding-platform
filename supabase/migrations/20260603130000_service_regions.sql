-- Sostituisce il concetto di "raggio di servizio (km)" con le REGIONI in cui il
-- professionista vuole lavorare (una, alcune o tutte).
alter table public.profiles
  add column if not exists service_regions text[];

comment on column public.profiles.service_regions is
  'Regioni italiane in cui il professionista vuole lavorare. Array vuoto/NULL = nessuna preferenza; tutte le 20 = tutta Italia.';
