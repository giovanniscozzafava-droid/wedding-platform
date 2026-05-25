-- ============================================================================
-- HARDENING DB-side: state machine quotes + validation quote_items
-- ============================================================================

-- 1. quote_items: name_snapshot non vuoto, quantity entro range sensato
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'qitems_label_not_empty') then
    alter table quote_items
      add constraint qitems_label_not_empty
        check (name_snapshot is null or length(trim(name_snapshot)) > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'qitems_quantity_range') then
    alter table quote_items
      add constraint qitems_quantity_range
        check (quantity >= 0 and quantity <= 99999);
  end if;
end$$;

-- 2. quotes: state machine via trigger BEFORE UPDATE
-- ----------------------------------------------------------------------------
-- Transizioni valide (forward + lifecycle-aware revisions):
--   BOZZA → INVIATO | RIFIUTATO
--   INVIATO → ACCETTATO | RIFIUTATO | BOZZA (re-edit, comporta revision++)
--   ACCETTATO → CONVERTITO_IN_CONTRATTO | BOZZA (force modifica)
--   CONVERTITO_IN_CONTRATTO → (terminale, no transizioni)
--   RIFIUTATO → BOZZA (reopen lead)
--   SCADUTO → BOZZA
--
-- Edge: bypass admin (is_admin) per recovery.
-- ----------------------------------------------------------------------------
create or replace function quotes_validate_status_transition()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean;
begin
  -- Stesso status: ok (update altre colonne)
  if OLD.status is null or NEW.status = OLD.status then
    return NEW;
  end if;

  -- Admin bypass
  if exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'ADMIN') then
    return NEW;
  end if;

  v_allowed := case OLD.status
    when 'BOZZA' then NEW.status in ('INVIATO', 'RIFIUTATO')
    when 'INVIATO' then NEW.status in ('ACCETTATO', 'RIFIUTATO', 'BOZZA', 'SCADUTO')
    when 'ACCETTATO' then NEW.status in ('CONVERTITO_IN_CONTRATTO', 'BOZZA', 'INVIATO')
      -- ACCETTATO->INVIATO permesso per re-invio post modifica forzata (force_resend in edge fn quote-send)
    when 'CONVERTITO_IN_CONTRATTO' then NEW.status = 'BOZZA'
      -- BOZZA permesso solo per reset eccezionale (admin)
    when 'RIFIUTATO' then NEW.status in ('BOZZA', 'INVIATO')
      -- INVIATO permesso per re-engagement
    when 'SCADUTO' then NEW.status in ('BOZZA', 'INVIATO')
    else false
  end;

  if not v_allowed then
    raise exception 'Transizione status non valida: % -> %', OLD.status, NEW.status
      using errcode = 'P0001', hint = 'Controllare la state machine del preventivo';
  end if;

  return NEW;
end$$;

drop trigger if exists trg_quotes_validate_status on quotes;
create trigger trg_quotes_validate_status
  before update of status on quotes
  for each row execute function quotes_validate_status_transition();

comment on function quotes_validate_status_transition() is
  'State machine quote status. Blocca transizioni non valide (es. CONVERTITO_IN_CONTRATTO terminale, ACCETTATO->RIFIUTATO diretto). Admin bypass per recovery.';
