-- BUG minisito: 'record "v_ce" has no field "client_name"'. Stessa causa PII (split P5):
-- client_name è stato spostato in calendar_entries_private ma wedding_site_get lo leggeva ancora
-- da calendar_entries (%rowtype). Fix: leggilo dalla tabella privata. Esposto anche event_kind
-- così il minisito può adattarsi al tipo di evento (compleanno, non solo matrimonio).

create or replace function wedding_site_get(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ce calendar_entries%rowtype;
  v_owner record;
  v_client_name text;
  v_sub jsonb;
  v_acc jsonb;
  v_tr  jsonb;
begin
  select * into v_ce from calendar_entries where wedding_website_slug = p_slug and wedding_website_published = true;
  if v_ce.id is null then return null; end if;

  select client_name into v_client_name from public.calendar_entries_private where entry_id = v_ce.id;

  select full_name, business_name, brand_logo_url, brand_primary_color, brand_secondary_color
    into v_owner from profiles where id = v_ce.owner_id;

  select jsonb_agg(jsonb_build_object(
    'id', se.id, 'kind', se.kind, 'title', se.title, 'description', se.description,
    'date_at', se.date_at, 'duration_min', se.duration_min, 'location', se.location,
    'cover_image_url', se.cover_image_url
  ) order by se.date_at)
  into v_sub from event_subevents se
  where se.entry_id = v_ce.id and se.status in ('PIANIFICATO','CONFERMATO');

  select jsonb_agg(jsonb_build_object(
    'id', a.id, 'kind', a.kind, 'name', a.name, 'address', a.address,
    'city', a.city, 'country', a.country, 'url', a.url, 'rate_per_night', a.rate_per_night,
    'currency', a.currency, 'promo_code', a.promo_code, 'distance_km', a.distance_km,
    'cover_image_url', a.cover_image_url
  ))
  into v_acc from event_accommodations a where a.entry_id = v_ce.id;

  select jsonb_agg(jsonb_build_object(
    'id', t.id, 'kind', t.kind, 'label', t.label, 'depart_at', t.depart_at,
    'depart_from', t.depart_from, 'arrive_at', t.arrive_at, 'arrive_to', t.arrive_to,
    'capacity', t.capacity, 'route_notes', t.route_notes
  ) order by t.depart_at)
  into v_tr from event_transport t where t.entry_id = v_ce.id;

  return jsonb_build_object(
    'wedding', jsonb_build_object(
      'id', v_ce.id,
      'title', v_ce.title,
      'client_name', v_client_name,
      'event_kind', v_ce.event_kind,
      'date_from', v_ce.date_from,
      'date_to', v_ce.date_to,
      'is_destination', v_ce.is_destination,
      'destination_location', v_ce.destination_location,
      'destination_country', v_ce.destination_country,
      'destination_language', v_ce.destination_language,
      'data', v_ce.wedding_website_data
    ),
    'owner', to_jsonb(v_owner),
    'subevents', coalesce(v_sub, '[]'::jsonb),
    'accommodations', coalesce(v_acc, '[]'::jsonb),
    'transport', coalesce(v_tr, '[]'::jsonb)
  );
end$$;
revoke all on function wedding_site_get(text) from public;
grant execute on function wedding_site_get(text) to anon, authenticated;
