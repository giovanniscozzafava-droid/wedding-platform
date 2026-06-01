# Stress Audit Planfully — Report (2026-06-01)

Audit di sicurezza e integrità su **produzione** (`zfwlkvqxfzvubmfyxofs`), profilo WP `+provola`.

## Metodo
- **8 auditor paralleli** su dimensioni distinte (RLS/cross-tenant, macchine a stati, integrità referenziale, trigger/funzioni, constraint/validazione, flussi nuovi, edge function, autorizzazioni frontend).
- Ogni finding CRITICAL/HIGH passato a un **verificatore avversariale** che tentava di refutarlo ri-eseguendo il repro.
- Probe live su DB reale impersonando ruoli (`set role authenticated/anon` + JWT claims) per testare **davvero** la RLS (il client CLI gira come superuser e la bypasserebbe).
- Test lifecycle end-to-end di un intero matrimonio via le RPC reali, con cleanup.
- **31 agenti, ~1.6M token, 994 tool-use.** 67 finding grezzi.

## Esito sintetico
| Severità (grezza) | N | Dopo verifica avversariale |
|---|---|---|
| CRITICAL | 7 | **1 reale** (+1 catena dipendente) — 5 refutati |
| HIGH | 16 | **2 reali** — 14 refutati |
| MEDIUM | 22 | ~15 plausibili (data-integrity + logica) |
| LOW/INFO | 22 | hardening minore |

Il valore della verifica avversariale: **19 su 23** finding CRITICAL/HIGH erano falsi positivi (gli edge-function IDOR, il "gating solo client", la doppia firma, ecc. NON riproducibili). Quelli sopravvissuti erano concentrati e veri.

---

## 🔴 CRITICAL — TROVATO E GIÀ CORRETTO

### C1. Tabelle audit/interne esposte ad anonimo (RLS off + GRANT ALL) — **FIXATO**
`quote_acceptances_audit`, `contracts_legacy_audit`, `lead_submit_attempts` avevano **RLS disabilitata** e **GRANT ALL** (incl. TRUNCATE) ad `anon`/`authenticated`.

Confermato in prod impersonando `anon`:
- `quote_acceptances_audit` → letto **4 righe** con `signer_email`, **`doc_number` (numero documento d'identità)**, `signer_phone`, `ip_address`, **`access_token`** di clienti reali; UPDATE/DELETE riuscito sull'audit trail legale.
- `contracts_legacy_audit` → letto e cancellato (10 righe) l'audit firme contratti.
- `lead_submit_attempts` → letti IP, INSERT/TRUNCATE del meccanismo anti-spam.

**Catena**: l'`access_token` trapelato dalla tabella audit consentiva, via `quote_get_by_token`/`quote_accept_by_token`/`quote_reject_by_token` (grant anon), di **leggere e accettare/rifiutare preventivi di qualsiasi tenant**.

**Impatto**: chiunque conosca la anon key (pubblica per natura) accedeva a PII complete + documenti d'identità di tutti i clienti di tutti i tenant, e poteva manomettere l'audit legale delle firme.

**Fix applicato** (`20260601700000_audit_tables_lockdown.sql`, già in prod + commit `266699e`):
`ENABLE ROW LEVEL SECURITY` + `REVOKE ALL FROM anon, authenticated, public` su tutte e 3. Verificato: anon ora riceve `permission denied`; le scritture legittime (SECURITY DEFINER / service_role) continuano (testato `submit_lead_request` → ok).

---

## 🟠 HIGH — reali, da decidere
Entrambi **risolti dallo stesso fix C1** (erano le altre due tabelle): `contracts_legacy_audit` e `lead_submit_attempts` ora lockdown. Nessun HIGH residuo aperto dopo il fix.

I 14 HIGH refutati includevano (per trasparenza, NON sono bug): IDOR su edge function `quote-send`/`quote-generate-pdf`/`contract-generate-pdf` (in realtà validano il chiamante), "gating contratto solo client" (la RPC richiede comunque ACCETTATO; il bypass tocca solo i dati del WP stesso), doppia firma (c'è `unique(quote_id, quote_revision)`), `capostipite_add_supplier` senza consenso (in realtà crea PENDING), self-conflict disponibilità (già corretto), bypass role-gate con profile null (RequireAuth gestisce il caso).

---

## 🟡 MEDIUM — plausibili, raccomandati (NON ancora applicati)
Non applicati perché aggiungere CHECK su tabelle prod con dati esistenti va validato riga per riga prima.

**Data-integrity (mancano CHECK constraint):**
- `quotes`: `guest_count`/`table_count` negativi, `margin_amount` negativo, `margin_percent` fuori range accettati.
- `quote_items`: `paid_amount` > `line_client` (overpay), pagato negativo, costo negativo.
- `event_tables`: nessuna unicità `(entry_id, table_no)`, `seats=0`, `table_no` negativo.
- `event_guests`: `party_size` 0/negativo/2 mld, `seat_no`/`nights_count` negativi, email malformata.
- `event_subevents`: capacità negativa, presenze > capacità, budget/durata negativi.
- `budget_entries`/`scadenzario`: importi negativi.
- `calendar_entries`: `value_amount` negativo, periodo viaggio di nozze invertito (`honeymoon_end < start`), `date_to < date_from`.
- `insurance_policies`: premio negativo, `end_date < start_date`.
- `lead_requests`: email malformata, `guests_estimate` negativo, messaggio da 200KB (no length cap), data assurda.

**Logica/flusso:**
- `profiles_select_public` (USING `profile_visibility='PUBLIC'`) ritorna **l'intera riga** (incl. `fiscal_code`, `phone`, `address`, `pec`). Oggi dormiente (0 profili PUBLIC) ma una futura impostazione "pubblico" esporrebbe dati fiscali. → esporre i campi pubblici solo via le RPC `get_*_public_profile` (già esistenti, già filtrate).
- Token preventivo/contratto **senza scadenza** effettiva: `access_token_expires_at` non verificato in `quote_get_by_token`/`contract_get_by_token`. PII (nome/email cliente) leggibile da chi ha il token, per sempre. → enforce scadenza + valutare token monouso.
- Regressioni di stato legali (`ACCETTATO`→`BOZZA`) **non rilasciano** la disponibilità BUSY del fornitore → date restano bloccate a torto.
- Rilascio disponibilità solo su `date_from` per eventi **multi-giorno**: i giorni successivi restano BUSY dopo annullamento.
- Nessun trigger di validazione su `contracts.status`: salti/regressioni arbitrarie.
- FK SET NULL: cancellando un preventivo, il **contratto resta scollegato** (contratto senza preventivo) e l'evento diventa "wedding senza quote". Da decidere se è retention voluta o buco.
- `lead_transition` azzera `is_billable`/`billed_amount` ad ogni transizione non-CLOSED_WON → possibile perdita del dato di fatturazione.
- **26 eventi senza notifiche workflow** alla coppia: due fonti diverse di membership (`calendar_entry_participants` vs `wedding_couple_members`) non allineate.
- **Gating contratto per ambito è solo client-side** (confermato: la RPC/insert richiede solo `ACCETTATO`, non la conferma di tutti i fornitori in COMPLETO). Non è un buco di sicurezza (tocca solo i dati del WP), ma la regola di business che hai chiesto è aggirabile via chiamata diretta. → spostare il check in `create_contract_from_clauses`/trigger.

**Frontend:**
- Uso pervasivo di `(supabase as any)` / `as unknown as {...}` che nasconde nomi-tabella e assunzioni non verificate (manutenibilità + rischio di query non coperte da RLS).

---

## ✅ Cosa NON è rotto (verificato attivamente)
- **Isolamento multi-tenant** su `calendar_entries`, `quotes`, `event_guests`, ecc.: un WP/coppia/fornitore **non** legge dati altrui via RLS (testato impersonando i ruoli reali).
- **Lifecycle completo** lead → evento → questionario propagato → preventivo → `INVIATO`→`ACCETTATO` (nessun trigger esplode, **regressione enum già corretta tiene**) → readiness gating corretto (COMPLETO blocca finché i fornitori non confermano) → build matrimonio (guests/tavoli/sub-eventi) → cleanup. Tutto OK.
- Tutte le ~90 funzioni SECURITY DEFINER hanno `search_path` pinnato (no injection).
- Edge function (quote-accept-sign, quote-send, lead-notify, ecc.): gli IDOR ipotizzati sono stati refutati — validano il chiamante / usano gate atomici.

---

## Priorità consigliate
1. ✅ **C1 — FATTO** (lockdown audit tables). Verificare se serve **ruotare gli access_token** già esposti (erano leggibili da anon prima del fix).
2. **Scadenza/monouso token** preventivo+contratto (MEDIUM, sicurezza).
3. **Constraint hardening** data-integrity (batch di CHECK, previa validazione dati esistenti).
4. **Rilascio disponibilità** su regressione stato + multi-giorno.
5. **Gating contratto ambito lato server** (la regola di business).
6. Allineare le due fonti di membership coppia (notifiche mancanti su 26 eventi).
7. `profiles_select_public` → solo via RPC filtrate.

Report completo dei 67 finding: `tasks/wei88v4ix.output`.
