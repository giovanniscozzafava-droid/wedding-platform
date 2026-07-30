-- Riconciliazione selezione album "Saverio e Chiara" (entry e9f79dd7-e73c-4391-9a65-7f57750e7179).
-- La coppia ha confermato 120 foto (gallery_media.album_choice='KEPT'), ma la selezione
-- dell'impaginatore (pick_photographer) ne aveva 269. Allineiamo l'impaginatore alle 120 definitive:
-- pick_photographer = true SOLO per le 120 KEPT, false per le altre 149.
-- Il LAYOUT (album_projects.layout) NON viene toccato: le foto già messe sulle tavole restano lì.
update public.gallery_media
   set pick_photographer = (album_choice = 'KEPT')
 where entry_id = 'e9f79dd7-e73c-4391-9a65-7f57750e7179'
   and pick_photographer is distinct from (album_choice = 'KEPT');
