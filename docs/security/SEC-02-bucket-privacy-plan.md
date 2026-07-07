# SEC-02 — Bucket foto pubblici → privati + signed URL (PIANO ESECUTIVO)

**Stato:** APERTO, pronto all'esecuzione **verificata**. NON applicato in automatico perché il flip
`public→false` rompe la visualizzazione finché il frontend non firma le URL: va fatto insieme e
verificato a video (l'audit stesso: "va pianificato, non improvvisato").

## Perché

`storage.buckets`: `wedding-photos` (92 oggetti) e `event-guest-uploads` (259 oggetti) sono
`public = true` → foto di persone in contesto privato leggibili da chiunque abbia l'URL (finiscono in
chat/cache/referrer). GDPR + posizionamento premium. Gli altri bucket privati (contratti/PDF/firme)
sono già `false` — corretto.

## Vincolo tecnico

Le URL pubbliche sono **memorizzate** in `gallery_media.thumbnail_link` (es. GuestGalleryPage:
`getPublicUrl(path)` salvato lì) e usate direttamente in ~7 componenti (`EventGalleryTab`,
`GuestGalleryPage`, `AlbumDesignerPage`, `MoodTab`, `CeremonyTab`, `AudioWishes`, `Guestbook`).
Rendere il bucket privato invalida quelle URL → serve firmarle a display dal **path** (non memorizzato:
va estratto dall'URL o salvato a parte).

## Passi (in un'unica PR verificata)

### 1) DB — bucket privati + RLS su storage.objects
```sql
update storage.buckets set public = false where id in ('wedding-photos','event-guest-uploads');

-- Lettura: solo membri dell'evento a cui appartiene l'oggetto. Il path convenzionale inizia con
-- l'entry_id (verificare il layout reale dei path prima di attivare). Owner della gallery scrive.
create policy "wedding_photos_read_members" on storage.objects for select to authenticated
  using ( bucket_id = 'wedding-photos'
    and public.album_can_edit( ((storage.foldername(name))[1])::uuid )  -- o is_entry_participant / is_wedding_couple
  );
create policy "guest_uploads_read_members" on storage.objects for select to authenticated
  using ( bucket_id = 'event-guest-uploads'
    and public.is_entry_participant( ((storage.foldername(name))[1])::uuid ) );
-- (+ policy INSERT/DELETE per owner/uploader come oggi.)
```
> Prima di attivare: **confermare il pattern dei path** (`entry_id/...`?). Se i path non contengono
> l'entry_id, aggiungere una colonna `storage_path`/`entry_id` a `gallery_media` e popolarla.

### 2) Frontend — firma a display (centralizzata)
- Aggiungere un resolver unico `signedPhotoUrl(m)` che, per media NON-Drive, genera una signed URL:
  `supabase.storage.from(bucket).createSignedUrl(path, 60*60)` (batch con `createSignedUrls` per le
  griglie). Cache in memoria + re-sign su scadenza.
- Sostituire negli ~7 componenti gli usi diretti di `m.thumbnail_link` (grid img, `fullSrc`,
  `origUrl`, lightbox, video) con il resolver. I media Drive restano invariati.
- Alternativa più semplice ma meno "pulita": servire tutto via l'edge proxy già esistente
  (`photo-web` / `album-image`) con controllo auth, e puntare le `<img>` lì.

### 3) Verifica (obbligatoria, a video)
- [ ] Le foto storage (non-Drive) si vedono ancora in galleria, lightbox, impaginatore, mood board.
- [ ] Un URL pubblico vecchio di un oggetto ora → **403** senza login.
- [ ] Un membro dell'evento vede le sue foto; un estraneo loggato → **no**.
- [ ] Upload ospite continua a funzionare (INSERT policy).

## Stima
~1–1.5 giorni (resolver + 7 punti display + policy + verifica). **Da fare come PR dedicata**, non a
coda di un'altra sessione: è render-critical e va visto funzionare prima del merge.
