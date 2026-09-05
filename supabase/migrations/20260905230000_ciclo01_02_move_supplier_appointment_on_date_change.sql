-- ============================================================================
-- CICLO-01/CICLO-02: auto_block_availability_from_quote inseriva la riga
-- supplier_appointments solo `where not exists (... source_quote_id = NEW.id)`:
-- se il preventivo cambiava data DOPO essere già stato accettato (via
-- riprogramma_evento o via "modifica forzata" nell'editor), la riga esistente
-- non veniva mai spostata alla nuova data. Risultato riprodotto dal vivo:
-- il fornitore risultava AVAILABLE sulla data vera dell'evento (recompute
-- trovava zero appuntamenti lì) mentre restava BUSY-fantasma sulla vecchia
-- data abbandonata. Fix: se la riga esiste già, la data si AGGIORNA invece
-- di lasciarla ferma.
-- ============================================================================

create or replace function auto_block_availability_from_quote()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_supplier uuid;
begin
  if NEW.event_date is null then return NEW; end if;

  -- Direct quote: owner_id è il fornitore.
  if NEW.direct_client_id is not null then
    if NEW.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') then
      update public.supplier_appointments
         set date = NEW.event_date, title = coalesce(NEW.title,'Evento'), updated_at = now()
       where source_quote_id = NEW.id;
      if not found then
        insert into public.supplier_appointments(owner_id, kind, title, date, supplier_client_id, source_quote_id, notes)
        values (NEW.owner_id, 'EVENTO', coalesce(NEW.title,'Evento'), NEW.event_date, NEW.direct_client_id, NEW.id, 'Da preventivo accettato');
      end if;
      perform public.recompute_day_availability(NEW.owner_id, NEW.event_date);
    elsif NEW.status = 'INVIATO' then
      insert into supplier_availability(fornitore_id, date, status, notes)
        values (NEW.owner_id, NEW.event_date, 'TENTATIVE', 'Preventivo diretto INVIATO: ' || coalesce(NEW.title,''))
      on conflict (fornitore_id, date) do nothing;
    end if;
  end if;

  -- Quote dentro wedding: blocca i fornitori delle voci (capacity-aware per ognuno),
  -- spostando l'appuntamento se già esiste invece di lasciarlo sulla vecchia data.
  if NEW.direct_client_id is null and NEW.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO') then
    for v_supplier in
      select distinct qi.supplier_id from quote_items qi
       where qi.quote_id = NEW.id and qi.supplier_id is not null
    loop
      update public.supplier_appointments
         set date = NEW.event_date, title = coalesce(NEW.title,'Evento'), updated_at = now()
       where source_quote_id = NEW.id and owner_id = v_supplier;
      if not found then
        insert into public.supplier_appointments(owner_id, kind, title, date, source_quote_id, notes)
        values (v_supplier, 'EVENTO', coalesce(NEW.title,'Evento'), NEW.event_date, NEW.id, 'Voce preventivo accettato');
      end if;
      perform public.recompute_day_availability(v_supplier, NEW.event_date);
    end loop;
  end if;

  return NEW;
end$$;
