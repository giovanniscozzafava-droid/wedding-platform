-- Accantonare un preventivo porta in archivio anche l'EVENTO collegato (e ripristinarlo lo
-- riporta indietro). L'evento vive in calendar_entries (collegato via quote_id); aggiungiamo
-- archived_at e lo teniamo in sync col preventivo.
-- (I contratti non hanno oggi un'azione di archiviazione — solo BOZZA/FIRMATO/INVIATO — quindi
--  il cascade parte dal preventivo; quando i contratti avranno un archivio si aggancerà qui.)

alter table public.calendar_entries add column if not exists archived_at timestamptz;
create index if not exists idx_calendar_entries_archived on public.calendar_entries(archived_at) where archived_at is not null;

-- Backfill: eventi il cui preventivo è già accantonato.
update public.calendar_entries ce
   set archived_at = q.archived_at
  from public.quotes q
 where ce.quote_id = q.id and q.archived_at is not null and ce.archived_at is null;

-- Sync preventivo → evento: accantona/ripristina.
create or replace function public._sync_event_archive_from_quote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.archived_at is distinct from old.archived_at then
    update public.calendar_entries
       set archived_at = new.archived_at
     where quote_id = new.id
       and archived_at is distinct from new.archived_at;
  end if;
  return new;
end$$;

drop trigger if exists trg_sync_event_archive_from_quote on public.quotes;
create trigger trg_sync_event_archive_from_quote
  after update of archived_at on public.quotes
  for each row execute function public._sync_event_archive_from_quote();
