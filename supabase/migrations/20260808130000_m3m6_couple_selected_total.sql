-- ============================================================================
-- M3/M6: la coppia deve vedere il totale VINCOLANTE (total_client_selected, il
-- valore che finisce in contratto/atto/acconto dopo R1), non un totale grezzo o
-- l'offerta piena. Le due RPC coppia non lo esponevano. Le arricchiamo con
-- total_client_selected; il frontend userà quello (fallback total_client per la
-- firma intera). Nessun'altra modifica alla logica.
-- ============================================================================

-- couple_received_quotes: cambia la signature (nuova colonna) => drop + create.
drop function if exists public.couple_received_quotes(uuid);
create or replace function public.couple_received_quotes(p_entry uuid)
returns table (quote_id uuid, professionista text, subrole text, role text, status text,
               total_client numeric, total_client_selected numeric, is_main boolean, quote_origin text)
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_main uuid; v_key text;
begin
  if v_uid is null then return; end if;
  if not public.is_admin() and not exists (select 1 from public.wedding_couple_members m where m.entry_id = p_entry and m.user_id = v_uid) then
    return;
  end if;
  select ce.quote_id into v_main from public.calendar_entries ce where ce.id = p_entry;
  v_key := public.quote_event_key(v_main);
  return query
    select q.id, coalesce(pr.business_name, pr.full_name) as professionista, pr.subrole, pr.role::text,
           q.status::text, q.total_client, q.total_client_selected, (q.id = v_main) as is_main, q.quote_origin
    from public.quotes q
    join public.profiles pr on pr.id = q.owner_id
    where (q.id = v_main)
       or (v_key is not null
           and public.quote_event_key(q.id) = v_key
           and q.quote_origin = 'SUPPLIER_SUGGESTION'
           and q.status in ('INVIATO', 'ACCETTATO', 'CONVERTITO_IN_CONTRATTO'))
    order by (q.id = v_main) desc, pr.subrole nulls last, professionista;
end$$;
revoke all on function public.couple_received_quotes(uuid) from anon, public;
grant execute on function public.couple_received_quotes(uuid) to authenticated;

-- couple_get_quote_detail: aggiunge total_client_selected al payload jsonb.
create or replace function public.couple_get_quote_detail(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_quote quotes%rowtype; v_items jsonb; v_owner record; v_key text;
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

  select jsonb_agg(jsonb_build_object(
           'id', qi.id, 'name_snapshot', qi.name_snapshot, 'description_snapshot', qi.description_snapshot,
           'unit_snapshot', qi.unit_snapshot, 'quantity', qi.quantity, 'line_client', qi.line_client,
           'sort_order', qi.sort_order, 'client_decision', qi.client_decision,
           'client_decline_reason', qi.client_decline_reason, 'contracted_at', qi.contracted_at,
           'created_at', qi.created_at, 'supplier_id', null,
           'category', sc.name,
           'photo', (select ph.thumbnail_url from public.service_photos ph where ph.service_id = qi.service_id order by ph.sort_order limit 1)
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
