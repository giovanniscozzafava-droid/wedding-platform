-- Set pick_photographer su un ELENCO di foto (owner-only). Usato da "seleziona liked" e dalla
-- cura AI (che riduce la selezione del fotografo). La selezione degli sposi non è toccata.
create or replace function public.photographer_set_picks(p_ids uuid[], p_pick boolean)
returns integer language plpgsql security definer set search_path = public as $$
declare v_bad int; v_n int;
begin
  if p_ids is null or array_length(p_ids, 1) is null then return 0; end if;
  -- rifiuta se anche una sola foto non è di una galleria dell'utente (o admin)
  select count(*) into v_bad
    from public.gallery_media m join public.event_galleries g on g.id = m.gallery_id
   where m.id = any(p_ids) and g.owner_id <> auth.uid();
  if v_bad > 0 and not public.is_admin() then raise exception 'forbidden'; end if;
  update public.gallery_media set pick_photographer = coalesce(p_pick, false) where id = any(p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end$$;
revoke all on function public.photographer_set_picks(uuid[], boolean) from public, anon;
grant execute on function public.photographer_set_picks(uuid[], boolean) to authenticated;
