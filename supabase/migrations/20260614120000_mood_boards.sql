-- ============================================================================
-- MOOD BOARD CANVAS — un "mini Canva" per la moodboard del cliente.
-- Una tela libera per evento (entry): immagini, testi, forme, icone, ghirigori.
-- Modificabile da: organizzatore (owner del calendar_entry), coppia, admin.
-- Il contenuto della tela è un JSON (elementi liberi) → versionabile lato app.
-- ============================================================================

create table if not exists mood_boards (
  entry_id   uuid primary key references calendar_entries(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table mood_boards enable row level security;

-- updated_at automatico
create or replace function public.touch_mood_boards()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_touch_mood_boards on mood_boards;
create trigger trg_touch_mood_boards before update on mood_boards
  for each row execute function public.touch_mood_boards();

-- Owner del calendar_entry (WP/Location/fotografo proprietario) → tutto
drop policy if exists "mood_boards_owner" on mood_boards;
create policy "mood_boards_owner" on mood_boards for all using (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
) with check (
  exists (select 1 from calendar_entries ce where ce.id = entry_id and ce.owner_id = auth.uid())
);

-- Coppia linkata all'evento → tutto (è il loro moodboard)
drop policy if exists "mood_boards_couple" on mood_boards;
create policy "mood_boards_couple" on mood_boards for all using (
  exists (select 1 from wedding_couple_members wcm where wcm.entry_id = mood_boards.entry_id and wcm.user_id = auth.uid())
) with check (
  exists (select 1 from wedding_couple_members wcm where wcm.entry_id = mood_boards.entry_id and wcm.user_id = auth.uid())
);

-- Admin → tutto
drop policy if exists "mood_boards_admin" on mood_boards;
create policy "mood_boards_admin" on mood_boards for all using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on mood_boards to authenticated;
