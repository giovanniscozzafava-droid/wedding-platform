-- Quando il cliente PINNA un modello sul catalogo, gli chiediamo le info IN PIÙ sul modello:
-- oltre a materiale/colore, anche pagine, logo/personalizzazione e foto in copertina.
alter table public.album_pins add column if not exists logo text;
alter table public.album_pins add column if not exists cover_photo boolean;
alter table public.album_pins add column if not exists pages int;
