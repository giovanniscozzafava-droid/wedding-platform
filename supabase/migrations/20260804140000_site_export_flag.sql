-- Flag per evento: "questo matrimonio puo' finire sul mio sito personale".
-- Serve al ponte verso gisko.net: la selezione del fotografo dice QUALI foto,
-- questo flag dice DA QUALI EVENTI. Senza, si pubblicherebbe tutto l'archivio.
--
-- Di base spento: nessun evento diventa pubblicabile per sbaglio.
alter table public.calendar_entries
  add column if not exists site_export boolean not null default false;

comment on column public.calendar_entries.site_export is
  'Il professionista ha abilitato questo evento all''esportazione verso il proprio sito personale. Da solo non pubblica nulla: seleziona anche le foto (gallery_media.pick_photographer).';

-- Interruttore visibile solo a chi ha davvero un sito personale collegato:
-- per gli altri professionisti la voce non compare nemmeno.
alter table public.profiles
  add column if not exists personal_site_sync boolean not null default false;

comment on column public.profiles.personal_site_sync is
  'Mostra i comandi di esportazione verso il sito personale del professionista.';

-- Le foto pubblicabili si cercano per evento abilitato: indice mirato.
create index if not exists idx_calentry_site_export
  on public.calendar_entries(owner_id) where site_export;
