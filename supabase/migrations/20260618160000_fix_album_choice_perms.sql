-- FIX "perde i like": la selezione cuori (album_choice) si salvava SOLO se l'utente era la coppia
-- o admin. Il FOTOGRAFO (proprietario galleria), che pure può editare tutto l'album
-- (album_can_edit), riceveva 'forbidden' silenzioso → l'optimistic update mostrava il cuore ma il
-- DB non lo salvava → al reload spariva. Allineiamo i permessi ad album_can_edit (coppia O
-- fotografo proprietario O admin), coerente con album_set_moments / album_project_save.
create or replace function public.set_album_choice(p_media uuid, p_choice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid;
begin
  select entry_id into v_entry from public.gallery_media where id = p_media;
  if v_entry is null then return jsonb_build_object('error', 'not_found'); end if;
  if not public.album_can_edit(v_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_choice is not null and p_choice not in ('KEPT', 'DISCARDED') then
    return jsonb_build_object('error', 'bad_choice');
  end if;
  update public.gallery_media set album_choice = p_choice where id = p_media;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.set_album_choice(uuid, text) to authenticated;
