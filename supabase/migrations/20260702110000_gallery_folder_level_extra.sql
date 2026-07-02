-- FIX upload album: 'invalid input value for enum gallery_folder_level: "EXTRA"'.
-- La RPC album_add_media (mig. 20260618120000) crea la cartella "Foto aggiunte all'album" con
-- level='EXTRA', ma l'enum gallery_folder_level non conteneva 'EXTRA' → ogni "aggiungi foto
-- all'album" falliva a runtime (rotto da giugno). Aggiungiamo il valore mancante.
--
-- Visibilità verificata (policy gf_read/gm_read): owner (fotografo) + coppia + admin vedono la
-- cartella e i media senza gate sul livello; il gate per livello riguarda solo cerchio/ospiti,
-- quindi la cartella EXTRA (album-side) resta correttamente non esposta a loro. Nessun buco RLS.
alter type public.gallery_folder_level add value if not exists 'EXTRA';
