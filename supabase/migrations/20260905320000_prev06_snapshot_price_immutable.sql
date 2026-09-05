-- ============================================================================
-- PREV-06 (decisione lasciata al mio giudizio da Giovanni): quote_items.
-- snapshot_price non aveva alcun legame col prezzo di catalogo. Verificato:
-- nessun percorso applicativo legittimo lo aggiorna dopo l'inserimento
-- (QuoteEditorPage.tsx lo scrive solo alla creazione della voce, da
-- svc.base_price; altrove è sempre in sola lettura) — è concettualmente
-- proprio uno "snapshot": si fotografa una volta, non si aggiorna mai dopo.
-- Scelta più semplice e più sicura: renderlo immutabile dopo l'inserimento,
-- invece di inseguire un floor legato al prezzo di catalogo corrente (che
-- cambierebbe nel tempo e romperebbe il concetto stesso di "fotografia").
-- Chiude il rischio concreto segnalato: un abbassamento non tracciato di
-- snapshot_price riduceva silenziosamente quanto il sistema calcola dovuto
-- al fornitore esterno nei settlement di rete (line_cost deriva da qui).
-- ============================================================================

create or replace function enforce_snapshot_price_immutable()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.snapshot_price is distinct from old.snapshot_price then
    raise exception 'snapshot_price è fissato alla creazione della voce e non può essere modificato.' using errcode = '23514';
  end if;
  return new;
end$$;

drop trigger if exists trg_enforce_snapshot_price_immutable on quote_items;
create trigger trg_enforce_snapshot_price_immutable
  before update of snapshot_price on quote_items
  for each row execute function enforce_snapshot_price_immutable();
