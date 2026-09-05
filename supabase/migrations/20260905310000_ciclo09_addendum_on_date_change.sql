-- ============================================================================
-- CICLO-09 (decisione presa da Giovanni: "A e testa" — un cambio data
-- post-firma genera un addendum, non un aggiornamento silenzioso).
--
-- riprogramma_evento aggiornava contracts.event_date anche su un contratto
-- già FIRMATO senza lasciare traccia: il testo firmato continuava a riportare
-- la vecchia data, nessun documento nuovo, nessuna nuova firma. Ora, per ogni
-- contratto FIRMATO collegato all'evento (contratto principale col cliente E
-- eventuali mini-contratti coi fornitori), genera un addendum "cambio data"
-- (riusa la tabella/il flusso di firma già esistenti per gli addendum di
-- importo — contract_addendums ha già una colonna date_change, mai popolata
-- finora) e lo lascia in BOZZA pronto per l'invio, esattamente come già
-- avviene per un addendum di importo generato dall'editor preventivo.
-- ============================================================================

create or replace function public._addendum_build_date_change(
  p_contract_id uuid, p_old_date date, p_new_date date
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_contract record; v_add_id uuid; v_token uuid; v_num int; v_body text;
begin
  select id, title, entry_id, quote_id, owner_id into v_contract
    from public.contracts where id = p_contract_id and status = 'FIRMATO';
  if v_contract.id is null then return jsonb_build_object('created', false, 'reason','no_signed_contract'); end if;
  if p_old_date is not distinct from p_new_date or p_new_date is null then
    return jsonb_build_object('created', false, 'reason','no_change');
  end if;

  v_body :=
    'Con il presente atto integrativo le parti concordano lo spostamento della data dell''evento oggetto del contratto "'
    || coalesce(v_contract.title,'Contratto') || '".' || chr(10) || chr(10)
    || 'Data precedente: ' || coalesce(to_char(p_old_date, 'DD/MM/YYYY'), 'non specificata') || '.' || chr(10)
    || 'Nuova data concordata: ' || to_char(p_new_date, 'DD/MM/YYYY') || '.' || chr(10) || chr(10)
    || 'Resta fermo e invariato ogni altro patto e condizione del contratto originario, incluso il corrispettivo.';

  select id into v_add_id from public.contract_addendums
   where contract_id = p_contract_id and status in ('BOZZA','INVIATO')
   order by addendum_number desc limit 1;

  if v_add_id is not null then
    update public.contract_addendums
       set title = 'Addendum al contratto — cambio data',
           body = v_body,
           amount_delta = 0,
           date_change = p_new_date,
           access_token = gen_random_uuid(),
           access_token_expires_at = now() + interval '30 days',
           status = 'BOZZA',
           updated_at = now()
     where id = v_add_id
     returning access_token into v_token;
  else
    select coalesce(max(addendum_number),0)+1 into v_num
      from public.contract_addendums where contract_id = p_contract_id;
    insert into public.contract_addendums(
      contract_id, quote_id, entry_id, addendum_number, status, title, body,
      amount_delta, date_change, created_by, access_token, access_token_expires_at
    ) values (
      p_contract_id, v_contract.quote_id, v_contract.entry_id, v_num, 'BOZZA',
      'Addendum al contratto — cambio data', v_body,
      0, p_new_date, v_contract.owner_id, gen_random_uuid(), now() + interval '30 days'
    )
    returning id, access_token into v_add_id, v_token;
  end if;

  return jsonb_build_object('created', true, 'addendum_id', v_add_id, 'token', v_token);
end$$;

revoke all on function public._addendum_build_date_change(uuid, date, date) from public, anon, authenticated;

-- --- riprogramma_evento: genera un addendum per ogni contratto FIRMATO collegato ---
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
  v_signed_contract  record;
  v_addendum_ids     uuid[] := array[]::uuid[];
  v_add_result       jsonb;
begin
  select id, owner_id, title, date_from, date_to, quote_id, evento_stato
    into v_entry
    from public.calendar_entries
   where id = p_entry_id
   for update;
  if not found then
    raise exception 'Evento % non trovato', p_entry_id using errcode = '42P01';
  end if;

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

  update public.calendar_entries
     set date_from = p_nuova_data,
         date_to   = v_new_to,
         updated_at = now()
   where id = p_entry_id;

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

  -- CICLO-09: un contratto già FIRMATO che cambia data genera un addendum
  -- (documento + nuova firma), invece di un aggiornamento silenzioso.
  if v_old_from is not null and v_old_from <> p_nuova_data then
    for v_signed_contract in
      select id from public.contracts where entry_id = p_entry_id and status = 'FIRMATO'
    loop
      v_add_result := public._addendum_build_date_change(v_signed_contract.id, v_old_from, p_nuova_data);
      if coalesce((v_add_result->>'created')::boolean, false) then
        v_addendum_ids := v_addendum_ids || (v_add_result->>'addendum_id')::uuid;
      end if;
    end loop;
  end if;

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

  insert into public.eventi_cambiamento(entry_id, tipo, payload, eseguito_da, stato)
  values (
    p_entry_id, 'RIPROGRAMMA',
    jsonb_build_object(
      'old_date_from', v_old_from,
      'old_date_to', v_old_to,
      'new_date_from', p_nuova_data,
      'new_date_to', v_new_to,
      'fornitori_da_riconfermare', v_fornitori_count,
      'addendum_ids', to_jsonb(v_addendum_ids)
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
    'fornitori_da_riconfermare', v_fornitori_count,
    'addendum_ids', to_jsonb(v_addendum_ids)
  );
end;
$$;

comment on function public.riprogramma_evento(uuid, date) is
  'Sposta un evento a una nuova data, libera la disponibilita` fornitori vecchia, aggiorna quotes/contracts, genera un addendum per ogni contratto già FIRMATO collegato, e notifica i fornitori per riconferma. Authz: owner WP o admin.';

revoke all on function public.riprogramma_evento(uuid, date) from public;
grant execute on function public.riprogramma_evento(uuid, date) to authenticated;
