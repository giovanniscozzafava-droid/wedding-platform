-- Di default una galleria si scarica SOLO in formato web. L'alta risoluzione la accende il
-- fotografo, cartella per cartella. Qui cambia solo il default per le cartelle NUOVE: le cartelle
-- già esistenti tengono il valore che hanno (la scelta di chi le ha create).
alter table public.gallery_folders alter column allow_dl_full set default false;
comment on column public.gallery_folders.allow_dl_full is
  'Download a piena risoluzione per sposi e ospiti: spento di default, lo accende il fotografo.';
