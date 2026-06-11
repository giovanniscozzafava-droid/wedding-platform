-- "Programma operativo" del team: poterlo importare dalla scaletta dell'evento anche
-- per gli EVENTI DIRETTI (senza preventivo). Aggiunge il link entry_id agli eventi-team
-- e fa leggere il programma da event_timeline tramite entry_id (non solo quote_id).
alter table public.supplier_team_events add column if not exists entry_id uuid references public.calendar_entries(id) on delete set null;

-- backfill: eventi-team da preventivo → entry via quote; eventi diretti → match titolo+data+owner
update public.supplier_team_events ste
   set entry_id = (select ce.id from public.calendar_entries ce where ce.quote_id = ste.quote_id limit 1)
 where ste.entry_id is null and ste.quote_id is not null;
update public.supplier_team_events ste
   set entry_id = (select ce.id from public.calendar_entries ce
                   where ce.owner_id = ste.supplier_id and ce.title = ste.title and ce.date_from = ste.event_date limit 1)
 where ste.entry_id is null and ste.quote_id is null and ste.event_date is not null;

create or replace function public.supplier_event_program(p_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $function$
declare v_sup uuid := auth.uid(); v_quote uuid; v_entry uuid; v_rows jsonb;
begin
  if v_sup is null then return jsonb_build_object('error', 'auth_required'); end if;
  select quote_id, entry_id into v_quote, v_entry
    from public.supplier_team_events where id = p_event_id and supplier_id = v_sup;
  if not found then return jsonb_build_object('error', 'not_owner'); end if;
  -- preferisci il link diretto all'evento; se manca, risolvi dal preventivo
  if v_entry is null and v_quote is not null then
    select id into v_entry from public.calendar_entries where quote_id = v_quote limit 1;
  end if;
  if v_entry is null then return jsonb_build_object('error', 'no_event'); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'start_time', to_char(t.start_time, 'HH24:MI'),
    'title',      t.title,
    'note',       t.description,
    'location',   t.location,
    'mine',       (t.supplier_id = v_sup)
  ) order by t.ord, t.start_time), '[]'::jsonb)
  into v_rows
  from public.event_timeline t
  where t.entry_id = v_entry and (t.supplier_id is null or t.supplier_id = v_sup);

  return jsonb_build_object('ok', true, 'items', v_rows);
end$function$;
grant execute on function public.supplier_event_program(uuid) to authenticated;
