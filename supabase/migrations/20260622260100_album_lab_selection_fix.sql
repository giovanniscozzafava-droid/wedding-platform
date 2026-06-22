-- fix: gallery_media.media_type è un enum (gallery_media_type) → cast a text per il returns table
create or replace function public.album_lab_selection(p_entry uuid)
returns table (drive_file_id text, thumbnail_link text, media_type text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and (is_album_lab or role::text in ('FOTOLAB','ADMIN'))) then
    return;
  end if;
  return query
    select m.drive_file_id, m.thumbnail_link, m.media_type::text
    from public.gallery_media m
    where m.entry_id = p_entry and m.album_choice = 'KEPT'
    order by m.media_type::text, m.drive_file_id;
end$$;
grant execute on function public.album_lab_selection(uuid) to authenticated;
