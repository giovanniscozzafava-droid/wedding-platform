-- client_portal_overview: aggiunge la CATEGORIA a ogni voce del preventivo e ordina
-- le voci per categoria, così nell'area cliente le voci arrivano già raggruppate e
-- ordinate (es. tutti i "Servizio fotografico" insieme, tutti gli "Album" insieme)
-- invece che mescolate. La categoria viene dal servizio d'origine della voce
-- (quote_items.service_id → services.category_id → service_categories.name); è NULL
-- per le voci senza servizio collegato (fallback "Altro" lato UI).
-- Resto della funzione IDENTICO alla versione precedente (20260605180000).
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
              'category', sc.name
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
        where q.owner_id = pr.id and lower(q.client_email) = v_email
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
      select owner_id from public.quotes where lower(client_email) = v_email
      union
      select owner_id from public.contracts where lower(client_email) = v_email
    )
  ) groups;

  return jsonb_build_object('ok', true, 'email', v_email, 'professionals', v_result);
end$$;

grant execute on function public.client_portal_overview() to authenticated;
