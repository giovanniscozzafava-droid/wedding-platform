-- ============================================================================
-- HOTFIX: couple_change_requests RLS policies usano is_entry_participant() che
-- legge da calendar_entry_participants. Ma la coppia è in wedding_couple_members
-- e si verifica con is_wedding_couple(). Risultato: INSERT bloccato con
-- 42501 row violates RLS policy quando lo sposo prova a inviare richiesta.
--
-- Fix: aggiunge OR is_wedding_couple(wedding_id) alle policy SELECT/INSERT.
-- ============================================================================

drop policy if exists ccr_couple_read on couple_change_requests;
create policy ccr_couple_read on couple_change_requests for select
  using (
    is_entry_participant(wedding_id)
    or is_wedding_couple(wedding_id)
    or exists (select 1 from calendar_entries ce where ce.id = wedding_id and ce.owner_id = auth.uid())
    or is_admin()
  );

drop policy if exists ccr_couple_insert on couple_change_requests;
create policy ccr_couple_insert on couple_change_requests for insert
  with check (
    requested_by = auth.uid()
    and (
      is_entry_participant(wedding_id)
      or is_wedding_couple(wedding_id)
      or exists (select 1 from calendar_entries ce where ce.id = wedding_id and ce.owner_id = auth.uid())
    )
  );

comment on policy ccr_couple_insert on couple_change_requests is
  'Permette a coppia (wedding_couple_members) o WP owner di creare richieste. Fix: aggiunto is_wedding_couple — la check originale usava solo is_entry_participant che non vede i membri coppia.';
