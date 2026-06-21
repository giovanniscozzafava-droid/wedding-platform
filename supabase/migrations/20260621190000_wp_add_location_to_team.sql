-- Gerarchia capostipiti: la WEDDING_PLANNER sta sopra la LOCATION e può reclutarla nel proprio
-- team, anche se la Location è a sua volta capostipite. La Location NON può fare il contrario.
-- Aggiunta diretta (ACTIVE): collaboration capostipite=WP, fornitore=Location.
create or replace function public.wp_add_location_to_team(p_location_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_role user_role;
  v_target_role user_role;
begin
  if v_uid is null then return jsonb_build_object('error','auth_required'); end if;
  if p_location_id = v_uid then return jsonb_build_object('error','self'); end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role <> 'WEDDING_PLANNER' then return jsonb_build_object('error','forbidden'); end if;
  select role into v_target_role from public.profiles where id = p_location_id;
  if v_target_role is null then return jsonb_build_object('error','not_found'); end if;
  if v_target_role <> 'LOCATION' then return jsonb_build_object('error','not_a_location'); end if;

  insert into public.collaborations (capostipite_id, fornitore_id, status, invited_at, accepted_at)
  values (v_uid, p_location_id, 'ACTIVE', now(), now())
  on conflict (capostipite_id, fornitore_id)
    do update set status = 'ACTIVE', accepted_at = coalesce(public.collaborations.accepted_at, now());

  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.wp_add_location_to_team(uuid) to authenticated;
