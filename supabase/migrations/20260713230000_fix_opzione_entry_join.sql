-- FIX: il legame è calendar_entries.quote_id → quotes.id (NON quotes.entry_id, che non esiste).
-- Le funzioni opzione trovavano l'evento con q.entry_id → errore a runtime. Corrette con la join giusta.

create or replace function public.richiedi_opzione_da_preventivo(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record; v_days int; v_exp timestamptz; v_optid uuid;
begin
  select q.id, ce.id as entry_id, q.owner_id, q.client_email, q.option_allowed, coalesce(q.option_days,15) as days, ce.date_from
    into v_q from public.quotes q join public.calendar_entries ce on ce.quote_id = q.id
    where q.access_token::text = p_token;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if not coalesce(v_q.option_allowed, false) then return jsonb_build_object('error','non_abilitato'); end if;
  if v_q.date_from is null then return jsonb_build_object('error','no_date'); end if;
  if exists (select 1 from public.quote_option_requests where quote_id = v_q.id and status='CONCESSA') then
    return jsonb_build_object('error','gia_opzionata');
  end if;

  v_days := greatest(1, v_q.days);
  v_exp  := now() + make_interval(days => v_days);
  begin
    insert into public.supplier_date_options(supplier_id, date_from, date_to, expires_at, reason, status)
      values (v_q.owner_id, v_q.date_from, v_q.date_from, v_exp, 'Opzione richiesta dal cliente', 'OPTIONED')
      returning id into v_optid;
  exception when exclusion_violation then
    return jsonb_build_object('error','date_already_optioned');
  end;
  insert into public.supplier_availability(fornitore_id, date, status, notes)
    values (v_q.owner_id, v_q.date_from, 'OPTIONED', 'Opzione richiesta dal cliente')
  on conflict (fornitore_id, date) do update
    set status = case when supplier_availability.status = 'AVAILABLE' then 'OPTIONED'::supplier_avail_status else supplier_availability.status end;

  update public.calendar_entries set status='OPZIONATA', option_expires_at=v_exp, option_requested_by=v_q.client_email where id=v_q.entry_id;
  insert into public.quote_option_requests(quote_id, entry_id, owner_id, client_email, status, granted_days, option_id)
    values (v_q.id, v_q.entry_id, v_q.owner_id, coalesce(v_q.client_email,''), 'CONCESSA', v_days, v_optid);
  return jsonb_build_object('ok', true, 'scade', v_exp);
end$$;
grant execute on function public.richiedi_opzione_da_preventivo(text) to anon, authenticated;

create or replace function public.blocca_data_preventivo(p_quote_id uuid, p_days int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q record; v_opt jsonb; v_exp timestamptz;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select q.id, ce.id as entry_id, q.owner_id, q.client_email, ce.date_from
    into v_q from public.quotes q join public.calendar_entries ce on ce.quote_id = q.id
    where q.id = p_quote_id;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if v_q.owner_id <> v_uid then return jsonb_build_object('error','forbidden'); end if;
  if v_q.date_from is null then return jsonb_build_object('error','no_date'); end if;

  v_exp := now() + make_interval(days => greatest(1, coalesce(p_days,15)));
  v_opt := public.opziona_data(v_q.date_from, v_q.date_from, greatest(1,coalesce(p_days,15)), 'Blocco data senza impegno (dal preventivo)', null, null);
  if v_opt ? 'error' then return v_opt; end if;

  update public.calendar_entries set status='OPZIONATA', option_expires_at=v_exp, option_requested_by=v_q.client_email where id=v_q.entry_id;
  insert into public.quote_option_requests(quote_id, entry_id, owner_id, client_email, status, granted_days, option_id)
    values (v_q.id, v_q.entry_id, v_q.owner_id, coalesce(v_q.client_email,''), 'CONCESSA', greatest(1,coalesce(p_days,15)), (v_opt->>'id')::uuid);
  return jsonb_build_object('ok', true, 'scade', v_exp);
end$$;
grant execute on function public.blocca_data_preventivo(uuid, int) to authenticated;

create or replace function public.sblocca_data_preventivo(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_q record;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select ce.id as entry_id, q.owner_id into v_q
    from public.quotes q join public.calendar_entries ce on ce.quote_id = q.id where q.id = p_quote_id;
  if v_q.entry_id is null then return jsonb_build_object('error','not_found'); end if;
  if v_q.owner_id <> v_uid then return jsonb_build_object('error','forbidden'); end if;

  update public.supplier_date_options o set status='RELEASED', updated_at=now()
    from public.quote_option_requests r
   where r.quote_id = p_quote_id and r.option_id = o.id and o.status='OPTIONED';
  update public.calendar_entries set status='IN_TRATTATIVA', option_expires_at=null, option_requested_by=null
   where id = v_q.entry_id and status='OPZIONATA';
  update public.quote_option_requests set status='RILASCIATA' where quote_id = p_quote_id and status='CONCESSA';
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.sblocca_data_preventivo(uuid) to authenticated;
