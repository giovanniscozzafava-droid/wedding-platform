-- ============================================================================
-- FIX "fornitori coinvolti": quando un fornitore conferma la presenza su un
-- preventivo (supplier_presence='SI'), deve comparire tra i partecipanti
-- dell'evento (calendar_entry_participants). Prima non accadeva.
-- Inoltre il check anti-doppia-prenotazione segnalava un falso conflitto perché
-- il fornitore risultava "occupato" dal SUO STESSO evento (auto-blocco): ora i
-- blocchi originati dallo stesso evento vengono esclusi.
-- ----------------------------------------------------------------------------

-- 1) Anti-conflitto: ignora i blocchi (supplier_availability BUSY) che derivano
--    dal preventivo dello STESSO evento a cui si sta aggiungendo il fornitore.
create or replace function public.trg_entry_participant_block_busy()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_date_from date; v_date_to date; v_conflict_date date; v_supplier_name text; v_quote uuid;
begin
  if new.user_id is null then return new; end if;
  if not exists (select 1 from profiles p where p.id = new.user_id and p.role = 'FORNITORE') then return new; end if;
  select date_from, date_to, quote_id into v_date_from, v_date_to, v_quote from calendar_entries where id = new.entry_id;
  if v_date_from is null then return new; end if;

  select sa.date into v_conflict_date
    from supplier_availability sa
   where sa.fornitore_id = new.user_id
     and sa.date between v_date_from and v_date_to
     and sa.status = 'BUSY'
     and sa.source_quote_id is distinct from v_quote   -- escludi il blocco dovuto a QUESTO evento
   limit 1;

  if v_conflict_date is not null then
    select coalesce(business_name, full_name) into v_supplier_name from profiles where id = new.user_id;
    raise exception 'AVAILABILITY_CONFLICT: il fornitore % è OCCUPATO il %', coalesce(v_supplier_name, new.user_id::text), v_conflict_date
      using errcode = '23514', hint = 'Cambia la data dell evento o togli il fornitore.';
  end if;
  return new;
end$$;

-- 2) Alla conferma presenza ('SI') → il fornitore diventa partecipante dell'evento.
create or replace function public.on_supplier_presence_participant()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_sub text;
begin
  if new.supplier_presence is distinct from 'SI' or new.supplier_id is null then return new; end if;
  select id into v_entry from calendar_entries where quote_id = new.quote_id limit 1;
  if v_entry is null then return new; end if;
  if exists (select 1 from calendar_entry_participants where entry_id = v_entry and user_id = new.supplier_id) then return new; end if;
  select subrole::text into v_sub from profiles where id = new.supplier_id;
  insert into calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
  values (v_entry, new.supplier_id, coalesce(v_sub, 'fornitore'), true);
  return new;
end$$;

drop trigger if exists trg_supplier_presence_participant on public.quote_items;
create trigger trg_supplier_presence_participant
  after update of supplier_presence on public.quote_items
  for each row when (new.supplier_presence = 'SI')
  execute function public.on_supplier_presence_participant();

-- 3) Backfill: registra i partecipanti per i fornitori che hanno già confermato.
do $$
declare r record;
begin
  for r in
    select distinct e.id as entry_id, qi.supplier_id, coalesce(pr.subrole::text,'fornitore') as sub
    from quote_items qi
    join calendar_entries e on e.quote_id = qi.quote_id
    join profiles pr on pr.id = qi.supplier_id
    where qi.supplier_presence = 'SI' and qi.supplier_id is not null
      and not exists (select 1 from calendar_entry_participants p where p.entry_id = e.id and p.user_id = qi.supplier_id)
  loop
    begin
      insert into calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
      values (r.entry_id, r.supplier_id, r.sub, true);
    exception when others then
      -- salta eventuali conflitti reali (fornitore occupato per ALTRO evento)
      null;
    end;
  end loop;
end$$;
