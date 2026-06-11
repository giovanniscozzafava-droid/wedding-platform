-- Social sulle foto dell'evento: like + commenti (restano nell'app) e auguri VOCALI
-- agli sposi. Accesso "puoi interagire se puoi vedere il media/evento" (riusa gm_read /
-- le porte foto): i subquery su gallery_media/calendar sono soggetti alla loro RLS.

-- ── LIKE ────────────────────────────────────────────────────────────────────
create table if not exists public.gallery_media_likes (
  media_id uuid not null references public.gallery_media(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (media_id, user_id)
);
alter table public.gallery_media_likes enable row level security;
drop policy if exists ml_read on public.gallery_media_likes;
create policy ml_read on public.gallery_media_likes for select
  using (exists (select 1 from public.gallery_media gm where gm.id = gallery_media_likes.media_id));
drop policy if exists ml_write on public.gallery_media_likes;
create policy ml_write on public.gallery_media_likes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.gallery_media gm where gm.id = gallery_media_likes.media_id));

-- ── COMMENTI ────────────────────────────────────────────────────────────────
create table if not exists public.gallery_media_comments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.gallery_media(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.gallery_media_comments enable row level security;
drop policy if exists mc_read on public.gallery_media_comments;
create policy mc_read on public.gallery_media_comments for select
  using (exists (select 1 from public.gallery_media gm where gm.id = gallery_media_comments.media_id));
drop policy if exists mc_insert on public.gallery_media_comments;
create policy mc_insert on public.gallery_media_comments for insert
  with check (user_id = auth.uid() and char_length(btrim(body)) between 1 and 1000
              and exists (select 1 from public.gallery_media gm where gm.id = gallery_media_comments.media_id));
drop policy if exists mc_delete on public.gallery_media_comments;
create policy mc_delete on public.gallery_media_comments for delete
  using (user_id = auth.uid() or public.is_admin()
         or exists (select 1 from public.gallery_media gm join public.event_galleries g on g.id = gm.gallery_id
                    where gm.id = gallery_media_comments.media_id and g.owner_id = auth.uid()));

-- autore = SOLO primo nome (server-side, anti-spoof)
create or replace function public._set_comment_author() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce(
    (select split_part(gg.full_name_searched, ' ', 1) from public.gallery_guests gg
       join public.gallery_media gm on gm.entry_id = gg.entry_id
      where gm.id = new.media_id and gg.guest_user_id = auth.uid() limit 1),
    (select split_part(full_name, ' ', 1) from public.profiles where id = auth.uid()),
    'Un invitato');
  return new;
end$$;
drop trigger if exists trg_comment_author on public.gallery_media_comments;
create trigger trg_comment_author before insert on public.gallery_media_comments
  for each row execute function public._set_comment_author();

-- ── AUGURI VOCALI ───────────────────────────────────────────────────────────
create table if not exists public.event_audio_wishes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.calendar_entries(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  author_name text,
  storage_path text not null,
  created_at timestamptz not null default now()
);
alter table public.event_audio_wishes enable row level security;
drop policy if exists aw_read on public.event_audio_wishes;
create policy aw_read on public.event_audio_wishes for select using (
  public.is_wedding_couple(entry_id) or public._photo_circle_member(entry_id)
  or public._photo_is_guest(entry_id) or public.is_admin()
);
drop policy if exists aw_insert on public.event_audio_wishes;
create policy aw_insert on public.event_audio_wishes for insert with check (
  user_id = auth.uid() and (public._photo_is_guest(entry_id) or public._photo_circle_member(entry_id) or public.is_wedding_couple(entry_id))
);
drop policy if exists aw_delete on public.event_audio_wishes;
create policy aw_delete on public.event_audio_wishes for delete using (
  user_id = auth.uid() or public.is_admin()
  or exists (select 1 from public.event_galleries g where g.entry_id = event_audio_wishes.entry_id and g.owner_id = auth.uid())
);
create or replace function public._set_wish_author() returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.author_name := coalesce(
    (select split_part(gg.full_name_searched, ' ', 1) from public.gallery_guests gg
      where gg.entry_id = new.entry_id and gg.guest_user_id = auth.uid() limit 1),
    (select split_part(full_name, ' ', 1) from public.profiles where id = auth.uid()),
    'Un invitato');
  return new;
end$$;
drop trigger if exists trg_wish_author on public.event_audio_wishes;
create trigger trg_wish_author before insert on public.event_audio_wishes
  for each row execute function public._set_wish_author();
