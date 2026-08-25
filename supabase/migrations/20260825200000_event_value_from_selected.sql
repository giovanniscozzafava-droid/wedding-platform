-- ============================================================================
-- "Valore" dell'evento (calendar_entries_private.value_amount) mostrava la somma
-- di TUTTE le voci (total_client), non quelle realmente selezionate dal cliente.
-- Causa: quote-send scrive value_amount = q.total_client al momento dell'INVIO
-- (quando il cliente non ha ancora scelto), e quello snapshot restava stale anche
-- dopo la selezione/accettazione. Es. Ierardi: value_amount=5010 ma selezionato=2000.
--
-- Fix alla fonte: per gli eventi collegati a un preventivo, value_amount viene
-- tenuto in sync col VALORE IMPEGNATO (R1): selezionato se >0, altrimenti totale.
-- Un trigger sui quotes lo aggiorna a ogni cambio di stato/totali (quotes_recalc_totals
-- ricalcola total_client_selected → questo trigger propaga il valore all'evento).
-- ============================================================================
create or replace function public.sync_event_value_from_quote() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_val numeric;
begin
  v_val := case when coalesce(new.total_client_selected, 0) > 0
                then new.total_client_selected
                else coalesce(new.total_client, 0) end;
  update public.calendar_entries_private cep
     set value_amount = v_val
    from public.calendar_entries ce
   where ce.id = cep.entry_id and ce.quote_id = new.id;
  return new;
end$$;

drop trigger if exists trg_sync_event_value_from_quote on public.quotes;
create trigger trg_sync_event_value_from_quote
  after update of status, total_client, total_client_selected on public.quotes
  for each row execute function public.sync_event_value_from_quote();

-- Backfill CHIRURGICO: correggo solo gli eventi il cui value_amount è ESATTAMENTE
-- il totale pieno mentre esiste un selezionato più piccolo (lo snapshot stale del
-- bug). NON tocco valori manuali diversi dal totale pieno.
update public.calendar_entries_private cep
   set value_amount = q.total_client_selected
  from public.calendar_entries ce
  join public.quotes q on q.id = ce.quote_id
 where ce.id = cep.entry_id
   and ce.quote_id is not null
   and coalesce(q.total_client_selected, 0) > 0
   and q.total_client_selected <> q.total_client
   and cep.value_amount is not distinct from q.total_client;
