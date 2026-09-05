-- ============================================================================
-- PREV-03: couple_get_quote_detail esponeva SEMPRE la foto del servizio,
-- anche sulle voci in blind (supplier_id già null lì, ma la fix N8
-- (20260808150000_n8_blind_hide_photo.sql) aveva patchato solo le due RPC
-- gemelle client_portal_overview/couple_get_quote_for_entry, non questa
-- terza — una foto di servizio (spesso con watermark) può identificare il
-- fornitore su una voce che dovrebbe restare cieca.
-- ============================================================================

create or replace function public.couple_get_quote_detail(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_quote quotes%rowtype; v_items jsonb; v_owner record; v_key text; v_mode text;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  select * into v_quote from public.quotes where id = p_quote_id;
  if v_quote.id is null then return jsonb_build_object('error','quote_not_found'); end if;
  v_key := public.quote_event_key(p_quote_id);
  if not public.is_admin() and not exists (
    select 1 from public.wedding_couple_members m
    join public.calendar_entries ce on ce.id = m.entry_id
    where m.user_id = v_uid
      and (ce.quote_id = p_quote_id or (v_key is not null and public.quote_event_key(ce.quote_id) = v_key))
  ) then
    return jsonb_build_object('error','forbidden');
  end if;

  if v_quote.access_token is null then
    update public.quotes set access_token = gen_random_uuid() where id = v_quote.id returning access_token into v_quote.access_token;
  end if;

  select coalesce(capostipite_sale_mode, 'BUNDLE') into v_mode from public.profiles where id = v_quote.owner_id;

  select jsonb_agg(jsonb_build_object(
           'id', qi.id, 'name_snapshot', qi.name_snapshot, 'description_snapshot', qi.description_snapshot,
           'unit_snapshot', qi.unit_snapshot, 'quantity', qi.quantity, 'line_client', qi.line_client,
           'sort_order', qi.sort_order, 'client_decision', qi.client_decision,
           'client_decline_reason', qi.client_decline_reason, 'contracted_at', qi.contracted_at,
           'created_at', qi.created_at, 'supplier_id', null,
           'category', sc.name,
           'photo', case when public.quote_item_is_blind(qi, v_mode) then null else
             (select ph.thumbnail_url from public.service_photos ph where ph.service_id = qi.service_id order by ph.sort_order limit 1)
           end
         ) order by qi.sort_order, qi.created_at)
    into v_items
    from public.quote_items qi
    left join public.services svc on svc.id = qi.service_id
    left join public.service_categories sc on sc.id = svc.category_id
    where qi.quote_id = v_quote.id;

  select full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color, role, subrole, city
    into v_owner from public.profiles where id = v_quote.owner_id;

  return jsonb_build_object(
    'id', v_quote.id, 'access_token', v_quote.access_token, 'title', v_quote.title,
    'client_name', v_quote.client_name, 'client_email', v_quote.client_email,
    'event_date', v_quote.event_date, 'event_kind', v_quote.event_kind, 'event_location', v_quote.event_location,
    'guest_count', v_quote.guest_count, 'status', v_quote.status, 'revision', v_quote.revision,
    'total_client', v_quote.total_client, 'total_client_selected', v_quote.total_client_selected,
    'pdf_url', v_quote.pdf_url, 'accepted_at', v_quote.accepted_at,
    'closed_at', v_quote.closed_at, 'business_model', 'GLOBAL',
    'owner', to_jsonb(v_owner), 'items', coalesce(v_items, '[]'::jsonb)
  );
end$$;
revoke all on function public.couple_get_quote_detail(uuid) from anon, public;
grant execute on function public.couple_get_quote_detail(uuid) to authenticated;
