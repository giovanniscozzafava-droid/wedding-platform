-- ============================================================================
-- FIX REGRESSIONE — le notifiche del cerchio evento erano andate perse.
--
-- Storia: 20260611190000_circle_notifications.sql aveva aggiunto le notifiche
-- (push_user_notification) a suggest_supplier_to_event e respond_circle_suggestion.
-- Poi 20260711100000_circle_suggestion_kind.sql ha riscritto le stesse funzioni per
-- aggiungere `kind`, e con `create or replace` ha CANCELLATO tutte le notifiche.
-- Effetto: dall'11/07, aggiungere un fornitore al cerchio non avvisava più nessuno
-- (caso Daisy: la suggestion PENDING esiste, ma sposi = 0 notifiche).
--
-- Questo file ripristina le notifiche in-app (campanello, user_notifications) E aggiunge
-- l'EMAIL (edge circle-notify via net.http_post, pattern lead-notify), mantenendo il kind.
-- Novità rispetto all'originale: su evento futuro avvisiamo ANCHE il fornitore proposto
-- ("sei stato proposto, in attesa di conferma degli sposi") — prima non lo sapeva.
-- ============================================================================

-- helper interno: manda l'email del cerchio via edge, best-effort (non blocca la RPC).
create or replace function public._circle_email(p_entry uuid, p_supplier uuid, p_by uuid, p_phase text)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  if not public.notify_guc_ready('circle-notify', p_entry) then return; end if;
  begin
    v_url := regexp_replace(current_setting('app.supabase_url', true), '/+$', '');
    v_key := coalesce(current_setting('app.functions_anon_key', true), '');
    perform net.http_post(
      url     := v_url || '/circle-notify',
      headers := jsonb_build_object('Content-Type', 'application/json')
                 || case when v_key <> '' then jsonb_build_object('Authorization', 'Bearer ' || v_key) else '{}'::jsonb end,
      body    := jsonb_build_object('entry_id', p_entry, 'supplier_id', p_supplier,
                                    'suggested_by', p_by, 'phase', p_phase));
  exception when others then
    insert into public.notification_dispatch_failures(hook, entity_id, reason)
    values ('circle-notify', p_entry, 'http_post_error: ' || SQLERRM);
  end;
end$$;

-- ------------------------------------------------- suggest_supplier_to_event
create or replace function public.suggest_supplier_to_event(p_entry uuid, p_supplier uuid, p_kind text default 'SHARE')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sub text; v_future boolean; v_kind text; v_title text; v_sname text; m record;
begin
  v_kind := case when upper(coalesce(p_kind,'')) = 'REFERRAL' then 'REFERRAL' else 'SHARE' end;
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if not exists (select 1 from public.profiles where id = p_supplier and role = 'FORNITORE') then
    return jsonb_build_object('error', 'not_a_supplier');
  end if;
  select subrole, coalesce(nullif(business_name,''), full_name, 'Un fornitore')
    into v_sub, v_sname from public.profiles where id = p_supplier;
  select coalesce(date_to, date_from) >= current_date, coalesce(title,'il vostro evento')
    into v_future, v_title from public.calendar_entries where id = p_entry;

  if v_future then
    insert into public.event_circle_suggestions(entry_id, supplier_id, role_key, suggested_by, status, kind)
    values (p_entry, p_supplier, v_sub, auth.uid(), 'PENDING', v_kind)
    on conflict (entry_id, supplier_id) do update
      set status = 'PENDING', suggested_by = excluded.suggested_by, role_key = excluded.role_key, kind = excluded.kind
      where public.event_circle_suggestions.status <> 'ACCEPTED';

    -- notifica gli sposi: devono approvare (ripristino)
    for m in select user_id from public.wedding_couple_members where entry_id = p_entry and user_id is not null loop
      perform public.push_user_notification(m.user_id, 'circle_request', 'Nuovo fornitore proposto',
        v_sname || ' è stato proposto per ' || v_title || '. Approva o rifiuta.', '/couple', p_entry);
    end loop;
    -- NOVITÀ: avvisa anche il fornitore proposto (prima non sapeva di essere stato invitato)
    perform public.push_user_notification(p_supplier, 'circle_proposed', 'Sei stato proposto per un evento',
      'Sei stato proposto per ' || v_title || '. Entri nel cerchio quando gli sposi confermano.',
      '/weddings/' || p_entry::text, p_entry);

    perform public._circle_email(p_entry, p_supplier, auth.uid(), 'proposed');

    if v_kind = 'REFERRAL' and current_date >= date '2027-01-01' then
      perform public._grant_referral_credit(p_entry, p_supplier, auth.uid());
    end if;
    return jsonb_build_object('ok', true, 'pending', true, 'kind', v_kind);
  end if;

  -- evento passato → il fornitore entra subito (accesso foto)
  begin
    insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
    values (p_entry, p_supplier, 'fornitore', true)
    on conflict (entry_id, user_id) do update set confirmed = true;
  exception when others then
    return jsonb_build_object('error', sqlerrm);
  end;
  -- notifica il fornitore aggiunto (ripristino) + email
  perform public.push_user_notification(p_supplier, 'circle_added', 'Sei nel cerchio di un evento',
    'Sei stato aggiunto a ' || v_title || ': trovi le foto dell''evento.', '/weddings/' || p_entry::text, p_entry);
  perform public._circle_email(p_entry, p_supplier, auth.uid(), 'added');

  if v_kind = 'REFERRAL' and current_date >= date '2027-01-01' then
    perform public._grant_referral_credit(p_entry, p_supplier, auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'pending', false, 'subrole', v_sub, 'kind', v_kind);
end$$;
grant execute on function public.suggest_supplier_to_event(uuid, uuid, text) to authenticated;

-- ------------------------------------------------- respond_circle_suggestion
create or replace function public.respond_circle_suggestion(
  p_suggestion uuid, p_accept boolean, p_signed_name text default null, p_data_passage boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_sup uuid; v_by uuid; v_kind text; v_title text; v_sname text;
begin
  select entry_id, supplier_id, suggested_by, kind into v_entry, v_sup, v_by, v_kind
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
       set status = 'ACCEPTED', signed_by = auth.uid(), signed_name = p_signed_name, signed_at = now(),
           data_passage = coalesce(p_data_passage, false)
     where id = p_suggestion;

    -- notifica il fornitore accettato + chi l'aveva suggerito (ripristino) + email
    perform public.push_user_notification(v_sup, 'circle_accepted', 'Sei stato accettato nel cerchio',
      'Gli sposi ti hanno accettato in ' || v_title || '.', '/weddings/' || v_entry::text, v_entry);
    if v_by is not null and v_by <> v_sup then
      perform public.push_user_notification(v_by, 'circle_accepted', 'Proposta accettata',
        'Gli sposi hanno accettato ' || v_sname || ' che avevi suggerito.', '/weddings/' || v_entry::text, v_entry);
    end if;
    perform public._circle_email(v_entry, v_sup, v_by, 'accepted');

    if v_kind = 'REFERRAL' and current_date >= date '2027-01-01' then
      perform public._grant_referral_credit(v_entry, v_sup, v_by);
    end if;
  else
    update public.event_circle_suggestions set status = 'REJECTED' where id = p_suggestion;
    update public.supplier_credits set status = 'CANCELLED'
      where entry_id = v_entry and debtor_id = v_sup and creditor_id = v_by and status = 'PENDING';
  end if;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.respond_circle_suggestion(uuid, boolean, text, boolean) to authenticated;
