-- ============================================================================
-- Availability hardening: blocco ferreo delle date occupate
-- ----------------------------------------------------------------------------
-- Bug: WP creava preventivo per data in cui il fornitore aveva BUSY, senza
-- alcun blocco né alert. Audit ha rivelato:
--  * soft check frontend opzionabile (confirm dialog si poteva ignorare)
--  * useAddQuoteItem non rifaceva il check prima di INSERT
--  * trigger AFTER su quote_items: propaga BUSY, non lo previene
--  * calendar_entry_participants: nessun trigger
--
-- Fix:
--  1) RPC centralizzata check_suppliers_busy_in_range(supplier_ids[], from, to)
--  2) BEFORE INSERT trigger su quote_items: blocca se busy nella data del quote
--  3) BEFORE INSERT trigger su calendar_entry_participants: blocca su range
--  4) Auto-block: trigger su quotes.status = ACCETTATO marca BUSY le date range
-- ============================================================================

-- 1) RPC centralizzata: ritorna i conflitti (vuoto = ok)
drop function if exists check_suppliers_busy_in_range(uuid[], date, date);
create or replace function check_suppliers_busy_in_range(
  p_supplier_ids uuid[],
  p_date_from date,
  p_date_to date
)
returns table (
  fornitore_id uuid,
  conflict_date date,
  status text,
  notes text,
  supplier_business_name text,
  supplier_full_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select sa.fornitore_id,
         sa.date as conflict_date,
         sa.status::text,
         sa.notes,
         p.business_name,
         p.full_name
    from supplier_availability sa
    join profiles p on p.id = sa.fornitore_id
   where sa.fornitore_id = any(p_supplier_ids)
     and sa.date between coalesce(p_date_from, '1900-01-01'::date)
                     and coalesce(p_date_to,   '9999-12-31'::date)
     and sa.status in ('BUSY','TENTATIVE')
   order by sa.fornitore_id, sa.date;
$$;

grant execute on function check_suppliers_busy_in_range(uuid[], date, date) to authenticated;

-- 2) BEFORE INSERT trigger su quote_items: blocca se fornitore BUSY nella
--    event_date del quote.
create or replace function trg_quote_item_block_busy() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date date;
  v_supplier_name text;
  v_status text;
begin
  if new.supplier_id is null then return new; end if;

  select q.event_date into v_event_date from quotes q where q.id = new.quote_id;
  if v_event_date is null then return new; end if;

  select sa.status::text, coalesce(p.business_name, p.full_name) into v_status, v_supplier_name
    from supplier_availability sa
    join profiles p on p.id = sa.fornitore_id
   where sa.fornitore_id = new.supplier_id
     and sa.date = v_event_date
   limit 1;

  if v_status = 'BUSY' then
    raise exception 'AVAILABILITY_CONFLICT: il fornitore % è OCCUPATO il %', coalesce(v_supplier_name, new.supplier_id::text), v_event_date
      using errcode = '23514', hint = 'Modifica la data dell evento o scegli un altro fornitore.';
  end if;

  return new;
end$$;

drop trigger if exists trg_quote_item_block_busy on quote_items;
create trigger trg_quote_item_block_busy
  before insert or update of supplier_id on quote_items
  for each row execute function trg_quote_item_block_busy();

-- 3) BEFORE INSERT trigger su calendar_entry_participants: blocca se fornitore
--    è BUSY in qualunque giorno tra date_from..date_to dell'entry.
create or replace function trg_entry_participant_block_busy() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_date_from date;
  v_date_to date;
  v_conflict_date date;
  v_supplier_name text;
begin
  if new.user_id is null then return new; end if;

  if not exists (select 1 from profiles p where p.id = new.user_id and p.role = 'FORNITORE') then
    return new;
  end if;

  select date_from, date_to into v_date_from, v_date_to from calendar_entries where id = new.entry_id;
  if v_date_from is null then return new; end if;

  select sa.date into v_conflict_date
    from supplier_availability sa
   where sa.fornitore_id = new.user_id
     and sa.date between v_date_from and v_date_to
     and sa.status = 'BUSY'
   limit 1;

  if v_conflict_date is not null then
    select coalesce(business_name, full_name) into v_supplier_name from profiles where id = new.user_id;
    raise exception 'AVAILABILITY_CONFLICT: il fornitore % è OCCUPATO il %', coalesce(v_supplier_name, new.user_id::text), v_conflict_date
      using errcode = '23514', hint = 'Cambia la data dell evento o togli il fornitore.';
  end if;

  return new;
end$$;

drop trigger if exists trg_entry_participant_block_busy on calendar_entry_participants;
create trigger trg_entry_participant_block_busy
  before insert or update of user_id on calendar_entry_participants
  for each row execute function trg_entry_participant_block_busy();

-- 4) Quando il quote passa ad ACCETTATO, marca BUSY tutte le date del range
--    per ogni fornitore della cerchia di voci. Idempotente.
create or replace function trg_quote_accept_block_dates() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from date;
  v_to date;
  v_title text;
  d date;
  s record;
begin
  if new.status <> 'ACCETTATO' or coalesce(old.status, '') = 'ACCETTATO' then
    return new;
  end if;

  select ce.date_from, ce.date_to, ce.title into v_from, v_to, v_title
    from calendar_entries ce where ce.quote_id = new.id limit 1;
  if v_from is null then v_from := new.event_date; v_to := new.event_date; v_title := new.title; end if;
  if v_from is null then return new; end if;

  for s in (select distinct qi.supplier_id from quote_items qi where qi.quote_id = new.id and qi.supplier_id is not null) loop
    d := v_from;
    while d <= v_to loop
      insert into supplier_availability (fornitore_id, date, status, notes)
      values (s.supplier_id, d, 'BUSY', concat('Preventivo accettato: ', coalesce(v_title, '')))
      on conflict (fornitore_id, date) do update
        set status = 'BUSY',
            notes  = coalesce(excluded.notes, supplier_availability.notes);
      d := d + 1;
    end loop;
  end loop;

  return new;
end$$;

drop trigger if exists trg_quote_accept_block_dates on quotes;
create trigger trg_quote_accept_block_dates
  after update of status on quotes
  for each row execute function trg_quote_accept_block_dates();
