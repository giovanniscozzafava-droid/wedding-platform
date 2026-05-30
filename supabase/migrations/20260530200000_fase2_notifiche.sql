-- FASE 2.1 — Workflow guidato: tabella notifiche + refresh per evento + trigger
--
-- Ogni transizione di calendar_entries.evento_stato (FASE 1.3) genera/aggiorna
-- una serie di notifiche "prossima mossa" per gli attori coinvolti:
--   - WP/LOCATION owner del calendar_entry (capostipite)
--   - Coppia (membri couple del wedding)
--   - Fornitori partecipanti
--
-- La tabella ha unique (destinatario_id, evento_id, tipo) per upsert idempotente.
-- Inserimenti SOLO via funzione security definer (nessuna policy INSERT da client).
-- Lettura: destinatario o admin.

-- 1. Tabella notifiche --------------------------------------------------------
create table if not exists public.notifiche (
  id              uuid primary key default gen_random_uuid(),
  destinatario_id uuid not null references public.profiles(id) on delete cascade,
  evento_id       uuid references public.calendar_entries(id) on delete cascade,
  tipo            text not null,
  titolo          text not null,
  descrizione     text,
  link_action     text,
  owner_della_mossa uuid references public.profiles(id) on delete set null,
  stato           text not null default 'PENDING'
                  check (stato in ('PENDING','DONE','SKIPPED')),
  priorita        int not null default 5,
  creato_il       timestamptz not null default now(),
  letto_il        timestamptz
);

comment on table public.notifiche is
  'Notifiche "prossima mossa" generate dal workflow evento. Insert solo via funzioni security definer; lettura: destinatario o admin.';
comment on column public.notifiche.tipo is
  'Codice della mossa (es. FIRMA_INCARICO, RACCOGLI_PREVENTIVI, INVIA_PREVENTIVO_COPPIA). Combinato con (destinatario_id, evento_id) e` chiave naturale per upsert.';
comment on column public.notifiche.owner_della_mossa is
  'Chi materialmente deve agire (utile per UI multi-utente). Puo` coincidere o no col destinatario.';
comment on column public.notifiche.stato is
  'PENDING: da fare. DONE: completata (di solito chiusa quando lo stato evento avanza). SKIPPED: ignorata dall''utente.';

-- Unicità: una sola notifica "viva" per (destinatario, evento, tipo): l'upsert
-- riapre/aggiorna invece di duplicare.
create unique index if not exists ux_notifiche_dest_evento_tipo
  on public.notifiche(destinatario_id, evento_id, tipo);

-- Indici di lettura mobile-first: PENDING dell'utente ordinate per priorità.
create index if not exists idx_notifiche_dest_stato_priorita
  on public.notifiche(destinatario_id, stato, priorita desc, creato_il desc);
create index if not exists idx_notifiche_evento
  on public.notifiche(evento_id);

-- 2. RLS ----------------------------------------------------------------------
alter table public.notifiche enable row level security;

-- Lettura: destinatario o admin.
drop policy if exists "notifiche_select_owner_or_admin" on public.notifiche;
create policy "notifiche_select_owner_or_admin" on public.notifiche
  for select
  using (destinatario_id = auth.uid() or public.is_admin());

-- Update: il destinatario puo` marcare letto_il / stato (DONE/SKIPPED) sulle SUE notifiche.
drop policy if exists "notifiche_update_owner" on public.notifiche;
create policy "notifiche_update_owner" on public.notifiche
  for update
  using (destinatario_id = auth.uid())
  with check (destinatario_id = auth.uid());

-- Nessuna policy INSERT/DELETE da client: insert solo via fn security definer,
-- delete via cascade FK.

-- 3. Funzione refresh_notifiche_per_evento -----------------------------------
-- Popola/aggiorna le notifiche PENDING in base a calendar_entries.evento_stato.
-- Upsert idempotente su (destinatario_id, evento_id, tipo).
-- Le notifiche con stato vecchio (tipo non più rilevante) vengono chiuse a DONE.

create or replace function public.refresh_notifiche_per_evento(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry         record;
  v_couple_ids    uuid[];
  v_owner_id      uuid;
  v_current_tipo  text;
  v_current_titolo text;
  v_current_desc  text;
  v_current_link  text;
  v_current_prio  int;
begin
  select id, owner_id, title, evento_stato, quote_id
    into v_entry
    from public.calendar_entries
   where id = p_entry_id;

  if not found then
    return;
  end if;

  v_owner_id := v_entry.owner_id;

  -- Membri "couple" associati al calendar entry (se la tabella esiste e ha la colonna).
  begin
    select coalesce(array_agg(distinct user_id), array[]::uuid[])
      into v_couple_ids
      from public.calendar_entry_participants
     where entry_id = p_entry_id
       and user_id is not null
       and coalesce(role_in_entry, '') ilike 'COUPLE%';
  exception when others then
    v_couple_ids := array[]::uuid[];
  end;

  -- 1) Determina la "prossima mossa" in base allo stato corrente.
  --    Una sola riga "viva" alla volta per destinatario+evento.
  case v_entry.evento_stato
    when 'LEAD' then
      v_current_tipo   := 'FIRMA_INCARICO';
      v_current_titolo := 'Firma l''incarico capostipite';
      v_current_desc   := 'Il cliente deve firmare l''incarico per attivare l''evento "' || v_entry.title || '".';
      v_current_link   := '/calendar?entry=' || v_entry.id::text;
      v_current_prio   := 9;
    when 'INCARICO_FIRMATO' then
      v_current_tipo   := 'RACCOGLI_PREVENTIVI';
      v_current_titolo := 'Raccogli preventivi dai fornitori';
      v_current_desc   := 'Invita i fornitori a inviare preventivi per "' || v_entry.title || '".';
      v_current_link   := '/quotes?entry=' || v_entry.id::text;
      v_current_prio   := 8;
    when 'PREVENTIVI' then
      v_current_tipo   := 'INVIA_PREVENTIVO_COPPIA';
      v_current_titolo := 'Invia preventivo alla coppia';
      v_current_desc   := 'Componi il preventivo totale e inviane copia firmabile alla coppia.';
      v_current_link   := '/quotes?entry=' || v_entry.id::text;
      v_current_prio   := 8;
    when 'PREVENTIVO_FIRMATO' then
      v_current_tipo   := 'PREPARA_CONTRATTO';
      v_current_titolo := 'Prepara il contratto';
      v_current_desc   := 'Il preventivo e` firmato. Genera il contratto dalle clausole standard.';
      v_current_link   := '/contracts?entry=' || v_entry.id::text;
      v_current_prio   := 8;
    when 'CONTRATTO' then
      v_current_tipo   := 'AVVIA_PIANIFICAZIONE';
      v_current_titolo := 'Avvia la pianificazione';
      v_current_desc   := 'Contratto firmato: passa alla pianificazione (timeline, scaletta, fornitori).';
      v_current_link   := '/calendar?entry=' || v_entry.id::text;
      v_current_prio   := 7;
    when 'PIANIFICAZIONE' then
      v_current_tipo   := 'COMPLETA_CHECKLIST';
      v_current_titolo := 'Completa la checklist evento';
      v_current_desc   := 'Spunta la checklist operativa: la settimana evento e` vicina.';
      v_current_link   := '/calendar?entry=' || v_entry.id::text;
      v_current_prio   := 7;
    when 'CHECKLIST' then
      v_current_tipo   := 'EVENTO_IMMINENTE';
      v_current_titolo := 'Evento imminente';
      v_current_desc   := 'Ultimi controlli pre-evento. Conferma fornitori, orari, logistica.';
      v_current_link   := '/calendar?entry=' || v_entry.id::text;
      v_current_prio   := 9;
    when 'SVOLTO' then
      v_current_tipo   := null; -- stato finale: nessuna mossa nuova
    when 'ANNULLATO' then
      v_current_tipo   := null;
    else
      v_current_tipo   := null;
  end case;

  -- 2) Chiudi le notifiche "vive" di stati precedenti (tipo diverso da quello corrente)
  --    per lo stesso evento: la mossa precedente e` considerata DONE.
  if v_current_tipo is not null then
    update public.notifiche
       set stato = 'DONE',
           letto_il = coalesce(letto_il, now())
     where evento_id = p_entry_id
       and stato = 'PENDING'
       and tipo <> v_current_tipo;
  else
    -- Stato finale: chiudi tutte le PENDING di questo evento.
    update public.notifiche
       set stato = 'DONE',
           letto_il = coalesce(letto_il, now())
     where evento_id = p_entry_id
       and stato = 'PENDING';
    return;
  end if;

  -- 3) Upsert della notifica per il capostipite (owner).
  if v_owner_id is not null then
    insert into public.notifiche(
      destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
      owner_della_mossa, stato, priorita
    ) values (
      v_owner_id, p_entry_id, v_current_tipo, v_current_titolo, v_current_desc, v_current_link,
      v_owner_id, 'PENDING', v_current_prio
    )
    on conflict (destinatario_id, evento_id, tipo) do update
      set titolo = excluded.titolo,
          descrizione = excluded.descrizione,
          link_action = excluded.link_action,
          owner_della_mossa = excluded.owner_della_mossa,
          stato = 'PENDING',
          priorita = excluded.priorita,
          letto_il = null;
  end if;

  -- 4) Per la coppia: emettiamo notifiche solo nei passaggi in cui sono "attori".
  --    LEAD -> firma incarico, PREVENTIVI -> firma preventivo, CONTRATTO da firmare.
  if array_length(v_couple_ids, 1) is not null then
    if v_entry.evento_stato in ('LEAD','PREVENTIVI','CONTRATTO') then
      declare
        v_couple_titolo text;
        v_couple_desc   text;
        v_couple_link   text;
        v_couple_tipo   text;
        v_couple_prio   int := 9;
        v_uid uuid;
      begin
        if v_entry.evento_stato = 'LEAD' then
          v_couple_tipo   := 'COPPIA_FIRMA_INCARICO';
          v_couple_titolo := 'Firma l''incarico col tuo wedding planner';
          v_couple_desc   := 'Apri l''incarico, leggilo e firma per attivare il vostro matrimonio.';
          v_couple_link   := '/couple';
        elsif v_entry.evento_stato = 'PREVENTIVI' then
          v_couple_tipo   := 'COPPIA_ATTENDE_PREVENTIVO';
          v_couple_titolo := 'Il preventivo arriva a breve';
          v_couple_desc   := 'Il/la wedding planner sta raccogliendo i preventivi. Ti avviseremo appena pronto.';
          v_couple_link   := '/couple';
          v_couple_prio   := 5;
        else -- CONTRATTO
          v_couple_tipo   := 'COPPIA_FIRMA_CONTRATTO';
          v_couple_titolo := 'Firma il contratto del matrimonio';
          v_couple_desc   := 'Trovi il contratto pronto alla firma nella sezione Documenti.';
          v_couple_link   := '/couple';
        end if;

        foreach v_uid in array v_couple_ids loop
          insert into public.notifiche(
            destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
            owner_della_mossa, stato, priorita
          ) values (
            v_uid, p_entry_id, v_couple_tipo, v_couple_titolo, v_couple_desc, v_couple_link,
            v_uid, 'PENDING', v_couple_prio
          )
          on conflict (destinatario_id, evento_id, tipo) do update
            set titolo = excluded.titolo,
                descrizione = excluded.descrizione,
                link_action = excluded.link_action,
                owner_della_mossa = excluded.owner_della_mossa,
                stato = 'PENDING',
                priorita = excluded.priorita,
                letto_il = null;
        end loop;
      end;
    end if;
  end if;
end;
$$;

comment on function public.refresh_notifiche_per_evento(uuid) is
  'Rigenera le notifiche "prossima mossa" per il calendar_entry indicato, in base a evento_stato. Chiude le vecchie a DONE, upserta quella nuova.';

-- 4. Trigger AFTER UPDATE OF evento_stato -------------------------------------
create or replace function public.fn_notifiche_on_evento_stato_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.evento_stato is distinct from old.evento_stato then
    perform public.refresh_notifiche_per_evento(new.id);
  end if;
  return null; -- after trigger
end;
$$;

comment on function public.fn_notifiche_on_evento_stato_change() is
  'Trigger AFTER UPDATE OF evento_stato: chiama refresh_notifiche_per_evento per aggiornare lo stato delle notifiche.';

drop trigger if exists trg_notifiche_evento_stato on public.calendar_entries;
create trigger trg_notifiche_evento_stato
  after update of evento_stato on public.calendar_entries
  for each row
  execute function public.fn_notifiche_on_evento_stato_change();

-- 5. Backfill: una passata iniziale per popolare le notifiche degli eventi esistenti.
do $$
declare
  r record;
begin
  for r in select id from public.calendar_entries loop
    perform public.refresh_notifiche_per_evento(r.id);
  end loop;
end$$;
