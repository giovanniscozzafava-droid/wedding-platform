-- ============================================================================
-- Couple: write access su event_guests + event_tables
-- ============================================================================
-- La coppia aveva solo SELECT su questi tavoli (migration 20260521150900).
-- Ora apriamo INSERT/UPDATE/DELETE: e' la "loro" festa, devono poter gestire
-- invitati e tavoli a piu' mani col wedding planner.
--
-- Tutela: is_wedding_couple(entry_id) verifica membership in wedding_couple_members.
-- ============================================================================

-- ─── event_guests ──────────────────────────────────────────────────────────
drop policy if exists "guests_insert_couple" on public.event_guests;
create policy "guests_insert_couple" on public.event_guests
  for insert with check (is_wedding_couple(entry_id));

drop policy if exists "guests_update_couple" on public.event_guests;
create policy "guests_update_couple" on public.event_guests
  for update using (is_wedding_couple(entry_id))
  with check (is_wedding_couple(entry_id));

drop policy if exists "guests_delete_couple" on public.event_guests;
create policy "guests_delete_couple" on public.event_guests
  for delete using (is_wedding_couple(entry_id));

-- ─── event_tables ──────────────────────────────────────────────────────────
drop policy if exists "tables_insert_couple" on public.event_tables;
create policy "tables_insert_couple" on public.event_tables
  for insert with check (is_wedding_couple(entry_id));

drop policy if exists "tables_update_couple" on public.event_tables;
create policy "tables_update_couple" on public.event_tables
  for update using (is_wedding_couple(entry_id))
  with check (is_wedding_couple(entry_id));

drop policy if exists "tables_delete_couple" on public.event_tables;
create policy "tables_delete_couple" on public.event_tables
  for delete using (is_wedding_couple(entry_id));

comment on policy "guests_insert_couple" on public.event_guests is
  'Coppia membri di wedding_couple_members possono aggiungere invitati al proprio matrimonio (multi-mano col WP).';
comment on policy "tables_insert_couple" on public.event_tables is
  'Coppia membri di wedding_couple_members possono creare tavoli del proprio matrimonio.';
