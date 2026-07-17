-- Ruolo MAESTRANZA: il professionista operativo (cameriere, secondo fotografo, musicista,
-- truccatore, fonico...) che lavora AGLI eventi ma non li vende. Non è un capostipite, non è
-- un fornitore, non è un cliente: sta in bacheca e si fa trovare.
--
-- ATTENZIONE: questo file deve contenere SOLO l'alter type. In PG15 l'ADD VALUE è ammesso in
-- transazione, ma il nuovo valore NON è utilizzabile nella stessa transazione: qualsiasi
-- trigger/seed/policy che nomini 'MAESTRANZA' nello stesso file farebbe fallire la migration.
-- Stesso pattern di 20260614160000_guest_role_enum.sql.
alter type user_role add value if not exists 'MAESTRANZA';
