-- BUG: suggerendo/aggiungendo un collega al CERCHIO dell'evento non maturava alcun credito
-- (log_supplier_referral non veniva mai chiamato dal flusso suggerimenti). Ora il credito si
-- crea al momento del suggerimento, sia per evento futuro (richiesta) sia passato (aggiunta diretta),
-- legato all'EVENTO (entry_id) così "ognuno vede i propri crediti, da chi e per quale evento".

alter table public.supplier_credits
  add column if not exists entry_id uuid references public.calendar_entries(id) on delete set null;
create index if not exists idx_supplier_credits_entry on public.supplier_credits(entry_id);

-- helper: crea il credito per il suggeritore (idempotente per evento+coppia creditore/debitore)
create or replace function public._grant_referral_credit(p_entry uuid, p_supplier uuid, p_creditor uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_kind text; v_label text;
begin
  if p_creditor is null or p_supplier is null or p_creditor = p_supplier then return; end if;
  if not exists (select 1 from public.profiles where id = p_supplier and role = 'FORNITORE') then return; end if;
  if exists (select 1 from public.supplier_credits
              where creditor_id = p_creditor and debtor_id = p_supplier and entry_id = p_entry
                and status <> 'CANCELLED') then return; end if;
  select event_kind, title into v_kind, v_label from public.calendar_entries where id = p_entry;
  insert into public.supplier_credits(creditor_id, debtor_id, amount, reason, event_kind, client_label, entry_id, created_by, status)
  values (p_creditor, p_supplier, 100, 'Segnalazione al cerchio evento', v_kind, v_label, p_entry, p_creditor, 'PENDING');
  perform public.push_user_notification(p_supplier, 'CREDIT_NEW', 'Nuova segnalazione ricevuta',
    'Un collega ti ha segnalato su un evento: hai un credito da riconoscere di 100€', '/crediti', null);
end$$;

-- suggest_supplier_to_event: crea il credito (creditore = chi suggerisce) appena suggerisce/aggiunge.
create or replace function public.suggest_supplier_to_event(p_entry uuid, p_supplier uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sub text; v_future boolean;
begin
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if not exists (select 1 from public.profiles where id = p_supplier and role = 'FORNITORE') then
    return jsonb_build_object('error', 'not_a_supplier');
  end if;
  select subrole into v_sub from public.profiles where id = p_supplier;
  select coalesce(date_to, date_from) >= current_date into v_future from public.calendar_entries where id = p_entry;

  if v_future then
    insert into public.event_circle_suggestions(entry_id, supplier_id, role_key, suggested_by, status)
    values (p_entry, p_supplier, v_sub, auth.uid(), 'PENDING')
    on conflict (entry_id, supplier_id) do update
      set status = 'PENDING', suggested_by = excluded.suggested_by, role_key = excluded.role_key
      where public.event_circle_suggestions.status <> 'ACCEPTED';
    perform public._grant_referral_credit(p_entry, p_supplier, auth.uid());
    return jsonb_build_object('ok', true, 'pending', true);
  end if;

  begin
    insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
    values (p_entry, p_supplier, 'fornitore', true)
    on conflict (entry_id, user_id) do update set confirmed = true;
  exception when others then
    return jsonb_build_object('error', sqlerrm);
  end;
  perform public._grant_referral_credit(p_entry, p_supplier, auth.uid());
  return jsonb_build_object('ok', true, 'pending', false, 'subrole', v_sub);
end$$;
grant execute on function public.suggest_supplier_to_event(uuid, uuid) to authenticated;

-- respond_circle_suggestion: mantiene il consenso passaggio-dati; se RIFIUTATO, annulla il credito.
create or replace function public.respond_circle_suggestion(
  p_suggestion uuid, p_accept boolean, p_signed_name text default null, p_data_passage boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_sup uuid; v_by uuid;
begin
  select entry_id, supplier_id, suggested_by into v_entry, v_sup, v_by
    from public.event_circle_suggestions where id = p_suggestion and status = 'PENDING';
  if v_entry is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (public.is_wedding_couple(v_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
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
    perform public._grant_referral_credit(v_entry, v_sup, v_by);
  else
    update public.event_circle_suggestions set status = 'REJECTED' where id = p_suggestion;
    update public.supplier_credits set status = 'CANCELLED'
      where entry_id = v_entry and debtor_id = v_sup and creditor_id = v_by and status = 'PENDING';
  end if;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.respond_circle_suggestion(uuid, boolean, text, boolean) to authenticated;

-- BACKFILL: crea i crediti mancanti per i suggerimenti già esistenti (es. Stefano→evento di oggi).
do $$
declare r record;
begin
  for r in select entry_id, supplier_id, suggested_by from public.event_circle_suggestions
           where status in ('PENDING','ACCEPTED') loop
    perform public._grant_referral_credit(r.entry_id, r.supplier_id, r.suggested_by);
  end loop;
end $$;
