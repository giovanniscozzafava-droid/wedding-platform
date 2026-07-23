-- ============================================================================
-- FIX regressione dual-selection (20260722120000_dual_selection.sql).
--
-- Quel migration ha spostato la SELEZIONE ALBUM del fotografo su `pick_photographer`
-- (l'AlbumDesigner ora legge `kept = pick_photographer`), ma ha backfillato SOLO
-- `pick_couple` da `album_choice='KEPT'` — NON `pick_photographer`. Risultato: tutte le
-- selezioni album storiche (che vivevano in `album_choice='KEPT'`) risultano vuote nel
-- nuovo cuore del fotografo → l'album mostra 0 selezione e restano visibili solo le foto
-- già impaginate nel layout (es. "Battesimo Mariafrancesca": 77 KEPT → si vedeva 46 = foto
-- piazzate). Impatto misurato: 1038 foto su 11 gallerie.
--
-- Rispecchiamo `album_choice='KEPT'` su `pick_photographer`, cioè seminiamo la selezione del
-- fotografo dallo storico condiviso. GUARDIA: NON tocchiamo le gallerie dove esiste già una
-- selezione col nuovo cuore (`pick_photographer` presente), per non sovrascrivere il lavoro
-- fatto con lo swipe/impaginatore dopo il refactor. Idempotente (ri-eseguibile: 0 righe).
-- ============================================================================
update public.gallery_media m
   set pick_photographer = true
 where m.media_type = 'PHOTO'
   and m.album_choice = 'KEPT'
   and m.pick_photographer = false
   and m.gallery_id not in (
     select gallery_id from public.gallery_media where pick_photographer
   );
