-- Costo di listino per modello (quanto paga il fotografo al lab) + ricarico predefinito.
-- Prezzo cliente = costo + ricarico. L'AI legge i COSTI dal PDF del listino fornitore; il
-- fotografo decide il ricarico (%). price resta il prezzo di vendita al cliente.
alter table public.album_catalog_hotspots add column if not exists cost numeric;
alter table public.album_catalogs add column if not exists markup_percent numeric not null default 0;
