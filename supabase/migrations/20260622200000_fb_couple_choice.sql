-- Lato CLIENTE: la coppia vede sul proprio dashboard le proposte di menu della location + i risultati
-- della prova menu, e sceglie. Accesso cross-tenant via is_wedding_couple(entry_id) (helper esistente).
-- La scelta scrive fb_event_menus sotto la LOCATION (owner) → fabbisogno/food cost/magazzino.

create or replace function public.fb_event_choice_view(p_entry uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_owner uuid; v_cov int; v_tast record;
begin
  select owner_id, coalesce(guest_count, 0) into v_owner, v_cov from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  if v_cov = 0 then select count(*) into v_cov from public.event_guests g where g.entry_id = p_entry and g.rsvp = 'YES' and g.age_group <> 'INFANT'; end if;
  select scheduled_at, sala, status into v_tast from public.fb_tastings where entry_id = p_entry order by created_at desc limit 1;

  return jsonb_build_object('ok', true, 'coperti', v_cov,
    'prova', case when v_tast is null then null else jsonb_build_object('quando', v_tast.scheduled_at, 'sala', v_tast.sala, 'status', v_tast.status) end,
    'proposte', coalesce((
      select jsonb_agg(jsonb_build_object('menu_id', mm.id, 'nome', mm.name, 'scelto', p.is_chosen,
        'piatti', coalesce((select jsonb_agg(jsonb_build_object('portata', mi.course, 'piatto', rc.name) order by mi.sort_order, rc.name)
          from public.fb_menu_items mi join public.fb_recipes rc on rc.id = mi.recipe_id where mi.menu_id = mm.id), '[]'::jsonb),
        'voti', coalesce((select jsonb_build_object('media', round(avg(v.score),2), 'n', count(*))
          from public.fb_tasting_votes v join public.fb_tastings t on t.id = v.tasting_id
          where t.entry_id = p_entry and v.menu_id = mm.id), null))
        order by mm.name)
      from public.fb_menu_proposals p join public.fb_menus mm on mm.id = p.menu_id where p.entry_id = p_entry), '[]'::jsonb));
end$$;
grant execute on function public.fb_event_choice_view(uuid) to authenticated;

create or replace function public.fb_member_choose(p_entry uuid, p_menu_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_cov int;
begin
  select owner_id, coalesce(guest_count, 0) into v_owner, v_cov from public.calendar_entries where id = p_entry;
  if v_owner is null then return jsonb_build_object('error','not_found'); end if;
  if not (v_owner = auth.uid() or public.is_wedding_couple(p_entry) or public.is_admin()) then return jsonb_build_object('error','forbidden'); end if;
  if not exists (select 1 from public.fb_menu_proposals where entry_id = p_entry and menu_id = p_menu_id) then return jsonb_build_object('error','menu_non_proposto'); end if;
  if v_cov = 0 then select greatest(count(*), 1) into v_cov from public.event_guests g where g.entry_id = p_entry and g.rsvp = 'YES' and g.age_group <> 'INFANT'; end if;
  if v_cov = 0 then v_cov := 100; end if;
  update public.fb_menu_proposals set is_chosen = (menu_id = p_menu_id) where entry_id = p_entry;
  delete from public.fb_event_menus where entry_id = p_entry;
  insert into public.fb_event_menus(location_id, entry_id, menu_id, covers) values (v_owner, p_entry, p_menu_id, v_cov);
  update public.fb_tastings set status = 'CONCLUSA' where entry_id = p_entry;
  return jsonb_build_object('ok', true, 'coperti', v_cov);
end$$;
grant execute on function public.fb_member_choose(uuid, uuid) to authenticated;
