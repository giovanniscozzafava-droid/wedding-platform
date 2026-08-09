-- ============================================================================
-- Rifinitura storage:
--  - service-photos: la edge upload-photo ammette 5MB (nessun resize server) ma il
--    bucket era limitato a 2MB -> i file 2-5MB passavano il check e fallivano allo
--    storage con 500. Allineo il bucket a 5MB.
--  - event-guest-uploads: bucket pubblico senza whitelist MIME e con limite 1GB
--    (un ospite poteva salvare byte arbitrari rinominati). Metto una whitelist
--    immagini/video e un limite sensato (200MB).
-- ============================================================================

update storage.buckets
   set file_size_limit = 5 * 1024 * 1024
 where id = 'service-photos';

update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','image/heif','video/mp4','video/quicktime'],
       file_size_limit = 200 * 1024 * 1024
 where id = 'event-guest-uploads';
