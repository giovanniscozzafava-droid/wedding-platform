-- POST-IT ancorati: la richiesta di modifica del cliente non è più solo testo generico, ma un
-- "bigliettino" appuntato in un PUNTO preciso della tavola (e, se ha toccato una foto, su QUELLA
-- foto). Il fotografo vede il post-it nello stesso punto. Coordinate 0..1 dell'INTERA tavola.
alter table public.album_revision_requests
  add column if not exists tavola_index int,                 -- indice tavola (spread) 0-based
  add column if not exists anchor_x real,                    -- 0..1 sulla larghezza tavola (2W)
  add column if not exists anchor_y real,                    -- 0..1 sull'altezza tavola
  add column if not exists media_id uuid references public.gallery_media(id) on delete set null;

-- back-compat: il body resta NOT NULL ma per i post-it "solo puntina senza testo" permettiamo
-- una stringa vuota lato app; nessuna modifica al vincolo qui.
comment on column public.album_revision_requests.anchor_x is 'Post-it: ascissa 0..1 sulla tavola intera (2W).';
comment on column public.album_revision_requests.media_id is 'Post-it: foto toccata dal cliente, se presente.';
