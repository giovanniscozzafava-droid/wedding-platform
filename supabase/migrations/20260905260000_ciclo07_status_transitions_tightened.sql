-- ============================================================================
-- CICLO-07: tre transizioni di stato preventivo restavano permesse senza
-- guardia, nonostante fossero illogiche:
--  - ACCETTATO -> INVIATO: nessun caller reale la usa oggi (verificato: unico
--    call-site di quote-send con `force_resend` sempre true non tocca lo
--    status; l'altro, useSendQuote, è per l'invio iniziale da BOZZA) — rimossa.
--  - CONVERTITO_IN_CONTRATTO -> BOZZA: restava permessa anche con un contratto
--    già FIRMATO collegato, il che scongelerebbe prezzi/voci di un preventivo
--    il cui contratto è legalmente vincolante. Bloccata in quel caso.
--  - RIFIUTATO -> BOZZA/INVIATO: mai stata negata quando il rifiuto veniva da
--    un annulla_evento (evento ANNULLATO) — un preventivo "morto" per
--    cancellazione evento poteva risorgere. Bloccata in quel caso, simmetrica
--    all'eccezione LC-4 già esistente nell'altro verso.
-- ACCETTATO -> BOZZA resta permessa (percorso reale: "sblocca e modifica" nel
-- force-edit dell'editor).
-- ============================================================================

create or replace function quotes_validate_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean;
begin
  if OLD.status is null or NEW.status = OLD.status then
    return NEW;
  end if;
  if exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN') then
    return NEW;
  end if;

  v_allowed := case OLD.status
    when 'BOZZA' then NEW.status in ('INVIATO', 'RIFIUTATO')
    when 'INVIATO' then NEW.status in ('ACCETTATO', 'RIFIUTATO', 'BOZZA')
    when 'ACCETTATO' then NEW.status in ('CONVERTITO_IN_CONTRATTO', 'BOZZA')
    when 'CONVERTITO_IN_CONTRATTO' then NEW.status = 'BOZZA'
    when 'RIFIUTATO' then NEW.status in ('BOZZA', 'INVIATO')
    else false
  end;

  -- CONVERTITO_IN_CONTRATTO -> BOZZA: mai se esiste già un contratto FIRMATO.
  if v_allowed
     and OLD.status = 'CONVERTITO_IN_CONTRATTO' and NEW.status = 'BOZZA'
     and exists (select 1 from public.contracts c where c.quote_id = NEW.id and c.status = 'FIRMATO')
  then
    v_allowed := false;
  end if;

  -- RIFIUTATO -> BOZZA/INVIATO: mai se il rifiuto viene da un evento ANNULLATO.
  if v_allowed
     and OLD.status = 'RIFIUTATO' and NEW.status in ('BOZZA', 'INVIATO')
     and exists (
       select 1 from public.calendar_entries ce
        where ce.quote_id = NEW.id and ce.evento_stato = 'ANNULLATO'
     )
  then
    v_allowed := false;
  end if;

  -- Eccezione LC-4: un evento ANNULLATO può rifiutare anche un preventivo già
  -- accettato o convertito. È il caso di annulla_evento, che marca l'evento
  -- ANNULLATO prima di rifiutare il preventivo e ne fa il teardown completo.
  if not v_allowed
     and NEW.status = 'RIFIUTATO'
     and OLD.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
     and exists (
       select 1 from public.calendar_entries ce
        where ce.quote_id = NEW.id and ce.evento_stato = 'ANNULLATO'
     ) then
    v_allowed := true;
  end if;

  if not v_allowed then
    raise exception 'Transizione status preventivo non valida: % -> %', OLD.status, NEW.status
      using errcode = 'P0001';
  end if;

  return NEW;
end$$;
