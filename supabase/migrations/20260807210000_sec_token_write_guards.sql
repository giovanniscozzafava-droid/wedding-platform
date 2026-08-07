-- SEC — Guardie di revoca/scadenza token sulle RPC di SCRITTURA via token del cliente che erano
-- state saltate dall'hardening 20260806140000 (che protesse solo quote_toggle_option / questionnaire).
-- Classe: link REVOCATO/scaduto che muove ancora total_client o blocca il calendario del pro.

-- QA-1: quote_pick_alternative muove selected_by_client (→ total_client se le alternative sono opzionali).
-- Aggiungiamo il guard revoca+scadenza al lookup per token (stessa forma di quote_toggle_option).
create or replace function public.quote_pick_alternative(p_token uuid, p_item_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_qid uuid; v_group text;
begin
  select qi.quote_id, qi.alternative_group into v_qid, v_group
    from public.quote_items qi
    join public.quotes q on q.id = qi.quote_id
   where q.access_token = p_token
     and q.token_revoked_at is null
     and public.is_token_valid(q.access_token_expires_at)
     and qi.id = p_item_id
     and qi.alternative_group is not null;
  if v_qid is null then return false; end if;

  update public.quote_items set selected_by_client = false
   where quote_id = v_qid and alternative_group = v_group;
  update public.quote_items set selected_by_client = true, client_selected_at = now()
   where id = p_item_id;

  insert into public.quote_views (quote_id, event_type, payload)
  values (v_qid, 'ALTERNATIVE_PICK', jsonb_build_object('item_id', p_item_id, 'group', v_group));
  return true;
end$$;

-- GP-2: proroga_opzione — un ex-cliente con link REVOCATO/scaduto teneva bloccata la data del pro
-- (DoS calendario); inoltre p_days era senza tetto. Aggiungiamo guard token + tetto = option_days.
create or replace function public.proroga_opzione(p_token text, p_days int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_q record; v_days int; v_exp timestamptz; v_cap int; v_conf int;
begin
  select q.id, ce.id as entry_id, q.owner_id, q.client_email, q.option_allowed,
         coalesce(q.option_days,15) as days, ce.date_from
    into v_q from public.quotes q join public.calendar_entries ce on ce.quote_id = q.id
    where q.access_token::text = p_token
      and q.token_revoked_at is null
      and public.is_token_valid(q.access_token_expires_at);
  if v_q.id is null then return jsonb_build_object('error','not_found'); end if;
  if not coalesce(v_q.option_allowed,false) then return jsonb_build_object('error','non_abilitato'); end if;
  if v_q.date_from is null then return jsonb_build_object('error','no_date'); end if;

  select coalesce(daily_capacity, 1) into v_cap from public.profiles where id = v_q.owner_id;
  select count(*) into v_conf from public.calendar_entries where owner_id = v_q.owner_id and date_from = v_q.date_from and status = 'CONFERMATA';
  if v_conf >= v_cap then return jsonb_build_object('error','data_non_disponibile'); end if;

  -- tetto: una proroga non puo' estendere oltre la finestra configurata dal pro (option_days).
  v_days := greatest(1, least(coalesce(p_days, v_q.days), v_q.days));
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
