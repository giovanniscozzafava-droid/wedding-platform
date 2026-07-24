-- "Accantona": i preventivi con archived_at valorizzato NON devono più comparire al cliente
-- (test/obsoleti). Filtriamo l'archiviato nelle due proiezioni cliente. Nessun altro cambiamento.

-- 1) Area cliente (/area-cliente): esclude i preventivi archiviati dalla lista per professionista.
create or replace function public.client_portal_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email', ''));
  v_result jsonb;
begin
  if v_email = '' then
    return jsonb_build_object('error', 'no_email');
  end if;

  select coalesce(jsonb_agg(grp order by grp->>'business_name'), '[]'::jsonb)
    into v_result
  from (
    select jsonb_build_object(
      'owner_id', pr.id,
      'business_name', coalesce(pr.business_name, pr.full_name),
      'role', pr.role,
      'subrole', pr.subrole,
      'brand_logo_url', pr.brand_logo_url,
      'brand_primary_color', pr.brand_primary_color,
      'city', pr.city,
      'quotes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', q.id,
          'title', q.title,
          'status', q.status,
          'event_kind', q.event_kind,
          'event_date', q.event_date,
          'event_location', q.event_location,
          'total_client', q.total_client,
          'access_token', q.access_token,
          'revision', q.revision,
          'pdf_url', q.pdf_url,
          'closed_at', q.closed_at,
          'items', (
            select coalesce(jsonb_agg(jsonb_build_object(
              'id', qi.id,
              'name', qi.name_snapshot,
              'qty', qi.quantity,
              'unit', qi.unit_snapshot,
              'line_client', qi.line_client,
              'supplier', coalesce(sp.business_name, sp.full_name),
              'client_decision', qi.client_decision,
              'decline_reason', qi.client_decline_reason,
              'category', sc.name,
              'photo', (select ph.thumbnail_url from public.service_photos ph
                        where ph.service_id = qi.service_id order by ph.sort_order limit 1)
            ) order by sc.name nulls last, qi.sort_order, qi.created_at), '[]'::jsonb)
            from public.quote_items qi
            left join public.profiles sp on sp.id = qi.supplier_id
            left join public.services svc on svc.id = qi.service_id
            left join public.service_categories sc on sc.id = svc.category_id
            where qi.quote_id = q.id
          ),
          'brief', (
            select jsonb_build_object(
              'delivery_label', b.delivery_label,
              'delivery_date', b.delivery_date,
              'headline', b.headline,
              'items', b.items,
              'note', b.note
            )
            from public.supplier_client_briefs b
            where b.quote_id = q.id and b.shared_at is not null
          )
        ) order by q.event_date nulls last, q.created_at desc), '[]'::jsonb)
        from public.quotes q
        where q.owner_id = pr.id and lower(q.client_email) = v_email and q.archived_at is null
      ),
      'contracts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', c.id,
          'title', c.title,
          'status', c.status,
          'access_token', c.access_token,
          'signed_at', c.signed_at,
          'pdf_url', c.pdf_url
        ) order by c.created_at desc), '[]'::jsonb)
        from public.contracts c
        where c.owner_id = pr.id and lower(c.client_email) = v_email
      )
    ) as grp
    from public.profiles pr
    where pr.id in (
      select owner_id from public.quotes where lower(client_email) = v_email and archived_at is null
      union
      select owner_id from public.contracts where lower(client_email) = v_email
    )
  ) groups;

  return jsonb_build_object('ok', true, 'email', v_email, 'professionals', v_result);
end$$;
grant execute on function public.client_portal_overview() to authenticated;

-- 2) Tab Preventivo della coppia: se il preventivo dell'evento è archiviato, trattalo come assente.
create or replace function public.couple_get_quote_for_entry(p_entry_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_quote quotes%rowtype; v_entry calendar_entries%rowtype; v_items jsonb; v_owner record;
  v_business_model text := 'GLOBAL';
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if not exists (select 1 from public.wedding_couple_members m where m.entry_id = p_entry_id and m.user_id = v_uid) then
    return jsonb_build_object('error','not_couple_member');
  end if;
  select * into v_entry from public.calendar_entries where id = p_entry_id;
  if v_entry.id is null or v_entry.quote_id is null then return jsonb_build_object('error','no_quote'); end if;
  select * into v_quote from public.quotes where id = v_entry.quote_id;
  if v_quote.id is null then return jsonb_build_object('error','quote_not_found'); end if;
  if v_quote.archived_at is not null then return jsonb_build_object('error','no_quote'); end if;

  if v_quote.access_token is null then
    update public.quotes set access_token = gen_random_uuid()
      where id = v_quote.id returning access_token into v_quote.access_token;
  end if;

  v_business_model := coalesce(v_entry.business_model, 'GLOBAL');

  select jsonb_agg(jsonb_build_object(
           'id', qi.id,
           'name_snapshot', qi.name_snapshot,
           'description_snapshot', qi.description_snapshot,
           'unit_snapshot', qi.unit_snapshot,
           'quantity', qi.quantity,
           'line_client', qi.line_client,
           'sort_order', qi.sort_order,
           'client_decision', qi.client_decision,
           'client_decline_reason', qi.client_decline_reason,
           'contracted_at', qi.contracted_at,
           'created_at', qi.created_at,
           'supplier_id', case when v_business_model = 'GLOBAL' then null else qi.supplier_id end,
           'category', sc.name,
           'photo', (select ph.thumbnail_url from public.service_photos ph
                     where ph.service_id = qi.service_id order by ph.sort_order limit 1)
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
    'total_client', v_quote.total_client, 'pdf_url', v_quote.pdf_url, 'accepted_at', v_quote.accepted_at,
    'closed_at', v_quote.closed_at, 'business_model', v_business_model,
    'owner', to_jsonb(v_owner), 'items', coalesce(v_items, '[]'::jsonb)
  );
end$$;
grant execute on function public.couple_get_quote_for_entry(uuid) to authenticated;
