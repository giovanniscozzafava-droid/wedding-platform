-- FASE 2 preventivatore album lato cliente: la coppia legge i COMPONENTI di vendita del fotografo
-- (copertine, accessori, spedizione) e il RESIDUO del preventivo (totale − pagato) per calcolare la
-- "rimanenza alla consegna". Solo le voci di VENDITA (niente costi interni). Couple/owner/admin.
create or replace function public.album_listino_for_entry(p_entry uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_cfg jsonb; v_qid uuid; v_total numeric; v_paid numeric;
begin
  if not (public.is_admin() or public.is_wedding_couple(p_entry)
     or exists (select 1 from public.calendar_entries ce where ce.id = p_entry and ce.owner_id = auth.uid())
     or exists (select 1 from public.event_galleries g where g.entry_id = p_entry and g.owner_id = auth.uid()))
  then return jsonb_build_object('error', 'forbidden'); end if;

  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  if v_owner is null then select owner_id into v_owner from public.calendar_entries where id = p_entry limit 1; end if;
  if v_owner is not null then select config into v_cfg from public.album_price_settings where owner_id = v_owner; end if;

  -- residuo del preventivo dell'evento
  select quote_id into v_qid from public.calendar_entries where id = p_entry;
  if v_qid is not null then
    select total_client into v_total from public.quotes where id = v_qid;
    select coalesce(sum(paid_amount), 0) into v_paid from public.quote_items where quote_id = v_qid;
  end if;

  return jsonb_build_object(
    'covers', coalesce(v_cfg -> 'covers', '[]'::jsonb),
    'accessories', coalesce(v_cfg -> 'accessories', '[]'::jsonb),
    'shipping', coalesce((v_cfg ->> 'shipping')::numeric, 0),
    'use_design_album', coalesce((v_cfg ->> 'useDesignAlbum')::boolean, true),
    'quote_total', coalesce(v_total, 0),
    'quote_paid', coalesce(v_paid, 0)
  );
end$$;
grant execute on function public.album_listino_for_entry(uuid) to authenticated;
