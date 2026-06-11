-- Completamento per sezione (anelli stile Apple che si "chiudono"): un valore 0..1
-- per ogni area dell'evento. SECURITY DEFINER, leggibile dai membri del cerchio/sposi.
create or replace function public.get_event_completion(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_guests int := 0; v_estimate int := 0; v_seated int := 0; v_rsvp int := 0;
  v_menu int := 0; v_timeline int := 0; v_mood int := 0; v_playlist int := 0; v_cer int := 0;
  v_ring jsonb; v_ring_val numeric := 0;
begin
  if not (public._photo_circle_member(p_entry) or public.is_wedding_couple(p_entry) or public.is_admin()
          or exists (select 1 from public.calendar_entries e where e.id = p_entry and e.owner_id = auth.uid())) then
    return jsonb_build_object('error', 'forbidden');
  end if;

  select count(*),
         count(*) filter (where table_id is not null),
         count(*) filter (where rsvp = 'YES')
    into v_guests, v_seated, v_rsvp from public.event_guests where entry_id = p_entry;
  select coalesce(guests_estimate, 0) into v_estimate from public.couple_preferences where entry_id = p_entry;
  select count(*) into v_menu from public.event_menu where entry_id = p_entry;
  select count(*) into v_timeline from public.event_timeline where entry_id = p_entry;
  select count(*) into v_mood from public.mood_images where entry_id = p_entry;
  select count(*) into v_playlist from public.event_playlist where entry_id = p_entry;
  select (case when coalesce(ceremony_venue_name, '') <> '' then 1 else 0 end
        + case when ceremony_date is not null then 1 else 0 end
        + case when coalesce(ceremony_type::text, '') <> '' then 1 else 0 end
        + case when coalesce(ceremony_city, '') <> '' then 1 else 0 end)
    into v_cer from public.calendar_entries where id = p_entry;

  v_ring := public.get_event_ring(p_entry);
  if coalesce((v_ring->>'total')::numeric, 0) > 0 then
    v_ring_val := (v_ring->>'covered')::numeric / (v_ring->>'total')::numeric;
  end if;

  return jsonb_build_object('sections', jsonb_build_array(
    jsonb_build_object('key','cerchio','label','Cerchio','tab','overview','value', round(v_ring_val,3),
      'detail', coalesce(v_ring->>'covered','0') || '/' || coalesce(v_ring->>'total','0')),
    jsonb_build_object('key','guests','label','Invitati','tab','guests',
      'value', round(least(1.0, case when v_estimate > 0 then v_guests::numeric/v_estimate else least(1.0, v_guests::numeric/50) end),3),
      'detail', v_guests::text || case when v_estimate > 0 then '/' || v_estimate else '' end),
    jsonb_build_object('key','rsvp','label','Conferme','tab','guests',
      'value', round(case when v_guests > 0 then v_rsvp::numeric/v_guests else 0 end,3), 'detail', v_rsvp::text || '/' || v_guests::text),
    jsonb_build_object('key','tables','label','Tavoli','tab','tables',
      'value', round(case when v_guests > 0 then v_seated::numeric/v_guests else 0 end,3), 'detail', v_seated::text || '/' || v_guests::text),
    jsonb_build_object('key','menu','label','Menu','tab','menu','value', round(least(1.0, v_menu::numeric/6),3), 'detail', v_menu::text),
    jsonb_build_object('key','timeline','label','Scaletta','tab','timeline','value', round(least(1.0, v_timeline::numeric/6),3), 'detail', v_timeline::text),
    jsonb_build_object('key','mood','label','Mood','tab','mood','value', round(least(1.0, v_mood::numeric/6),3), 'detail', v_mood::text),
    jsonb_build_object('key','playlist','label','Playlist','tab','playlist','value', round(least(1.0, v_playlist::numeric/8),3), 'detail', v_playlist::text),
    jsonb_build_object('key','cerimonia','label','Cerimonia','tab','ceremony','value', round(v_cer::numeric/4,3), 'detail', v_cer::text || '/4')
  ));
end$$;
grant execute on function public.get_event_completion(uuid) to authenticated;
