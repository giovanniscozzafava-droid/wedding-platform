-- ============================================================================
-- N4 (decisione: "richiede approvazione capostipite"): lo sconto proposto da un
-- fornitore non si applica più da solo. Prima abbassava subito line_client (e
-- quindi total_client) e andava al cliente: un fornitore poteva muovere il totale
-- del capostipite senza consenso, erodendone il margine (anche negativo).
-- Ora è una PROPOSTA in attesa: viene registrata, notificata al capostipite, e
-- solo quando il capostipite APPROVA diventa item_discount_percent (ricalcolo +
-- ritorno al cliente). Se rifiuta, la proposta sparisce senza toccare nulla.
-- ============================================================================

alter table public.quote_items
  add column if not exists supplier_proposed_discount_percent numeric
    check (supplier_proposed_discount_percent is null
           or (supplier_proposed_discount_percent >= 0 and supplier_proposed_discount_percent <= 90));

comment on column public.quote_items.supplier_proposed_discount_percent is
  'Sconto proposto dal fornitore, IN ATTESA di approvazione del capostipite. Applicato a item_discount_percent solo su approvazione.';

-- Il fornitore PROPONE (non applica). Notifica solo il capostipite.
create or replace function public.supplier_propose_discount(
  p_item_id uuid, p_discount_percent numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_sup uuid; v_quote uuid; v_name text; v_owner uuid;
begin
  select supplier_id, quote_id, name_snapshot into v_sup, v_quote, v_name
    from public.quote_items where id = p_item_id;
  if v_sup is null then return jsonb_build_object('error','not_found'); end if;
  if v_sup is distinct from auth.uid() then return jsonb_build_object('error','forbidden'); end if;
  if p_discount_percent is null or p_discount_percent < 0 or p_discount_percent > 90 then
    return jsonb_build_object('error','bad_discount');
  end if;

  -- N4: registra la PROPOSTA, non tocca line_client/total_client né il cliente.
  update public.quote_items
     set supplier_proposed_discount_percent = p_discount_percent,
         supplier_counter_note = nullif(trim(coalesce(p_note,'')), ''),
         supplier_counter_at = now()
   where id = p_item_id;

  select owner_id into v_owner from public.quotes where id = v_quote;
  perform public.push_user_notification(v_owner, 'SUPPLIER_COUNTER',
    'Un fornitore propone uno sconto',
    'Sconto proposto ' || p_discount_percent || '% su "' || v_name || '"'
      || coalesce(' · ' || p_note, '') || ' · da approvare',
    '/quotes/' || v_quote::text, v_quote);

  return jsonb_build_object('ok', true, 'pending', true);
end$$;
revoke all on function public.supplier_propose_discount(uuid, numeric, text) from public;
grant execute on function public.supplier_propose_discount(uuid, numeric, text) to authenticated;

-- Il capostipite APPROVA o RIFIUTA la proposta di sconto del fornitore.
create or replace function public.capostipite_resolve_supplier_discount(
  p_item_id uuid, p_approve boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_quote uuid; v_prop numeric; v_name text; v_sup uuid; v_new numeric;
begin
  select qi.quote_id, qi.supplier_proposed_discount_percent, qi.name_snapshot, qi.supplier_id
    into v_quote, v_prop, v_name, v_sup
    from public.quote_items qi where qi.id = p_item_id;
  if v_quote is null then return jsonb_build_object('error','not_found'); end if;
  select owner_id into v_owner from public.quotes where id = v_quote;
  if v_owner is distinct from auth.uid() and not public.is_admin() then
    return jsonb_build_object('error','forbidden');
  end if;
  if v_prop is null then return jsonb_build_object('error','no_pending'); end if;

  if p_approve then
    update public.quote_items
       set item_discount_percent = v_prop,               -- il trigger ricalcola line_client
           supplier_proposed_discount_percent = null,
           client_decision = 'IN_ATTESA',
           client_decline_reason = null
     where id = p_item_id
     returning line_client into v_new;
    perform public.notify_quote_client(v_quote, 'QUOTE_NEW_ITEM',
      'Offerta aggiornata con sconto',
      '"' || v_name || '" è stata riproposta con uno sconto. Aprila per decidere.');
    perform public.push_user_notification(v_sup, 'SUPPLIER_COUNTER',
      'Sconto approvato',
      'Il capostipite ha approvato il tuo sconto su "' || v_name || '".',
      '/voci-da-rivedere', v_quote);
    return jsonb_build_object('ok', true, 'approved', true, 'new_line_client', v_new);
  else
    update public.quote_items
       set supplier_proposed_discount_percent = null
     where id = p_item_id;
    perform public.push_user_notification(v_sup, 'SUPPLIER_COUNTER',
      'Sconto non applicato',
      'Il capostipite non ha applicato lo sconto che avevi proposto su "' || v_name || '".',
      '/voci-da-rivedere', v_quote);
    return jsonb_build_object('ok', true, 'approved', false);
  end if;
end$$;
revoke all on function public.capostipite_resolve_supplier_discount(uuid, boolean) from public;
grant execute on function public.capostipite_resolve_supplier_discount(uuid, boolean) to authenticated;
