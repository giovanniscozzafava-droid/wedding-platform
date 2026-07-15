-- PUBBLICA LISTINO ALBUM NEL CATALOGO PREVENTIVI
-- Dal "Listino album" il fotografo può pubblicare i suoi formati/pacchetti come voci-servizio
-- (tabella services), così le ritrova quando compone un preventivo (categoria «Album»).
--
-- album_ref = chiave STABILE della voce d'origine nel listino (fmt:<formatKey> / pkg:<packageId>).
-- Serve a ri-pubblicare in modo IDEMPOTENTE: se la voce esiste già la si aggiorna (prezzo), non si
-- creano doppioni. Unico per fornitore. RLS invariata: il proprietario gestisce già i propri services.

alter table public.services add column if not exists album_ref text;

create unique index if not exists services_album_ref_uq
  on public.services(fornitore_id, album_ref) where album_ref is not null;

comment on column public.services.album_ref is
  'Provenienza dal Listino album (fmt:<key> / pkg:<id>); chiave stabile per pubblicazione idempotente nel catalogo.';
