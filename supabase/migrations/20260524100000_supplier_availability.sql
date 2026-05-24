-- ============================================================================
-- Supplier availability calendar
-- Default: fornitore disponibile (assenza riga = disponibile).
-- Solo i giorni esplicitamente marcati BUSY o TENTATIVE non sono prenotabili.
-- Trigger su quote_items: blocca insert se fornitore BUSY in data evento.
-- ============================================================================

create type supplier_avail_status as enum ('AVAILABLE', 'BUSY', 'TENTATIVE');

create table if not exists supplier_availability (
  id            uuid primary key default gen_random_uuid(),
  fornitore_id  uuid not null references profiles(id) on delete cascade,
  date          date not null,
  status        supplier_avail_status not null default 'BUSY',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (fornitore_id, date)
);

create index if not exists idx_avail_forn_date on supplier_availability(fornitore_id, date);
create trigger trg_avail_updated_at before update on supplier_availability
  for each row execute function set_updated_at();

alter table supplier_availability enable row level security;

-- Fornitore vede/modifica solo le proprie
create policy "avail_select_own" on supplier_availability for select using (
  fornitore_id = auth.uid()
  or is_admin()
  or exists (
    select 1 from collaborations c
    where c.fornitore_id = supplier_availability.fornitore_id
      and c.capostipite_id = auth.uid()
      and c.status = 'ACTIVE'
  )
);
create policy "avail_modify_own" on supplier_availability for all
  using (fornitore_id = auth.uid())
  with check (fornitore_id = auth.uid());

-- RPC public per WP loggato: verifica disponibilità
create or replace function check_supplier_available(p_supplier uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from supplier_availability
    where fornitore_id = p_supplier
      and date = p_date
      and status = 'BUSY'
  );
$$;
grant execute on function check_supplier_available(uuid, date) to authenticated;

-- Trigger su quote_items: blocca insert se fornitore BUSY
create or replace function block_busy_supplier_on_quote_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_date date;
  v_busy boolean;
begin
  if NEW.supplier_id is null then return NEW; end if;
  select event_date into v_event_date from quotes where id = NEW.quote_id;
  if v_event_date is null then return NEW; end if;
  select exists (
    select 1 from supplier_availability
    where fornitore_id = NEW.supplier_id
      and date = v_event_date
      and status = 'BUSY'
  ) into v_busy;
  if v_busy then
    raise exception
      'Fornitore non disponibile il %. Verifica calendario disponibilita`.', v_event_date
      using errcode = 'P0001';
  end if;
  return NEW;
end$$;

drop trigger if exists trg_block_busy_supplier on quote_items;
create trigger trg_block_busy_supplier
  before insert on quote_items
  for each row execute function block_busy_supplier_on_quote_item();
