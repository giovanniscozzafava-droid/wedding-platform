-- ============================================================================
-- Batch hardening dal secondo giro di audit (fix netti e sicuri):
--  A1(network): la policy qitems_select_supplier esponeva TUTTE le colonne di
--    quote_items al fornitore via PostgREST diretto (line_client, item_markup_
--    percent, snapshot_price = il margine del capostipite). Le pagine fornitore
--    passano solo da RPC SECURITY DEFINER, quindi la policy è pura superficie
--    d'attacco → la rimuoviamo.
--  BUG3/M2: nessun vincolo impediva due alternative selezionate nello stesso
--    gruppo (doppio conteggio nei totali). Indice unico parziale.
--  B1: funzione morta quote_items_recalc_lines() (bare) diverge da _v2 (quella
--    viva): landmine se una migration futura riaggancia il trigger al nome
--    simile → la eliminiamo.
--  B5: network_settlements senza CHECK amount_paid<=amount_due (clamp solo lato
--    app) → aggiungiamo il vincolo (tabella oggi vuota, feature spenta).
-- ============================================================================

-- A1: via la policy fornitore inutilizzata (i dati fornitore arrivano solo da RPC).
drop policy if exists qitems_select_supplier on public.quote_items;

-- BUG3/M2: al massimo UNA alternativa selezionata per gruppo.
create unique index if not exists uq_quote_items_alt_group_selected
  on public.quote_items (quote_id, alternative_group)
  where alternative_group is not null and selected_by_client;

-- B1: elimina la funzione morta (non agganciata ad alcun trigger; il vivo è _v2).
drop function if exists public.quote_items_recalc_lines();

-- B5: il pagato non può superare il dovuto.
alter table public.network_settlements drop constraint if exists ns_paid_le_due;
alter table public.network_settlements add constraint ns_paid_le_due
  check (amount_paid <= amount_due);
