-- IMPORT iCal: il professionista incolla l'URL .ics del suo calendario (Google/Apple/Outlook…);
-- Planfully scarica il feed, crea blocchi "occupato" (source=ICAL) sulle date, ri-sincronizza e
-- ripulisce gli eventi rimossi. Non tocca gli eventi creati a mano (source='MANUAL').

create table if not exists public.user_ical_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  label text,
  last_synced_at timestamptz,
  last_status text,       -- 'ok' | 'error:...'
  last_count int,         -- eventi importati all'ultima sync
  created_at timestamptz not null default now(),
  unique (user_id, url)
);
alter table public.user_ical_feeds enable row level security;
drop policy if exists ical_feeds_own on public.user_ical_feeds;
create policy ical_feeds_own on public.user_ical_feeds
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Sorgente e chiavi esterne sugli eventi calendario (per riconoscere/ripulire gli import iCal).
alter table public.calendar_entries
  add column if not exists source text not null default 'MANUAL',   -- MANUAL | ICAL
  add column if not exists ical_feed_id uuid references public.user_ical_feeds(id) on delete cascade,
  add column if not exists external_uid text;

-- Un evento iCal e' identificato in modo univoco da (feed, UID): upsert idempotente + prune.
create unique index if not exists calendar_entries_ical_uid
  on public.calendar_entries (ical_feed_id, external_uid)
  where ical_feed_id is not null;
