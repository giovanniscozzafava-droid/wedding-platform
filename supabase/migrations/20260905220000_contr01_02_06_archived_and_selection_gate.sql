-- ============================================================================
-- CONTR-01/06: quote_accept_by_token è una RPC pubblica (anon-callable) rimasta
-- viva da prima della regola "R1/A2" (il preventivo si compone dalle voci
-- accettate): porta lo status ad ACCETTATO senza controllare client_decision
-- né richiedere almeno una voce scelta — a differenza di quote-accept-sign,
-- che quel gate ce l'ha. Nessun chiamante nel frontend attuale (verificato:
-- publicQuoteAccept in useQuotes.ts non è importata da nessuna pagina), ma
-- resta un endpoint vivo invocabile direttamente con un token valido: chi lo
-- chiamasse riprodurrebbe esattamente lo scenario "contratto sul totale
-- pieno" che R1 doveva chiudere. Fix: stesso gate di quote-accept-sign
-- (almeno una voce ACCETTATA se il preventivo ne ha), più il check archived_at
-- (CONTR-02).
--
-- CONTR-02: archived_at (preventivo accantonato) non era onorato in
-- quote_accept_by_token, quote_items_decide_by_token, né quote_get_by_token —
-- un preventivo accantonato dal professionista restava apribile/decidibile/
-- firmabile via token finché non scadeva o veniva revocato esplicitamente.
-- ============================================================================

create or replace function quote_accept_by_token(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_has_items boolean; v_n_picked int;
begin
  select id into v_id from quotes
   where access_token = p_token
     and status in ('INVIATO','ACCETTATO')
     and token_revoked_at is null
     and archived_at is null
     and (access_token_expires_at is null or access_token_expires_at > now());
  if v_id is null then return false; end if;

  select count(*) > 0, count(*) filter (where client_decision = 'ACCETTATO')
    into v_has_items, v_n_picked
    from quote_items where quote_id = v_id;
  if v_has_items and v_n_picked = 0 then
    return false;
  end if;

  update quotes
     set status = 'ACCETTATO',
         accepted_at = coalesce(accepted_at, now()),
         token_consumed_at = coalesce(token_consumed_at, now()),
         client_response_log = client_response_log || jsonb_build_object('event','accepted','at',now())
   where id = v_id;

  update calendar_entries set status = 'OPZIONATA', updated_at = now()
   where quote_id = v_id and status in ('IN_TRATTATIVA','OPZIONATA');
  perform public.log_access('quotes', v_id::text, 'TOKEN_USE', jsonb_build_object('op','accept'));
  return true;
end$$;
revoke all on function quote_accept_by_token(uuid) from public;
grant execute on function quote_accept_by_token(uuid) to anon, authenticated;

-- --- quote_items_decide_by_token: onora archived_at ---
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

  select q.id, q.status, q.closed_at, q.archived_at
    into v_q
    from quotes q
   where q.access_token = p_token
     and q.token_revoked_at is null
     and (q.access_token_expires_at is null or q.access_token_expires_at > now());
  if v_q.id is null then return jsonb_build_object('error','invalid_token'); end if;
  if v_q.closed_at is not null then return jsonb_build_object('error','closed'); end if;
  if v_q.archived_at is not null then return jsonb_build_object('error','archived'); end if;

  if v_q.status::text not in ('INVIATO','BOZZA') then
    return jsonb_build_object('error','not_editable', 'status', v_q.status::text);
  end if;

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

-- --- quote_get_by_token: onora archived_at (stesso trattamento di revocato/scaduto: null) ---
create or replace function public.quote_get_by_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_quote   quotes%rowtype;
  v_items   jsonb;
  v_owner   record;
  v_mode    text;
begin
  select * into v_quote from quotes
   where access_token = p_token
     and token_revoked_at is null
     and archived_at is null
     and is_token_valid(access_token_expires_at);
  if v_quote.id is null then
    return null;
  end if;

  select coalesce(capostipite_sale_mode, 'BUNDLE') into v_mode from profiles where id = v_quote.owner_id;

  select jsonb_agg(jsonb_build_object(
           'id',                  qi.id,
           'name_snapshot',       qi.name_snapshot,
           'description_snapshot', qi.description_snapshot,
           'unit_snapshot',       qi.unit_snapshot,
           'quantity',            qi.quantity,
           'line_client',         qi.line_client,
           'sort_order',          qi.sort_order,
           'is_optional',         qi.is_optional,
           'alternative_group',   qi.alternative_group,
           'selected_by_client',  qi.selected_by_client,
           'client_decision',     qi.client_decision,
           'category', case
             when public.quote_item_is_blind(qi, v_mode) then coalesce(
               (select sc.name from services s join service_categories sc on sc.id = s.category_id where s.id = qi.service_id),
               'Altri servizi')
             else coalesce(
               (select sc.name from services s join service_categories sc on sc.id = s.category_id where s.id = qi.service_id),
               initcap(nullif((select sp2.subrole from profiles sp2 where sp2.id = qi.supplier_id), '')),
               'Altri servizi')
           end,
           'supplier', case
             when public.quote_item_is_blind(qi, v_mode) or qi.supplier_id is null then null
             else (select jsonb_build_object('name', coalesce(sp.business_name, sp.full_name),
                                             'slug', sp.slug, 'subrole', sp.subrole, 'city', sp.city)
                     from profiles sp where sp.id = qi.supplier_id)
           end
         ) order by qi.sort_order)
    into v_items
    from quote_items qi
   where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url,
         brand_primary_color, brand_secondary_color,
         role, subrole, city
    into v_owner
    from profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id',                v_quote.id,
    'title',             v_quote.title,
    'client_name',       v_quote.client_name,
    'client_email',      v_quote.client_email,
    'event_date',        v_quote.event_date,
    'event_kind',        v_quote.event_kind,
    'event_location',    v_quote.event_location,
    'guest_count',       v_quote.guest_count,
    'status',            v_quote.status,
    'revision',          v_quote.revision,
    'total_client',      v_quote.total_client,
    'total_client_selected', v_quote.total_client_selected,
    'pdf_url',           v_quote.pdf_url,
    'pdf_variant',       v_quote.pdf_variant,
    'direct_client_id',  v_quote.direct_client_id,
    'owner',             to_jsonb(v_owner),
    'items',             coalesce(v_items, '[]'::jsonb)
  );
end
$$;

grant execute on function public.quote_get_by_token(uuid) to anon, authenticated, service_role;
