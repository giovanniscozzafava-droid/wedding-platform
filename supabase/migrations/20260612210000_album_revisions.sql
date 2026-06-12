-- Richieste di modifica all'album: il cliente (coppia) scrive cosa cambiare; il
-- fotografo le vede e le segna come fatte. Visibili a chi può lavorare all'album.
create table if not exists public.album_revision_requests (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.calendar_entries(id) on delete cascade,
  user_id     uuid not null default auth.uid(),
  author_name text,
  page_index  int,                              -- pagina di riferimento (1-based), opzionale
  body        text not null,
  status      text not null default 'OPEN',     -- OPEN | DONE
  created_at  timestamptz not null default now()
);
create index if not exists idx_album_rev_entry on public.album_revision_requests(entry_id, status, created_at desc);
alter table public.album_revision_requests enable row level security;

drop policy if exists arr_rw on public.album_revision_requests;
create policy arr_rw on public.album_revision_requests for all
  using (public.album_can_edit(entry_id))
  with check (public.album_can_edit(entry_id) and (user_id = auth.uid() or public.album_can_edit(entry_id)));

-- autore = nome di chi scrive (coppia o professionista)
create or replace function public._set_album_rev_author() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce(
    (select split_part(full_name_searched, ' ', 1) from public.gallery_guests where entry_id = new.entry_id and guest_user_id = auth.uid() limit 1),
    (select coalesce(nullif(business_name,''), full_name) from public.profiles where id = auth.uid()),
    'Cliente');
  return new;
end$$;
drop trigger if exists trg_set_album_rev_author on public.album_revision_requests;
create trigger trg_set_album_rev_author before insert on public.album_revision_requests
  for each row execute function public._set_album_rev_author();

-- notifica il fotografo (owner della galleria) quando arriva una richiesta
create or replace function public._notify_album_rev() returns trigger language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  select owner_id into v_owner from public.event_galleries where entry_id = new.entry_id limit 1;
  if v_owner is not null and v_owner <> new.user_id then
    perform public.push_user_notification(v_owner, 'album_revision', 'Richiesta di modifica all''album',
      coalesce(new.author_name, 'Il cliente') || ' ha chiesto una modifica' || coalesce(' (pag. ' || new.page_index || ')', ''),
      '/album/' || new.entry_id, new.entry_id);
  end if;
  return new;
end$$;
drop trigger if exists trg_notify_album_rev on public.album_revision_requests;
create trigger trg_notify_album_rev after insert on public.album_revision_requests
  for each row execute function public._notify_album_rev();
