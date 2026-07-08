-- album_commission_share null-safe: se un parametro è NULL, NON sovrascrive il valore esistente.
-- Serve perché la commissione si può generare da due punti: dal configuratore copertina (passa
-- cover+copie) e dall'impaginatore (passa cover=null, copies=null → preserva quanto già impostato).
create or replace function public.album_commission_share(
  p_entry uuid, p_cover jsonb, p_copies int default 1, p_notes text default null, p_file_link text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_proj record; v_label text; v_pages int; v_id uuid; v_token uuid;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error','forbidden'); end if;
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  v_owner := coalesce(v_owner, auth.uid());
  select id, format_key, coalesce(jsonb_array_length(layout->'pages'),0) as pages into v_proj
    from public.album_projects where entry_id = p_entry order by updated_at desc limit 1;
  select coalesce(title,'Album') into v_label from public.calendar_entries where id = p_entry;
  v_pages := coalesce(v_proj.pages, 0);

  select id into v_id from public.album_orders
    where album_project_id = v_proj.id and status in ('NEW','ON_HOLD','REJECTED')
    order by created_at desc limit 1;
  if v_id is not null then
    update public.album_orders set
      cover     = coalesce(p_cover, cover),
      copies    = case when p_copies is null then copies else greatest(1, p_copies) end,
      pages     = v_pages,
      notes     = coalesce(p_notes, notes),
      file_link = coalesce(p_file_link, file_link),
      share_token = coalesce(share_token, gen_random_uuid())
      where id = v_id returning share_token into v_token;
  else
    insert into public.album_orders(entry_id, album_project_id, photographer_id, couple_label,
      format_key, pages, copies, cover, notes, file_link, share_token)
      values (p_entry, v_proj.id, v_owner, v_label,
        coalesce(v_proj.format_key,'SQ_30'), v_pages, greatest(1, coalesce(p_copies,1)),
        coalesce(p_cover,'{}'::jsonb), p_notes, p_file_link, gen_random_uuid())
      returning share_token into v_token;
  end if;
  return jsonb_build_object('ok', true, 'token', v_token, 'order_id', v_id);
end$$;
grant execute on function public.album_commission_share(uuid, jsonb, int, text, text) to authenticated;
