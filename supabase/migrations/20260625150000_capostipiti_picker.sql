-- Picker dei capostipiti già iscritti: elenca i wedding planner / location collegati al
-- chiamante (i suoi capostipiti via collaborations) — così si selezionano senza digitare l'email.
create or replace function public.list_addable_capostipiti(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not (public._photo_circle_member(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden');
  end if;
  select jsonb_agg(jsonb_build_object(
           'id', x.id,
           'name', coalesce(nullif(trim(x.business_name), ''), x.full_name, 'Wedding planner'),
           'role', x.role::text,
           'in_event', exists (select 1 from public.calendar_entry_participants cep where cep.entry_id = p_entry and cep.user_id = x.id)
         ) order by coalesce(x.business_name, x.full_name))
    into v
  from (
    select distinct pr.id, pr.business_name, pr.full_name, pr.role
    from public.profiles pr
    where pr.role in ('WEDDING_PLANNER','LOCATION')
      and (
        public.is_admin()
        or pr.id = auth.uid()
        or exists (select 1 from public.collaborations c where c.capostipite_id = pr.id and c.fornitore_id = auth.uid())
      )
  ) x;
  return jsonb_build_object('caps', coalesce(v, '[]'::jsonb));
end$$;
grant execute on function public.list_addable_capostipiti(uuid) to authenticated;

-- Aggiunge un capostipite (WP/Location) all'evento dato il suo id (dal picker).
create or replace function public.event_add_capostipite_id(p_entry uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_role text;
begin
  if not (public._photo_circle_member(p_entry) or public.is_admin()) then
    return jsonb_build_object('error','forbidden');
  end if;
  select role::text into v_role from public.profiles where id = p_user;
  if v_role is null then return jsonb_build_object('error','not_found'); end if;
  if v_role not in ('WEDDING_PLANNER','LOCATION') then
    return jsonb_build_object('error','not_a_planner', 'role', v_role);
  end if;
  insert into public.calendar_entry_participants(entry_id, user_id, role_in_entry, confirmed)
    values (p_entry, p_user, lower(v_role), true)
    on conflict (entry_id, user_id) do update set confirmed = true;
  return jsonb_build_object('ok', true, 'role', v_role);
end$$;
grant execute on function public.event_add_capostipite_id(uuid, uuid) to authenticated;
