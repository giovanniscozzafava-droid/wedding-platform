-- (1) POST-IT "SOSTITUISCI CON": il cliente può chiedere di rimpiazzare una foto, indicando
--     facoltativamente con quale. Il fotografo, in lavorazione, se la ritrova pronta da inserire.
alter table public.album_revision_requests
  add column if not exists kind text not null default 'NOTE',                 -- NOTE | REPLACE
  add column if not exists replace_media_id uuid references public.gallery_media(id) on delete set null;

-- (2) SEGNALE "selezione chiusa, puoi impaginare": il cliente conferma la scelta dei cuori dalla
--     sua galleria (NON dall'impaginatore, che riscriverebbe il layout). Imposta solo lo stato
--     dell'album a PHOTOGRAPHER_EDIT (crea la riga se non esiste) e notifica il fotografo.
create or replace function public.album_request_layout(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_kept int;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  select count(*) into v_kept from public.gallery_media where entry_id = p_entry and album_choice = 'KEPT';
  if v_kept = 0 then return jsonb_build_object('error', 'no_selection'); end if;
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  insert into public.album_projects(entry_id, gallery_id, owner_id, format_key, status, layout, updated_by, updated_at)
    values (p_entry, null, coalesce(v_owner, auth.uid()), 'SQ_30', 'PHOTOGRAPHER_EDIT', '{"pages":[]}'::jsonb, auth.uid(), now())
  on conflict (entry_id) do update set status = 'PHOTOGRAPHER_EDIT', updated_by = auth.uid(), updated_at = now();
  if v_owner is not null and v_owner <> auth.uid() then
    perform public.push_user_notification(v_owner, 'album_selection_done', 'Selezione foto confermata',
      'Il cliente ha confermato la selezione (' || v_kept || ' foto): puoi impaginare la bozza.',
      '/album/' || p_entry, p_entry);
  end if;
  return jsonb_build_object('ok', true, 'kept', v_kept);
end$$;
grant execute on function public.album_request_layout(uuid) to authenticated;
