-- ============================================================================
-- C-1 (CRITICO, sweep RLS): il bucket wedding-photos (public=true) aveva una policy
-- SELECT `wedding_photos_read_all USING (bucket_id='wedding-photos')` per il ruolo
-- public → chiunque, anche non autenticato, poteva ENUMERARE (LIST API) ogni path
-- e scaricare l'intera galleria di ogni coppia, aggirando la RLS di gallery_media.
--
-- Verificato: l'app mostra le foto SOLO via getPublicUrl (URL pubblico per path
-- noto), NON usa mai la LIST API né signed URL; upload/delete hanno policy proprie
-- (insert_member / delete_member). Quindi rimuovere la policy SELECT chiude
-- l'enumerazione senza rompere la visualizzazione.
--
-- NB: i byte restano serviti da /object/public/ per chi conosce il path UUID esatto
-- (modello a opacità, come floor-plans/event-guest-uploads). La chiusura completa
-- (bucket privato + signed URL ovunque) è un refactor a parte, non fatto qui.
-- ============================================================================

drop policy if exists wedding_photos_read_all on storage.objects;
