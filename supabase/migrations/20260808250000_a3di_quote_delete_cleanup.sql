-- ============================================================================
-- A3 (integrità dati): cancellando (hard-delete) un preventivo, le FK
-- supplier_availability.source_quote_id e supplier_appointments.source_quote_id
-- vanno a NULL (ON DELETE SET NULL). Le righe BUSY create dall'accettazione del
-- preventivo restano quindi orfane: i fornitori restano bloccati su quelle date
-- per sempre, senza alcun preventivo tracciante. Il rilascio esiste solo su
-- cambio-stato (regressione), non su DELETE, e un ACCETTATO non firmato è
-- cancellabile dal proprietario.
-- Fix: un trigger BEFORE DELETE su quotes pulisce le righe generate da quel
-- preventivo prima che la FK le orfanizzi.
-- ============================================================================

create or replace function public._tg_quote_cleanup_before_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.supplier_availability where source_quote_id = old.id;
  delete from public.supplier_appointments  where source_quote_id = old.id;
  return old;
exception when others then
  return old;  -- non bloccare mai la cancellazione per un errore di pulizia
end$$;

drop trigger if exists trg_quote_cleanup_before_delete on public.quotes;
create trigger trg_quote_cleanup_before_delete
  before delete on public.quotes
  for each row execute function public._tg_quote_cleanup_before_delete();
