-- "Seleziona tutti i cuori" ATOMICO: un solo update invece di N RPC in parallelo (che potevano
-- fallire a metà → like persi). + rimozione della funzione diagnostica temporanea.
create or replace function public.album_set_choices(p_ids uuid[], p_choice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid; v_ok int := 0;
begin
  if p_choice is not null and p_choice not in ('KEPT', 'DISCARDED') then return jsonb_build_object('error', 'bad_choice'); end if;
  for v_entry in select distinct entry_id from public.gallery_media where id = any(p_ids) loop
    if not public.album_can_edit(v_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  end loop;
  update public.gallery_media set album_choice = p_choice where id = any(p_ids);
  get diagnostics v_ok = row_count;
  return jsonb_build_object('ok', true, 'updated', v_ok);
end$$;
grant execute on function public.album_set_choices(uuid[], text) to authenticated;

drop function if exists public._diag_album_counts(uuid);
