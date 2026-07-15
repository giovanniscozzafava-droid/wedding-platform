-- CONFERMA ANTICIPATA: gli sposi possono confermare la selezione appena RAGGIUNTO il numero
-- (tenute nel range [min,max]), senza dover scorrere per forza ogni foto rimasta. Togliamo il
-- vincolo "tutte decise" dal submit: le foto non decise restano semplicemente non tenute (DISCARDED).
-- Advance (giro successivo) invece resta subordinato all'aver deciso tutto: serve solo quando si
-- supera il tetto massimo.
create or replace function public.gallery_selection_submit(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_g record; v_sel public.gallery_selection; v_kept int;
begin
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);
  if v_sel.status = 'SUBMITTED' then return jsonb_build_object('error', 'already_submitted'); end if;
  select count(*) into v_kept from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round and keep;
  if v_kept < v_sel.target_min then return jsonb_build_object('error', 'below_min', 'kept', v_kept, 'min', v_sel.target_min); end if;
  if v_kept > v_sel.target_max then return jsonb_build_object('error', 'above_max', 'kept', v_kept, 'max', v_sel.target_max); end if;

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
    coalesce(v_g.couple_label, v_g.title) || ' · ' || v_kept || ' foto scelte per l''album',
    '/album/' || v_g.entry_id::text, v_g.id);

  return jsonb_build_object('ok', true, 'kept', v_kept, 'status', 'SUBMITTED');
end$$;
grant execute on function public.gallery_selection_submit(uuid) to anon, authenticated;
