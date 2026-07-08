-- La pagina commissione (link con le tavole) mostra anche la SCELTA DEL CLIENTE fatta nel picker
-- (modello + materiali/colori/logo/foto + box/finiture + prezzo, nella nota). La commessa firmata
-- dal cliente è un album_orders con cover->>'source' = 'pdf_catalog': la agganciamo per entry_id.
create or replace function public.album_commission_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_o record; v_p record; v_email text; v_sel int; v_date date; v_choice jsonb;
begin
  if p_token is null then return jsonb_build_object('error', 'no_token'); end if;
  select * into v_o from public.album_orders where share_token = p_token limit 1;
  if v_o.id is null then return jsonb_build_object('error', 'not_found'); end if;
  select business_name, full_name, phone, brand_logo_url, brand_primary_color into v_p
    from public.profiles where id = v_o.photographer_id;
  select email into v_email from auth.users where id = v_o.photographer_id;
  select coalesce(count(*), 0) into v_sel from public.gallery_media
    where entry_id = v_o.entry_id and album_choice = 'KEPT' and media_type = 'PHOTO';
  select coalesce(ceremony_date, date_from) into v_date from public.calendar_entries where id = v_o.entry_id;
  -- scelta del cliente: l'ultima commessa firmata dal picker per questo evento
  select cover into v_choice from public.album_orders
    where entry_id = v_o.entry_id and cover->>'source' = 'pdf_catalog'
    order by created_at desc limit 1;

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'format_key', v_o.format_key, 'pages', v_o.pages, 'copies', v_o.copies, 'cover', v_o.cover,
      'couple_label', v_o.couple_label, 'notes', v_o.notes, 'file_link', v_o.file_link,
      'status', v_o.status, 'created_at', v_o.created_at),
    'photographer', jsonb_build_object(
      'business_name', v_p.business_name, 'full_name', v_p.full_name, 'phone', v_p.phone,
      'email', v_email, 'logo', v_p.brand_logo_url, 'color', v_p.brand_primary_color),
    'selection_count', v_sel,
    'event_date', v_date,
    'client_choice', v_choice);
end$$;
grant execute on function public.album_commission_by_token(uuid) to anon, authenticated;
