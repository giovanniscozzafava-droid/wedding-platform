-- Editor foto lato fotografo (crop/ruota/flip/raddrizza): la versione MODIFICATA
-- viene esportata su storage e messa qui. Se presente, è quella mostrata/scaricata
-- OVUNQUE (cartella, galleria coppia, album, download). Il file ORIGINALE su Google
-- Drive resta INTATTO (edit non distruttivo).
alter table public.gallery_media add column if not exists edited_url text;
comment on column public.gallery_media.edited_url is 'Versione modificata (crop/ruota/flip) esportata dal fotografo. Se valorizzata prevale ovunque; l''originale Drive resta intatto.';
