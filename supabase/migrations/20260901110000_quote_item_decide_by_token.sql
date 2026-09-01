-- REGOLA (Giovanni, 01/09/2026): il preventivo si compone sulla base delle SINGOLE VOCI
-- accettate dal cliente; senza selezione il preventivo NON va avanti.
--
-- Problema: le uniche superfici che permettevano di scegliere voce per voce
-- (CoupleDashboard, ClientProfessionalsView) richiedono un ACCOUNT, e
-- client_decide_quote_item pretende auth.uid(). Il cliente che arriva dal link via
-- email (/p/preview/:token) non ha account → non poteva scegliere nulla → firmava
-- l'intero preventivo → tutte le voci restavano IN_ATTESA e total_client_selected=0.
--
-- Qui la variante A TOKEN, con la stessa autorizzazione dei token preventivo.
-- Accetta un ARRAY di voci: una sola (spunta singola) o tutte ("Opziona tutte le voci").

create or replace function public.quote_items_decide_by_token(
  p_token uuid,
  p_item_ids uuid[],
  p_decision text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_q record;
  v_touched int;
  v_accepted numeric; v_pending numeric;
begin
  if p_decision not in ('ACCETTATO','RIFIUTATO','IN_ATTESA','FORSE') then
    return jsonb_build_object('error','bad_decision');
  end if;
  if p_item_ids is null or array_length(p_item_ids, 1) is null then
    return jsonb_build_object('error','no_items');
  end if;

  select q.id, q.status, q.closed_at
    into v_q
    from quotes q
   where q.access_token = p_token
     and q.token_revoked_at is null
     and (q.access_token_expires_at is null or q.access_token_expires_at > now());
  if v_q.id is null then return jsonb_build_object('error','invalid_token'); end if;
  if v_q.closed_at is not null then return jsonb_build_object('error','closed'); end if;

  -- ::text obbligatorio: status è un enum quote_status, il confronto con stringhe
  -- grezze via coalesce su enum vuoto è la regressione che il 25/08 bloccò le firme.
  if v_q.status::text not in ('INVIATO','BOZZA') then
    return jsonb_build_object('error','not_editable', 'status', v_q.status::text);
  end if;

  -- Solo voci di QUESTO preventivo e non già portate in contratto.
  update quote_items qi
     set client_decision = p_decision,
         client_decided_at = now(),
         client_decline_reason = null,
         selected_by_client = case when coalesce(qi.is_optional,false)
                                   then (p_decision = 'ACCETTATO')
                                   else qi.selected_by_client end,
         client_selected_at = case when p_decision = 'ACCETTATO'
                                   then coalesce(qi.client_selected_at, now())
                                   else qi.client_selected_at end
   where qi.quote_id = v_q.id
     and qi.id = any(p_item_ids)
     and qi.contracted_at is null;
  get diagnostics v_touched = row_count;
  if v_touched = 0 then return jsonb_build_object('error','not_found'); end if;

  perform public.quotes_recalc_totals(v_q.id);

  select coalesce(sum(line_client) filter (where client_decision = 'ACCETTATO'), 0),
         coalesce(sum(line_client) filter (where client_decision <> 'ACCETTATO'), 0)
    into v_accepted, v_pending
    from quote_items where quote_id = v_q.id;

  perform public.log_access('quotes', v_q.id::text, 'TOKEN_USE',
                            jsonb_build_object('op','decide_items','n',v_touched,'decision',p_decision));

  return jsonb_build_object('ok', true, 'touched', v_touched,
                            'accepted_total', v_accepted, 'pending_total', v_pending,
                            'total_client_selected',
                            (select total_client_selected from quotes where id = v_q.id));
end$$;

revoke all on function public.quote_items_decide_by_token(uuid, uuid[], text) from public;
grant execute on function public.quote_items_decide_by_token(uuid, uuid[], text) to anon, authenticated;

comment on function public.quote_items_decide_by_token(uuid, uuid[], text) is
  'Decisione per-voce dal link pubblico del preventivo (token). Array: una voce o tutte.';
