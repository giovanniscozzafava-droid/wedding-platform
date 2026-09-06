-- ============================================================================
-- Secondo bug reale trovato oggi girando il video tutorial: gallery_get_by_token
-- non ha MAI restituito il campo in_pool che il frontend usa per popolare la
-- coda di swipe (GallerySwipePage.tsx filtra su `m.in_pool && m.decision==null`).
-- La query unisce già _gallery_pool(...) per selezionare le foto — quindi ogni
-- riga restituita è, per costruzione, nel pool del giro corrente: basta
-- dichiararlo nel JSON. Bug pre-esistente, non introdotto dal fix blind di oggi
-- (20260906010000) — qui riprendo la stessa funzione aggiungendo solo il campo.
-- ============================================================================

create or replace function public.gallery_get_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_g record; v_p record; v_email text; v_date date; v_sel public.gallery_selection;
  v_media jsonb; v_pool_n int; v_decided_n int; v_kept_n int; v_total int;
  v_quote_id uuid; v_owner_id uuid; v_mode text; v_is_blind boolean := false;
begin
  if p_token is null then return jsonb_build_object('error', 'no_token'); end if;
  select * into v_g from public.event_galleries where share_token = p_token limit 1;
  if v_g.id is null then return jsonb_build_object('error', 'not_found'); end if;
  if v_g.share_expires_at is not null and v_g.share_expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;

  select ce.quote_id into v_quote_id from public.calendar_entries ce where ce.id = v_g.entry_id;
  if v_quote_id is not null then
    select owner_id into v_owner_id from public.quotes where id = v_quote_id;
    select coalesce(capostipite_sale_mode,'BUNDLE') into v_mode from public.profiles where id = v_owner_id;
    if v_owner_id is distinct from v_g.owner_id then
      select exists(
        select 1 from public.quote_items qi
         where qi.quote_id = v_quote_id
           and qi.supplier_id = v_g.owner_id
           and public.quote_item_is_blind(qi, v_mode)
      ) into v_is_blind;
    end if;
  end if;

  if v_is_blind then
    select business_name, full_name, brand_logo_url, brand_primary_color into v_p from public.profiles where id = v_owner_id;
    select email into v_email from auth.users where id = v_owner_id;
  else
    select business_name, full_name, brand_logo_url, brand_primary_color into v_p from public.profiles where id = v_g.owner_id;
    select email into v_email from auth.users where id = v_g.owner_id;
  end if;

  select coalesce(ceremony_date, date_from) into v_date from public.calendar_entries where id = v_g.entry_id;
  v_sel := public._gallery_ensure_selection(v_g.id, v_g.entry_id);

  select count(*) into v_total from public._gallery_base_media(v_g.id);
  select count(*) into v_pool_n from public._gallery_pool(v_g.id, v_sel.round);
  select count(*) into v_decided_n from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round;
  select count(*) into v_kept_n from public.gallery_selection_decisions where gallery_id = v_g.id and round = v_sel.round and keep;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', gm.id, 'drive_file_id', gm.drive_file_id, 'thumbnail_link', gm.thumbnail_link,
           'media_type', gm.media_type, 'album_moment', gm.album_moment, 'source_name', gm.source_name,
           'decision', d.keep, 'in_pool', true) order by gm.album_moment nulls last, gm.created_at), '[]'::jsonb)
    into v_media
  from public.gallery_media gm
  join public._gallery_pool(v_g.id, v_sel.round) p on p.media_id = gm.id
  left join public.gallery_selection_decisions d on d.gallery_id = v_g.id and d.media_id = gm.id and d.round = v_sel.round;

  return jsonb_build_object(
    'ok', true,
    'gallery', jsonb_build_object(
      'title', v_g.title, 'couple_label', v_g.couple_label, 'kind', v_g.kind,
      'event_date', v_date, 'expires_at', v_g.share_expires_at),
    'photographer', jsonb_build_object(
      'business_name', v_p.business_name, 'full_name', v_p.full_name, 'email', v_email,
      'logo', v_p.brand_logo_url, 'color', v_p.brand_primary_color),
    'selection', jsonb_build_object(
      'round', v_sel.round, 'status', v_sel.status, 'target_min', v_sel.target_min, 'target_max', v_sel.target_max,
      'total', v_total, 'pool', v_pool_n, 'decided', v_decided_n, 'kept', v_kept_n,
      'submitted_at', v_sel.submitted_at),
    'media', v_media);
end$$;
