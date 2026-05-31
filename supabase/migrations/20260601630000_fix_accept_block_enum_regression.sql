-- ============================================================================
-- HOTFIX: ripristina il cast ::text in trg_quote_accept_block_dates.
-- ----------------------------------------------------------------------------
-- Regressione introdotta in 20260601400000 (availability self-conflict fix):
-- riscrivendo la funzione ho ricopiato `coalesce(old.status, '')` SENZA il
-- cast ::text che la migration 20260529160000 aveva gia` applicato per
-- correggere lo stesso identico bug.
--
-- Effetto del bug: `coalesce(old.status, '')` costringe PostgreSQL a convertire
-- il literal '' al tipo enum quote_status → "invalid input value for enum
-- quote_status: ''" su QUALSIASI UPDATE di quotes.status. Questo BLOCCA
-- l'accettazione reale del preventivo (INVIATO → ACCETTATO via edge function
-- quote-accept-sign) e ogni altra transizione di stato.
--
-- Fix: castare a text prima del coalesce (come 20260529160000), cosi` il
-- confronto avviene su stringhe e nessun '' viene coerced all'enum.
-- ============================================================================

create or replace function public.trg_quote_accept_block_dates() returns trigger
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
  -- Skip se non stiamo passando ad ACCETTATO, o se lo era gia` (idempotenza).
  -- NB: old.status::text evita la conversione del literal '' all'enum.
  if new.status <> 'ACCETTATO' or coalesce(old.status::text, '') = 'ACCETTATO' then
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
