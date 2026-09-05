-- ============================================================================
-- CICLO-04: annulla_evento liberava solo supplier_availability, mai
-- supplier_appointments (il modello di capacità che conta davvero da quando
-- esiste, 20260602150000): la riga restava orfana per sempre e poteva
-- ridiventare BUSY se un futuro ricalcolo la trovava ancora lì.
-- ============================================================================

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
  v_appt_count    int := 0;
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
  update public.calendar_entries
     set evento_stato = 'ANNULLATO',
         status       = 'CANCELLATA',
         updated_at   = now()
   where id = p_entry_id;

  -- 1b) Annota il motivo nelle note private (calendar_entries.notes non esiste).
  update public.calendar_entries_private
     set notes = trim(
           coalesce(notes, '') ||
           E'\n[Annullato il ' || to_char(now(), 'DD/MM/YYYY') || ']: ' ||
           coalesce(p_motivo, 'motivo non specificato')
         )
   where entry_id = p_entry_id;

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

  -- 2b) Ripulisce anche supplier_appointments (il modello di capacità reale) —
  --     senza questo, la riga resta orfana e può ridiventare BUSY per errore
  --     in futuro su ricalcoli di quella data per lo stesso fornitore.
  if v_entry.quote_id is not null then
    delete from public.supplier_appointments sap
     where sap.source_quote_id = v_entry.quote_id;
    get diagnostics v_appt_count = row_count;

    if v_entry.date_from is not null then
      perform public.recompute_day_availability(qi.supplier_id, v_entry.date_from)
        from (select distinct supplier_id from public.quote_items
               where quote_id = v_entry.quote_id and supplier_id is not null) qi;
    end if;
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
    select v_entry.owner_id as uid
    union
    select wcm.user_id
      from public.wedding_couple_members wcm
     where wcm.entry_id = p_entry_id and wcm.user_id is not null
    union
    select p.user_id
      from public.calendar_entry_participants p
     where p.entry_id = p_entry_id and p.user_id is not null
    union
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
      'appuntamenti_rimossi', v_appt_count,
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
    'appuntamenti_rimossi', v_appt_count,
    'quotes_aggiornati', v_quotes_count,
    'contracts_annullati', v_contr_count,
    'notifiche_inviate', v_notif_count,
    'recuperabile', true
  );
end;
$$;
