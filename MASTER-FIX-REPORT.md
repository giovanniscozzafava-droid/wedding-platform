# MASTER-FIX-REPORT — risoluzione audit adversariale

> Un branch per cluster, in sequenza 1→2→3→4→5. Ogni fix chiuso solo col ciclo rosso→verde sul test BRK + un positivo che prova che il legittimo regge. Niente su `main`/produzione, niente force-push.

## Stato dei 5 cluster
| # | Cluster | Branch | Stato |
|---|---|---|---|
| 1 | "FIRMATO è terminale" | `fix/1-firmato-terminale` | ✅ **chiuso e provato** |
| 2 | "Numeri accettati congelati" | `fix/2-snapshot-prezzi` | ⏸ da fare |
| 3 | "Limiti economici e concorrenza" | `fix/3-bounds-concorrenza` | ⏸ da fare |
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

**Dove mi sono fermato:** fine cluster 1. Prossimo: `fix/2-snapshot-prezzi` (E-SNAPSHOT-02/03, A-12/14/15).
