-- ════════════════════════════════════════════════════════════════════════════
-- LINK "COPIA COMMISSIONE" per la STAMPA (anche non utente Planfully).
-- L'ordine album (album_orders) diventa una pagina pubblica a token: la stampa apre il
-- link e vede la scheda commissione (formato, pagine, copie, copertina, box, rifiniture,
-- selezione clienti, contatti fotografo, link ai file). Evita wetransfer + email.
-- I dati sono AUTO-IMPORTATI dall'impaginato (album_projects) + copertina + selezione.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.album_orders add column if not exists share_token uuid unique;
alter table public.album_orders add column if not exists file_link text;   -- Drive/WeTransfer/galleria (opz.)

-- Genera/aggiorna la commissione condivisibile e restituisce il TOKEN. Solo chi può editare l'album.
create or replace function public.album_commission_share(
  p_entry uuid, p_cover jsonb, p_copies int default 1, p_notes text default null, p_file_link text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_proj record; v_label text; v_pages int; v_id uuid; v_token uuid;
begin
  if not public.album_can_edit(p_entry) then return jsonb_build_object('error','forbidden'); end if;
  select owner_id into v_owner from public.event_galleries where entry_id = p_entry limit 1;
  v_owner := coalesce(v_owner, auth.uid());
  select id, format_key, coalesce(jsonb_array_length(layout->'pages'),0) as pages into v_proj
    from public.album_projects where entry_id = p_entry order by updated_at desc limit 1;
  select coalesce(title,'Album') into v_label from public.calendar_entries where id = p_entry;
  v_pages := coalesce(v_proj.pages, 0);

  select id into v_id from public.album_orders
    where album_project_id = v_proj.id and status in ('NEW','ON_HOLD','REJECTED')
    order by created_at desc limit 1;
  if v_id is not null then
    update public.album_orders set
      cover = coalesce(p_cover, cover), copies = greatest(1, coalesce(p_copies, 1)), pages = v_pages,
      notes = coalesce(p_notes, notes), file_link = coalesce(p_file_link, file_link),
      share_token = coalesce(share_token, gen_random_uuid())
      where id = v_id returning share_token into v_token;
  else
    insert into public.album_orders(entry_id, album_project_id, photographer_id, couple_label,
      format_key, pages, copies, cover, notes, file_link, share_token)
      values (p_entry, v_proj.id, v_owner, v_label,
        coalesce(v_proj.format_key,'SQ_30'), v_pages, greatest(1, coalesce(p_copies,1)),
        coalesce(p_cover,'{}'::jsonb), p_notes, p_file_link, gen_random_uuid())
      returning id, share_token into v_id, v_token;
  end if;
  return jsonb_build_object('ok', true, 'token', v_token, 'order_id', v_id);
end$$;
grant execute on function public.album_commission_share(uuid, jsonb, int, text, text) to authenticated;

-- PUBBLICA: legge la commissione dal token (nessun login). Ritorna solo dati di produzione + contatti.
create or replace function public.album_commission_by_token(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_o record; v_p record; v_email text; v_sel int; v_date date;
begin
  if p_token is null then return jsonb_build_object('error','no_token'); end if;
  select * into v_o from public.album_orders where share_token = p_token limit 1;
  if v_o.id is null then return jsonb_build_object('error','not_found'); end if;
  select business_name, full_name, phone, brand_logo_url, brand_primary_color into v_p
    from public.profiles where id = v_o.photographer_id;
  select email into v_email from auth.users where id = v_o.photographer_id;
  select coalesce(count(*),0) into v_sel from public.gallery_media
    where entry_id = v_o.entry_id and album_choice = 'KEPT' and media_type = 'PHOTO';
  select coalesce(ceremony_date, date_from) into v_date from public.calendar_entries where id = v_o.entry_id;
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
    'event_date', v_date
  );
end$$;
grant execute on function public.album_commission_by_token(uuid) to anon, authenticated;
