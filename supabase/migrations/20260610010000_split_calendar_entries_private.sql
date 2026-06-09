-- ============================================================================
-- CHIUSURA BUCO P5 (split strutturale) — audit notturno.
-- Causa: un fornitore-collaboratore legge la tabella base `calendar_entries`
-- (policy calentry_select_participant / ce_select_collab_supplier) e con essa
-- vede anche client_name/client_email/notes/value_amount (PII + valore evento).
-- RLS è per-riga, non per-colonna → si SPOSTANO FISICAMENTE i campi sensibili
-- in una tabella 1:1 leggibile solo da owner/coppia/admin.
-- Prova: tests/sql/pii_isolation_tests.sql › P5 (rosso prima → verde dopo) +
--        positivi owner/coppia/fornitore.
-- ============================================================================

-- 1) Tabella privata 1:1 (PK = FK verso calendar_entries)
create table if not exists public.calendar_entries_private (
  entry_id     uuid primary key references public.calendar_entries(id) on delete cascade,
  client_name  varchar,
  client_email varchar,
  notes        text,
  value_amount numeric,         -- TOTALE evento (non il compenso del singolo fornitore)
  updated_at   timestamptz not null default now()
);

-- 2) Migra i dati esistenti
insert into public.calendar_entries_private (entry_id, client_name, client_email, notes, value_amount)
select id, client_name, client_email, notes, value_amount
  from public.calendar_entries
on conflict (entry_id) do nothing;

-- 3) Rimuovi i campi sensibili dalla tabella leggibile dal fornitore
alter table public.calendar_entries
  drop column if exists client_name,
  drop column if exists client_email,
  drop column if exists notes,
  drop column if exists value_amount;

-- 4) RLS: legge solo owner dell'evento + coppia (è il cliente) + admin.
--    Scrive solo owner + admin. Il fornitore/participant NON ha policy → 0.
alter table public.calendar_entries_private enable row level security;

drop policy if exists "cep_select_owner_couple_admin" on public.calendar_entries_private;
create policy "cep_select_owner_couple_admin" on public.calendar_entries_private for select using (
  exists (select 1 from public.calendar_entries ce
           where ce.id = entry_id and (ce.owner_id = auth.uid() or public.is_wedding_couple(ce.id)))
  or public.is_admin()
);

drop policy if exists "cep_write_owner_admin" on public.calendar_entries_private;
create policy "cep_write_owner_admin" on public.calendar_entries_private for all using (
  exists (select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
  or public.is_admin()
) with check (
  exists (select 1 from public.calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
  or public.is_admin()
);

-- 5) Crea automaticamente la riga privata per ogni nuovo evento (owner-side).
create or replace function public.ensure_calendar_entry_private()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.calendar_entries_private (entry_id) values (NEW.id)
  on conflict (entry_id) do nothing;
  return NEW;
end$$;
drop trigger if exists trg_ensure_calentry_private on public.calendar_entries;
create trigger trg_ensure_calentry_private after insert on public.calendar_entries
  for each row execute function public.ensure_calendar_entry_private();

grant select, insert, update on public.calendar_entries_private to authenticated;

comment on table public.calendar_entries_private is
  'Campi sensibili dell''evento (client_name/email/notes/valore TOTALE) separati da calendar_entries: leggibili solo da owner/coppia/admin. Chiude il BUCO P5 (fornitore non vede PII cliente).';
