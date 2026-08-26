-- ════════════════════════════════════════════════════════════════════════════
-- Cerchio evento: un professionista che ha un PREVENTIVO ACCETTATO per lo STESSO
-- matrimonio (stessa quote_event_key) deve comparire AUTOMATICAMENTE nel cerchio,
-- anche se non è partecipante formale dell'entry né ha un'entry propria.
-- Caso reale: Rossana Ierardi firma con Gisko (fotografo) E con Stefano Severini
-- (videomaker); i due preventivi condividono la chiave-evento, ma Stefano non
-- risultava nel cerchio di Gisko → ruolo Videomaker mostrato come "suggerisci".
-- Fix: aggiungo ai `members` (da cui derivano copertura e nomi) gli owner dei
-- preventivi ACCETTATO/CONVERTITO con la stessa chiave-evento di questo evento.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.get_event_ring(p_entry uuid)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
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
    union
    -- Pro con preventivo ACCETTATO per lo STESSO evento (stessa chiave-evento):
    -- entrano nel cerchio in automatico (es. il videomaker che ha firmato col cliente).
    select q2.owner_id
    from public.quotes q2
    where public.quote_event_key(q2.id) is not null
      and public.quote_event_key(q2.id) = public.quote_event_key(
            (select ce.quote_id from public.calendar_entries ce where ce.id = p_entry))
      and q2.status in ('ACCETTATO','CONVERTITO_IN_CONTRATTO')
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
end$function$;
