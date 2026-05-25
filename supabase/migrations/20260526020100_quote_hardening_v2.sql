-- ============================================================================
-- Patch v2 della state machine quotes — aggiunge transizioni operative
-- mancate nella v1 (es. ACCETTATO->INVIATO usato da quote-send re-invio).
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
    when 'INVIATO' then NEW.status in ('ACCETTATO', 'RIFIUTATO', 'BOZZA', 'SCADUTO')
    when 'ACCETTATO' then NEW.status in ('CONVERTITO_IN_CONTRATTO', 'BOZZA', 'INVIATO')
    when 'CONVERTITO_IN_CONTRATTO' then NEW.status = 'BOZZA'
    when 'RIFIUTATO' then NEW.status in ('BOZZA', 'INVIATO')
    when 'SCADUTO' then NEW.status in ('BOZZA', 'INVIATO')
    else false
  end;

  if not v_allowed then
    raise exception 'Transizione status non valida: % -> %', OLD.status, NEW.status
      using errcode = 'P0001';
  end if;

  return NEW;
end$$;
