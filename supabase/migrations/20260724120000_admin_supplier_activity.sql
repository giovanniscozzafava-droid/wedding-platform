-- MONITORAGGIO ATTIVITÀ FORNITORI (admin): chi si iscrive e poi AGISCE davvero — soprattutto se
-- crea servizi. Per ogni FORNITORE: iscritto il, ultimo accesso (auth.users.last_sign_in_at),
-- n° servizi (tot/attivi) + data primo servizio, n° preventivi, n° eventi, n° foto caricate.
-- Lo stato (attivo/dormiente/mai entrato/senza servizi) lo calcola la UI dai numeri.
create or replace function public.admin_supplier_activity(p_search text default null, p_filter text default 'all')
returns table (
  id uuid, name text, subrole text, email text,
  created_at timestamptz, last_sign_in_at timestamptz,
  n_services int, n_services_active int, n_quotes int, n_events int, n_photos int,
  first_service_at timestamptz
) language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select p.id,
      coalesce(nullif(p.business_name, ''), p.full_name)::text,
      p.subrole::text,
      u.email::text,
      p.created_at,
      u.last_sign_in_at,
      (select count(*)::int from public.services s where s.fornitore_id = p.id),
      (select count(*)::int from public.services s where s.fornitore_id = p.id and s.is_active),
      (select count(*)::int from public.quotes q where q.owner_id = p.id),
      (select count(*)::int from public.calendar_entries e where e.owner_id = p.id),
      (select count(*)::int from public.gallery_media m join public.event_galleries g on g.id = m.gallery_id where g.owner_id = p.id),
      (select min(s.created_at) from public.services s where s.fornitore_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'FORNITORE'
      and (coalesce(p_search, '') = ''
           or p.full_name ilike '%' || p_search || '%'
           or p.business_name ilike '%' || p_search || '%'
           or u.email ilike '%' || p_search || '%')
      and (
        coalesce(p_filter, 'all') = 'all'
        or (p_filter = 'no_services'   and not exists (select 1 from public.services s where s.fornitore_id = p.id))
        or (p_filter = 'with_services' and     exists (select 1 from public.services s where s.fornitore_id = p.id))
        or (p_filter = 'never_in'      and u.last_sign_in_at is null)
        or (p_filter = 'dormant'       and (u.last_sign_in_at is null or u.last_sign_in_at < now() - interval '30 days'))
      )
    order by p.created_at desc
    limit 400;
end$$;
revoke all on function public.admin_supplier_activity(text, text) from public, anon;
grant execute on function public.admin_supplier_activity(text, text) to authenticated;
