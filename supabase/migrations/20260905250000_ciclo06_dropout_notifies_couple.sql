-- ============================================================================
-- CICLO-06: dropout_fornitore notificava solo il WP owner ("sostituisci
-- fornitore"), mai la coppia — che scopriva il ritiro del fornitore solo se
-- il WP gliene parlava a voce/messaggio fuori piattaforma.
-- ============================================================================

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
  v_couple_dest      uuid;
  v_couple_list      uuid[];
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

  begin
    select coalesce(p.business_name, p.full_name, 'fornitore')
      into v_old_supplier_name
      from public.profiles p
     where p.id = v_old_supplier;
  exception when others then
    v_old_supplier_name := 'fornitore';
  end;

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

  -- Notifica anche la coppia: prima non veniva mai avvisata di un dropout.
  if v_entry.id is not null then
    -- calendar_entry_participants non contiene mai la coppia (solo fornitori/
    -- staff, verificato): l'unica fonte per i membri coppia è wedding_couple_members.
    select coalesce(array_agg(distinct wcm.user_id) filter (where wcm.user_id is not null), array[]::uuid[])
      into v_couple_list
      from public.wedding_couple_members wcm
     where wcm.entry_id = v_entry.id;

    if array_length(v_couple_list, 1) is not null then
      foreach v_couple_dest in array v_couple_list loop
        insert into public.notifiche(
          destinatario_id, evento_id, tipo, titolo, descrizione, link_action,
          owner_della_mossa, stato, priorita
        ) values (
          v_couple_dest, v_entry.id,
          'DROPOUT_FORNITORE_COPPIA_' || p_quote_item_id::text,
          'Un fornitore si è ritirato',
          'Il fornitore per "' || coalesce(v_item.name_snapshot, 'un servizio') ||
            '" si è ritirato. Il tuo wedding planner sta cercando un sostituto.',
          '/couple',
          v_entry.owner_id, 'PENDING', 8
        )
        on conflict (destinatario_id, evento_id, tipo) do update
          set descrizione = excluded.descrizione,
              stato = 'PENDING',
              letto_il = null;
      end loop;
    end if;
  end if;

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
