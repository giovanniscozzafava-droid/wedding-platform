-- Editor foto lato fotografo: l'export della versione modificata carica su
-- wedding-photos in `{entry_id}/edited/...`. La policy insert esistente permette
-- solo il proprietario del calendar_entry o i membri coppia — ma il fotografo
-- possiede la GALLERY (event_galleries.owner_id), che nei preventivi "suggeriti"
-- puo' differire dal proprietario dell'evento. Aggiungo una policy PERMISSIVA
-- (va in OR con quelle esistenti) che abilita il proprietario della gallery a
-- scrivere SOLO nella cartella del proprio evento (primo segmento del path).
create policy "wedding_photos_insert_gallery_owner"
on storage.objects for insert to public
with check (
  bucket_id = 'wedding-photos'
  and auth.uid() is not null
  and exists (
    select 1 from public.event_galleries eg
    where eg.entry_id::text = split_part(name, '/', 1)
      and eg.owner_id = auth.uid()
  )
);
