-- SELEZIONE SPOSI: (A) il fotografo può CHIUDERE coattamente la selezione anche fuori range (quando il
-- cliente non riesce a stare nei numeri). (B) data MASSIMA entro cui finire: da lì partono le email di
-- avviso (cron giornaliero → edge gallery-deadline-run).

alter table public.gallery_selection
  add column if not exists deadline date,
  add column if not exists last_reminder_on date;

-- (B) owner imposta/azzera la data massima (reset del promemoria)
create or replace function public.gallery_set_deadline(p_gallery uuid, p_deadline date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g public.event_galleries;
begin
  select * into v_g from public.event_galleries where id = p_gallery;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (v_g.owner_id = auth.uid() or public.is_admin()) then return jsonb_build_object('error', 'forbidden'); end if;
  perform public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  update public.gallery_selection set deadline = p_deadline, last_reminder_on = null, updated_at = now() where gallery_id = v_g.id;
  return jsonb_build_object('ok', true, 'deadline', p_deadline);
end$$;

-- (A) owner CHIUDE la selezione anche fuori range: applica le tenute del giro corrente (KEPT) e
-- scarta le altre, poi stato = SUBMITTED. Nessun controllo min/max né "giro finito".
create or replace function public.gallery_force_close(p_gallery uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g public.event_galleries; v_sel public.gallery_selection; v_kept int;
begin
  select * into v_g from public.event_galleries where id = p_gallery;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (v_g.owner_id = auth.uid() or public.is_admin()) then return jsonb_build_object('error', 'forbidden'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  if v_sel.status = 'SUBMITTED' then return jsonb_build_object('error', 'already_submitted'); end if;
  update public.gallery_media gm set album_choice = 'KEPT'
   from public._gallery_base_media(v_g.id) b
   where gm.id = b.media_id
     and exists (select 1 from public.gallery_selection_decisions d
                 where d.gallery_id = v_g.id and d.media_id = gm.id and d.round = v_sel.round and d.keep);
  update public.gallery_media gm set album_choice = 'DISCARDED'
   from public._gallery_base_media(v_g.id) b
   where gm.id = b.media_id
     and not exists (select 1 from public.gallery_selection_decisions d
                     where d.gallery_id = v_g.id and d.media_id = gm.id and d.round = v_sel.round and d.keep);
  select count(*) into v_kept from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round and keep;
  update public.gallery_selection set status = 'SUBMITTED', submitted_at = now(), updated_at = now() where gallery_id = v_g.id;
  return jsonb_build_object('ok', true, 'kept', v_kept, 'status', 'SUBMITTED');
end$$;

-- get range esteso: include deadline + status (per la UI del fotografo)
create or replace function public.gallery_get_range(p_gallery uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g public.event_galleries; v_sel public.gallery_selection; v_kind text;
begin
  select * into v_g from public.event_galleries where id = p_gallery;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (v_g.owner_id = auth.uid() or public.is_admin()) then return jsonb_build_object('error', 'forbidden'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  select coalesce(event_kind, 'matrimonio') into v_kind from public.calendar_entries where id = v_g.entry_id;
  return jsonb_build_object('min', v_sel.target_min, 'max', v_sel.target_max, 'event_kind', v_kind,
    'submitted', v_sel.submitted_at is not null, 'deadline', v_sel.deadline, 'status', v_sel.status);
end$$;

-- (B) cron giornaliero → edge che manda gli avvisi email alla coppia (best-effort)
create or replace function public.gallery_deadline_kick() returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_key text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net') then return; end if;
  v_url := regexp_replace(coalesce(current_setting('app.supabase_url', true), 'http://kong:8000/functions/v1'), '/+$', '');
  v_key := coalesce(current_setting('app.functions_anon_key', true), '');
  perform net.http_post(
    url     := v_url || '/gallery-deadline-run',
    headers := jsonb_build_object('Content-Type', 'application/json')
               || case when v_key <> '' then jsonb_build_object('Authorization', 'Bearer ' || v_key) else '{}'::jsonb end,
    body    := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
end$$;
do $$ begin
  perform cron.schedule('gallery-deadline-daily', '0 8 * * *', 'select public.gallery_deadline_kick();');
exception when others then raise notice 'pg_cron non disponibile: gallery-deadline non schedulato'; end $$;

grant execute on function public.gallery_set_deadline(uuid, date) to authenticated;
grant execute on function public.gallery_force_close(uuid) to authenticated;
