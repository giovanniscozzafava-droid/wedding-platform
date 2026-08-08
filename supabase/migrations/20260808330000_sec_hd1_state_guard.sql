-- SEC / HD-1: quote_toggle_option e quote_pick_alternative (scrittura via token cliente) NON avevano
-- guard di stato. Dopo BUG1 scrivono anche client_decision → muovono total_client_selected e, via il
-- nuovo trigger settlement, i network_settlements. Su un preventivo gia' CONVERTITO_IN_CONTRATTO o
-- CHIUSO (con link cliente ancora valido: quote_accept_by_token NON revoca il token) questo ri-prezza
-- un atto/contratto gia' firmato. Allineiamo il guard a client_decide_quote_item: bloccato se il
-- preventivo e' chiuso o convertito in contratto. La ri-decisione PRE-conclusione (stato ACCETTATO)
-- resta consentita, per design. (Conserva i guard token + l'allineamento delle due bandiere di BUG1.)

create or replace function public.quote_toggle_option(p_token uuid, p_item_id uuid, p_selected boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select qi.id into v_id
    from quote_items qi
    join quotes q on q.id = qi.quote_id
   where q.access_token = p_token
     and q.token_revoked_at is null
     and is_token_valid(q.access_token_expires_at)
     and q.closed_at is null
     and q.status <> 'CONVERTITO_IN_CONTRATTO'::quote_status
     and qi.id = p_item_id
     and qi.is_optional = true;
  if v_id is null then return false; end if;

  update quote_items
     set selected_by_client = p_selected,
         client_selected_at = case when p_selected then now() else null end,
         client_decision = case when p_selected then 'ACCETTATO' else 'IN_ATTESA' end,
         client_decided_at = now()
   where id = v_id;

  insert into quote_views (quote_id, event_type, payload)
  select q.id, 'OPTIONAL_TOGGLE', jsonb_build_object('item_id', p_item_id, 'selected', p_selected)
  from quotes q where q.access_token = p_token;
  return true;
end$$;

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
     and q.closed_at is null
     and q.status <> 'CONVERTITO_IN_CONTRATTO'::quote_status
     and qi.id = p_item_id
     and qi.alternative_group is not null;
  if v_qid is null then return false; end if;

  update public.quote_items
     set selected_by_client = false, client_decision = 'IN_ATTESA', client_decided_at = now()
   where quote_id = v_qid and alternative_group = v_group;
  update public.quote_items
     set selected_by_client = true, client_selected_at = now(),
         client_decision = 'ACCETTATO', client_decided_at = now()
   where id = p_item_id;

  insert into public.quote_views (quote_id, event_type, payload)
  values (v_qid, 'ALTERNATIVE_PICK', jsonb_build_object('item_id', p_item_id, 'group', v_group));
  return true;
end$$;

grant execute on function public.quote_toggle_option(uuid, uuid, boolean) to anon, authenticated;
grant execute on function public.quote_pick_alternative(uuid, uuid) to anon, authenticated;
