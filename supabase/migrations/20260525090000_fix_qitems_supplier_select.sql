-- Fix: il fornitore non vedeva le proprie voci nel preventivo.
-- La policy qitems_select_via_quote permette solo all'owner del quote (WP).
-- Aggiungo policy per supplier che vede solo le sue voci.

drop policy if exists "qitems_select_supplier" on quote_items;
create policy "qitems_select_supplier"
  on quote_items for select
  using (supplier_id = auth.uid());

comment on policy "qitems_select_supplier" on quote_items is
  'Fornitore vede SOLO le proprie voci (supplier_id=auth.uid()) attraverso tutti i preventivi che lo coinvolgono. Permette earnings tracking e visibilita pagamenti.';
