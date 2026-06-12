-- ============================================================================
-- Ospiti: catalogazione foto (tag multipli + niente minori) e GUESTBOOK
-- (firma + messaggio). Audio e guestbook diventano categorie a sé.
-- ============================================================================

-- Catalogazione delle foto caricate dagli ospiti: serviranno ai professionisti.
alter table public.gallery_media add column if not exists guest_tags text[] not null default '{}';
alter table public.gallery_media add column if not exists no_minors  boolean not null default false;
create index if not exists idx_gallery_media_guest_tags on public.gallery_media using gin (guest_tags);

-- guest_add_media v2: accetta tag e dichiarazione "nessun minore".
create or replace function public.guest_add_media(
  p_entry uuid, p_storage_path text, p_thumb text, p_media_type text, p_promo boolean,
  p_tags text[], p_no_minors boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_gal uuid; v_folder uuid; v_name text;
begin
  if not public._photo_is_guest(p_entry) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_promo is not true then return jsonb_build_object('error', 'consent_required'); end if;
  select id into v_gal from public.event_galleries where entry_id = p_entry;
  if v_gal is null then return jsonb_build_object('error', 'no_gallery'); end if;
  select id into v_folder from public.gallery_folders
    where gallery_id = v_gal and level = 'INVITATI' and name = 'Foto & video degli ospiti' limit 1;
  if v_folder is null then
    insert into public.gallery_folders(gallery_id, entry_id, name, level, sort_order)
      values (v_gal, p_entry, 'Foto & video degli ospiti', 'INVITATI',
              coalesce((select max(sort_order) + 1 from public.gallery_folders where gallery_id = v_gal), 0))
      returning id into v_folder;
  end if;
  select coalesce(nullif(split_part(coalesce(
            (select full_name_searched from public.gallery_guests where entry_id = p_entry and guest_user_id = auth.uid()),
            (select full_name from public.profiles where id = auth.uid()), ''), ' ', 1), ''), 'Un invitato')
    into v_name;
  insert into public.gallery_media(folder_id, gallery_id, entry_id, drive_file_id, thumbnail_link, media_type,
                                   uploaded_by, promo_consent, uploader_name, guest_tags, no_minors)
    values (v_folder, v_gal, p_entry, 'guest:' || p_storage_path, p_thumb,
            (case when p_media_type = 'VIDEO' then 'VIDEO' else 'PHOTO' end)::public.gallery_media_type,
            auth.uid(), true, v_name, coalesce(p_tags, '{}'), coalesce(p_no_minors, false));
  return jsonb_build_object('ok', true);
end$$;
grant execute on function public.guest_add_media(uuid, text, text, text, boolean, text[], boolean) to authenticated;

-- ── GUESTBOOK: firma + messaggio degli ospiti ──────────────────────────────
create table if not exists public.event_guestbook (
  id             uuid primary key default gen_random_uuid(),
  entry_id       uuid not null references public.calendar_entries(id) on delete cascade,
  user_id        uuid not null default auth.uid(),
  author_name    text,
  message        text,
  signature_path text,            -- immagine firma in event-guest-uploads
  created_at     timestamptz not null default now()
);
create index if not exists idx_guestbook_entry on public.event_guestbook(entry_id, created_at desc);
alter table public.event_guestbook enable row level security;

-- lettura: sposi, cerchio, ospiti, owner galleria/evento, admin
drop policy if exists gb_read on public.event_guestbook;
create policy gb_read on public.event_guestbook for select using (
  public.is_wedding_couple(entry_id) or public._photo_circle_member(entry_id)
  or public._photo_is_guest(entry_id) or public.is_admin()
  or exists (select 1 from public.event_galleries g where g.entry_id = event_guestbook.entry_id and g.owner_id = auth.uid())
  or exists (select 1 from public.calendar_entries ce where ce.id = event_guestbook.entry_id and ce.owner_id = auth.uid())
);
-- scrittura: solo ospite/cerchio/coppia autenticati, per la propria riga
drop policy if exists gb_insert on public.event_guestbook;
create policy gb_insert on public.event_guestbook for insert with check (
  user_id = auth.uid() and (public._photo_is_guest(entry_id) or public._photo_circle_member(entry_id) or public.is_wedding_couple(entry_id))
);
drop policy if exists gb_delete on public.event_guestbook;
create policy gb_delete on public.event_guestbook for delete using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.event_galleries g where g.entry_id = event_guestbook.entry_id and g.owner_id = auth.uid())
);

-- autore = primo nome dell'ospite (denormalizzato)
create or replace function public._set_guestbook_author() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce(
    (select split_part(gg.full_name_searched, ' ', 1) from public.gallery_guests gg where gg.entry_id = new.entry_id and gg.guest_user_id = auth.uid() limit 1),
    (select split_part(full_name, ' ', 1) from public.profiles where id = auth.uid()),
    'Un invitato');
  return new;
end$$;
drop trigger if exists trg_set_guestbook_author on public.event_guestbook;
create trigger trg_set_guestbook_author before insert on public.event_guestbook
  for each row execute function public._set_guestbook_author();

-- notifica gli sposi quando arriva una firma/messaggio
create or replace function public._notify_guestbook() returns trigger language plpgsql security definer set search_path = public as $$
declare m record;
begin
  for m in select user_id from public.wedding_couple_members where entry_id = new.entry_id and user_id is not null and user_id <> new.user_id loop
    perform public.push_user_notification(m.user_id, 'guestbook', 'Nuovo messaggio nel guestbook',
      coalesce(new.author_name, 'Un invitato') || ' ha lasciato un pensiero', '/couple', new.entry_id);
  end loop;
  return new;
end$$;
drop trigger if exists trg_notify_guestbook on public.event_guestbook;
create trigger trg_notify_guestbook after insert on public.event_guestbook
  for each row execute function public._notify_guestbook();
