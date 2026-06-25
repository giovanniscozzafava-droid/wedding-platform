-- 1) get_event_ring.wp diventa una LISTA: tutti i capostipiti dell'evento (proprietario +
--    partecipanti/collaboratori con ruolo WEDDING_PLANNER o LOCATION). Così la WP si vede.
create or replace function public.get_event_ring(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_roles jsonb; v_total int; v_covered int; v_wps jsonb;
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

  -- capostipiti: proprietario (sempre) + membri WEDDING_PLANNER / LOCATION
  with caps as (
    select v_owner as uid, true as is_owner
    union
    select user_id, false from public.calendar_entry_participants where entry_id = p_entry
    union
    select collaborator_id, false from public.supplier_event_collaborators where event_id = p_entry and status = 'ATTIVO'
  )
  select jsonb_agg(distinct jsonb_build_object(
           'name', coalesce(nullif(trim(pr.business_name), ''), pr.full_name, 'Organizzatore'),
           'role', pr.role::text
         ))
    into v_wps
  from caps c join public.profiles pr on pr.id = c.uid
  where c.is_owner or pr.role in ('WEDDING_PLANNER','LOCATION');

  return jsonb_build_object(
    'roles', coalesce(v_roles,'[]'::jsonb),
    'total', coalesce(v_total,0),
    'covered', coalesce(v_covered,0),
    'closed', coalesce(v_total,0) > 0 and coalesce(v_covered,0) = coalesce(v_total,0),
    'wp', coalesce(v_wps, '[]'::jsonb)
  );
end$$;

-- 2) Inserire un capostipite (WP / Location) nell'evento per email. Un membro del cerchio o
--    admin può aggiungere un wedding planner / location esistente: entra come partecipante.
create or replace function public.event_add_capostipite(p_entry uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid; v_role text;
begin
  if not (public._photo_circle_member(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden');
  end if;
  select u.id into v_uid from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
  if v_uid is null then return jsonb_build_object('error','not_found'); end if;
  select role::text into v_role from public.profiles where id = v_uid;
  if v_role not in ('WEDDING_PLANNER','LOCATION') then
    return jsonb_build_object('error','not_a_planner', 'role', coalesce(v_role,'?'));
  end if;
  insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
    values (p_entry, v_uid, lower(v_role), true)
    on conflict (entry_id, user_id) do update set confirmed = true;
  return jsonb_build_object('ok', true, 'role', v_role);
end$$;
grant execute on function public.event_add_capostipite(uuid, text) to authenticated;
