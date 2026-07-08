-- Le CARD MANUALI caricano una FOTO nel bucket album-catalogs, che finora accettava solo PDF.
-- Allargo i mime type consentiti alle immagini (oltre al PDF dei cataloghi).
update storage.buckets
  set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
  where id = 'album-catalogs';
