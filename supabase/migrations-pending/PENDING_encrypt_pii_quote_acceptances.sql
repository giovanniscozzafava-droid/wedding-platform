-- ============================================================================
-- ⛔️ NON APPLICARE — in attesa di decisione su KEY MANAGEMENT.
-- ----------------------------------------------------------------------------
-- Questo file è VOLUTAMENTE fuori da `supabase/migrations/` (cartella
-- `migrations-pending/`): NON viene incluso da `supabase db push` / reset.
-- Cifratura a riposo di `doc_number` e `client_fiscal_code` in
-- `quote_acceptances`. Testare SOLO sul seed locale.
--
-- DECISIONI APERTE (servono prima di attivare):
--   (a) DOVE vive la chiave: secret della Edge Function (cifratura applicativa,
--       il DB non vede mai il plaintext) vs `app.settings` / Vault Postgres
--       (pgcrypto lato DB). Consigliato: cifratura APPLICATIVA nelle Edge
--       Function → il DB conserva solo bytea, la chiave non tocca Postgres.
--   (b) SE conservare il numero documento o solo un flag "identità verificata":
--       per molti casi d'uso basta `identity_verified boolean` + hash, senza
--       custodire il documento (minimizzazione GDPR).
--   (c) DATA-MIGRATION delle righe esistenti: NON inclusa qui — richiede la
--       chiave e una finestra controllata; va pianificata a parte.
-- ============================================================================

-- Variante DB-side (pgcrypto) — esempio per test locale soltanto.
create extension if not exists pgcrypto;

-- 1) Colonne cifrate (additive, accanto alle attuali in chiaro)
alter table public.quote_acceptances
  add column if not exists doc_number_enc          bytea,
  add column if not exists client_fiscal_code_enc  bytea,
  add column if not exists pii_encrypted           boolean not null default false;

-- 2) Helper: cifra usando una chiave passata via GUC di sessione
--    (in produzione la chiave NON deve stare in una migrazione).
--    set_config('app.pii_key', '<chiave>', false) prima dell'uso.
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

-- 3) (NON incluso) data-migration delle righe esistenti:
--    update quote_acceptances
--       set doc_number_enc = _pii_encrypt(doc_number),
--           client_fiscal_code_enc = _pii_encrypt(client_fiscal_code),
--           pii_encrypted = true;
--    ...e poi, in una migrazione successiva, azzerare le colonne in chiaro.
--    → Da eseguire SOLO dopo aver deciso (a) e con la chiave caricata.

-- TEST LOCALE (seed): verifica round-trip su una riga fittizia.
--   select set_config('app.pii_key','test-key-locale',false);
--   insert into quote_acceptances(...) ...;
--   update quote_acceptances set doc_number_enc=_pii_encrypt(doc_number) where ...;
--   select _pii_decrypt(doc_number_enc) = doc_number from quote_acceptances where ...;
