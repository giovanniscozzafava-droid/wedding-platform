-- ============================================================================
-- Availability: esclusione self-quote dall'alert "fornitore OCCUPATO"
-- ----------------------------------------------------------------------------
-- Bug: quando il quote passa in ACCETTATO, trg_quote_accept_block_dates marca
-- BUSY i fornitori per quella data. Il banner AvailabilityBanner sulla pagina
-- dello stesso preventivo (QuoteEditorPage) chiama check_suppliers_busy_in_range
-- e VEDE quei BUSY come conflitti -> mostra "N fornitori OCCUPATI" auto-generati
-- dal preventivo stesso.
--
-- Fix:
--  1) Aggiunta colonna supplier_availability.source_quote_id (uuid nullable).
--  2) Trigger trg_quote_accept_block_dates valorizza source_quote_id.
--  3) RPC check_suppliers_busy_in_range accetta p_exclude_quote_id opzionale
--     che filtra i conflitti causati dal quote indicato.
-- ============================================================================

-- 1) Aggiungi colonna source_quote_id su supplier_availability ---------------
alter table public.supplier_availability
  add column if not exists source_quote_id uuid references public.quotes(id) on delete set null;

comment on column public.supplier_availability.source_quote_id is
  'Se valorizzato, indica il quote che ha generato il BUSY (per esclusione self-conflict).';

create index if not exists idx_supplier_avail_source_quote
  on public.supplier_availability(source_quote_id) where source_quote_id is not null;

-- Retro-fill: collega i record BUSY esistenti al quote dichiarato in notes
-- (notes formato 'Preventivo accettato: <title>'). Best-effort, non bloccante.
update public.supplier_availability sa
   set source_quote_id = q.id
  from public.quotes q
 where sa.source_quote_id is null
   and sa.status = 'BUSY'
   and sa.notes is not null
   and q.status = 'ACCETTATO'
   and q.event_date = sa.date
   and sa.notes like concat('Preventivo accettato: ', q.title, '%');

-- 2) Trigger trg_quote_accept_block_dates: valorizza source_quote_id ---------
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
      insert into supplier_availability (fornitore_id, date, status, notes, source_quote_id)
      values (s.supplier_id, d, 'BUSY', concat('Preventivo accettato: ', coalesce(v_title, '')), new.id)
      on conflict (fornitore_id, date) do update
        set status          = 'BUSY',
            notes           = coalesce(excluded.notes, supplier_availability.notes),
            source_quote_id = coalesce(supplier_availability.source_quote_id, excluded.source_quote_id);
      d := d + 1;
    end loop;
  end loop;

  return new;
end$$;

-- 3) RPC check_suppliers_busy_in_range: parametro p_exclude_quote_id ---------
drop function if exists check_suppliers_busy_in_range(uuid[], date, date);
drop function if exists check_suppliers_busy_in_range(uuid[], date, date, uuid);
create or replace function check_suppliers_busy_in_range(
  p_supplier_ids uuid[],
  p_date_from date,
  p_date_to date,
  p_exclude_quote_id uuid default null
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
     and (p_exclude_quote_id is null or sa.source_quote_id is distinct from p_exclude_quote_id)
   order by sa.fornitore_id, sa.date;
$$;

grant execute on function check_suppliers_busy_in_range(uuid[], date, date, uuid) to authenticated;
