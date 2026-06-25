-- Upload ospiti più affidabili: i video da smartphone superano spesso il limite di default
-- del bucket (es. 50MB) e l'upload falliva senza spiegazione. Alziamo il limite, teniamo il
-- bucket pubblico (serve per le anteprime via getPublicUrl) e togliamo la restrizione MIME
-- (la validazione è lato client; le immagini vengono già convertite in JPEG).
update storage.buckets
set file_size_limit = 1073741824,   -- 1 GB
    public = true,
    allowed_mime_types = null
where id = 'event-guest-uploads';

do $$
declare v record;
begin
  select file_size_limit, public, allowed_mime_types into v from storage.buckets where id = 'event-guest-uploads';
  if not found then raise notice 'bucket event-guest-uploads NON trovato';
  else raise notice 'event-guest-uploads → file_size_limit=%, public=%, mime=%', v.file_size_limit, v.public, v.allowed_mime_types; end if;
end $$;
