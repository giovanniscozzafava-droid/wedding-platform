-- ============================================================================
-- BUGFIX LC-4: annulla_evento non riusciva ad annullare un evento il cui
-- preventivo era ACCETTATO o CONVERTITO_IN_CONTRATTO.
--
-- Causa: annulla_evento (step 3) porta il preventivo a RIFIUTATO, ma il trigger
-- quotes_validate_status_transition consente RIFIUTATO solo da BOZZA/INVIATO —
-- ACCETTATO→RIFIUTATO e CONVERTITO_IN_CONTRATTO→RIFIUTATO sono transizioni
-- vietate → il trigger solleva eccezione e l'intero annullamento fallisce.
--
-- Fix (chirurgico, senza toccare annulla_evento): il validator concede
-- ACCETTATO/CONVERTITO → RIFIUTATO SOLO se l'evento collegato è già ANNULLATO.
-- annulla_evento imposta calendar_entries.evento_stato = 'ANNULLATO' (step 1)
-- PRIMA di rifiutare il preventivo (step 3), e fa il teardown completo
-- (availability, contratti→ANNULLATO, notifiche). Nessun altro percorso può
-- rifiutare un preventivo già accettato/contrattualizzato.
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
    when 'ACCETTATO' then NEW.status in ('CONVERTITO_IN_CONTRATTO', 'BOZZA', 'INVIATO')
    when 'CONVERTITO_IN_CONTRATTO' then NEW.status = 'BOZZA'
    when 'RIFIUTATO' then NEW.status in ('BOZZA', 'INVIATO')
    else false
  end;

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
