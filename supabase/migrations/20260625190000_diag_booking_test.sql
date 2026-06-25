-- TEST (diagnostico): crea una config prenotazioni per un professionista con slug e verifica
-- che booking_public_config e booking_free_slots restituiscano dati sensati.
do $$
declare v_id uuid; v_slug text; v_cfg jsonb; v_slots jsonb;
begin
  select id, slug into v_id, v_slug from public.profiles
   where slug is not null and role in ('FORNITORE','WEDDING_PLANNER','LOCATION')
   order by created_at limit 1;
  if v_id is null then raise notice 'TEST: nessun professionista con slug'; return; end if;

  insert into public.booking_settings(professional_id) values (v_id)
    on conflict (professional_id) do update set enabled = true;

  v_cfg := public.booking_public_config(v_slug);
  v_slots := public.booking_free_slots(v_slug, current_date, current_date + 7);

  raise notice 'TEST booking → slug=% cfg_ok=% slots=% primo=%',
    v_slug,
    (v_cfg is not null and (v_cfg ? 'professional_id')),
    jsonb_array_length(coalesce(v_slots, '[]'::jsonb)),
    coalesce(v_slots -> 0, 'null'::jsonb);
end $$;
