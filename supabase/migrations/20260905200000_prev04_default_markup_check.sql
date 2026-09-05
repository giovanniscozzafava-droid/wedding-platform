-- ============================================================================
-- PREV-04: quotes.default_markup_percent era l'unico dei tre campi di markup
-- senza CHECK (item_markup_percent e quote_supplier_markups.markup_percent
-- sono vincolati 0..1000 dal 20260611030000). Un valore molto negativo può
-- spingere line_client sotto costo. Nessuna riga esistente viola il vincolo
-- (verificato prima di applicarlo).
-- ============================================================================

alter table quotes
  add constraint quotes_default_markup_pct_chk
  check (default_markup_percent >= 0 and default_markup_percent <= 1000);
