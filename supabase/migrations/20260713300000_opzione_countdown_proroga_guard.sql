-- OPZIONE DATA — countdown + proroga (rinnovo) + guardia anti doppia-prenotazione.
--   * quote_option_status: aggiunge expires_at (countdown lato cliente).
--   * proroga_opzione(token, giorni): il cliente rinnova l'opzione SE la data è ancora disponibile.
--   * tg_no_double_booking: non si possono confermare due eventi oltre la capacità (daily_capacity, def 1)
--     sulla stessa data+pro → "il cliente può firmare SE la data è rimasta disponibile".

create or replace function public.quote_option_status(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'option_allowed', coalesce(q.option_allowed, false),
    'option_days',    coalesce(q.option_days, 15),
    'optioned',       exists (select 1 from public.quote_option_requests r where r.quote_id = q.id and r.status = 'CONCESSA'),
    'expires_at',     (select ce.option_expires_at from public.calendar_entries ce where ce.quote_id = q.id and ce.status = 'OPZIONATA' limit 1)
  ) from public.quotes q where q.access_token::text = p_token;
$$;
grant execute on function public.quote_option_status(text) to anon, authenticated;

-- Rinnovo dell'opzione (cliente via token): solo se la data non è già stata presa (capacità).
create or replace function public.proroga_opzione(p_token text, p_days int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record; v_days int; v_exp timestamptz; v_cap int; v_conf int;
begin
  select q.id, ce.id as entry_id, q.owner_id, q.client_email, q.option_allowed, coalesce(q.option_days,15) as days, ce.date_from
    into v_q from public.quotes q join public.calendar_entries ce on ce.quote_id = q.id
    where q.access_token::text = p_token;
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if not coalesce(v_q.option_allowed,false) then return jsonb_build_object('error','non_abilitato'); end if;
  if v_q.date_from is null then return jsonb_build_object('error','no_date'); end if;

  select coalesce(daily_capacity, 1) into v_cap from public.profiles where id = v_q.owner_id;
  select count(*) into v_conf from public.calendar_entries where owner_id = v_q.owner_id and date_from = v_q.date_from and status = 'CONFERMATA';
  if v_conf >= v_cap then return jsonb_build_object('error','data_non_disponibile'); end if;

  v_days := greatest(1, coalesce(p_days, v_q.days));
  v_exp  := now() + make_interval(days => v_days);
  update public.calendar_entries set status='OPZIONATA', option_expires_at=v_exp, option_requested_by=v_q.client_email where id=v_q.entry_id;
  if exists (select 1 from public.quote_option_requests where quote_id=v_q.id) then
    update public.quote_option_requests set status='CONCESSA', granted_days=v_days where quote_id=v_q.id;
  else
    insert into public.quote_option_requests(quote_id, entry_id, owner_id, client_email, status, granted_days)
      values (v_q.id, v_q.entry_id, v_q.owner_id, coalesce(v_q.client_email,''), 'CONCESSA', v_days);
  end if;
  return jsonb_build_object('ok', true, 'scade', v_exp);
end$$;
grant execute on function public.proroga_opzione(text, int) to anon, authenticated;

-- Guardia: niente doppia prenotazione oltre la capacità del pro sulla stessa data.
create or replace function public.tg_no_double_booking()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cap int; v_conf int;
begin
  if new.status = 'CONFERMATA' and (old.status is distinct from 'CONFERMATA') and new.date_from is not null then
    select coalesce(daily_capacity, 1) into v_cap from public.profiles where id = new.owner_id;
    select count(*) into v_conf from public.calendar_entries where owner_id = new.owner_id and date_from = new.date_from and status = 'CONFERMATA' and id <> new.id;
    if v_conf >= v_cap then
      raise exception 'data_non_disponibile' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end$$;
drop trigger if exists trg_no_double_booking on public.calendar_entries;
create trigger trg_no_double_booking
  before update of status on public.calendar_entries
  for each row execute function public.tg_no_double_booking();
