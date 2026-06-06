-- ============================================================================
-- Picker "colleghi che seguo" per la condivisione del programma evento.
--  • followed_colleagues(): i colleghi (fornitori/location/WP) che seguo (follow
--    APPROVED), senza il filtro referral. Per cercarli e invitarli direttamente.
--  • invite_event_collaborator_by_id(): invita per id profilo (dal picker),
--    in alternativa all'invito via email (per chi non è ancora iscritto).
-- ============================================================================
create or replace function public.followed_colleagues()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', coalesce(p.business_name, p.full_name, 'Collega'),
    'subrole', p.subrole,
    'role', p.role,
    'city', p.city
  ) order by coalesce(p.business_name, p.full_name)), '[]'::jsonb)
  from public.follows f
  join public.profiles p on p.id = f.followed_id
  where f.follower_id = auth.uid()
    and f.status = 'APPROVED'
    and p.role in ('FORNITORE','LOCATION','WEDDING_PLANNER');
$$;
grant execute on function public.followed_colleagues() to authenticated;

create or replace function public.invite_event_collaborator_by_id(p_event_id uuid, p_collab_id uuid, p_can_edit boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid := auth.uid(); v_title text; v_owner_name text; v_id uuid;
begin
  if v_owner is null then return jsonb_build_object('error','auth_required'); end if;
  select title into v_title from public.supplier_team_events where id = p_event_id and supplier_id = v_owner;
  if v_title is null then return jsonb_build_object('error','not_owner'); end if;
  if p_collab_id = v_owner then return jsonb_build_object('error','cannot_invite_self'); end if;
  if not exists (select 1 from public.profiles where id = p_collab_id) then return jsonb_build_object('error','user_not_found'); end if;

  insert into public.supplier_event_collaborators (event_id, owner_id, collaborator_id, status, can_edit)
  values (p_event_id, v_owner, p_collab_id, 'INVITATO', coalesce(p_can_edit, false))
  on conflict (event_id, collaborator_id)
    do update set status = 'INVITATO', can_edit = excluded.can_edit, updated_at = now()
  returning id into v_id;

  select coalesce(business_name, full_name, 'Un collega') into v_owner_name from public.profiles where id = v_owner;
  perform public.push_user_notification(
    p_collab_id, 'EVENT_COLLAB_INVITE', 'Invito a un evento',
    v_owner_name || ' ti ha invitato a condividere il programma di "' || v_title || '"',
    '/team', p_event_id);
  return jsonb_build_object('ok', true, 'collaborator_id', v_id);
end$$;
grant execute on function public.invite_event_collaborator_by_id(uuid, uuid, boolean) to authenticated;
