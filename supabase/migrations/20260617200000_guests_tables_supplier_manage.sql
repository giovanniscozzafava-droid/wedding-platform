-- ============================================================================
-- Il fornitore che gestisce l'evento (capostipite / collaboratore) deve poter
-- GESTIRE la lista invitati e i tavoli, non solo leggerli.
-- ----------------------------------------------------------------------------
-- Bug osservato: il selettore Adulto/Bambino e le "esigenze speciali" non si
-- salvavano per chi gestiva l'evento da fornitore. Causa: su event_guests /
-- event_tables esistevano solo policy di SCRITTURA per owner e coppia; il
-- fornitore collaboratore aveva solo SELECT, quindi ogni UPDATE veniva rifiutato
-- in silenzio (e l'UI tornava al valore precedente).
--
-- Gate: is_collab_supplier_of_entry(entry_id) — già usato per la SELECT — copre
-- il participant esplicito, il fornitore con voce di preventivo collegata e il
-- fornitore assegnato a un momento del programma. È lo stesso "chi vede gestisce".
-- ============================================================================

-- event_guests --------------------------------------------------------------
drop policy if exists guests_insert_supplier on public.event_guests;
drop policy if exists guests_update_supplier on public.event_guests;
drop policy if exists guests_delete_supplier on public.event_guests;

create policy guests_insert_supplier on public.event_guests
  for insert to authenticated
  with check (public.is_collab_supplier_of_entry(entry_id));

create policy guests_update_supplier on public.event_guests
  for update to authenticated
  using (public.is_collab_supplier_of_entry(entry_id))
  with check (public.is_collab_supplier_of_entry(entry_id));

create policy guests_delete_supplier on public.event_guests
  for delete to authenticated
  using (public.is_collab_supplier_of_entry(entry_id));

-- event_tables --------------------------------------------------------------
drop policy if exists tables_insert_supplier on public.event_tables;
drop policy if exists tables_update_supplier on public.event_tables;
drop policy if exists tables_delete_supplier on public.event_tables;

create policy tables_insert_supplier on public.event_tables
  for insert to authenticated
  with check (public.is_collab_supplier_of_entry(entry_id));

create policy tables_update_supplier on public.event_tables
  for update to authenticated
  using (public.is_collab_supplier_of_entry(entry_id))
  with check (public.is_collab_supplier_of_entry(entry_id));

create policy tables_delete_supplier on public.event_tables
  for delete to authenticated
  using (public.is_collab_supplier_of_entry(entry_id));
