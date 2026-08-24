-- ============================================================================
-- Il TOTALE del CONTRATTO deve SEMPRE essere la somma di ciò che il cliente ha
-- scelto (come il preventivo): selezionato se >0, altrimenti totale pieno. Finora
-- alcuni path (creazione anticipata / "Compila con AI" che rigenera solo le sezioni)
-- lasciavano contracts.total_amount al totale PIENO mentre l'Art. 2.1 diceva il
-- selezionato → "IMPORTO TOTALE" gonfiato in UI (es. Ierardi 5010 invece di 2000).
--
-- Trigger: per i contratti CLIENTE non firmati (party_kind CLIENT_WP / SUPPLIER_CLIENT,
-- status BOZZA/INVIATO) collegati a un preventivo, total_amount è sempre allineato al
-- totale selezionato. I contratti fornitore↔WP (SUPPLIER_WP, basati sul COSTO) e quelli
-- FIRMATI (importo congelato) NON vengono toccati. Vale per diretti, suggeriti e ogni caso.
-- ============================================================================
create or replace function public.contracts_sync_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_sel numeric; v_full numeric;
begin
  if NEW.quote_id is not null
     and NEW.status in ('BOZZA','INVIATO')
     and coalesce(NEW.party_kind::text, '') in ('CLIENT_WP','SUPPLIER_CLIENT') then
    select total_client_selected, total_client into v_sel, v_full
      from public.quotes where id = NEW.quote_id;
    if found then
      NEW.total_amount := case when coalesce(v_sel, 0) > 0 then v_sel else coalesce(v_full, 0) end;
    end if;
  end if;
  return NEW;
end$$;

drop trigger if exists trg_contracts_sync_total on public.contracts;
create trigger trg_contracts_sync_total
  before insert or update on public.contracts
  for each row execute function public.contracts_sync_total();

-- Backfill: allinea i contratti cliente NON firmati già esistenti (Ierardi incluso).
update public.contracts c
   set total_amount = (case when coalesce(q.total_client_selected, 0) > 0
                            then q.total_client_selected else coalesce(q.total_client, 0) end),
       updated_at = now()
  from public.quotes q
 where q.id = c.quote_id
   and c.status in ('BOZZA','INVIATO')
   and coalesce(c.party_kind::text, '') in ('CLIENT_WP','SUPPLIER_CLIENT')
   and c.total_amount is distinct from (case when coalesce(q.total_client_selected, 0) > 0
                                             then q.total_client_selected else coalesce(q.total_client, 0) end);
