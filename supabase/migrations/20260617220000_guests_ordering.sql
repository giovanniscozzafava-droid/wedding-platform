-- ============================================================================
-- Ordinamento personalizzato della lista invitati
-- ----------------------------------------------------------------------------
-- - sort_order: posizione decisa dall'utente trascinando il blocco su/giù.
--   Usiamo numeri "a gap" (ranking frazionario): spostando una riga tra due
--   vicine si scrive solo la riga spostata = media dei due vicini.
--   NULL = non ancora ordinato manualmente (ricade sull'ordine alfabetico).
-- - is_close_family: marca i "parenti più stretti", per il preset di ordinamento.
-- ============================================================================

alter table public.event_guests
  add column if not exists sort_order      double precision,
  add column if not exists is_close_family boolean not null default false;

create index if not exists idx_guests_sort on public.event_guests(entry_id, sort_order nulls last, full_name);

-- Le nuove colonne devono essere scrivibili dagli stessi ruoli (grant a livello
-- di colonna come per le altre).
grant update (sort_order, is_close_family) on public.event_guests to authenticated, anon;
