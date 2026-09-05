-- ============================================================================
-- Decisione di Giovanni (06/09/2026): il terzo varco sulla regola R1 trovato
-- dal collaudo di integrità dati va bloccato, come già avviene lato cliente
-- (quote-accept-sign/quote_accept_by_token, CONTR-01). "Genera contratto"
-- nell'editor (QuoteEditorPage::handleCreateContract) porta il preventivo a
-- CONVERTITO_IN_CONTRATTO con un semplice UPDATE dal frontend: non passava
-- da nessun gate. Ora la transizione stessa lo impedisce, qualunque sia il
-- chiamante — stessa regola già in vigore altrove: se il preventivo ha voci,
-- ne serve almeno una ACCETTATA (un preventivo senza voci resta permesso,
-- coerente con l'unico altro punto che applica questa regola).
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

  -- R1 anche qui: -> CONVERTITO_IN_CONTRATTO richiede almeno una voce
  -- accettata, se il preventivo ha voci (stessa regola di quote-accept-sign).
  if v_allowed
     and NEW.status = 'CONVERTITO_IN_CONTRATTO'
     and exists (select 1 from public.quote_items qi where qi.quote_id = NEW.id)
     and not exists (select 1 from public.quote_items qi where qi.quote_id = NEW.id and qi.client_decision = 'ACCETTATO')
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
