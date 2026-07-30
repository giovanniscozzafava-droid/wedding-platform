-- Opzione data: quando il CLIENTE blocca la data dal preventivo (regola dei N giorni), il
-- PROFESSIONISTA deve essere NOTIFICATO (campanella) — la data risulta gia' in giallo sul calendario
-- (status OPZIONATA impostato dalla stessa funzione). Aggiungiamo la notifica in-app, best-effort.
-- Ridefinizione di richiedi_opzione_da_preventivo (ultima versione: opzione multi-priorita) + notifica.

create or replace function public.richiedi_opzione_da_preventivo(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record; v_days int; v_exp timestamptz; v_pos int;
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

  -- opzione SOFT sull'evento della coppia (multi-cliente: nessun lock esclusivo sulla data del pro)
  update public.calendar_entries set status='OPZIONATA', option_expires_at=v_exp, option_requested_by=v_q.client_email
   where id=v_q.entry_id and status in ('IN_TRATTATIVA','OPZIONATA');
  insert into public.quote_option_requests(quote_id, entry_id, owner_id, client_email, status, granted_days)
    values (v_q.id, v_q.entry_id, v_q.owner_id, coalesce(v_q.client_email,''), 'CONCESSA', v_days);

  -- posizione in coda = opzioni attive sulla stessa data+professionista (1 = solo tu)
  select count(*) into v_pos from public.quote_option_requests r
    join public.calendar_entries ce on ce.id = r.entry_id
   where r.owner_id = v_q.owner_id and ce.date_from = v_q.date_from and r.status='CONCESSA';

  -- NOTIFICA al professionista: un cliente ha bloccato la sua data (la vede in giallo sul calendario).
  begin
    perform public.push_user_notification(
      v_q.owner_id, 'date_option', 'Un cliente ha bloccato la tua data',
      'La data del ' || to_char(v_q.date_from, 'DD/MM/YYYY') || ' è stata opzionata da un cliente per '
        || v_days || ' giorni (scade il ' || to_char(v_exp, 'DD/MM/YYYY') || '). La trovi in giallo sul calendario.',
      '/calendario', v_q.id);
  exception when others then null; end;

  return jsonb_build_object('ok', true, 'scade', v_exp, 'posizione', v_pos, 'contesa', v_pos > 1);
end$$;
grant execute on function public.richiedi_opzione_da_preventivo(text) to anon, authenticated;
