-- ============================================================================
-- Secondo trigger di blocco disponibilità (trg_quote_item_block_busy): stesso
-- difetto. Il fornitore non poteva aggiungere/aggiornare le proprie voci sul
-- proprio preventivo se aveva la data BUSY. Fix: salta quando si tratta del
-- proprietario del preventivo o di un preventivo già accettato/vivo. Il blocco
-- resta solo quando si aggiunge un fornitore TERZO realmente occupato.
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

  -- Fornitore TERZO realmente occupato (blocco manuale o impegno) → avvisa.
  select (sa.status::text = 'BUSY'), coalesce(p.business_name, p.full_name)
    into v_busy, v_supplier_name
    from supplier_availability sa join profiles p on p.id = sa.fornitore_id
   where sa.fornitore_id = new.supplier_id and sa.date = v_event_date
   limit 1;

  if coalesce(v_busy, false) then
    raise exception 'AVAILABILITY_CONFLICT: il fornitore % non è disponibile il %', coalesce(v_supplier_name, new.supplier_id::text), v_event_date
      using errcode = '23514', hint = 'Scegli un altro fornitore o cambia data.';
  end if;
  return new;
end$$;
