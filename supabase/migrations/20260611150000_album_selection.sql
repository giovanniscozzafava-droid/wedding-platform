-- Selezione foto/video per l'album in stile "Tinder": gli sposi tengono o scartano
-- una alla volta, e possono SEMPRE recuperare gli scarti (album_choice torna a NULL).
-- La scelta è column-safe via RPC: gli sposi non toccano altri campi della media.
alter table public.gallery_media
  add column if not exists album_choice text check (album_choice in ('KEPT','DISCARDED'));

create or replace function public.set_album_choice(p_media uuid, p_choice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_entry uuid;
begin
  select entry_id into v_entry from public.gallery_media where id = p_media;
  if v_entry is null then return jsonb_build_object('error', 'not_found'); end if;
  if not (public.is_wedding_couple(v_entry) or public.is_admin()) then
    return jsonb_build_object('error', 'forbidden');
  end if;
  if p_choice is not null and p_choice not in ('KEPT', 'DISCARDED') then
    return jsonb_build_object('error', 'bad_choice');
  end if;
  update public.gallery_media set album_choice = p_choice where id = p_media;
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.set_album_choice(uuid, text) to authenticated;
