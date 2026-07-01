-- ============================================================================
-- SPEGNIMENTO SISTEMA A (prova menu v1, 22 giugno) — consolidamento su B+C
-- ----------------------------------------------------------------------------
-- Tre meccanismi di voto sulla prova menu:
--   A (22/06) — link pubblico /prova-menu/:token + fb_submit_vote -> fb_tasting_votes.
--               VICOLO CIECO: i voti NON alimentano food cost né dispensa.
--   B (01/07) — sessioni stagionali collettive (/prove-menu, /prova-menu-invito):
--               RSVP presenze. Resta.
--   C (01/07) — voto/conferma piatti in MenuTab (fb_dish_vote/fb_dish_confirm ->
--               fb_event_dish). Unico che alimenta food cost/dispensa. Resta.
--
-- A è vecchio e si spegne. Nessun dato reale in prod → rimozione pulita.
--
-- NON si tocca (condivise con C):
--   * fb_tastings — C (fb_event_choice_view) la legge come CONTENITORE-APPUNTAMENTO
--     (scheduled_at, sala, status). Resta. Si rimuove solo vote_token (solo di A).
--   * fb_menu_proposals — menu proposti all'evento. Serve a C. Resta.
--   * fb_dish_votes / fb_event_choice_view / fb_dish_confirm / fb_choose_menu — Restano.
-- Tutto `if exists` → idempotente.
-- ============================================================================

-- 1) RPC del Sistema A
drop function if exists public.fb_submit_vote(text, text, uuid, int, text);
drop function if exists public.fb_tasting_public(text);
drop function if exists public.fb_tasting_results(uuid);
drop function if exists public.fb_create_tasting(uuid, timestamptz, text);

-- 2) Tabella voti-vicolo-cieco (nessun dato reale)
drop table if exists public.fb_tasting_votes cascade;

-- 3) Colonna vote_token su fb_tastings (usata SOLO da A). fb_tastings resta (serve a C).
alter table public.fb_tastings drop column if exists vote_token;
