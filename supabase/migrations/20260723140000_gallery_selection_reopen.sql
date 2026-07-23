-- ============================================================================
-- RIAPRI SELEZIONE + CHIUDI SEMPRE (fuori range con avviso).
--   · La coppia può CHIUDERE in qualsiasi momento: se è fuori dal range [min,max] il
--     frontend avvisa, poi chiama submit con p_force = true (chiude comunque).
--   · La coppia può CHIEDERE di riaprire (dopo la chiusura) → notifica il fotografo.
--   · Il FOTOGRAFO (owner) riapre: nuovo giro sulle tenute correnti, così la coppia
--     riprende a scartare da quanto era rimasto verso il range.
-- ============================================================================
alter table public.gallery_selection add column if not exists reopen_requested_at timestamptz;

-- SUBMIT con opzione forza: senza force impone il range (below_min/above_max), con force chiude
-- comunque. (Sostituisce la firma a 1 argomento; la chiamata RPC con solo p_token usa il default.)
drop function if exists public.gallery_selection_submit(uuid);
create or replace function public.gallery_selection_submit(p_token uuid, p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g record; v_sel public.gallery_selection; v_kept int;
begin
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  if v_sel.status = 'SUBMITTED' then return jsonb_build_object('error', 'already_submitted'); end if;
  select count(*) into v_kept from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round and keep;
  if not coalesce(p_force, false) then
    if v_kept < v_sel.target_min then return jsonb_build_object('error', 'below_min', 'kept', v_kept, 'min', v_sel.target_min); end if;
    if v_kept > v_sel.target_max then return jsonb_build_object('error', 'above_max', 'kept', v_kept, 'max', v_sel.target_max); end if;
  end if;

  -- tenute del giro corrente = KEPT; le altre foto base (incluse le non decise) = DISCARDED
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

  update public.gallery_selection set status = 'SUBMITTED', submitted_at = now(), updated_at = now() where gallery_id = v_g.id;

  perform public.push_user_notification(
    v_g.owner_id, 'gallery_selection',
    'Gli sposi hanno confermato la selezione',
    coalesce(v_g.couple_label, v_g.title) || ' · ' || v_kept || ' foto scelte per l''album'
      || case when coalesce(p_force, false) and (v_kept < v_sel.target_min or v_kept > v_sel.target_max) then ' (fuori range)' else '' end,
    '/album/' || v_g.entry_id::text, v_g.id);

  return jsonb_build_object('ok', true, 'kept', v_kept, 'status', 'SUBMITTED');
end$$;
grant execute on function public.gallery_selection_submit(uuid, boolean) to anon, authenticated;

-- COPPIA: chiede di riaprire (solo se già inviata). Segna la richiesta e notifica il fotografo.
create or replace function public.gallery_selection_request_reopen(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g record; v_sel public.gallery_selection;
begin
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  if v_sel.status <> 'SUBMITTED' then return jsonb_build_object('error', 'not_submitted'); end if;
  update public.gallery_selection set reopen_requested_at = now(), updated_at = now() where gallery_id = v_g.id;
  perform public.push_user_notification(
    v_g.owner_id, 'gallery_selection',
    'La coppia chiede di riaprire la selezione',
    coalesce(v_g.couple_label, v_g.title) || ' · vuole continuare a scremare le foto',
    '/album/' || v_g.entry_id::text, v_g.id);
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.gallery_selection_request_reopen(uuid) to anon, authenticated;

-- FOTOGRAFO (owner): riapre la selezione. Nuovo giro → pool = tenute del giro appena chiuso,
-- così la coppia riprende a scartare da quanto era rimasto. Torna ACTIVE, azzera la richiesta.
create or replace function public.gallery_selection_reopen(p_gallery uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g public.event_galleries; v_sel public.gallery_selection;
begin
  select * into v_g from public.event_galleries where id = p_gallery;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (v_g.owner_id = auth.uid() or public.is_admin()) then return jsonb_build_object('error', 'forbidden'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  if v_sel.status <> 'SUBMITTED' then return jsonb_build_object('error', 'not_submitted'); end if;
  update public.gallery_selection
     set round = round + 1, status = 'ACTIVE', submitted_at = null, reopen_requested_at = null, updated_at = now()
   where gallery_id = v_g.id;
  return jsonb_build_object('ok', true, 'round', v_sel.round + 1, 'share_token', v_g.share_token, 'entry_id', v_g.entry_id);
end$$;
grant execute on function public.gallery_selection_reopen(uuid) to authenticated;

-- get range esteso: aggiunge reopen_requested (per far comparire "Riapri" al fotografo).
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
    'submitted', v_sel.submitted_at is not null, 'deadline', v_sel.deadline, 'status', v_sel.status,
    'reopen_requested', v_sel.reopen_requested_at is not null, 'round', v_sel.round);
end$$;
