-- ============================================================================
-- Gap fix permessi:
-- A) COUPLE puo` MODIFICARE: event_tables, event_guests, wedding_tasks,
--    mood_images, event_playlist (oltre alle SELECT gia` ok)
-- B) COUPLE puo` SELECT contracts del proprio matrimonio
-- C) FORN con collaboration ACTIVE puo` SELECT calendar_entries +
--    event_timeline/tables/guests/subevents/accommodations/transport/gadgets
--    dei capostipiti con cui collabora.
-- ============================================================================

-- =========== A. COUPLE write su tables/guests/tasks/mood/playlist =============

-- event_tables: INSERT/UPDATE/DELETE per couple member
drop policy if exists "tab_insert_couple" on event_tables;
create policy "tab_insert_couple" on event_tables for insert with check (
  is_wedding_couple(entry_id)
);
drop policy if exists "tab_update_couple" on event_tables;
create policy "tab_update_couple" on event_tables for update using (
  is_wedding_couple(entry_id)
) with check (is_wedding_couple(entry_id));
drop policy if exists "tab_delete_couple" on event_tables;
create policy "tab_delete_couple" on event_tables for delete using (
  is_wedding_couple(entry_id)
);

-- event_guests: INSERT/UPDATE/DELETE per couple
drop policy if exists "guest_insert_couple" on event_guests;
create policy "guest_insert_couple" on event_guests for insert with check (
  is_wedding_couple(entry_id)
);
drop policy if exists "guest_update_couple" on event_guests;
create policy "guest_update_couple" on event_guests for update using (
  is_wedding_couple(entry_id)
) with check (is_wedding_couple(entry_id));
drop policy if exists "guest_delete_couple" on event_guests;
create policy "guest_delete_couple" on event_guests for delete using (
  is_wedding_couple(entry_id)
);

-- wedding_tasks: INSERT/UPDATE/DELETE per couple (gia` SELECT)
drop policy if exists "tasks_insert_couple" on wedding_tasks;
create policy "tasks_insert_couple" on wedding_tasks for insert with check (
  is_wedding_couple(entry_id)
);
drop policy if exists "tasks_update_couple" on wedding_tasks;
create policy "tasks_update_couple" on wedding_tasks for update using (
  is_wedding_couple(entry_id)
) with check (is_wedding_couple(entry_id));
drop policy if exists "tasks_delete_couple" on wedding_tasks;
create policy "tasks_delete_couple" on wedding_tasks for delete using (
  is_wedding_couple(entry_id)
);

-- mood_images UPDATE per couple (INSERT/DELETE/SELECT gia` ok)
drop policy if exists "mood_update_couple" on mood_images;
create policy "mood_update_couple" on mood_images for update using (
  is_wedding_couple(entry_id)
) with check (is_wedding_couple(entry_id));

-- event_playlist UPDATE per couple
drop policy if exists "playlist_update_couple" on event_playlist;
create policy "playlist_update_couple" on event_playlist for update using (
  is_wedding_couple(entry_id)
) with check (is_wedding_couple(entry_id));

-- =========== B. COUPLE SELECT contracts del proprio matrimonio ===============

drop policy if exists "contracts_select_couple" on contracts;
create policy "contracts_select_couple" on contracts for select using (
  exists (
    select 1 from quotes q
    where q.id = contracts.quote_id
      and exists (
        select 1 from calendar_entries ce where ce.quote_id = q.id and is_wedding_couple(ce.id)
      )
  )
);

-- =========== C. FORN con collaboration ACTIVE vede wedding dei capostipiti ====

-- Helper: e' il fornitore loggato collegato all'owner del wedding?
create or replace function is_collab_supplier_of_entry(p_entry uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from calendar_entries ce
    join collaborations c
      on c.capostipite_id = ce.owner_id
     and c.fornitore_id = auth.uid()
     and c.status = 'ACTIVE'
    where ce.id = p_entry
  );
$$;

grant execute on function is_collab_supplier_of_entry(uuid) to authenticated;

-- calendar_entries: FORN vede entries dei capostipiti con cui ha collab ACTIVE
drop policy if exists "ce_select_collab_supplier" on calendar_entries;
create policy "ce_select_collab_supplier" on calendar_entries for select using (
  is_collab_supplier_of_entry(id)
);

-- event_timeline / tables / guests / subevents / accommodations / transport / gadgets
drop policy if exists "timeline_select_collab_supplier" on event_timeline;
create policy "timeline_select_collab_supplier" on event_timeline for select using (
  is_collab_supplier_of_entry(entry_id)
);

drop policy if exists "tab_select_collab_supplier" on event_tables;
create policy "tab_select_collab_supplier" on event_tables for select using (
  is_collab_supplier_of_entry(entry_id)
);

drop policy if exists "guest_select_collab_supplier" on event_guests;
create policy "guest_select_collab_supplier" on event_guests for select using (
  is_collab_supplier_of_entry(entry_id)
);

drop policy if exists "subev_select_collab_supplier" on event_subevents;
create policy "subev_select_collab_supplier" on event_subevents for select using (
  is_collab_supplier_of_entry(entry_id)
);

drop policy if exists "acc_select_collab_supplier" on event_accommodations;
create policy "acc_select_collab_supplier" on event_accommodations for select using (
  is_collab_supplier_of_entry(entry_id)
);

drop policy if exists "transp_select_collab_supplier" on event_transport;
create policy "transp_select_collab_supplier" on event_transport for select using (
  is_collab_supplier_of_entry(entry_id)
);

drop policy if exists "gadg_select_collab_supplier" on event_gadgets;
create policy "gadg_select_collab_supplier" on event_gadgets for select using (
  is_collab_supplier_of_entry(entry_id)
);
