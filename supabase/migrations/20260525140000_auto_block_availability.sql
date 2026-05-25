-- ============================================================================
-- AUTO-BLOCK SUPPLIER AVAILABILITY
--
-- Quando un fornitore crea un preventivo (standalone o dentro wedding) e
-- l'evento ha una data, la disponibilità del fornitore per quella data deve
-- riflettere automaticamente lo stato:
--   - INVIATO (quote diretto)        --> TENTATIVE
--   - ACCETTATO / CONVERTITO         --> BUSY
--   - Contract FIRMATO (direct)      --> BUSY (sigillo finale)
--
-- Così WP/Location, interrogando il calendario fornitore via
-- check_supplier_available() o supplier_availability (RLS via collaborations),
-- vedono la data occupata anche se il fornitore lavora autonomamente.
--
-- Strategia: forward-only. Se quote torna a BOZZA/RIFIUTATO, il fornitore
-- può sbloccare manualmente. Evita race condition su revert.
-- ============================================================================

-- 1. Trigger su quotes: status change + event_date -> propaga availability
create or replace function auto_block_availability_from_quote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_busy_note text;
  v_tentative_note text;
begin
  if NEW.event_date is null then return NEW; end if;

  -- (A) Direct quote: owner_id è il fornitore (no wedding).
  if NEW.direct_client_id is not null then
    v_busy_note := 'Preventivo diretto ACCETTATO: ' || coalesce(NEW.title, '');
    v_tentative_note := 'Preventivo diretto INVIATO: ' || coalesce(NEW.title, '');

    if NEW.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO') then
      insert into supplier_availability(fornitore_id, date, status, notes)
        values (NEW.owner_id, NEW.event_date, 'BUSY', v_busy_note)
      on conflict (fornitore_id, date) do update
        set status = case
              when supplier_availability.status = 'AVAILABLE' then 'BUSY'::supplier_avail_status
              when supplier_availability.status = 'TENTATIVE' then 'BUSY'::supplier_avail_status
              else supplier_availability.status
            end,
            notes = excluded.notes;
    elsif NEW.status = 'INVIATO' then
      insert into supplier_availability(fornitore_id, date, status, notes)
        values (NEW.owner_id, NEW.event_date, 'TENTATIVE', v_tentative_note)
      on conflict (fornitore_id, date) do nothing;
    end if;
  end if;

  -- (B) Quote dentro wedding (no direct_client_id): scorri quote_items per
  --     ogni supplier_id distinto e blocca le rispettive availability.
  --     Si propaga solo al passaggio ad ACCETTATO/CONVERTITO (no INVIATO,
  --     per non spammare TENTATIVE quando il WP sta solo proponendo voci).
  if NEW.direct_client_id is null
     and NEW.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
  then
    insert into supplier_availability(fornitore_id, date, status, notes)
      select distinct qi.supplier_id,
                      NEW.event_date,
                      'BUSY',
                      'Preventivo accettato: ' || coalesce(NEW.title, '')
        from quote_items qi
       where qi.quote_id = NEW.id
         and qi.supplier_id is not null
    on conflict (fornitore_id, date) do update
      set status = case
            when supplier_availability.status = 'AVAILABLE' then 'BUSY'::supplier_avail_status
            when supplier_availability.status = 'TENTATIVE' then 'BUSY'::supplier_avail_status
            else supplier_availability.status
          end,
          notes = excluded.notes;
  end if;

  return NEW;
end$$;

drop trigger if exists trg_quotes_auto_avail on quotes;
create trigger trg_quotes_auto_avail
  after insert or update of status, event_date, direct_client_id on quotes
  for each row execute function auto_block_availability_from_quote();

comment on function auto_block_availability_from_quote() is
  'Propaga lo stato del preventivo sulla disponibilità del fornitore: TENTATIVE su INVIATO diretto, BUSY su ACCETTATO/CONVERTITO. Forward-only — il revert va fatto manualmente.';

-- 2. Trigger su contracts: FIRMATO + event_date -> BUSY ----------------------
create or replace function auto_block_availability_from_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status <> 'FIRMATO' then return NEW; end if;
  if NEW.event_date is null then return NEW; end if;

  -- Contract diretto: owner_id è il fornitore.
  if NEW.direct_client_id is not null then
    insert into supplier_availability(fornitore_id, date, status, notes)
      values (NEW.owner_id, NEW.event_date, 'BUSY',
              'Contratto FIRMATO: ' || coalesce(NEW.title, ''))
    on conflict (fornitore_id, date) do update
      set status = 'BUSY'::supplier_avail_status,
          notes = excluded.notes;
  end if;

  -- Contract dentro wedding: se ha quote_id, scorri quote_items.
  if NEW.direct_client_id is null and NEW.quote_id is not null then
    insert into supplier_availability(fornitore_id, date, status, notes)
      select distinct qi.supplier_id,
                      NEW.event_date,
                      'BUSY',
                      'Contratto firmato — ' || coalesce(NEW.title, '')
        from quote_items qi
       where qi.quote_id = NEW.quote_id
         and qi.supplier_id is not null
    on conflict (fornitore_id, date) do update
      set status = 'BUSY'::supplier_avail_status,
          notes = excluded.notes;
  end if;

  return NEW;
end$$;

drop trigger if exists trg_contracts_auto_avail on contracts;
create trigger trg_contracts_auto_avail
  after insert or update of status, event_date, direct_client_id on contracts
  for each row execute function auto_block_availability_from_contract();

comment on function auto_block_availability_from_contract() is
  'Sigilla la disponibilità (BUSY) del fornitore quando un contratto passa a FIRMATO. Sia per contratti diretti (owner_id=fornitore) sia dentro wedding (via quote_items.supplier_id).';

-- 3. Backfill UNA TANTUM: applica la regola a quote/contract già esistenti --
--    Solo righe con event_date settata e status >= ACCETTATO.
insert into supplier_availability(fornitore_id, date, status, notes)
select distinct q.owner_id, q.event_date, 'BUSY'::supplier_avail_status,
       'Backfill preventivo diretto: ' || q.title
  from quotes q
 where q.direct_client_id is not null
   and q.event_date is not null
   and q.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
on conflict (fornitore_id, date) do nothing;

insert into supplier_availability(fornitore_id, date, status, notes)
select distinct qi.supplier_id, q.event_date, 'BUSY'::supplier_avail_status,
       'Backfill preventivo accettato: ' || q.title
  from quotes q
  join quote_items qi on qi.quote_id = q.id
 where q.direct_client_id is null
   and q.event_date is not null
   and q.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
   and qi.supplier_id is not null
on conflict (fornitore_id, date) do nothing;
