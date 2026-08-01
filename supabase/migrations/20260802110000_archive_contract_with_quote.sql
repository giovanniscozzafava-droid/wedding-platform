-- Accantonare un preventivo deve fare piazza pulita: l'EVENTO gia' segue (trigger esistente
-- _sync_event_archive_from_quote), ma il CONTRATTO restava appeso nella lista del professionista.
-- Qui agganciamo anche i contratti al cascade: accantoni il preventivo -> spariscono insieme evento
-- + contratto, e ripristinando tornano tutti. Cosi' il professionista "non vede piu' nulla" del
-- test archiviato (e nessun documento resta orfano in giro).

alter table public.contracts add column if not exists archived_at timestamptz;
create index if not exists idx_contracts_archived on public.contracts(archived_at) where archived_at is not null;

-- Backfill: contratti il cui preventivo (o evento collegato) e' gia' accantonato.
update public.contracts c
   set archived_at = q.archived_at
  from public.quotes q
 where c.quote_id = q.id and q.archived_at is not null and c.archived_at is null;

update public.contracts c
   set archived_at = ce.archived_at
  from public.calendar_entries ce
 where c.entry_id = ce.id and ce.archived_at is not null and c.archived_at is null;

-- Cascade preventivo -> evento + contratto (estende il trigger che prima toccava solo l'evento).
-- La sola redefinizione della funzione basta: il trigger trg_sync_event_archive_from_quote gia'
-- esistente continua a puntare qui.
create or replace function public._sync_event_archive_from_quote()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.archived_at is distinct from old.archived_at then
    -- Evento collegato (comportamento preesistente).
    update public.calendar_entries
       set archived_at = new.archived_at
     where quote_id = new.id
       and archived_at is distinct from new.archived_at;
    -- Contratti collegati (per preventivo o per evento del preventivo) seguono lo stesso stato.
    update public.contracts
       set archived_at = new.archived_at
     where (quote_id = new.id
            or entry_id in (select id from public.calendar_entries where quote_id = new.id))
       and archived_at is distinct from new.archived_at;
  end if;
  return new;
end$$;
