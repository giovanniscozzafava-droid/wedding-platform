-- La SELEZIONE ALBUM del fotografo è il suo cuore (pick_photographer), unico e coerente tra
-- galleria, swipe da telefono e impaginatore. Qui le azioni in blocco (owner-only):
--   photographer_set_all      = seleziona/deseleziona TUTTE le foto dell'evento
--   photographer_adopt_couple = "parti dalla selezione degli sposi": pick_photographer := pick_couple
-- La selezione degli sposi (pick_couple) NON viene mai toccata: resta protetta e distinta.

create or replace function public.photographer_set_all(p_entry uuid, p_pick boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_n int;
begin
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  update public.gallery_media set pick_photographer = coalesce(p_pick, false)
   where entry_id = p_entry and media_type = 'PHOTO';
  get diagnostics v_n = row_count;
  return v_n;
end$$;
revoke all on function public.photographer_set_all(uuid, boolean) from public, anon;
grant execute on function public.photographer_set_all(uuid, boolean) to authenticated;

create or replace function public.photographer_adopt_couple(p_entry uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_n int;
begin
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  if v_owner is null then raise exception 'not_found'; end if;
  if v_owner <> auth.uid() and not public.is_admin() then raise exception 'forbidden'; end if;
  update public.gallery_media set pick_photographer = coalesce(pick_couple, false)
   where entry_id = p_entry and media_type = 'PHOTO';
  select count(*) into v_n from public.gallery_media where entry_id = p_entry and pick_photographer;
  return v_n;
end$$;
revoke all on function public.photographer_adopt_couple(uuid) from public, anon;
grant execute on function public.photographer_adopt_couple(uuid) to authenticated;
