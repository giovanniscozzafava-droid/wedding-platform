-- ============================================================================
-- GER-08: la policy RLS che permette l'insert su `collaborations` verificava
-- solo il ruolo del CHIAMANTE (capostipite_id = auth.uid(), ruolo WP/LOCATION/
-- ADMIN), mai il ruolo del bersaglio (fornitore_id). La gerarchia "WP sopra
-- LOCATION" era quindi enforced solo nelle due RPC applicative
-- (capostipite_add_supplier, wp_add_location_to_team): un insert diretto da
-- una LOCATION con fornitore_id = un WP a piacere non sarebbe stato bloccato
-- da RLS. Nessun frontend fa un insert diretto oggi (verificato), ma è un
-- buco di difesa-in-profondità reale. Le RPC restano SECURITY DEFINER e non
-- sono soggette a questa policy (girano come owner della funzione).
-- ============================================================================

drop policy if exists "collab_insert_capo" on collaborations;
create policy "collab_insert_capo"
  on collaborations for insert
  with check (
    capostipite_id = auth.uid()
    and (
      is_admin()
      or (
        exists (select 1 from profiles where id = auth.uid() and role = 'WEDDING_PLANNER')
        and exists (select 1 from profiles where id = fornitore_id and role in ('FORNITORE','LOCATION'))
      )
      or (
        exists (select 1 from profiles where id = auth.uid() and role = 'LOCATION')
        and exists (select 1 from profiles where id = fornitore_id and role = 'FORNITORE')
      )
    )
  );
