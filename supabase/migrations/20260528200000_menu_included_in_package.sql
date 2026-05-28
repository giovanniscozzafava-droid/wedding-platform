-- ============================================================================
-- Menu: distingue voci che fanno parte del pacchetto a persona (gia incluse)
-- da quelle extra a pagamento.
-- ----------------------------------------------------------------------------
-- Quando il WP ha venduto un pacchetto preventivo "tutto incluso a persona",
-- il menu del catering ha price_per_guest=null perche e gia coperto. Per non
-- confondere con "prezzo da definire", aggiungiamo un flag esplicito.
-- ============================================================================

alter table event_menu
  add column if not exists included_in_package boolean not null default false;

comment on column event_menu.included_in_package is
  'true = questa voce e gia compresa nel prezzo a persona del pacchetto. price_per_guest viene ignorato in totale.';

-- Quando included_in_package=true, il prezzo non deve sommarsi al totale.
-- L'eventuale somma resta a carico del frontend (gia calcola la stat).
