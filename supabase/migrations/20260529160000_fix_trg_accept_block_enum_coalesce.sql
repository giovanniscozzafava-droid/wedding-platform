-- ============================================================================
-- HOTFIX: trg_quote_accept_block_dates falliva con
--   "invalid input value for enum quote_status: ''"
-- ============================================================================
-- Bug preesistente in migration 20260528220000_availability_hardening.sql L149:
--   if new.status <> 'ACCETTATO' or coalesce(old.status, '') = 'ACCETTATO' then
-- Il coalesce su old.status (enum quote_status) con literal '' costringe PG a
-- castare '' a quote_status → enum non ha valore '' → exception.
--
-- L'errore scattava SU OGNI update di quotes.status, bloccando in particolare
-- la transizione BOZZA -> INVIATO usata da quote-accept-sign per i preventivi
-- che la coppia firma senza che il WP abbia premuto "Invia" (es. apertura
-- diretta del link /p/accept).
--
-- Fix: ::text esplicito sul coalesce. Logica identica, niente cast enum.
-- ============================================================================

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
  if new.status <> 'ACCETTATO'::quote_status
     or coalesce(old.status::text, '') = 'ACCETTATO'
  then
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
      values (s.supplier_id, d, 'BUSY'::supplier_avail_status, concat('Preventivo accettato: ', coalesce(v_title, '')))
      on conflict (fornitore_id, date) do update
        set status = 'BUSY'::supplier_avail_status,
            notes  = coalesce(excluded.notes, supplier_availability.notes);
      d := d + 1;
    end loop;
  end loop;

  return new;
end$$;
