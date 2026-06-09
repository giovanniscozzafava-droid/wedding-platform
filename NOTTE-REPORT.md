# NOTTE-REPORT — Risoluzione rischi audit (notte 2)

> Branch: `chore/audit-rls-pii-notte` · DB locale **avviato** (`supabase start` + `db reset`), test **dinamici** contro Postgres reale. Niente su prod, niente merge su `main`.
> **Priorità per rischio-dati: 1 e 2 (le vere esposizioni) sono affrontate e PROVATE. 3–7 non raggiunte stanotte (vedi sotto), come previsto dal prompt: meglio un ⏸ onesto.**

## Job zero ✅
DB locale su (Postgres :54322), seed corretto (6 profili, 23 servizi). **Intoppo risolto:** due mie migrazioni di seed blog (`...330000`, `...370000`) inserivano `author_id` di **produzione**, assenti nel seed locale → FK fallita su `db reset`. Le ho rese **portabili** con guardia `and exists (select 1 from profiles where id=<author>)`: in locale saltano, in prod (già applicate) restano innocue. *(Inoltre la CLI v2.90 aveva un glitch su `seed_files`, risolto con `supabase stop/start`.)*

## Tabella esiti (punti 1–7)

| # | Rischio | Cosa era esposto | Cosa l'ha chiuso | Esito |
|---|---|---|---|---|
| **1** | Isolamento RLS cross-tenant | **`calendar_entries`**: un *fornitore/participant* legge `client_name`/`notes`/`value` del cliente dalla **tabella base** (test **P5 rosso**) | — (il fix giusto richiede una tua decisione) | ⚠️ **BUCO APERTO — decisione Giovanni** |
| 1b | Resto dell'isolamento | anon su tabelle PII/audit; cross-tenant preventivi/prospect; participant→PII | RLS già corretta (provato P1/P2/P3/P4/P6 **verdi**) | ✅ provato |
| **2** | Viste che bypassano la RLS | **`v_salute_evento`** leggibile da **anon** (per-evento, cross-tenant): era `security_invoker` **off** | `security_invoker = on` + `revoke anon` (mig. `20260609020000`); test **V1 rosso→verde** | ✅ **CHIUSO e provato** |
| 3 | Cifratura PII a riposo | `doc_number`/`fiscal_code` in chiaro in `quote_acceptances` | Migrazione **esempio** pronta ma **inattiva** (`migrations-pending/`) | ⏸ **non attivata** — serve decisione (sotto) |
| 4 | Famiglia "funzioni esposte" (33 Edge Fn) | gate disinnescabili, relay/enumerazione | `funnel-cron` fail-closed + `suggest-alternatives` rate-limit (notte 1) | ⏸ **parziale** — sweep completo delle 33 NON fatto |
| 5 | Signed URL quasi-permanenti | URL firma/atto a 10 anni | URL brevi (15 min) + firma salvata come **key** (notte 1) | ⏸ **parziale** — endpoint permanente `/atto/{token}` NON implementato |
| 6 | Cancello anti-regressione PII | migrazioni PII senza test | — | ⏸ non fatto |
| 7 | Superficie domini non-core dietro flag | scope creep | — | ⏸ non fatto |

## ⬛️ Decisioni che aspettano TE

1. **BUCO #1 (`calendar_entries`) — il più importante.** Un fornitore in rete vede **nome/email/note/valore** del cliente del WP. Il fix non è banale perché RLS è **per-riga, non per-colonna**: togliere quelle policy toglie anche l'accesso **legittimo** del fornitore al proprio calendario/guadagni. **Scegli un approccio:**
   - (a) **Split PII**: spostare `client_name/client_email/notes/value_amount` in una tabella `calendar_entries_private` (RLS owner/couple/admin), lasciando in `calendar_entries` solo i campi non sensibili (data/titolo/stato) leggibili dai fornitori. *(Più pulito, è un piccolo refactor.)*
   - (b) **Solo vista**: i fornitori NON leggono più la tabella base (policy owner/couple/admin) e tutte le loro letture passano dalla vista ridotta + un RPC "guadagni" che ritorna solo i loro numeri. Decidere **se il fornitore può vedere `value_amount`**.
   - Dimmi quale e lo implemento con test rosso→verde.
2. **Cifratura PII (punto 3):** (a) **dove vive la chiave** — Vault (stessa istanza DB) vs cifratura applicativa nelle Edge Function (il DB non vede il plaintext); (b) **conservare il numero documento** o tenere solo un flag `identità_verificata` + ultime cifre (minimizzazione GDPR). *Tradeoff noto:* col Vault la chiave vive nello stesso DB — la versione blindata (chiave esterna o non-ritenzione) è una tua scelta, non la prendo io.
3. **Domini "core" (punto 7):** quali consideri davvero core (così metto gli altri dietro `feature_flags` spenti).

## 🟢 Cosa è stato fatto e PROVATO stanotte
- **Suite dinamiche** (DB reale): `rls_tests.sql` 9/9 ✅ · `pii_isolation_tests.sql` P1–P4,P6 ✅ / **P5 ❌ (finding aperto)** · `views_isolation_tests.sql` V1–V3 ✅.
- **Fix #2 applicato e provato** (vista `v_salute_evento`).
- `docs/SECURITY-RLS-AUDIT.md` aggiornato con **introspezione live** (sezione "ESITI DINAMICI LIVE").
- `tsc`/`npm run build` frontend: ✅ verde (modifiche solo SQL/edge).

## Dove mi sono fermato e perché
- **Punto 1**: il fix corretto rimuove accesso legittimo → **regola del prompt: fermati e annota**. Fatto.
- **Punti 3–7**: non raggiunti per tempo. Il prompt lo prevede: chiudere prima le **esposizioni** (1–2, fatte), poi il resto. 4 e 5 erano già parzialmente coperti dalla notte 1. Lo sweep delle 33 funzioni e l'endpoint `/atto` sono i prossimi.

## File del commit (branch)
```
docs/SECURITY-RLS-AUDIT.md                          (+ esiti live)
tests/sql/pii_isolation_tests.sql                   (bootstrap + P1 fix; P5 = finding)
tests/sql/views_isolation_tests.sql                 (nuovo)
supabase/migrations/20260609020000_fix_view_salute_evento_invoker.sql   (FIX #2)
supabase/migrations/20260608330000_blog_seed_gisko_daisylab.sql         (guard portabilità)
supabase/migrations/20260608370000_blog_seed_7posts.sql                 (guard portabilità)
NOTTE-REPORT.md
```
(+ i fix/file della notte 1 già sul branch)
