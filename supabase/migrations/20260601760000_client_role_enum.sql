-- ============================================================================
-- Ruolo CLIENT: il cliente diretto di un fornitore (o di più fornitori non
-- connessi tra loro) ha una propria area dove gestisce, in modo ordinato e
-- distinto per professionista, preventivi/contratti/informazioni.
-- ----------------------------------------------------------------------------
-- L'aggiunta del valore enum DEVE stare in una migration separata: Postgres
-- non consente di usare un nuovo valore enum nella stessa transazione che lo
-- crea. Le funzioni/policy che referenziano 'CLIENT' stanno nella migration
-- successiva (20260601760500).
-- ============================================================================

alter type user_role add value if not exists 'CLIENT';
