-- 1) source_name su gallery_media: salviamo il NOME del file caricato. Serve a impedire i
--    doppioni in modo definitivo (dedup per nome anche senza interrogare Drive) e a contare.
alter table public.gallery_media add column if not exists source_name text;
create index if not exists idx_gallery_media_folder_name on public.gallery_media(folder_id, source_name);

-- 2) Conteggio "mi piace" per foto di un evento. SECURITY DEFINER ma gated: solo chi può
--    vedere la galleria (cerchio dell'evento / proprietario / admin) ottiene i numeri.
create or replace function public.gallery_like_counts(p_entry uuid)
returns table(media_id uuid, n int)
language sql stable security definer set search_path = public as $$
  select l.media_id, count(*)::int
  from public.gallery_media_likes l
  join public.gallery_media gm on gm.id = l.media_id
  where gm.entry_id = p_entry
    and (
      public._photo_circle_member(p_entry)
      or public.is_admin()
      or exists (select 1 from public.event_galleries g where g.entry_id = p_entry and g.owner_id = auth.uid())
    )
  group by l.media_id;
$$;
grant execute on function public.gallery_like_counts(uuid) to authenticated;
