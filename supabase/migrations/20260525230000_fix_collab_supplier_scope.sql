-- ============================================================================
-- CRITICAL HOTFIX: is_collab_supplier_of_entry() era troppo permissiva.
--
-- Bug originale: la funzione controllava solo che il fornitore avesse una
-- collaborations ACTIVE con il WP owner del wedding, NON che fosse
-- effettivamente coinvolto in QUEL specifico wedding. Risultato: ogni
-- fornitore con collab ACTIVE vedeva PII (sposi gmail, value_amount,
-- guest list, seating chart, dietary, trasporti) di TUTTI i wedding del
-- WP partner, non solo quello a cui partecipava.
--
-- Impatto: GDPR breach + competitive intelligence + cross-wedding leak.
--
-- Fix: il fornitore vede SOLO se:
--   (a) è participant esplicito in calendar_entry_participants, OR
--   (b) ha una voce sua (quote_items.supplier_id = auth.uid()) nel
--       preventivo linked al wedding (calendar_entries.quote_id), OR
--   (c) è esplicitamente assegnato a un momento del programma
--       (event_timeline.supplier_id = auth.uid())
-- ============================================================================

create or replace function is_collab_supplier_of_entry(p_entry uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    -- (a) participant esplicito
    select 1
      from calendar_entry_participants p
     where p.entry_id = p_entry
       and p.user_id = auth.uid()
  )
  or exists (
    -- (b) voce di preventivo collegato al wedding
    select 1
      from calendar_entries ce
      join quote_items qi on qi.quote_id = ce.quote_id
     where ce.id = p_entry
       and qi.supplier_id = auth.uid()
  )
  or exists (
    -- (c) assegnazione esplicita a un momento del programma
    select 1
      from event_timeline et
     where et.entry_id = p_entry
       and et.supplier_id = auth.uid()
  );
$$;

grant execute on function is_collab_supplier_of_entry(uuid) to authenticated;

comment on function is_collab_supplier_of_entry(uuid) is
  'Vero se il fornitore loggato è esplicitamente coinvolto nel wedding p_entry: come participant, come fornitore di una voce di preventivo o assegnato a un momento del programma. Fix critical leak: prima la funzione bastava una collaborations ACTIVE qualsiasi con il WP owner per leggere PII di tutti i suoi wedding.';

-- ----------------------------------------------------------------------------
-- BUG-G-2: event_playlist policy "playlist_select_owner_or_part" usa
-- calendar_entry_participants senza ulteriori vincoli. Il fornitore
-- partecipante "generico" leggeva tutta la playlist. Allineiamo al nuovo
-- predicate restrittivo.
-- ----------------------------------------------------------------------------
drop policy if exists "playlist_select_owner_or_part" on event_playlist;
create policy "playlist_select_owner_or_part" on event_playlist for select using (
  exists (
    select 1 from calendar_entries ce
     where ce.id = event_playlist.entry_id
       and ce.owner_id = auth.uid()
  )
  or is_wedding_couple(entry_id)
  or is_collab_supplier_of_entry(entry_id)
  or is_admin()
);

comment on policy "playlist_select_owner_or_part" on event_playlist is
  'Owner WP/admin sempre, coppia membri wedding e fornitori esplicitamente coinvolti (via is_collab_supplier_of_entry tightened).';
