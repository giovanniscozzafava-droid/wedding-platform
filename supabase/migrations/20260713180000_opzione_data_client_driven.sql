-- OPZIONE DATA — flusso corretto: il CLIENTE chiede di tenere la data (senza firmare) → parte il
-- countdown; il PROFESSIONISTA deve ABILITARE questa possibilità sul singolo preventivo.
--   quotes.option_allowed = il pro consente al cliente di opzionare la data
--   quotes.option_days    = durata del blocco (default 15)
-- richiedi_opzione_da_preventivo(token): se abilitato, CONCEDE subito l'opzione per conto del pro
--   (opziona_data usa auth.uid() = il pro, ma qui chiama il cliente via token → replichiamo gli insert
--    per v_owner, mantenendo il vincolo anti-overlap sull'exclusion constraint).
alter table public.quotes
  add column if not exists option_allowed boolean not null default false,
  add column if not exists option_days    int not null default 15;

create or replace function public.richiedi_opzione_da_preventivo(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record; v_days int; v_exp timestamptz; v_optid uuid; d date;
begin
  select q.id, q.entry_id, q.owner_id, q.client_email, q.option_allowed, coalesce(q.option_days,15) as days, ce.date_from
    into v_q from public.quotes q join public.calendar_entries ce on ce.id = q.entry_id
    where q.access_token::text = p_token;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if not coalesce(v_q.option_allowed, false) then return jsonb_build_object('error','non_abilitato'); end if;
  if v_q.date_from is null then return jsonb_build_object('error','no_date'); end if;
  if exists (select 1 from public.quote_option_requests where quote_id = v_q.id and status='CONCESSA') then
    return jsonb_build_object('error','gia_opzionata');
  end if;

  v_days := greatest(1, v_q.days);
  v_exp  := now() + make_interval(days => v_days);

  -- opzione PER CONTO DEL PROPRIETARIO (equivalente a opziona_data ma senza auth.uid()=pro).
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
