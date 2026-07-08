-- Prezzo per MODELLO nel catalogo PDF: ogni hotspot (modello marcato) ha un prezzo di vendita.
-- I "pacchetti base" (es. 290/390/490 con modello incluso) e la semantica evento vivono in JSONB
-- (album_price_settings.config.packages e album_projects.price_config) → nessun'altra colonna.
alter table public.album_catalog_hotspots add column if not exists price numeric;
