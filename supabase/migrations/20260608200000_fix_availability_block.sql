-- ============================================================================
-- FIX disponibilità: il trigger che blocca l'inserimento di voci su una data
-- BUSY era troppo aggressivo. Impediva al FORNITORE di aggiungere voci al
-- PROPRIO preventivo/evento (anche live su un preventivo accettato) solo perché
-- aveva bloccato quella data. Il fornitore gestisce il proprio calendario: non
-- deve auto-bloccarsi. Inoltre niente blocco sui preventivi già accettati/vivi.
-- Resta come SALVAGUARDIA solo quando si aggiunge un fornitore TERZO occupato.
-- ============================================================================
create or replace function block_busy_supplier_on_quote_item()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_event_date date;
  v_owner uuid;
  v_status text;
  v_busy boolean;
begin
  if NEW.supplier_id is null then return NEW; end if;

  select event_date, owner_id, status into v_event_date, v_owner, v_status
    from quotes where id = NEW.quote_id;
  if v_event_date is null then return NEW; end if;

  -- 1) Il fornitore aggiunge un SUO servizio al SUO preventivo → mai bloccare.
  if NEW.supplier_id = v_owner then return NEW; end if;
  -- 2) Preventivo già accettato/vivo → è l'evento in corso, le integrazioni passano.
  if v_status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO') then return NEW; end if;

  -- 3) Altrimenti: se il fornitore TERZO è davvero occupato (blocco/vacanza o un
  --    altro evento), avvisa. NB: usiamo solo gli impegni reali, non i blocchi
  --    "soft" residui in supplier_availability.
  select exists (
    select 1 from supplier_appointments a
     where a.owner_id = NEW.supplier_id
       and a.kind in ('BLOCCO','VACANZA','EVENTO')
       and v_event_date between a.date and coalesce(a.end_date, a.date)
  ) into v_busy;

  if v_busy then
    raise exception
      'Il fornitore selezionato non è disponibile il %. Scegline un altro o cambia data.', v_event_date
      using errcode = 'P0001';
  end if;
  return NEW;
end$$;
