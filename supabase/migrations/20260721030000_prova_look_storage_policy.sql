-- FIX Prova Look: il fornitore carica la foto della cliente in event-guest-uploads/{uid}/look-src/…
-- Le policy esistenti su quel bucket vogliono un entry_id come primo segmento → l'upload veniva
-- rifiutato da RLS. Aggiungiamo una policy: l'autenticato può inserire nella PROPRIA cartella look-src.
drop policy if exists look_src_upload_insert on storage.objects;
create policy look_src_upload_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'event-guest-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'look-src'
);
