-- ============================================================================
-- ⛔️ SUPERATO — NON è il piano adottato. Tenuto solo come "strada non presa".
-- ----------------------------------------------------------------------------
-- Dopo aver tracciato il codice (giu 2026), la cifratura app-level è stata
-- SCARTATA: `doc_number` è riusato DB-side per il prefill di contratto/addendum
-- e vive in chiaro anche in `contracts.signature_data` → cifrarne una sola copia
-- è teatro, cifrarle tutte richiede un refactor della pipeline di firma (il DB
-- non potrebbe più decifrare per il prefill). La tabella è già protetta da RLS
-- (owner+admin), grant lockdown (anon revocato), disk-encryption a riposo e URL
-- firmati brevi. Il residuo reale — la RITENZIONE perenne del numero — è chiuso
-- da `supabase/migrations/20260610020000_signing_pii_retention.sql` (doc_last4 +
-- purge_old_signing_pii() schedulato via pg_cron). Questo file resta come
-- riferimento SE un domani si vorrà la cifratura completa (refactor a parte).
--
-- [storico] DECISION RECORD originale — Cifratura PII a riposo (quote_acceptances)
-- ----------------------------------------------------------------------------
-- Fuori da `supabase/migrations/` di proposito: NON entra in `db push`/reset.
-- Cifra a riposo `doc_number` e `client_fiscal_code` di `quote_acceptances`.
--
-- Giovanni ha delegato la scelta ("consigliami tu"). Decisioni prese:
--
--   (a) DOVE vive la chiave  →  CIFRATURA APPLICATIVA (Edge Function).
--       La chiave sta nei *secret della Edge Function* (`PII_ENC_KEY`), MAI in
--       Postgres. Il DB conserva solo `bytea`. Motivo: l'intero audit di queste
--       notti riguarda RLS-bypass / service_role trafugato / dump del DB-backup.
--       Una chiave dentro Postgres (pgcrypto GUC o Vault) è decifrabile da
--       CHIUNQUE abbia accesso DB/service_role → NON difende dalle minacce che
--       stiamo chiudendo. App-level sì: un dump completo del DB non rivela nulla.
--       → pgcrypto qui sotto resta SOLO come test di round-trip locale.
--
--   (b) COSA conservare  →  MINIMIZZAZIONE (GDPR).
--       Teniamo `doc_type` + `doc_last4` (ultime 4 cifre) + la voce già
--       mascherata in `signature_audit_trail` (mask_doc_number) + `document_hash`.
--       Il NUMERO PIENO si conserva solo cifrato (app-level) e con scadenza
--       (`pii_purge_after`, default +24 mesi: copre l'eventuale contestazione,
--       poi si azzera). La validità della firma poggia su audit-trail immutabile
--       + hash + identità catturata all'atto, NON sulla custodia perenne del
--       numero in chiaro.
--
-- PERCHÉ NON L'HO GIÀ APPLICATO STANOTTE (e l'ho lasciato qui):
--   - Rewira il flusso di FIRMA LEGALE (quote-accept-sign) — non testabile
--     end-to-end alla cieca senza l'apparato di firma.
--   - L'ultimo step CANCELLA dati legali (plaintext) → irreversibile su prod.
--   Questi due meritano il tuo "vai" e un passaggio testato. Tutto il resto
--   (decisioni + schema + rollout) è qui pronto.
-- ============================================================================

-- ── STEP 1 (additivo, sicuro) — colonne cifrate + minimizzazione ────────────
alter table public.quote_acceptances
  add column if not exists doc_number_enc          bytea,
  add column if not exists client_fiscal_code_enc  bytea,
  add column if not exists doc_last4               text,
  add column if not exists pii_encrypted           boolean not null default false,
  add column if not exists pii_purge_after         timestamptz;

-- ── STEP 2 (Edge Function) — helper AES-GCM, chiave dai secret ───────────────
--   File nuovo: supabase/functions/_shared/pii-crypto.ts (WebCrypto/Deno):
--     - key = base64-decode(Deno.env.get('PII_ENC_KEY'))  // 32 byte = AES-256
--     - encrypt(text): iv random 12B; AES-GCM; ritorna iv||ciphertext (bytea)
--     - decrypt(buf):  splitta iv/ciphertext; AES-GCM open
--   In quote-accept-sign, accanto all'insert attuale (ADDITIVO e GUARDATO):
--     if (PII_ENC_KEY) {                 // assente in prod oggi → no-op, zero regressioni
--       doc_number_enc = encrypt(doc_number)
--       client_fiscal_code_enc = encrypt(fiscal_code)
--       doc_last4 = doc_number.slice(-4)
--       pii_encrypted = true
--       pii_purge_after = now()+interval '24 months'
--     }
--   Il blocco va in try/catch dedicato: un errore di cifratura NON deve MAI
--   bloccare la firma.

-- ── STEP 3 (backfill, una tantum, con chiave caricata) ──────────────────────
--   update quote_acceptances
--      set doc_number_enc = <encrypt app-side>, client_fiscal_code_enc = ...,
--          doc_last4 = right(doc_number,4), pii_encrypted = true,
--          pii_purge_after = now() + interval '24 months'
--    where not pii_encrypted;
--   (Eseguito da uno script Edge che ha la chiave; NON in SQL con chiave in DB.)

-- ── STEP 4 (irreversibile — solo dopo verifica round-trip) ──────────────────
--   alter table public.quote_acceptances
--     alter column doc_number drop not null;
--   update quote_acceptances set doc_number = null, client_fiscal_code = null
--    where pii_encrypted;          -- azzera il plaintext
--   -- PDF dell'atto: legge il numero pieno SOLO al momento della generazione
--   --   via decrypt app-side; in lista/preview si mostra doc_last4.

-- ── STEP 5 (igiene) — purge programmato ─────────────────────────────────────
--   Job (cron Edge) che azzera doc_number_enc/client_fiscal_code_enc dove
--   pii_purge_after < now(): minimizzazione anche del cifrato a scadenza.

-- ============================================================================
-- pgcrypto: SOLO per test di round-trip locale (NON è la soluzione di prod).
-- ============================================================================
create extension if not exists pgcrypto;
create or replace function public._pii_encrypt(p_text text)
returns bytea language sql immutable as $$
  select case when p_text is null or p_text = '' then null
              else pgp_sym_encrypt(p_text, current_setting('app.pii_key')) end;
$$;
create or replace function public._pii_decrypt(p_enc bytea)
returns text language sql stable as $$
  select case when p_enc is null then null
              else pgp_sym_decrypt(p_enc, current_setting('app.pii_key')) end;
$$;
-- TEST LOCALE:
--   select set_config('app.pii_key','test-key-locale',false);
--   update quote_acceptances set doc_number_enc=_pii_encrypt(doc_number) where ...;
--   select _pii_decrypt(doc_number_enc) = doc_number from quote_acceptances where ...;
