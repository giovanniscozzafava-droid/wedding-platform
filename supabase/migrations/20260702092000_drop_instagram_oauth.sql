-- ============================================================================
-- RIMOZIONE FLUSSO INSTAGRAM OAuth (codice morto)
-- ----------------------------------------------------------------------------
-- Il flusso di CONNESSIONE Instagram (OAuth) non è mai stato collegato alla UI:
-- nessun menu, nessun componente montato (InstagramLogoPicker era orfano),
-- nessuna edge invocata da codice vivo, nessuna FK in entrata verso
-- instagram_connections/_oauth_states. Manteneva un access_token long-lived →
-- superficie inutile.
--
-- NON tocca: il campo `instagram`/`instagram_url` del profilo pubblico;
-- l'import "incolla link" in ServiceForm (via import-pin-url); i riferimenti
-- testuali a URL Instagram. Tutto `if exists` → idempotente.
-- ============================================================================

-- 1) RPC che leggevano/scrivevano instagram_connections
drop function if exists public.my_instagram();
drop function if exists public.disconnect_instagram();

-- 2) Tabelle (policy RLS associate cadono in cascata con la tabella).
drop table if exists public.instagram_oauth_states cascade;
drop table if exists public.instagram_connections cascade;

-- NB: le edge instagram-oauth-start/-callback, instagram-import, instagram-avatar
-- NON sono oggetti DB: rimosse cancellando le cartelle in supabase/functions/.
-- I secret INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET possono essere rimossi dal
-- progetto Supabase (azione umana).
