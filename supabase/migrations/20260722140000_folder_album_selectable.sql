-- Ogni cartella può ENTRARE o meno nella SELEZIONE ALBUM. Non tutte le cartelle devono
-- essere selezionabili/impaginabili (es. scatti grezzi, backstage, foto ospiti): il fotografo
-- decide alla creazione (default incluso) e può cambiarlo dopo.
alter table public.gallery_folders add column if not exists album_selectable boolean not null default true;
comment on column public.gallery_folders.album_selectable is 'La cartella entra nella selezione album (le sue foto sono selezionabili e impaginabili). Off = esclusa dalla selezione album.';
