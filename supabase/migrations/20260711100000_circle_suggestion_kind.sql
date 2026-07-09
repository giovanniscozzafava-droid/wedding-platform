-- Inserire un fornitore nel cerchio dell'evento NON è sempre una segnalazione: può essere una
-- semplice condivisione di materiale (gratis). Aggiungo `kind` alla suggestion e rendo il credito
-- €39 opzionale: matura SOLO se kind='REFERRAL' e dalla data di attivazione (gennaio 2027).
-- (La condivisione dà comunque accesso pieno al cerchio, come gli altri membri.)

alter table public.event_circle_suggestions
  add column if not exists kind text not null default 'REFERRAL' check (kind in ('REFERRAL','SHARE'));

-- rimuovo l'overload a 2 argomenti (creava sempre il credito): d'ora in poi si passa il kind.
drop function if exists public.suggest_supplier_to_event(uuid, uuid);

create or replace function public.suggest_supplier_to_event(p_entry uuid, p_supplier uuid, p_kind text default 'SHARE')
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sub text; v_future boolean;
        v_kind text := case when upper(coalesce(p_kind,'')) = 'REFERRAL' then 'REFERRAL' else 'SHARE' end;
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
    insert into public.event_circle_suggestions(entry_id, supplier_id, role_key, suggested_by, status, kind)
    values (p_entry, p_supplier, v_sub, auth.uid(), 'PENDING', v_kind)
    on conflict (entry_id, supplier_id) do update
      set status = 'PENDING', suggested_by = excluded.suggested_by, role_key = excluded.role_key, kind = excluded.kind
      where public.event_circle_suggestions.status <> 'ACCEPTED';
    if v_kind = 'REFERRAL' and current_date >= date '2027-01-01' then
      perform public._grant_referral_credit(p_entry, p_supplier, auth.uid());
    end if;
    return jsonb_build_object('ok', true, 'pending', true, 'kind', v_kind);
  end if;

  begin
    insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
    values (p_entry, p_supplier, 'fornitore', true)
    on conflict (entry_id, user_id) do update set confirmed = true;
  exception when others then
    return jsonb_build_object('error', sqlerrm);
  end;
  if v_kind = 'REFERRAL' and current_date >= date '2027-01-01' then
    perform public._grant_referral_credit(p_entry, p_supplier, auth.uid());
  end if;
  return jsonb_build_object('ok', true, 'pending', false, 'subrole', v_sub, 'kind', v_kind);
end$$;
grant execute on function public.suggest_supplier_to_event(uuid, uuid, text) to authenticated;

-- accettazione: il credito matura solo se la suggestion è una SEGNALAZIONE (e da gennaio 2027).
create or replace function public.respond_circle_suggestion(
  p_suggestion uuid, p_accept boolean, p_signed_name text default null, p_data_passage boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_sup uuid; v_by uuid; v_kind text;
begin
  select entry_id, supplier_id, suggested_by, kind into v_entry, v_sup, v_by, v_kind
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
