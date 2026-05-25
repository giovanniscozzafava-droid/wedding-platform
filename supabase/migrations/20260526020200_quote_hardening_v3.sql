-- Patch v3: SCADUTO non è valore enum quote_status. Rimosso dal case.
-- quote_status enum = ('BOZZA','INVIATO','ACCETTATO','RIFIUTATO','CONVERTITO_IN_CONTRATTO')

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

  if not v_allowed then
    raise exception 'Transizione status preventivo non valida: % -> %', OLD.status, NEW.status
      using errcode = 'P0001';
  end if;

  return NEW;
end$$;
