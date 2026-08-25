-- ============================================================================
-- trg_quote_item_block_busy — due difetti nella rilevazione BUSY:
--  (1) FALSO POSITIVO: nessuna esclusione self-quote. Se un preventivo va
--      ACCETTATO (i fornitori vengono marcati BUSY con source_quote_id = questo
--      preventivo) e poi viene ri-aperto (BOZZA/INVIATO) per aggiungere/sostituire
--      una voce dello STESSO fornitore, il trigger sollevava AVAILABILITY_CONFLICT
--      contro l'occupazione generata dal preventivo stesso.
--  (2) FALSO NEGATIVO: `limit 1` prendeva UNA riga a caso e controllava se quella
--      era BUSY; con più righe (una libera + una BUSY) poteva mancare il conflitto.
-- Fix: EXISTS di una riga BUSY che NON provenga da questo stesso preventivo.
-- ============================================================================
create or replace function trg_quote_item_block_busy() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_event_date date;
  v_owner uuid;
  v_status text;
  v_supplier_name text;
  v_busy boolean;
begin
  if new.supplier_id is null then return new; end if;

  select q.event_date, q.owner_id, q.status into v_event_date, v_owner, v_status
    from quotes q where q.id = new.quote_id;
  if v_event_date is null then return new; end if;

  -- Il fornitore gestisce il proprio calendario: mai bloccarlo sul proprio preventivo.
  if new.supplier_id = v_owner then return new; end if;
  -- Preventivo già accettato/vivo → integrazioni sempre ammesse.
  if v_status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO') then return new; end if;

  -- Fornitore TERZO realmente occupato da ALTRO (non da questo stesso preventivo).
  select exists (
    select 1 from supplier_availability sa
     where sa.fornitore_id = new.supplier_id
       and sa.date = v_event_date
       and sa.status::text = 'BUSY'
       and sa.source_quote_id is distinct from new.quote_id
  ) into v_busy;

  if coalesce(v_busy, false) then
    select coalesce(p.business_name, p.full_name) into v_supplier_name
      from profiles p where p.id = new.supplier_id;
    raise exception 'AVAILABILITY_CONFLICT: il fornitore % non è disponibile il %', coalesce(v_supplier_name, new.supplier_id::text), v_event_date
      using errcode = '23514', hint = 'Scegli un altro fornitore o cambia data.';
  end if;
  return new;
end$$;
