-- TABLEAU MARIAGE GRAFICO: la piantina vera (non più solo elenco).
-- Aggiunge posizione/rotazione dei tavoli sulla piantina, il flag "tavolo staff"
-- e la forma "ferro di cavallo".
-- pos_x/pos_y esistevano già come INT (mai usati): li convertiamo a REAL per usare
-- frazioni 0..1 della piantina (int->real è lossless).
alter table public.event_tables
  alter column pos_x type real using pos_x::real,
  alter column pos_y type real using pos_y::real;

alter table public.event_tables
  add column if not exists rotation real not null default 0, -- gradi (0 = orizzontale)
  add column if not exists is_staff boolean not null default false;

-- Aggiunge FERRO_CAVALLO ai valori ammessi per shape (mantiene i precedenti).
alter table public.event_tables drop constraint if exists event_tables_shape_check;
alter table public.event_tables
  add constraint event_tables_shape_check
  check (shape in ('ROUND','SQUARE','RECT','HEAD','IMPERIALE','FERRO_CAVALLO'));
