# NOTTE-REPORT — Risoluzione rischi audit (notte 2 + chiusura P5)

> Branch: `chore/audit-rls-pii-notte` · DB locale **avviato** (`supabase start` + `db reset`), test **dinamici** contro Postgres reale. Niente su prod, niente merge su `main`.
> **Priorità per rischio-dati: 1 e 2 (le vere esposizioni) sono CHIUSE e PROVATE. Il BUCO #1 (PII `calendar_entries`) è stato chiuso con lo SPLIT strutturale (opzione a). 3–7 restano ⏸ (vedi sotto).**

## Job zero ✅
DB locale su (Postgres :54322), seed corretto (6 profili, 23 servizi). **Intoppo risolto:** due mie migrazioni di seed blog (`...330000`, `...370000`) inserivano `author_id` di **produzione**, assenti nel seed locale → FK fallita su `db reset`. Le ho rese **portabili** con guardia `and exists (select 1 from profiles where id=<author>)`: in locale saltano, in prod (già applicate) restano innocue. *(Inoltre la CLI v2.90 aveva un glitch su `seed_files`, risolto con `supabase stop/start`.)*

## Tabella esiti (punti 1–7)

| # | Rischio | Cosa era esposto | Cosa l'ha chiuso | Esito |
|---|---|---|---|---|
| **1** | Isolamento RLS cross-tenant | **`calendar_entries`**: un *fornitore/participant* leggeva `client_name`/`client_email`/`notes`/`value_amount` del cliente dalla **tabella base** (test **P5 rosso**) | **SPLIT strutturale** (opzione a): PII spostata in **`calendar_entries_private`** (RLS owner/couple/admin), colonne **droppate** dalla base; trigger crea la riga privata; frontend/edge adattati. Mig. `20260610010000`. Test **P5 rosso→verde** + **P5b** (owner legge) verde | ✅ **CHIUSO e provato** |
| 1b | Resto dell'isolamento | anon su tabelle PII/audit; cross-tenant preventivi/prospect; participant→PII | RLS già corretta (provato P1/P2/P3/P4/P6 **verdi**) | ✅ provato |
| **2** | Viste che bypassano la RLS | **`v_salute_evento`** leggibile da **anon** (per-evento, cross-tenant): era `security_invoker` **off** | `security_invoker = on` + `revoke anon` (mig. `20260609020000`); test **V1 rosso→verde** | ✅ **CHIUSO e provato** |
| 3 | Cifratura PII a riposo | `doc_number`/`fiscal_code` in chiaro in `quote_acceptances` | Migrazione **esempio** pronta ma **inattiva** (`migrations-pending/`) | ⏸ **non attivata** — serve decisione (sotto) |
| 4 | Famiglia "funzioni esposte" (33 Edge Fn) | gate disinnescabili, relay/enumerazione | `funnel-cron` fail-closed + `suggest-alternatives` rate-limit (notte 1) | ⏸ **parziale** — sweep completo delle 33 NON fatto |
| 5 | Signed URL quasi-permanenti | URL firma/atto a 10 anni | URL brevi (15 min) + firma salvata come **key** (notte 1) | ⏸ **parziale** — endpoint permanente `/atto/{token}` NON implementato |
| 6 | Cancello anti-regressione PII | migrazioni PII senza test | — | ⏸ non fatto |
| 7 | Superficie domini non-core dietro flag | scope creep | — | ⏸ non fatto |

## ✅ BUCO #1 — CHIUSO (split strutturale, opzione a)
Implementato lo **split PII** scelto da te. Dettaglio in fondo ("Chiusura P5").
**Non resta nulla da decidere su questo punto.**

## ⬛️ Decisioni che aspettano TE
1. **Cifratura PII (punto 3):** (a) **dove vive la chiave** — Vault (stessa istanza DB) vs cifratura applicativa nelle Edge Function (il DB non vede il plaintext); (b) **conservare il numero documento** o tenere solo un flag `identità_verificata` + ultime cifre (minimizzazione GDPR). *Tradeoff noto:* col Vault la chiave vive nello stesso DB — la versione blindata (chiave esterna o non-ritenzione) è una tua scelta, non la prendo io.
2. **Domini "core" (punto 7):** quali consideri davvero core (così metto gli altri dietro `feature_flags` spenti).

## 🟢 Cosa è stato fatto e PROVATO stanotte
- **Suite dinamiche** (DB reale, run finale): `rls_tests.sql` **8/8 ✅** · `pii_isolation_tests.sql` **P1–P6 ✅ (incluso P5 split + P5b owner)** · `views_isolation_tests.sql` **V1–V3 ✅**.
- **BUCO #1 (P5) CHIUSO** con split strutturale (vedi sotto).
- **Fix #2 applicato e provato** (vista `v_salute_evento`).
- `docs/SECURITY-RLS-AUDIT.md` aggiornato con **introspezione live** (sezione "ESITI DINAMICI LIVE").
- `tsc`/`npm run build` frontend: ✅ verde (split adattato in hook + edge writers).

## 🔒 Chiusura P5 — split `calendar_entries_private` (opzione a)
**Cosa è cambiato.** RLS è **per-riga, non per-colonna**: non si potevano nascondere 4 colonne al solo fornitore. Quindi:
- Nuova tabella **`calendar_entries_private(entry_id PK→calendar_entries, client_name, client_email, notes, value_amount, updated_at)`**, RLS:
  - `cep_select_owner_couple_admin` (SELECT: owner **o** coppia **o** admin) — il fornitore-participant **non ha policy** → 0 righe.
  - `cep_write_owner_admin` (INSERT/UPDATE: owner **o** admin).
- Le 4 colonne PII **droppate** da `calendar_entries`: il fornitore vede ancora **data/titolo/stato** (accesso legittimo al calendario) ma **non** i dati cliente né il valore totale.
- Trigger `ensure_calendar_entry_private` (AFTER INSERT) crea la riga privata vuota.
- **Owner intatto:** legge/scrive tutto via join su `calendar_entries_private` (embed PostgREST `calendar_entries_private(...)`, verificato live).
- **Frontend adattato** (read+write, ri-appiattiti per non toccare i consumer): `useCalendar.ts`, `useWedding.ts`, `useCouple.ts`.
- **Edge writers adattati:** `quote-send` (insert base + upsert privato), nessun altro writer SQL/edge delle 4 colonne (grep).
- **Prova rosso→verde:** `P5` (cols PII rimosse dalla base · fornitore 0 su `_private` · ma vede l'evento) + `P5b` (owner legge `client_name` da `_private`). Regressione `rls_tests` 8/8 verde.

## 🧹 Sweep Edge Functions (punto 4) — fatto, READ-ONLY + 1 fix sicuro
Esaminate tutte le **33** funzioni (fail-open gate / no-auth+service_role / enumeration-relay / CORS / signed URL).

**🔴 Confermato e CHIUSO (1):**
- **`inbound-email`** — *fail-open gate*. `if (SECRET && key !== SECRET) return 401` (riga 18): se `INBOUND_WEBHOOK_SECRET` non è settato il webhook accettava **chiunque** e scriveva `inbound_emails` con SERVICE_ROLE (injection di email inbound fasulle). → **fail-closed**: `if (!SECRET) return 503; if (key !== SECRET) return 401`. *(Branch-only: prima del deploy assicurati che `INBOUND_WEBHOOK_SECRET` sia impostato lato Resend, altrimenti l'endpoint risponde 503 — è il comportamento voluto.)*

**🟢 Verificati e già OK (fix notte 1 ancora presenti):** `funnel-cron` (fail-closed), `suggest-alternatives` (rate-limit IP+email), `quote-accept-sign` (firma come key, URL 15 min).

**⚪️ Falsi positivi dell'audit automatico (verificati a mano, NESSUN bug):**
- `instagram-import` — *non* è no-auth: richiede `getUser()` (401) e carica il token `where profile_id = user.id` (riga 20) → un chiamante usa solo il **proprio** token; `media_id` è risolto contro quel token (l'API IG ritorna solo i media del proprietario). Nessun accesso cross-utente.
- `instagram-oauth-callback` — *non* è CSRF: lo `state` è 128-bit random generato server-side da un utente autenticato, salvato con `profile_id`, **single-use** (delete riga 48); il token viene legato a `st.profile_id` **salvato**, non a input del chiamante. HMAC sarebbe difesa-in-profondità marginale → non aggiunto (rischio di rompere il flusso).

**🟡 Findings che restano (decisione/tuning, non toccati per non rompere flussi legittimi):**
- **Signed URL lunghi su PDF**: `contract-generate-pdf` **365 gg** (dati fiscali) · `moodboard-pdf` 30 gg · `quote-generate-pdf` 7 gg. Sono documenti che il cliente riapre dall'email → accorciarli è una scelta di prodotto (per quanto tempo un cliente deve poter riaprire il suo PDF?). Dimmi le scadenze volute e le imposto.
- **`suggest-alternatives` / `lead-notify`**: rate-limit presente; si può irrobustire (normalizzare email lowercase prima del match, finestra più stretta). Tuning, non buco.

**Non fatto (punto 5):** endpoint permanente `/atto/{token}` per ri-scaricare l'atto firmato — resta da implementare (oggi l'URL è a 15 min).

## Dove mi sono fermato e perché
- **Punti 3, 7**: ⏸ richiedono una tua decisione (cifratura PII e domini core, sopra).

## File del commit (branch)
```
supabase/migrations/20260610010000_split_calendar_entries_private.sql   (FIX #1 — split PII)
frontend/src/hooks/useCalendar.ts                   (read+write split)
frontend/src/hooks/useWedding.ts                    (read+write split)
frontend/src/hooks/useCouple.ts                     (read split)
supabase/functions/quote-send/index.ts             (writer split)
supabase/functions/inbound-email/index.ts          (fail-closed webhook secret)
tests/sql/pii_isolation_tests.sql                   (P5 rosso→verde + P5b)
tests/sql/rls_tests.sql                             (bootstrap + TEST 5 su _private)
docs/SECURITY-RLS-AUDIT.md                          (+ esiti live, P5 chiuso)
tests/sql/views_isolation_tests.sql                 (nuovo)
supabase/migrations/20260609020000_fix_view_salute_evento_invoker.sql   (FIX #2)
supabase/migrations/20260608330000_blog_seed_gisko_daisylab.sql         (guard portabilità)
supabase/migrations/20260608370000_blog_seed_7posts.sql                 (guard portabilità)
NOTTE-REPORT.md
```
(+ i fix/file della notte 1 già sul branch)
