-- Nota del fotografo alla coppia quando segna l'album come FINALE (es. "ho aggiunto delle pagine",
-- "ho scelto il formato verticale perché si presta meglio"). Mostrata nell'email di consegna e
-- nell'album lato coppia.
alter table public.album_projects add column if not exists final_note text;

-- Il fotografo (album_can_edit) imposta la nota prima di segnare finale.
create or replace function public.album_set_final_note(p_entry uuid, p_note text)
returns jsonb language plpgsql volatile security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return jsonb_build_object('error', 'unauthorized'); end if;
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  update public.album_projects set final_note = nullif(btrim(p_note), '') where entry_id = p_entry;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.album_set_final_note(uuid, text) to authenticated;
