# MASTER-FIX-REPORT — risoluzione audit adversariale

> Un branch per cluster, in sequenza 1→2→3→4→5. Ogni fix chiuso solo col ciclo rosso→verde sul test BRK + un positivo che prova che il legittimo regge. Niente su `main`/produzione, niente force-push.

## Stato dei 5 cluster
| # | Cluster | Branch | Stato |
|---|---|---|---|
| 1 | "FIRMATO è terminale" | `fix/1-firmato-terminale` | ✅ **chiuso e provato** |
| 2 | "Numeri accettati congelati" | `fix/2-snapshot-prezzi` | ✅ **chiuso e provato** |
| 3 | "Limiti economici e concorrenza" | `fix/3-bounds-concorrenza` | ✅ **chiuso e provato** |
| 4 | "Contabilità: congelare" | `fix/4-freeze-contabilita` | 🧊 **congelato** (non si patcha la matematica) |
| 5 | "Cifratura/ritenzione PII: verifica" | — (solo verifica) | ✅ **verificato** · ⏸ 1 decisione a Giovanni |

**Ordine di revisione dei branch:** 1 → 2 → 3 → 4 → 5 (ognuno parte dal precedente).

---

## CLUSTER 1 — "FIRMATO è terminale" ✅
Branch `fix/1-firmato-terminale` · mig. `supabase/migrations/20260611010000_fix_cluster1_firmato_terminale.sql`.
Invariante imposta: **un atto FIRMATO non si ri-firma, non si ri-collega, non si controfirma prima della firma, non si cancella, e il suo registro legale non si separa mai da lui.** `signature_audit_trail` MAI toccato: le cancellazioni sono bloccate **a monte**.

| BRK | Fix | Test ora verde |
|---|---|---|
| A-07/07b | `contract_sign_full`: tolto `'FIRMATO'` dalla `WHERE`; se già FIRMATO ritorna idempotente **senza** riscrivere `signature_data` → niente overwrite del firmatario, niente divergenza dall'audit | C1-T1 |
| A-08 | `addendum_sign_full`: stesso fix (idempotente su FIRMATO) | C1-T2 |
| A-09 | `countersign_contract`: guard `status='FIRMATO' and signed_at is not null` (niente controfirma prima della firma) | C1-T3 |
| A-10/11 | `contract_sign_full`: aggiunti i check `token_revoked_at` e `access_token_expires_at` (firma fallisce se revocato/scaduto) | C1-T4 |
| A-06 | `contracts_enforce_quote_accettato`: esteso a `BEFORE UPDATE OF quote_id` + blocco re-link se il contratto è FIRMATO o la nuova quote non è ACCETTATO/CONVERTITO | C1-T5 |
| C-01/05/10 | `delete_quote_cascade` raise se atto firmato collegato + **trigger BEFORE DELETE** su `quotes` (backstop per ogni ruolo, anche superuser e cascate da `profiles`) + policy RLS `quotes_delete_owner` ristretta | C1-T6 |
| C-02/09 | `delete_wedding_cascade` raise + **trigger BEFORE DELETE** su `calendar_entries` + policy RLS `calentry_delete_owner` ristretta | C1-T7 |

**Ciclo rosso→verde provato:** prima i 12 blocchi BRK del cluster erano rossi; dopo la migrazione i 7 BRK-A (06/07/07b/08/09/10/11) e i 5 BRK-C (01/02/05/09/10) **non fanno più rosso** (operazione bloccata o resa innocua). I test sono **migrati a verdi permanenti** in `tests/sql/cluster1_firmato_terminale.sql` (7/7 verdi), che assertano sia il guard sia il **positivo** (firmare una bozza, controfirmare dopo la firma, cancellare una bozza/evento libero funzionano ancora).

**Regressione completa verde:** `rls_tests` 9/9 · `pii_isolation_tests` 22/22 · `views_isolation_tests` 3/3 · `tsc -b && vite build` ✅.

**Note / scelte:**
- I test C-09/C-10 cancellano come **superuser** (RLS non ferma il superuser) → il fix decisivo è un **trigger BEFORE DELETE** che scatta su ogni path; la restrizione delle policy RLS resta come difesa in profondità per l'owner authenticated.
- **BRK-C-04** (🟠 `contracts.supplier_id` SET NULL su FIRMATO) **lasciato aperto** come da piano ("se intricato, annota e lascia"): richiede RESTRICT o congelamento del firmatario in `signature_data`, va valutato col cluster sui dati.
- I blocchi adversariali risolti restano nei file `tests/adversarial/*.sql` come record storico, con header che indica "RISOLTI in Cluster 1"; la rete di regressione viva è il file verde.

**Dove mi sono fermato:** fine cluster 1. Prossimo: `fix/2-snapshot-prezzi`.

---

## CLUSTER 2 — "I numeri accettati sono congelati" ✅
Branch `fix/2-snapshot-prezzi` · mig. `supabase/migrations/20260611020000_fix_cluster2_snapshot_prezzi.sql`.
Invariante: una volta ACCETTATO/CONVERTITO_IN_CONTRATTO gli importi concordati sono immutabili; niente ricalcolo silenzioso; niente conclude/reopen/ridecisione fuori stato.

| BRK | Fix | Test verde |
|---|---|---|
| E-SNAPSHOT-02 | `quotes_default_markup_after_update`: se la quote è ACCETTATO/CONVERTITO ritorna senza ricalcolare `line_client` | C2-T1 |
| E-SNAPSHOT-03 | `quote_supplier_markup_after_change`: stesso status guard (legge lo stato della quote) | C2-T2 |
| A-15 | `quote_reopen`: aggiunto `status <> 'CONVERTITO_IN_CONTRATTO'` (non si riapre una convertita) | C2-T3 |
| A-14 | `quote_conclude_by_client`: conclude solo ACCETTATO/CONVERTITO (`not_accepted` altrimenti) | C2-T4 |
| A-12 | `client_decide_quote_item`: blocca se `contracted_at` valorizzato o quote CONVERTITO (`contracted`) | C2-T5 |

**Ciclo rosso→verde provato:** dopo la migrazione nessun BRK-A fa più rosso (tutta la famiglia A chiusa tra cluster 1 e 2). Verdi permanenti in `tests/sql/cluster2_snapshot_prezzi.sql` (5/5), con i **positivi**: su BOZZA il markup ricalcola ancora (130→180 / 130→250), un ACCETTATO chiuso si riapre, un ACCETTATO si conclude, una voce viva si decide.

**Regressione completa verde:** `rls_tests` 9/9 · `pii_isolation_tests` 22/22 · `views_isolation_tests` 3/3 · `cluster1` 7/7 · `tsc+vite build` ✅.

**Dove mi sono fermato:** fine cluster 2. Prossimo: `fix/3-bounds-concorrenza`.

---

## CLUSTER 3 — "Limiti economici e concorrenza" ✅
Branch `fix/3-bounds-concorrenza` · mig. `supabase/migrations/20260611030000_fix_cluster3_bounds_concorrenza.sql`.

| BRK | Fix | Test verde |
|---|---|---|
| D-01 / D-04 | CHECK sconto voce/totale `0..100` (prima ammettevano -1000 → prezzo 11×) | C3-T1 |
| D-02 | CHECK markup `0..1000` (no markup negativo); negativo bloccato anche dal sotto-costo | C3-T2 |
| D-06 | tipi `item_markup_percent`/`markup_percent` allargati a `numeric(6,2)` → markup 1000 storabile, CHECK coerente | C3-T3 |
| D-03 / D-14 | `quote_items_recalc_lines_v2`: voce di terzi non può finire sotto-costo (`item_below_cost`) | C3-T4 |
| D-18 / D-17 | `quotes_recalc_totals`: lo sconto non azzera più il costo proprio reale → `total_cost` resta, la perdita è VISIBILE nel margine | C3-T5 |
| D-07 | `opziona_data`: range invertito rifiutato (`invalid_range`) | C3-T6 |
| B-01 | exclusion constraint `sdo_no_overlap_active` (btree_gist) + `opziona_data` ritorna `date_already_optioned` | C3-T6 |
| B-03 | colonna `quotes.version` + trigger di bump + RPC `quote_save_guarded` (lost-update → `stale_version`) | C3-T7 |

**Ciclo rosso→verde provato:** dopo la migrazione nessun BRK-D in scope né BRK-B fa più rosso; verdi permanenti in `tests/sql/cluster3_bounds_concorrenza.sql` (7/7) con i **positivi** (sconto 10% ok, markup 1000 ok, voce sopra-costo ok, data libera opzionabile, save a versione corretta ok).

**Regressione completa verde:** `rls_tests` 9/9 · `pii_isolation_tests` 22/22 · `views_isolation_tests` 3/3 · `cluster1` 7/7 · `cluster2` 5/5 · `tsc+vite build` ✅. Catena migrazioni valida su `db reset` pulito.

**Lasciati aperti (non in questo cluster per il piano):** D-08 (data passata), D-09 (cap range opzione), D-11 (validazione email/CF), D-16 (arrotondamento per-riga, ⚪). Da assegnare a un cluster date/validazione futuro.

**Dove mi sono fermato:** fine cluster 3. Prossimo: `fix/4-freeze-contabilita`.

---

## CLUSTER 4 — "Contabilità: CONGELARE, non aggiustare" 🧊
Branch `fix/4-freeze-contabilita` · mig. `supabase/migrations/20260611040000_fix_cluster4_freeze_contabilita.sql`.
**Decisione del piano rispettata: NESSUN fix alla matematica dei soldi.** Il dominio referral/MRR/commissioni/recruiting è messo dietro il feature flag **`referral_accounting_enabled` = OFF**; le funzioni che coniano/saldano crediti diventano **NO-OP** finché il flag è spento.

| Cosa | Come |
|---|---|
| Flag dominio | nuovo `feature_flags.referral_accounting_enabled` **default false** |
| Conia-crediti gated | `autocredit_on_referred_contract`, `on_supplier_subscription_change`, `on_lead_closed_won`, `recruiting_activate_reward` → `return new` se flag OFF (niente credito coniato) |
| Saldo gated | `settle_supplier_credit` → `{error:'disabled'}` · `recruiting_settle_due` → `{ok:false, reason:'disabled'}` se flag OFF |

**Provato (freeze, NON matematica):** `tests/sql/cluster4_freeze_contabilita.sql` (5/5 verdi) dimostra che a flag OFF la superficie è **inerte**: firmare un contratto referenziato conia **0 crediti**, `settle_supplier_credit`/`recruiting_settle_due` rispondono `disabled`, il credito resta intatto.

**I test E-* restano EXPECTED-FAIL (come da piano):** `tests/adversarial/E_accounting.sql` accende il flag in testa e lo rispegne in coda, così continua a **documentare** i 9 bug (E-01..E-09) — riprodotti tutti — *da risolvere contro denaro reale al collegamento di Stripe*. Non spostati a verde: la matematica NON è stata toccata.

**Nota gating frontend:** la `feature_flags` non è letta dal FE (vedi NOTTE-REPORT), ma il gate è **a livello DB** → anche se l'UI referral resta visibile, il backend non produce alcun effetto finanziario (il rischio reale è neutralizzato). Nascondere l'UI è un follow-up FE minimale, non necessario per la sicurezza.

**Regressione completa verde:** `cluster1` 7/7 · `cluster2` 5/5 · `cluster3` 7/7 · `rls` 9/9 · `pii` 22/22 · `views` 3/3 · `tsc+vite build` ✅.

**Dove mi sono fermato:** fine cluster 4. Prossimo: `fix/5` (solo verifica).

---

## CLUSTER 5 — "Cifratura/ritenzione PII" ✅ verificato (nessun branch)
Non riaperto, come da piano. **Verificato** sul branch base:
- `supabase/migrations/20260610020000_signing_pii_retention.sql` presente nella catena;
- `purge_old_signing_pii(24)` esiste e **gira** (ritorna 0 su seed fresco: nessuna riga vecchia);
- colonna `quote_acceptances.doc_last4` + trigger `set_doc_last4` presenti;
- cron `purge-signing-pii` schedulato (`0 3 1 * *`).

**⏸ Decisione che resta a Giovanni (NON la prendo io):** se conservare il **numero documento** o tenere solo un **flag "identità verificata"** + `doc_last4`. Dipende dal provider di firma. Annotata come aperta.

---

## ✅ Riepilogo finale
Tutti e 5 i cluster chiusi nel senso giusto. **Ordine di revisione branch: 1 → 2 → 3 → 4 → 5.**

| # | Branch | Migrazione | Esito |
|---|---|---|---|
| 1 | `fix/1-firmato-terminale` | `20260611010000` | ✅ atti firmati intoccabili (A-06/07/07b/08/09/10/11, C-01/02/05/09/10) |
| 2 | `fix/2-snapshot-prezzi` | `20260611020000` | ✅ numeri accettati congelati (E-SNAPSHOT-02/03, A-12/14/15) |
| 3 | `fix/3-bounds-concorrenza` | `20260611030000` | ✅ limiti economici + concorrenza (D-01/02/03/04/06/07/14/18, B-01/03) |
| 4 | `fix/4-freeze-contabilita` | `20260611040000` | 🧊 contabilità inerte dietro flag (E-01..09 documentati, math non toccata) |
| 5 | — | (verifica `20260610020000`) | ✅ retention PII attiva · ⏸ 1 decisione Giovanni |

**Rete di regressione permanente:** `tests/sql/cluster1..4_*.sql` (24 test verdi) — nessun agente futuro può reintrodurre questi bug in silenzio. Ogni cluster: `db reset` pulito + `rls/pii/views` + `tsc+vite build` verdi.

**Resta aperto (non assegnato dal piano):** D-08 (data passata), D-09 (cap range opzione), D-11 (validazione email/CF), D-16 (round per-riga ⚪), C-04 (supplier_id NULL su FIRMATO 🟠), C-03/06/08 (orfani minori). Candidati a un cluster "date/validazione/orfani-minori" futuro.
