-- Notifiche sulle "mosse" del cerchio: ogni azione genera una notifica al
-- destinatario giusto, con deep-link al punto da aprire (campanello + bollino rosso).
-- Riusa push_user_notification(user, type, title, body, link, ref).

-- suggerisci: notifica gli sposi (futuro, da approvare) o il fornitore (passato, aggiunto).
create or replace function public.suggest_supplier_to_event(p_entry uuid, p_supplier uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sub text; v_future boolean; v_sname text; v_title text; m record;
begin
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if not exists (select 1 from public.profiles where id = p_supplier and role = 'FORNITORE') then
    return jsonb_build_object('error', 'not_a_supplier');
  end if;
  select subrole, coalesce(nullif(business_name,''), full_name, 'Un fornitore') into v_sub, v_sname from public.profiles where id = p_supplier;
  select coalesce(date_to, date_from) >= current_date, coalesce(title,'il vostro evento') into v_future, v_title from public.calendar_entries where id = p_entry;

  if v_future then
    insert into public.event_circle_suggestions(entry_id, supplier_id, role_key, suggested_by, status)
    values (p_entry, p_supplier, v_sub, auth.uid(), 'PENDING')
    on conflict (entry_id, supplier_id) do update
      set status = 'PENDING', suggested_by = excluded.suggested_by, role_key = excluded.role_key
      where public.event_circle_suggestions.status <> 'ACCEPTED';
    -- notifica gli sposi: devono approvare
    for m in select user_id from public.wedding_couple_members where entry_id = p_entry and user_id is not null loop
      perform public.push_user_notification(m.user_id, 'circle_request', 'Nuovo fornitore proposto',
        v_sname || ' è stato proposto per ' || v_title || '. Approva o rifiuta.', '/couple', p_entry);
    end loop;
    return jsonb_build_object('ok', true, 'pending', true);
  end if;

  begin
    insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
    values (p_entry, p_supplier, 'fornitore', true)
    on conflict (entry_id, user_id) do update set confirmed = true;
  exception when others then
    return jsonb_build_object('error', sqlerrm);
  end;
  -- notifica il fornitore aggiunto (evento passato → accesso foto)
  perform public.push_user_notification(p_supplier, 'circle_added', 'Sei nel cerchio di un evento',
    'Sei stato aggiunto a ' || v_title || ': trovi le foto dell''evento.', '/weddings/' || p_entry::text, p_entry);
  return jsonb_build_object('ok', true, 'pending', false, 'subrole', v_sub);
end$$;
grant execute on function public.suggest_supplier_to_event(uuid, uuid) to authenticated;

-- approvazione sposi: notifica il fornitore accettato e chi l'aveva suggerito.
create or replace function public.respond_circle_suggestion(p_suggestion uuid, p_accept boolean, p_signed_name text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_sup uuid; v_by uuid; v_title text; v_sname text;
begin
  select entry_id, supplier_id, suggested_by into v_entry, v_sup, v_by
    from public.event_circle_suggestions where id = p_suggestion and status = 'PENDING';
  if v_entry is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (public.is_wedding_couple(v_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  select coalesce(title,'il vostro evento') into v_title from public.calendar_entries where id = v_entry;
  select coalesce(nullif(business_name,''), full_name, 'Il fornitore') into v_sname from public.profiles where id = v_sup;

  if p_accept then
    if coalesce(btrim(p_signed_name), '') = '' then return jsonb_build_object('error', 'signature_required'); end if;
    begin
      insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
      values (v_entry, v_sup, 'fornitore', true)
      on conflict (entry_id, user_id) do update set confirmed = true;
    exception when others then
      return jsonb_build_object('error', sqlerrm);
    end;
    update public.event_circle_suggestions
       set status = 'ACCEPTED', signed_by = auth.uid(), signed_name = p_signed_name, signed_at = now()
     where id = p_suggestion;
    -- notifica il fornitore accettato + chi l'ha suggerito
    perform public.push_user_notification(v_sup, 'circle_accepted', 'Sei stato accettato nel cerchio',
      'Gli sposi ti hanno accettato in ' || v_title || '.', '/weddings/' || v_entry::text, v_entry);
    if v_by is not null and v_by <> v_sup then
      perform public.push_user_notification(v_by, 'circle_accepted', 'Proposta accettata',
        'Gli sposi hanno accettato ' || v_sname || ' che avevi suggerito.', '/weddings/' || v_entry::text, v_entry);
    end if;
  else
    update public.event_circle_suggestions set status = 'REJECTED' where id = p_suggestion;
  end if;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.respond_circle_suggestion(uuid, boolean, text) to authenticated;
