-- ============================================================================
-- GER-07: profiles_select_collab_supplier era hard-coded a role = 'FORNITORE',
-- ma una LOCATION può essere reclutata da un WP esattamente come un fornitore
-- (capostipite_add_supplier/wp_add_location_to_team la inseriscono in
-- collaborations.fornitore_id allo stesso modo). Una LOCATION reclutata
-- risultava invisibile al WP: profilo non leggibile via RLS, quindi
-- useSuppliers()/useSupplier() la scartavano (embed profiles = null) — spariva
-- da /suppliers, dettaglio rotto, e in CatalogPage le sue voci di catalogo
-- (visibili: services_select_collab non ha questo filtro di ruolo) apparivano
-- etichettate genericamente "Fornitore" invece che col suo vero nome/logo.
-- ============================================================================

drop policy if exists "profiles_select_collab_supplier" on profiles;
create policy "profiles_select_collab_supplier"
  on profiles for select
  using (
    role in ('FORNITORE', 'LOCATION') and has_active_collab_with_supplier(id)
  );
