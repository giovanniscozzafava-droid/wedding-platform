-- Clausola a pagamento PER CARTELLA (il fotografo mette in vendita un'intera
-- cartella). La riscossione vera sarà organizzata con Stripe in un secondo momento.
-- Tutto resta dietro al flag photo_sales_enabled (attualmente OFF → vendite blindate):
-- finché il flag è off, prezzi/vendita non hanno alcun effetto sul download.
alter table public.gallery_folders
  add column if not exists is_for_sale boolean not null default false,
  add column if not exists price_cents integer;
