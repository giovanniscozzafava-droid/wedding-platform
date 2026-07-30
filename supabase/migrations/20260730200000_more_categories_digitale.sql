-- Nuove categorie servizio richieste: "Digitale" e "Addio al nubilato e celibato".
-- Trasversali (subrole null) → visibili a tutti i professionisti nel picker categoria.
-- Idempotente (on conflict slug do nothing), safe in produzione.
insert into service_categories (id, name, slug, subrole, is_standard) values
  ('11111111-0000-0000-0000-000000000094','Digitale',                     'digitale',                 null, true),
  ('11111111-0000-0000-0000-000000000095','Addio al nubilato e celibato', 'addio-nubilato-celibato',  null, true)
on conflict (slug) do nothing;
