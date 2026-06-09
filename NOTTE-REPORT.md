# NOTTE-REPORT — Audit RLS/PII + fix di sicurezza

> Branch: `chore/audit-rls-pii-notte` · **nessun merge su `main`, nessun `db push` su produzione.**
> Build frontend: ✅ **verde** (`npm run build`). Edge function (Deno): fuori da `tsc -b`, modifiche additive.

## ⬛️ IN CIMA — cosa aspetta TE (decisioni / verifiche)

1. **Conferma live dei `DA-VERIFICARE`** (Docker era spento → niente introspezione `pg_policies`). Priorità in `docs/SECURITY-RLS-AUDIT.md › Priorità per la revisione umana`. I tre punti caldi:
   - **Viste esposte ad `anon`**: `v_salute_evento`, `user_rating_summary` (e `v_riconciliazione_evento`, `supplier_trial_status` ad `authenticated`). Le viste **non applicano RLS**: confermare che aggreghino e non espongano identificatori / dati cross-tenant. *(È la classe della falla del 1° giugno.)*
   - **`platform_config` / `feature_flags`** leggibili da tutti (`USING true`): confermare che non contengano segreti.
   - **Tabelle PII** (`quote_acceptances`, `contracts`, `supplier_clients`, `lead_requests`, `network_prospects`…): le policy sembrano owner-scoped, ma vanno **provate** coi test (sotto).
2. **`BUCO` da correggere**: **0 confermati** dallo statico (vedi sotto). Quando avvii il DB locale, gira i test: i fallimenti = i veri buchi → li sistemi tu (io non ho toccato le policy, come da regole).
3. **Decisione cifratura PII** (Task 4, file inattivo): (a) **dove vive la chiave** — consiglio cifratura applicativa nelle Edge Function, il DB vede solo `bytea`; (b) **se conservare il numero documento o solo un flag `identità verificata`** (minimizzazione GDPR); (c) pianificare la data-migration delle righe esistenti.
4. **Conseguenza UX del fix 3b**: l'URL del **PDF dell'atto di accettazione** ora scade in **15 min**. Il link nelle **email** già inviate/future muore dopo 15 min → serve un piccolo endpoint *on-demand* "rigenera link atto" (decisione tua). La firma immagine non è più persistita come URL (salvata come key nel bucket privato).

---

## 🟢 VERDE — fatto in autonomia

### 1. Mappa di copertura RLS/PII → `docs/SECURITY-RLS-AUDIT.md`
- **119 tabelle** mappate, **326 policy**, dettaglio per tabella (operazione/ruolo/`USING`/`WITH CHECK`), flag PII e verdetto `OK`/`DA-VERIFICARE`/`BUCO`.
- **Metodo:** parsing statico delle migrazioni (Docker spento → niente `pg_policies` live). Chiaramente etichettato nel doc.
- **Esito:** `OK` 106 · `DA-VERIFICARE` 13 · `BUCO` **0 confermati**.
- **Lockdown audit confermato**: `access_audit_log`, `admin_audit`, `audit_log`, `quote_acceptances_audit`, `signature_audit_trail`, `lead_submit_attempts`, `contracts_legacy_audit` → RLS on, **nessun GRANT ad anon/authenticated**, policy assenti/solo service-role = **deny-all** ai client. Coerente con `audit_tables_lockdown`.

### 2. Test di isolamento → `tests/sql/pii_isolation_tests.sql`
Scritti nel pattern di `rls_tests.sql` (impersonazione `set_config(request.jwt.claims)` + `SET LOCAL ROLE`). Scenari:
- **P1** — `anon` vede **0 righe** da: `quote_acceptances`, `quote_acceptances_audit`, `contracts`, `supplier_clients`, `lead_requests`, `network_prospects`, `network_prospect_logs`, `lead_submit_attempts`, `signature_audit_trail`, `quote_view_consents`, `referral_redeem_attempts`, `audit_log`, `access_audit_log`.
- **P2/P3** — **cross-tenant**: il capostipite B non vede preventivi (`quotes`) né prospect (`network_prospects`) del capostipite A.
- **P4/P5** — il **participant** accede solo alla **view ridotta** (`calendar_entries_for_participants`, senza `client_name`/`value_amount`/`notes`) e **non** legge i PII dell'evento dalla tabella base.
- **P6** — `anon` **non** può UPDATE/DELETE sulle tabelle audit.
- ⚠️ **NON ESEGUITI stanotte**: il runner (`tests/sql/run_rls_tests.sh`) richiede il **container Postgres locale** (`supabase start`), ma **Docker non era disponibile**. Per eseguirli: `supabase start && supabase db reset && bash tests/sql/run_rls_tests.sh` (il runner punta a `rls_tests.sql`; per i nuovi, lanciare lo stesso comando sostituendo il file, o aggiungere `pii_isolation_tests.sql` allo script). I test sono *fail-loud* (RAISE EXCEPTION): un fallimento = buco reale da sistemare.

### 3. Fix meccanici (additivi, build verde)
- **`supabase/functions/funnel-cron/index.ts`** — gate ora **fail-closed**: se `CRON_SECRET` manca → **401** (prima il controllo veniva *saltato* quando il secret era assente).
- **`supabase/functions/quote-accept-sign/index.ts`** — due `createSignedUrl(..., 10 anni)`:
  - firma immagine (riga ~171): **non si persiste più un URL di lunga durata** → si salva la **key** di storage (bucket privato). Il PDF dell'atto incorpora la firma dai **bytes**, non dall'URL → flusso invariato.
  - atto di accettazione (riga ~439): URL di **lettura effimero, 15 min**.
- **`supabase/functions/suggest-alternatives/index.ts`** — **rate-limit IP+email** (finestra 1h: max 8/IP, 4/email → `429`), con migrazione **additiva** `supabase/migrations/20260609010000_suggest_rate_limit.sql` (nuova tabella `suggest_attempts`, RLS deny-all client, cleanup). Nessun ALTER distruttivo.

## 🟡 GIALLO — preparato, NON applicato
- **`supabase/migrations-pending/PENDING_encrypt_pii_quote_acceptances.sql`** — cifratura a riposo di `doc_number` e `client_fiscal_code` (pgcrypto, esempio per test locale). **Fuori** da `supabase/migrations/` → NON incluso da `db push`/reset. Header `⛔️ NON APPLICARE` + decisioni aperte (key management, doc vs flag, data-migration). Non testato in locale (Docker spento).

## 🔴 ROSSO — rispettato
Nessun `db push`/migrazione su produzione · nessun tocco a pagamenti/Stripe/tier · **nessuna policy RLS `BUCO` corretta da me** (solo segnalate) · nessun `DROP`/`TRUNCATE`/ALTER distruttivo · nessun merge/force-push su `main`.

## File toccati (sul branch)
```
docs/SECURITY-RLS-AUDIT.md                                            (nuovo)
tests/sql/pii_isolation_tests.sql                                     (nuovo)
NOTTE-REPORT.md                                                       (nuovo)
supabase/migrations/20260609010000_suggest_rate_limit.sql            (nuovo, additivo)
supabase/migrations-pending/PENDING_encrypt_pii_quote_acceptances.sql (nuovo, INATTIVO)
supabase/functions/funnel-cron/index.ts                               (fix)
supabase/functions/quote-accept-sign/index.ts                         (fix)
supabase/functions/suggest-alternatives/index.ts                      (fix + rate-limit)
```

## Limite onesto della notte
Senza Docker non ho potuto: (1) introspezione live `pg_policies` (mappa = statica), (2) **eseguire** i test di isolamento, (3) testare in locale la migrazione di cifratura. Tutto è scritto e pronto: appena il DB locale è avviabile, i test danno la verità sui `DA-VERIFICARE`.
