-- Coerenza "organizzazione visibile al cerchio": event_playlist / mood_images /
-- mood_inspirations NON concedevano lettura ai partecipanti, a differenza di
-- timeline/invitati/tavoli/alloggi/trasporti/ecc. → il fornitore del cerchio vedeva
-- quelle tab VUOTE (bug). Queste tabelle non contengono campi sensibili (niente
-- budget/prezzi), quindi le allineo: lettura ai membri del cerchio.
-- NB: couple_preferences (budget_min/max) ed event_menu (price_per_guest) NON
-- vengono concessi: contengono dati di prezzo/budget → restano owner/sposi/admin.

create policy playlist_select_member on public.event_playlist for select
  using (public.is_entry_participant(entry_id) or public.is_collab_supplier_of_entry(entry_id));

create policy moodimg_select_member on public.mood_images for select
  using (public.is_entry_participant(entry_id) or public.is_collab_supplier_of_entry(entry_id));

create policy moodinsp_select_member on public.mood_inspirations for select
  using (public.is_entry_participant(entry_id) or public.is_collab_supplier_of_entry(entry_id));
