-- ============================================================================
-- C-2 (decisione #3, "fai tu"): la COPPIA poteva leggere line_cost / item_markup_
-- percent / snapshot_price direttamente via PostgREST (policy qitems_select_couple),
-- esponendo il margine della piattaforma — la RLS è per-riga, non per-colonna, e
-- la versione couple-safe del frontend non basta a chiuderla.
--
-- La coppia NON ha bisogno di leggere quote_items in diretta: il suo preventivo
-- passa da RPC SECURITY DEFINER già mascherate (couple_get_quote_detail /
-- couple_get_quote_for_entry, che nullano supplier_id e ritornano solo line_client),
-- e le sue azioni (couple_set_item_quantity, client_decide_quote_item, toggle/pick)
-- sono anch'esse SECURITY DEFINER. Rimuoviamo quindi la policy diretta.
-- (L'unico uso frontend era il rilevamento "ristorazione" per la tab Menu, che
-- ricade su un fallback quando le voci non arrivano — nessuna funzione persa.)
-- ============================================================================

drop policy if exists qitems_select_couple on public.quote_items;
