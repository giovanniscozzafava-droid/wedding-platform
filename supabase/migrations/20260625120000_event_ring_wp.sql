-- Il cerchio dell'evento mostrava solo i fornitori (ruoli), non il capostipite/WP che lo guida.
-- Aggiungiamo al ring un campo `wp` = nome + ruolo del proprietario dell'evento (la WP/capostipite),
-- così nel cerchio si vede anche chi coordina.
create or replace function public.get_event_ring(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_roles jsonb; v_total int; v_covered int; v_wp jsonb;
begin
  select owner_id into v_owner from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','event_not_found'); end if;
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden');
  end if;

  perform public._event_ring_seed(p_entry);

  with members as (
    select user_id as uid from public.calendar_entry_participants where entry_id = p_entry
    union select v_owner
    union select collaborator_id from public.supplier_event_collaborators where event_id = p_entry and status = 'ATTIVO'
  ),
  covered_keys as (
    select distinct pr.subrole as k from members m join public.profiles pr on pr.id = m.uid where pr.subrole is not null
    union
    select 'location' from members m join public.profiles pr on pr.id = m.uid where pr.role = 'LOCATION'
  ),
  named as (
    select pr.subrole as k, coalesce(pr.business_name, pr.full_name) as nm
    from members m join public.profiles pr on pr.id = m.uid where pr.subrole is not null
  )
  select
    jsonb_agg(jsonb_build_object(
      'role_key', r.role_key, 'label', r.label, 'sort_order', r.sort_order,
      'covered', (r.role_key in (select k from covered_keys)),
      'covered_by', (select nm from named n where n.k = r.role_key limit 1)
    ) order by r.sort_order),
    count(*),
    count(*) filter (where r.role_key in (select k from covered_keys))
  into v_roles, v_total, v_covered
  from public.event_ring_roles r
  where r.entry_id = p_entry and r.active;

  -- capostipite / WP = proprietario dell'evento
  select jsonb_build_object(
           'name', coalesce(nullif(trim(pr.business_name), ''), pr.full_name, 'Organizzatore'),
           'role', pr.role::text
         )
    into v_wp
  from public.profiles pr where pr.id = v_owner;

  return jsonb_build_object(
    'roles', coalesce(v_roles,'[]'::jsonb),
    'total', coalesce(v_total,0),
    'covered', coalesce(v_covered,0),
    'closed', coalesce(v_total,0) > 0 and coalesce(v_covered,0) = coalesce(v_total,0),
    'wp', v_wp
  );
end$$;
