# MASTER-FIX-REPORT — risoluzione audit adversariale

> Un branch per cluster, in sequenza 1→2→3→4→5. Ogni fix chiuso solo col ciclo rosso→verde sul test BRK + un positivo che prova che il legittimo regge. Niente su `main`/produzione, niente force-push.

## Stato dei 5 cluster
| # | Cluster | Branch | Stato |
|---|---|---|---|
| 1 | "FIRMATO è terminale" | `fix/1-firmato-terminale` | ✅ **chiuso e provato** |
| 2 | "Numeri accettati congelati" | `fix/2-snapshot-prezzi` | ✅ **chiuso e provato** |
| 3 | "Limiti economici e concorrenza" | `fix/3-bounds-concorrenza` | ✅ **chiuso e provato** |
| 4 | "Contabilità: congelare" | `fix/4-freeze-contabilita` | ⏸ da fare |
| 5 | "Cifratura/ritenzione PII: verifica" | — (solo verifica) | ⏸ da fare |

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

**Dove mi sono fermato:** fine cluster 3. Prossimo: `fix/4-freeze-contabilita` (congelare, NON patchare la matematica dei soldi).
