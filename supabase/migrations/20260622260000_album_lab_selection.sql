-- La stamperia (FotoLab) apre la SELEZIONE foto di un ordine: anteprime cliccabili. Gate lab.
create or replace function public.album_lab_selection(p_entry uuid)
returns table (drive_file_id text, thumbnail_link text, media_type text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and (is_album_lab or role::text in ('FOTOLAB','ADMIN'))) then
    return;
  end if;
  return query
    select m.drive_file_id, m.thumbnail_link, m.media_type
    from public.gallery_media m
    where m.entry_id = p_entry and m.album_choice = 'KEPT'
    order by m.media_type, m.drive_file_id;
end$$;
grant execute on function public.album_lab_selection(uuid) to authenticated;

-- album_lab_list: aggiungo il conteggio foto selezionate (per il bottone "Vedi selezione (N)")
drop function if exists public.album_lab_list();
create function public.album_lab_list()
returns table (id uuid, entry_id uuid, couple_label text, photographer text, format_key text, pages int, copies int, cover jsonb, status text, queue_order int, reject_reason text, created_at timestamptz, selection_count int)
language sql stable security invoker set search_path = public as $$
  select o.id, o.entry_id, o.couple_label, coalesce(p.business_name, p.full_name, 'Fotografo'), o.format_key, o.pages, o.copies, o.cover, o.status, o.queue_order, o.reject_reason, o.created_at,
    (select count(*) from public.gallery_media gm where gm.entry_id = o.entry_id and gm.album_choice = 'KEPT')::int
  from public.album_orders o left join public.profiles p on p.id = o.photographer_id
  order by case o.status when 'NEW' then 0 when 'ACCEPTED' then 1 when 'IN_PRODUCTION' then 2 when 'ON_HOLD' then 3 when 'SHIPPED' then 4 else 5 end, o.queue_order, o.created_at;
$$;
grant execute on function public.album_lab_list() to authenticated;
