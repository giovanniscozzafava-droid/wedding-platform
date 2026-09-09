-- ============================================================================
-- Evento urgente — il professionista marca un evento come urgente:
--   1. nella lista eventi sale IN CIMA a qualsiasi altro ordinamento (lato
--      frontend: frontend/src/pages/WeddingsPage.tsx legge `urgent`).
--   2. finché resta urgente, riceve un promemoria (in-app + email) ogni
--      `urgent_remind_every_hours` ore (24 default, o 48 / 168=7gg).
--
-- Riuso del canale esistente (NON un nuovo invio): il promemoria è una riga
-- in `notifiche` (tipo EVENTO_URGENTE, upsert su (destinatario_id, evento_id,
-- tipo) come FORNITORE_PRESENZA in 20260907122000) — appare subito in-app
-- (ProssimaMossa legge PENDING senza filtrare scadenza_il) e viene imbustata
-- nella email quotidiana già esistente: `scadenza_il` la mette nel digest del
-- giorno (v_notifiche_digest_per_utente → invia_digest_giornaliero → pg_net
-- → edge function send-digest → Resend, vedi 20260601300000/20260720140000).
-- Per questo `urgent_reminders_due()` va schedulato PRIMA del cron
-- 'invia-digest-giornaliero' (08:00 UTC), esattamente come 'rigenera-
-- promemoria' (01:15 UTC) fa per gli altri promemoria a data fissa — la
-- digest legge solo scadenza_il::date = oggi al MOMENTO in cui gira, non
-- accumula i giorni passati.
--
-- `calendar_entries_collab` (vista mascherata per il fornitore-collaboratore)
-- NON viene toccata: elenca le colonne esplicitamente, quindi non espone mai
-- `urgent` → i collaboratori non vedono l'urgenza (solo l'owner la gestisce).
-- ============================================================================

-- 1. Colonne su calendar_entries --------------------------------------------
alter table public.calendar_entries
  add column if not exists urgent boolean not null default false,
  add column if not exists urgent_since timestamptz,
  add column if not exists urgent_note text,
  add column if not exists urgent_remind_every_hours int not null default 24,
  add column if not exists urgent_last_reminded_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'calendar_entries_urgent_remind_every_hours_check'
  ) then
    alter table public.calendar_entries
      add constraint calendar_entries_urgent_remind_every_hours_check
      check (urgent_remind_every_hours in (24, 48, 168)); -- 24h / 48h / 7 giorni
  end if;
end $$;

comment on column public.calendar_entries.urgent is
  'Evento marcato urgente dal professionista: sale in cima alla lista eventi e genera promemoria periodici finché resta true.';
comment on column public.calendar_entries.urgent_since is
  'Istante in cui l''evento è STATO marcato urgente (l''ultima volta): azzerato quando urgent torna false. Usato per "Urgente da N giorni".';
comment on column public.calendar_entries.urgent_note is
  'Nota facoltativa del professionista sul perché l''evento è urgente.';
comment on column public.calendar_entries.urgent_remind_every_hours is
  'Cadenza del promemoria urgenza: 24, 48 o 168 (7 giorni) ore. Default 24.';
comment on column public.calendar_entries.urgent_last_reminded_at is
  'Ultima volta che urgent_reminders_due() ha generato/aggiornato il promemoria per questo evento.';

-- Indice per la scansione del cron: solo le righe urgent = true contano.
create index if not exists idx_calentry_urgent
  on public.calendar_entries(urgent, urgent_last_reminded_at)
  where urgent is true;

-- 2. Trigger: gestisce urgent_since / urgent_last_reminded_at e chiude il
--    promemoria pendente quando l'urgenza viene tolta ----------------------
create or replace function public.fn_evento_urgente_toggle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.urgent is true and coalesce(old.urgent, false) is false then
    -- appena marcato urgente: riparte il ciclo di promemoria da zero, cosi`
    -- il primo promemoria puo` partire alla prossima esecuzione del cron.
    new.urgent_since := now();
    new.urgent_last_reminded_at := null;
  elsif new.urgent is false and coalesce(old.urgent, false) is true then
    -- urgenza tolta: si ferma tutto, e il promemoria pendente si chiude
    -- (non resta a galleggiare in "prossima mossa" per un evento non piu` urgente).
    new.urgent_since := null;
    new.urgent_last_reminded_at := null;
    begin
      update public.notifiche
         set stato = 'DONE', letto_il = coalesce(letto_il, now())
       where evento_id = new.id
         and tipo = 'EVENTO_URGENTE'
         and stato = 'PENDING';
    exception when others then null; -- best-effort: non deve bloccare il toggle
    end;
  end if;
  return new;
end;
$$;

comment on function public.fn_evento_urgente_toggle() is
  'Trigger BEFORE UPDATE OF urgent su calendar_entries: gestisce urgent_since/urgent_last_reminded_at e chiude il promemoria EVENTO_URGENTE pendente quando l''urgenza viene tolta.';

drop trigger if exists trg_evento_urgente_toggle on public.calendar_entries;
create trigger trg_evento_urgente_toggle
  before update of urgent on public.calendar_entries
  for each row
  execute function public.fn_evento_urgente_toggle();

-- 3. Funzione urgent_reminders_due() -----------------------------------------
-- Per ogni evento urgente non archiviato/non annullato con promemoria scaduto
-- (mai inviato o piu` vecchio di urgent_remind_every_hours ore), crea/aggiorna
-- la notifica EVENTO_URGENTE per l'owner e aggiorna urgent_last_reminded_at.
-- Ritorna il numero di promemoria generati/aggiornati.
create or replace function public.urgent_reminders_due()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r          record;
  v_count    int := 0;
  v_giorni   int;
  v_nome     text;
  v_titolo   text;
  v_descr    text;
  v_link     text;
begin
  for r in
    select ce.id, ce.owner_id, ce.title, ce.event_kind, ce.urgent_since, ce.urgent_note,
           ce.urgent_remind_every_hours,
           cep.client_name
      from public.calendar_entries ce
      left join public.calendar_entries_private cep on cep.entry_id = ce.id
     where ce.urgent is true
       and ce.archived_at is null
       and ce.evento_stato <> 'ANNULLATO'
       and ce.owner_id is not null
       and (
         ce.urgent_last_reminded_at is null
         or ce.urgent_last_reminded_at < now() - make_interval(hours => ce.urgent_remind_every_hours)
       )
  loop
    v_giorni := greatest(0, floor(extract(epoch from (now() - coalesce(r.urgent_since, now()))) / 86400))::int;
    v_nome   := coalesce(nullif(r.client_name, ''), nullif(r.title, ''), 'evento');
    v_titolo := 'Evento urgente: ' || v_nome;
    v_descr  := case
                  when v_giorni <= 0 then 'Segnalato urgente da oggi.'
                  when v_giorni = 1  then 'Segnalato urgente da 1 giorno.'
                  else 'Segnalato urgente da ' || v_giorni || ' giorni.'
                end
                || case when nullif(r.urgent_note, '') is not null then ' ' || r.urgent_note else '' end;
    v_link   := '/weddings/' || r.id::text;

    begin
      insert into public.notifiche(
        destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
        owner_della_mossa, stato, priorita, scadenza_il
      ) values (
        r.owner_id, r.id, 'EVENTO_URGENTE', v_titolo, v_descr, v_link,
        r.owner_id, 'PENDING', 10, now()
      )
      on conflict (destinatario_id, evento_id, tipo) do update
        set titolo      = excluded.titolo,
            descrizione = excluded.descrizione,
            link_action = excluded.link_action,
            stato       = 'PENDING',
            priorita    = excluded.priorita,
            scadenza_il = excluded.scadenza_il,
            letto_il    = null,
            creato_il   = now();
    exception when others then null; -- best-effort: un evento non deve bloccare gli altri
    end;

    update public.calendar_entries
       set urgent_last_reminded_at = now()
     where id = r.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.urgent_reminders_due() is
  'Promemoria evento urgente: per ogni calendar_entries urgent=true non archiviato/non annullato scaduto di promemoria, upserta la notifica EVENTO_URGENTE (in-app subito, email nel prossimo digest giornaliero) e aggiorna urgent_last_reminded_at. Schedulata da pg_cron PRIMA di invia-digest-giornaliero.';

-- Interna: nessun accesso da client (ne` anon ne` authenticated). La chiama
-- solo pg_cron (ruolo proprietario della funzione, come le altre RPC interne
-- — vedi 20260907140000_sec_revoca_anon_su_rpc_interne.sql).
revoke execute on function public.urgent_reminders_due() from public, anon, authenticated;

-- 4. Cron: promemoria evento urgente, 15 minuti prima del digest -------------
--    07:45 UTC ogni giorno (invia-digest-giornaliero gira alle 08:00 UTC:
--    vedi 20260713220000_schedule_promemoria_digest.sql). cron.schedule
--    upserta per jobname -> rerun-safe.
do $$ begin
  perform cron.schedule('urgent-reminders-daily', '45 7 * * *',
    'select public.urgent_reminders_due();');
exception when others then
  raise notice 'pg_cron non disponibile: urgent-reminders-daily non schedulato (%)', SQLERRM;
end $$;
