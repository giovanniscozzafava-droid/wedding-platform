-- FASE 5.2 — Cambiamenti evento (riprogrammazione / dropout fornitore / annullamento)
--
-- Tabella `eventi_cambiamento`: log strutturato delle 3 mosse "rumorose" che
-- modificano un evento gia` partito.
--
-- RPC:
--   - riprogramma_evento(p_entry, p_nuova_data)
--   - dropout_fornitore(p_quote_item_id, p_motivo)
--   - annulla_evento(p_entry, p_motivo)
--
-- Tutte transazionali (la singola call e` un blocco atomico in plpgsql) e
-- security definer. Authz: solo owner WP del calendar_entry o admin.
--
-- Soft-delete recuperabile per annullamento: NON facciamo DELETE delle righe,
-- impostiamo evento_stato='ANNULLATO' e marchiamo i record collegati
-- (quotes -> RIFIUTATO, contracts -> ANNULLATO). Il dato resta navigabile e
-- ripristinabile in futuro (riapertura manuale via admin).

-- 1. Tabella eventi_cambiamento ----------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'evento_cambiamento_tipo') then
    create type public.evento_cambiamento_tipo as enum (
      'RIPROGRAMMA',
      'DROPOUT_FORNITORE',
      'ANNULLAMENTO'
    );
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'evento_cambiamento_stato') then
    create type public.evento_cambiamento_stato as enum (
      'IN_CORSO',
      'COMPLETATO',
      'FALLITO'
    );
  end if;
end$$;

create table if not exists public.eventi_cambiamento (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null references public.calendar_entries(id) on delete cascade,
  tipo          public.evento_cambiamento_tipo not null,
  payload       jsonb not null default '{}'::jsonb,
  eseguito_da   uuid references public.profiles(id) on delete set null,
  eseguito_il   timestamptz not null default now(),
  stato         public.evento_cambiamento_stato not null default 'IN_CORSO'
);

comment on table public.eventi_cambiamento is
  'Log strutturato dei 3 cambiamenti "rumorosi" su un evento: riprogrammazione, dropout fornitore, annullamento. Append-only via RPC security definer.';
comment on column public.eventi_cambiamento.payload is
  'JSON con i parametri della mossa (es. {old_date_from, new_date_from} per RIPROGRAMMA, {motivo, quote_item_id} per DROPOUT).';

create index if not exists idx_eventi_cambiamento_entry
  on public.eventi_cambiamento(entry_id, eseguito_il desc);
create index if not exists idx_eventi_cambiamento_tipo
  on public.eventi_cambiamento(tipo);

-- RLS: lettura per i membri evento (riusa is_evento_member di FASE 5.1) o admin.
alter table public.eventi_cambiamento enable row level security;

drop policy if exists "eventi_cambiamento_select_membri" on public.eventi_cambiamento;
create policy "eventi_cambiamento_select_membri" on public.eventi_cambiamento
  for select
  using (public.is_evento_member(entry_id));

-- Niente policy di INSERT/UPDATE/DELETE da client: solo RPC security definer.

grant select on public.eventi_cambiamento to authenticated;


-- 2. RPC riprogramma_evento --------------------------------------------------
-- Sposta calendar_entries.date_from/date_to alla nuova data, libera le
-- supplier_availability vecchie associate (status=BUSY/TENTATIVE con notes che
-- richiamano questo evento) e genera una notifica RICONFERMA per ogni fornitore
-- del preventivo.

create or replace function public.riprogramma_evento(
  p_entry_id   uuid,
  p_nuova_data date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry            record;
  v_old_from         date;
  v_old_to           date;
  v_new_to           date;
  v_durata_giorni    int;
  v_cambio_id        uuid;
  v_fornitori_count  int := 0;
  v_fornitore        uuid;
begin
  -- Carico evento.
  select id, owner_id, title, date_from, date_to, quote_id, evento_stato
    into v_entry
    from public.calendar_entries
   where id = p_entry_id
   for update;
  if not found then
    raise exception 'Evento % non trovato', p_entry_id using errcode = '42P01';
  end if;

  -- Authz: owner WP o admin.
  if not (v_entry.owner_id = auth.uid() or public.is_admin()) then
    raise exception 'Non autorizzato a riprogrammare questo evento' using errcode = '42501';
  end if;

  if v_entry.evento_stato in ('SVOLTO','ANNULLATO') then
    raise exception 'Impossibile riprogrammare un evento %', v_entry.evento_stato using errcode = '22023';
  end if;

  if p_nuova_data is null then
    raise exception 'Nuova data non valida' using errcode = '22023';
  end if;

  v_old_from := v_entry.date_from;
  v_old_to   := v_entry.date_to;
  v_durata_giorni := greatest(coalesce(v_old_to, v_old_from) - v_old_from, 0);
  v_new_to := p_nuova_data + v_durata_giorni;

  -- Aggiorna le date.
  update public.calendar_entries
     set date_from = p_nuova_data,
         date_to   = v_new_to,
         updated_at = now()
   where id = p_entry_id;

  -- Libera supplier_availability sulla data vecchia per i fornitori del quote
  -- (status BUSY o TENTATIVE). Best-effort: cancello solo se il fornitore
  -- e` ancora nel quote e la riga esiste.
  if v_entry.quote_id is not null and v_old_from is not null then
    delete from public.supplier_availability sa
     where sa.date = v_old_from
       and sa.status in ('BUSY','TENTATIVE')
       and sa.fornitore_id in (
         select distinct qi.supplier_id
           from public.quote_items qi
          where qi.quote_id = v_entry.quote_id
            and qi.supplier_id is not null
       );
  end if;

  -- Aggiorna event_date sui quote/contracts collegati, cosi` i trigger di
  -- auto_block_availability potranno ri-bloccare la NUOVA data.
  if v_entry.quote_id is not null then
    update public.quotes
       set event_date = p_nuova_data,
           updated_at = now()
     where id = v_entry.quote_id;
  end if;

  update public.contracts
     set event_date = p_nuova_data,
         updated_at = now()
   where entry_id = p_entry_id;

  -- Notifica RICONFERMA per ogni fornitore del quote.
  if v_entry.quote_id is not null then
    for v_fornitore in
      select distinct qi.supplier_id
        from public.quote_items qi
       where qi.quote_id = v_entry.quote_id
         and qi.supplier_id is not null
    loop
      insert into public.notifiche(
        destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
        owner_della_mossa, stato, priorita
      ) values (
        v_fornitore, p_entry_id, 'RICONFERMA_DATA_EVENTO',
        'Riconferma disponibilita` per la nuova data',
        'L''evento "' || coalesce(v_entry.title, '') || '" e` stato riprogrammato al '
          || to_char(p_nuova_data, 'DD/MM/YYYY') || '. Conferma la tua disponibilita`.',
        '/supplier/availability?date=' || p_nuova_data::text,
        v_entry.owner_id, 'PENDING', 9
      )
      on conflict (destinatario_id, evento_id, tipo) do update
        set titolo = excluded.titolo,
            descrizione = excluded.descrizione,
            link_action = excluded.link_action,
            owner_della_mossa = excluded.owner_della_mossa,
            priorita = excluded.priorita,
            stato = 'PENDING',
            letto_il = null;
      v_fornitori_count := v_fornitori_count + 1;
    end loop;
  end if;

  -- Notifica anche WP owner + coppia (link al dettaglio evento).
  insert into public.notifiche(
    destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
    owner_della_mossa, stato, priorita
  ) values (
    v_entry.owner_id, p_entry_id, 'EVENTO_RIPROGRAMMATO',
    'Evento riprogrammato',
    'Hai spostato "' || coalesce(v_entry.title, '') || '" al '
      || to_char(p_nuova_data, 'DD/MM/YYYY') || '. Notifica inviata a '
      || v_fornitori_count::text || ' fornitori per riconferma.',
    '/wedding/' || p_entry_id::text,
    v_entry.owner_id, 'PENDING', 7
  )
  on conflict (destinatario_id, evento_id, tipo) do update
    set descrizione = excluded.descrizione,
        link_action = excluded.link_action,
        priorita = excluded.priorita,
        stato = 'PENDING',
        letto_il = null;

  -- Riga eventi_cambiamento.
  insert into public.eventi_cambiamento(entry_id, tipo, payload, eseguito_da, stato)
  values (
    p_entry_id, 'RIPROGRAMMA',
    jsonb_build_object(
      'old_date_from', v_old_from,
      'old_date_to', v_old_to,
      'new_date_from', p_nuova_data,
      'new_date_to', v_new_to,
      'fornitori_da_riconfermare', v_fornitori_count
    ),
    auth.uid(),
    'COMPLETATO'
  )
  returning id into v_cambio_id;

  return jsonb_build_object(
    'ok', true,
    'cambio_id', v_cambio_id,
    'old_date_from', v_old_from,
    'new_date_from', p_nuova_data,
    'fornitori_da_riconfermare', v_fornitori_count
  );
end;
$$;

comment on function public.riprogramma_evento(uuid, date) is
  'Sposta un evento a una nuova data, libera la disponibilita` fornitori vecchia, aggiorna quotes/contracts e notifica i fornitori per riconferma. Authz: owner WP o admin.';

revoke all on function public.riprogramma_evento(uuid, date) from public;
grant execute on function public.riprogramma_evento(uuid, date) to authenticated;


-- 3. RPC dropout_fornitore ---------------------------------------------------
-- Imposta quote_items.supplier_id = NULL su una specifica voce, annota il
-- motivo nella description_snapshot, libera la sua disponibilita` (se BUSY/
-- TENTATIVE per quella data) e notifica il WP con priorita` urgente.

create or replace function public.dropout_fornitore(
  p_quote_item_id uuid,
  p_motivo        text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item             record;
  v_quote            record;
  v_entry            record;
  v_old_supplier     uuid;
  v_old_supplier_name text;
  v_cambio_id        uuid;
begin
  select qi.id, qi.quote_id, qi.supplier_id, qi.name_snapshot,
         qi.description_snapshot
    into v_item
    from public.quote_items qi
   where qi.id = p_quote_item_id
   for update;
  if not found then
    raise exception 'Voce preventivo % non trovata', p_quote_item_id using errcode = '42P01';
  end if;
  if v_item.supplier_id is null then
    raise exception 'Nessun fornitore assegnato a questa voce' using errcode = '22023';
  end if;

  select q.id, q.owner_id, q.event_date, q.title
    into v_quote
    from public.quotes q
   where q.id = v_item.quote_id;

  select ce.id, ce.owner_id, ce.title, ce.date_from, ce.evento_stato
    into v_entry
    from public.calendar_entries ce
   where ce.quote_id = v_item.quote_id
   limit 1;

  -- Authz: owner del quote, owner del calendar_entry o admin.
  if not (
    (v_quote.owner_id is not null and v_quote.owner_id = auth.uid())
    or (v_entry.owner_id is not null and v_entry.owner_id = auth.uid())
    or public.is_admin()
  ) then
    raise exception 'Non autorizzato a registrare dropout per questa voce' using errcode = '42501';
  end if;

  if v_entry.evento_stato in ('SVOLTO','ANNULLATO') then
    raise exception 'Impossibile gestire dropout su evento %', v_entry.evento_stato using errcode = '22023';
  end if;

  v_old_supplier := v_item.supplier_id;

  -- Nome fornitore (best-effort) per messaggio leggibile.
  begin
    select coalesce(p.business_name, p.full_name, 'fornitore')
      into v_old_supplier_name
      from public.profiles p
     where p.id = v_old_supplier;
  exception when others then
    v_old_supplier_name := 'fornitore';
  end;

  -- Aggiorna la voce: rimuovi fornitore, annota il motivo nella description.
  update public.quote_items qi
     set supplier_id = null,
         description_snapshot = trim(
           coalesce(qi.description_snapshot, '') ||
           E'\n[Dropout fornitore ' || coalesce(v_old_supplier_name, '') ||
           ' il ' || to_char(now(), 'DD/MM/YYYY') || ']: ' ||
           coalesce(p_motivo, 'motivo non specificato')
         ),
         updated_at = now()
   where qi.id = p_quote_item_id;

  -- Libera la disponibilita` del fornitore per la data evento (se BUSY/TENTATIVE).
  if v_quote.event_date is not null then
    delete from public.supplier_availability sa
     where sa.fornitore_id = v_old_supplier
       and sa.date = v_quote.event_date
       and sa.status in ('BUSY','TENTATIVE');
  end if;

  -- Notifica WP owner del calendar_entry: urgente, deve sostituire il fornitore.
  if v_entry.owner_id is not null then
    insert into public.notifiche(
      destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
      owner_della_mossa, stato, priorita
    ) values (
      v_entry.owner_id, v_entry.id,
      'DROPOUT_FORNITORE_' || p_quote_item_id::text,
      'Sostituisci fornitore: ' || coalesce(v_item.name_snapshot, 'voce preventivo'),
      coalesce(v_old_supplier_name, 'Fornitore') ||
        ' ha rinunciato. Motivo: ' || coalesce(p_motivo, '—') ||
        '. Trova un sostituto al piu` presto.',
      '/quotes?entry=' || v_entry.id::text,
      v_entry.owner_id, 'PENDING', 10
    )
    on conflict (destinatario_id, evento_id, tipo) do update
      set titolo = excluded.titolo,
          descrizione = excluded.descrizione,
          link_action = excluded.link_action,
          owner_della_mossa = excluded.owner_della_mossa,
          priorita = excluded.priorita,
          stato = 'PENDING',
          letto_il = null;
  end if;

  -- Riga eventi_cambiamento.
  insert into public.eventi_cambiamento(entry_id, tipo, payload, eseguito_da, stato)
  values (
    v_entry.id, 'DROPOUT_FORNITORE',
    jsonb_build_object(
      'quote_item_id', p_quote_item_id,
      'quote_id', v_item.quote_id,
      'fornitore_id', v_old_supplier,
      'fornitore_nome', v_old_supplier_name,
      'voce_nome', v_item.name_snapshot,
      'motivo', p_motivo
    ),
    auth.uid(),
    'COMPLETATO'
  )
  returning id into v_cambio_id;

  return jsonb_build_object(
    'ok', true,
    'cambio_id', v_cambio_id,
    'quote_item_id', p_quote_item_id,
    'fornitore_rimosso', v_old_supplier
  );
end;
$$;

comment on function public.dropout_fornitore(uuid, text) is
  'Marca dropout di un fornitore su una voce preventivo: SET supplier_id=NULL, annota motivo, libera availability, notifica WP urgente. Authz: owner WP/quote o admin.';

revoke all on function public.dropout_fornitore(uuid, text) from public;
grant execute on function public.dropout_fornitore(uuid, text) to authenticated;


-- 4. RPC annulla_evento ------------------------------------------------------
-- Soft-cancel: evento_stato='ANNULLATO', libera tutte le supplier_availability
-- legate al quote, mette quotes -> RIFIUTATO, contracts -> ANNULLATO. Notifica
-- tutti i membri. Recuperabile via admin (i dati non vengono cancellati).

create or replace function public.annulla_evento(
  p_entry_id uuid,
  p_motivo   text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry         record;
  v_cambio_id     uuid;
  v_avail_count   int := 0;
  v_quotes_count  int := 0;
  v_contr_count   int := 0;
  v_notif_count   int := 0;
  v_dest          uuid;
  v_dest_list     uuid[];
begin
  select id, owner_id, title, date_from, quote_id, evento_stato
    into v_entry
    from public.calendar_entries
   where id = p_entry_id
   for update;
  if not found then
    raise exception 'Evento % non trovato', p_entry_id using errcode = '42P01';
  end if;

  if not (v_entry.owner_id = auth.uid() or public.is_admin()) then
    raise exception 'Non autorizzato ad annullare questo evento' using errcode = '42501';
  end if;

  if v_entry.evento_stato in ('SVOLTO','ANNULLATO') then
    raise exception 'Evento gia` % — nessuna azione', v_entry.evento_stato using errcode = '22023';
  end if;

  -- 1) Soft-cancel: porta lo stato ad ANNULLATO (forward-only validato dal trigger esistente).
  --    Annota il motivo nelle notes per chi recupera lo storico.
  update public.calendar_entries
     set evento_stato = 'ANNULLATO',
         status       = 'CANCELLATA',
         notes        = trim(
           coalesce(notes, '') ||
           E'\n[Annullato il ' || to_char(now(), 'DD/MM/YYYY') || ']: ' ||
           coalesce(p_motivo, 'motivo non specificato')
         ),
         updated_at   = now()
   where id = p_entry_id;

  -- 2) Libera tutte le supplier_availability legate al quote sulla data evento.
  if v_entry.quote_id is not null and v_entry.date_from is not null then
    with deleted as (
      delete from public.supplier_availability sa
       where sa.date = v_entry.date_from
         and sa.status in ('BUSY','TENTATIVE')
         and sa.fornitore_id in (
           select distinct qi.supplier_id
             from public.quote_items qi
            where qi.quote_id = v_entry.quote_id
              and qi.supplier_id is not null
         )
      returning 1
    )
    select count(*) into v_avail_count from deleted;
  end if;

  -- 3) Quotes -> RIFIUTATO (solo quelli ancora attivi).
  if v_entry.quote_id is not null then
    update public.quotes
       set status           = 'RIFIUTATO',
           rejected_at      = coalesce(rejected_at, now()),
           rejection_reason = 'Evento annullato: ' || coalesce(p_motivo, ''),
           updated_at       = now()
     where id = v_entry.quote_id
       and status not in ('RIFIUTATO');
    get diagnostics v_quotes_count = row_count;
  end if;

  -- 4) Contracts -> ANNULLATO (tutti quelli ancora attivi sull'entry).
  update public.contracts
     set status     = 'ANNULLATO',
         updated_at = now()
   where entry_id = p_entry_id
     and status not in ('ANNULLATO');
  get diagnostics v_contr_count = row_count;

  -- 5) Notifiche a tutti i destinatari evento (owner, couple_members, fornitori).
  with parts as (
    -- owner WP
    select v_entry.owner_id as uid
    union
    -- couple members con user_id
    select wcm.user_id
      from public.wedding_couple_members wcm
     where wcm.entry_id = p_entry_id and wcm.user_id is not null
    union
    -- couple participants ruolo COUPLE*
    select p.user_id
      from public.calendar_entry_participants p
     where p.entry_id = p_entry_id and p.user_id is not null
    union
    -- fornitori sul quote
    select distinct qi.supplier_id
      from public.quote_items qi
      join public.quotes q on q.id = qi.quote_id
     where q.id = v_entry.quote_id and qi.supplier_id is not null
  )
  select coalesce(array_agg(distinct uid) filter (where uid is not null), array[]::uuid[])
    into v_dest_list
    from parts;

  if array_length(v_dest_list, 1) is not null then
    foreach v_dest in array v_dest_list loop
      insert into public.notifiche(
        destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
        owner_della_mossa, stato, priorita
      ) values (
        v_dest, p_entry_id, 'EVENTO_ANNULLATO',
        'Evento annullato',
        'L''evento "' || coalesce(v_entry.title, '') || '" e` stato annullato. Motivo: ' ||
          coalesce(p_motivo, '—'),
        '/wedding/' || p_entry_id::text,
        v_entry.owner_id, 'PENDING', 10
      )
      on conflict (destinatario_id, evento_id, tipo) do update
        set descrizione = excluded.descrizione,
            link_action = excluded.link_action,
            priorita = excluded.priorita,
            stato = 'PENDING',
            letto_il = null;
      v_notif_count := v_notif_count + 1;
    end loop;
  end if;

  -- 6) Riga eventi_cambiamento.
  insert into public.eventi_cambiamento(entry_id, tipo, payload, eseguito_da, stato)
  values (
    p_entry_id, 'ANNULLAMENTO',
    jsonb_build_object(
      'motivo', p_motivo,
      'quote_id', v_entry.quote_id,
      'availability_liberate', v_avail_count,
      'quotes_aggiornati', v_quotes_count,
      'contracts_annullati', v_contr_count,
      'notifiche_inviate', v_notif_count,
      'data_evento', v_entry.date_from,
      'recuperabile', true
    ),
    auth.uid(),
    'COMPLETATO'
  )
  returning id into v_cambio_id;

  return jsonb_build_object(
    'ok', true,
    'cambio_id', v_cambio_id,
    'availability_liberate', v_avail_count,
    'quotes_aggiornati', v_quotes_count,
    'contracts_annullati', v_contr_count,
    'notifiche_inviate', v_notif_count,
    'recuperabile', true
  );
end;
$$;

comment on function public.annulla_evento(uuid, text) is
  'Soft-annulla un evento: evento_stato=ANNULLATO, libera availability, quotes->RIFIUTATO, contracts->ANNULLATO, notifica tutti. I dati restano (recuperabile via admin). Authz: owner WP o admin.';

revoke all on function public.annulla_evento(uuid, text) from public;
grant execute on function public.annulla_evento(uuid, text) to authenticated;
