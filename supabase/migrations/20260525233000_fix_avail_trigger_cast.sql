-- ============================================================================
-- CRITICAL HOTFIX: auto-block availability trigger crashava su UPDATE/INSERT
-- di quotes/contracts con event_date e status target con SQLSTATE 42804:
--   "column status is of type supplier_avail_status but expression is of type text"
--
-- Causa: nelle INSERT INTO supplier_availability(...) VALUES (..., 'BUSY', ...)
-- e nelle INSERT ... SELECT 'BUSY', ... il literal text non viene castato e
-- Postgres si rifiuta di inferire il tipo enum target. Effetto: nessun quote
-- con event_date poteva transitare ad ACCETTATO/CONVERTITO_IN_CONTRATTO,
-- bloccando l'intera pipeline preventivo->firma->contratto in produzione.
--
-- Fix: cast esplicito ::supplier_avail_status su ogni literal nei trigger.
-- ============================================================================

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

  if NEW.direct_client_id is not null then
    v_busy_note := 'Preventivo diretto ACCETTATO: ' || coalesce(NEW.title, '');
    v_tentative_note := 'Preventivo diretto INVIATO: ' || coalesce(NEW.title, '');

    if NEW.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO') then
      insert into supplier_availability(fornitore_id, date, status, notes)
        values (NEW.owner_id, NEW.event_date, 'BUSY'::supplier_avail_status, v_busy_note)
      on conflict (fornitore_id, date) do update
        set status = case
              when supplier_availability.status = 'AVAILABLE' then 'BUSY'::supplier_avail_status
              when supplier_availability.status = 'TENTATIVE' then 'BUSY'::supplier_avail_status
              else supplier_availability.status
            end,
            notes = excluded.notes;
    elsif NEW.status = 'INVIATO' then
      insert into supplier_availability(fornitore_id, date, status, notes)
        values (NEW.owner_id, NEW.event_date, 'TENTATIVE'::supplier_avail_status, v_tentative_note)
      on conflict (fornitore_id, date) do nothing;
    end if;
  end if;

  if NEW.direct_client_id is null
     and NEW.status in ('ACCETTATO', 'CONVERTITO_IN_CONTRATTO')
  then
    insert into supplier_availability(fornitore_id, date, status, notes)
      select distinct qi.supplier_id,
                      NEW.event_date,
                      'BUSY'::supplier_avail_status,
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

create or replace function auto_block_availability_from_contract()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status <> 'FIRMATO' then return NEW; end if;
  if NEW.event_date is null then return NEW; end if;

  if NEW.direct_client_id is not null then
    insert into supplier_availability(fornitore_id, date, status, notes)
      values (NEW.owner_id, NEW.event_date, 'BUSY'::supplier_avail_status,
              'Contratto FIRMATO: ' || coalesce(NEW.title, ''))
    on conflict (fornitore_id, date) do update
      set status = 'BUSY'::supplier_avail_status,
          notes = excluded.notes;
  end if;

  if NEW.direct_client_id is null and NEW.quote_id is not null then
    insert into supplier_availability(fornitore_id, date, status, notes)
      select distinct qi.supplier_id,
                      NEW.event_date,
                      'BUSY'::supplier_avail_status,
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

comment on function auto_block_availability_from_quote() is
  'Propaga status preventivo a supplier_availability. v2 — cast espliciti per evitare 42804.';
comment on function auto_block_availability_from_contract() is
  'Sigilla disponibilita fornitore su contract FIRMATO. v2 — cast espliciti.';

-- ----------------------------------------------------------------------------
-- BUG-E2: quotes_insert_owner RLS policy escludeva FORNITORE.
-- La feature supplier-standalone (preventivo diretto fornitore) era
-- inutilizzabile via API JWT (UI client usa anon, non service-role).
-- Fix: aggiunge FORNITORE alla check role.
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_policies where tablename = 'quotes' and policyname = 'quotes_insert_owner') then
    execute 'drop policy quotes_insert_owner on quotes';
  end if;
end$$;

create policy quotes_insert_owner on quotes for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from profiles p
       where p.id = auth.uid()
         and p.role in ('WEDDING_PLANNER', 'LOCATION', 'ADMIN', 'FORNITORE')
    )
  );

comment on policy quotes_insert_owner on quotes is
  'Permette a WP/LOCATION/ADMIN/FORNITORE di creare preventivi propri. FORNITORE creates direct quotes via direct_client_id, gli altri creano quote per wedding.';
