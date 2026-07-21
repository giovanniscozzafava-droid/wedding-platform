-- FIX funnel album coppia ("Il tuo album"): lo step 1 "Scegli le tue foto" risultava NON fatto se la
-- coppia aveva scelto con la SELEZIONE SWIPE (gallery_selection SUBMITTED / album_choice=KEPT) invece
-- dei cuori. Ora è considerato fatto anche quando la selezione è chiusa (dalla coppia o coattamente).
create or replace function public.album_photos_chosen(p_entry uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.is_admin() or public.is_wedding_couple(p_entry)
    or exists (select 1 from public.calendar_entries ce where ce.id = p_entry and ce.owner_id = auth.uid())
    or exists (select 1 from public.event_galleries g where g.entry_id = p_entry and g.owner_id = auth.uid())) then
    return false;
  end if;
  return exists (
    select 1 from public.event_galleries g
    join public.gallery_selection s on s.gallery_id = g.id
    where g.entry_id = p_entry and s.status = 'SUBMITTED'
  );
end$$;
grant execute on function public.album_photos_chosen(uuid) to authenticated;
