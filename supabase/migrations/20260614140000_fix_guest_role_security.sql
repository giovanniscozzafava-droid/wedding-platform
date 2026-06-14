-- ============================================================================
-- SICUREZZA: gli ospiti registrati al volo da guest-signup venivano creati SENZA
-- ruolo nei metadata → il trigger handle_new_user assegnava il default WEDDING_PLANNER,
-- dando loro accesso alle aree professionali. La edge function ora passa role='CLIENT';
-- qui declassiamo gli ospiti GIÀ creati per errore come professionisti.
--
-- Condizioni MOLTO conservative: tocchiamo solo profili che sono chiaramente ospiti
-- (presenti in gallery_guests, mai onboardati, senza business, senza eventi/gallerie
-- di proprietà). Un vero professionista che è anche ospite altrove NON viene toccato.
-- ============================================================================

update public.profiles p
   set role = 'CLIENT'
 where p.role = 'WEDDING_PLANNER'
   and coalesce(p.onboarding_complete, false) = false
   and coalesce(nullif(btrim(p.business_name), ''), null) is null
   and exists (select 1 from public.gallery_guests gg where gg.guest_user_id = p.id)
   and not exists (select 1 from public.calendar_entries ce where ce.owner_id = p.id)
   and not exists (select 1 from public.event_galleries eg where eg.owner_id = p.id);
