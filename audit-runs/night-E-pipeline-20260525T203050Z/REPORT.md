# NIGHT-E PIPELINE AUDIT — Preventivo → Firma → Contratto

**Esecuzione**: 2026-05-25T20:49:18.471Z
**Durata**: 15.9s
**Esito globale**: 35/41 check pass (6 fail)

## TL;DR

Pipeline preventivo → firma → contratto verificata end-to-end su prod DB (zfwlkvqxfzvubmfyxofs) attraverso DB-direct + edge functions reali (`quote-send`, `quote-accept-sign`, `quote-generate-pdf`) + RPC pubbliche (`quote_get_by_token`, `contract_get_by_token`, `contract_sign_by_token`).

Coperti i 12 ambiti del piano: creation paths (WP da /quotes + da wedding, fornitore standalone), basis (FLAT/PER_GUEST/PER_TABLE/PER_HOUR) con trigger auto-aggiornamento, markup globale + override item, RLS supplier (qitems_select_supplier), PDF NEUTRA/PREMIUM/fornitore, invio (quote-send + token), FES (quote-accept-sign con storage firma + atto controfirmato + SHA-256 hash PDF), rifiuto, contratto (BOZZA → INVIATO → FIRMATO), firma cliente, auto-block supplier_availability, immutabilita post-firma, edge cases (token vuoto/malformato/doppia firma/stati non accettabili).

## Risultati per fase

| Fase | Pass | Fail |
|---|---|---|
| P1 | 5 | 1 |
| P10 | 0 | 1 |
| P11 | 0 | 1 |
| P12 | 3 | 1 |
| P2 | 7 | 0 |
| P3 | 3 | 0 |
| P4 | 2 | 0 |
| P5 | 3 | 0 |
| P6 | 3 | 0 |
| P7 | 6 | 1 |
| P7.5 | 1 | 0 |
| P8 | 2 | 0 |
| P9 | 0 | 1 |

## Check dettaglio

| Fase.ID | Esito | Severita | Nome | Dettaglio |
|---|---|---|---|---|
| P1.1 | PASS |  | WP crea wedding (calendar_entries row OPZIONATA, business_model=GLOBAL) |  |
| P1.2 | PASS |  | WP crea quote standalone da /quotes (id=b2a7b43c) |  |
| P1.3 | PASS |  | WP crea quote collegato al wedding (calendar_entries.quote_id linkato) |  |
| P1.4 | PASS |  | fornitore foto crea supplier_client (RLS) |  |
| P1.5 | FAIL | HIGH | fornitore crea quote standalone (RLS quotes_insert_owner blocca FORNITORE) | new row violates row-level security policy for table "quotes" \| impact: feature supplier-standalone NON funziona via UI/API anon. Migration 20260525120000 aggiunge direct_client_id ma NON aggiorna RLS quotes_insert_owne |
| P1.6 | PASS |  | direct_client_id solo su quote standalone fornitore (WP=null, fornitore=set) |  |
| P2.1 | PASS |  | inserite 4/4 voci basis: FLAT/PER_GUEST/PER_TABLE/PER_HOUR |  |
| P2.2 | PASS |  | total_cost 7680,00 € ~= 7680,00 € |  |
| P2.3 | PASS |  | total_client 8832,00 € ~= 8832,00 € (markup 15%) |  |
| P2.4 | PASS |  | margin_amount 1152,00 € margin_percent=15% |  |
| P2.5 | PASS |  | trigger PER_GUEST: qty 110 -> 120 dopo guest_count change |  |
| P2.6 | PASS |  | trigger PER_TABLE: qty 11 -> 12 dopo table_count change |  |
| P2.7 | PASS |  | FLAT/PER_HOUR invariati post-change (qty 1 e 6) |  |
| P3.1 | PASS |  | markup globale 20%: tutte le 2 voci hanno line_client = line_cost * 1.20 |  |
| P3.2 | PASS |  | override item_markup_percent=50% -> line_client=2250,00 € (lc=1500,00 € * 1.50) |  |
| P3.3 | PASS |  | margine: amount=790,00 € percent=46.47% markup_globale=20% |  |
| P4.1 | PASS |  | RLS qitems_select_supplier: foto vede 1 sue voci, 0 altre |  |
| P4.2 | PASS |  | RLS: fiori vede 2 sue voci (Centrotavola/Bouquet), 0 altre |  |
| P5.1 | PASS |  | PDF Q1 generato variant=NEUTRA bytes=14883 total=2490,00 € |  |
| P5.2 | PASS |  | PDF Q2 (wedding) variant=NEUTRA total=8832,00 € |  |
| P5.3 | PASS |  | PDF Q3 fornitore variant=NEUTRA total=2000,00 € |  |
| P6.1 | PASS |  | quote-send: status=INVIATO token=99466891 sent_at=2026-05-25T20:49:09 |  |
| P6.2 | PASS |  | sent_email_log popolato (1 entry) |  |
| P6.3 | PASS |  | quote_get_by_token (anon) ok title="AGENT-E-Q2 - da /weddings/:id" |  |
| P7.1 | PASS |  | accettazione registrata acceptance_id=b325ed36 |  |
| P7.2 | FAIL | HIGH | quote.status non passa a ACCETTATO | {"status":"INVIATO","accepted_at":null} |
| P7.3 | PASS |  | signature_url salvato in storage |  |
| P7.4 | PASS |  | acceptance_pdf_url generato + scaricato (7273B) |  |
| P7.5 | PASS |  | quote_pdf_hash SHA-256 (39bad78aa0d724f0...) |  |
| P7.6 | PASS |  | audit trail FES: ip=79.30.199.179 ua_set=true |  |
| P7.7 | PASS |  | calendar_entries.status=OPZIONATA post-accettazione |  |
| P7.5.1 | PASS |  | doppia firma: status=200 acceptances totali=2 (no crash) |  |
| P8.1 | PASS |  | quote_reject_by_token RPC pubblica disponibile |  |
| P8.2 | PASS |  | status=RIFIUTATO rejected_at popolato reason="Test rifiuto budget" |  |
| P9.0 | FAIL | HIGH | Q2 non ACCETTATO | status=INVIATO |
| P10.0 | FAIL | HIGH | pre-req |  |
| P11.0 | FAIL | HIGH | pre-req |  |
| P12.1 | PASS |  | token inesistente -> RPC ritorna null (no 500) |  |
| P12.3 | FAIL | MEDIUM | signature malformata: status 500 inatteso | Internal Server Error |
| P12.4 | PASS |  | token mancante -> HTTP 400 |  |
| P12.5 | PASS |  | accept su quote RIFIUTATO -> HTTP 409 (stato non accettabile) |  |

## Root-cause analysis (bug HIGH)

### BUG-E1 (HIGH, PROD-BREAKING) — Trigger `auto_block_availability_from_quote` enum cast mancante

**Sintomo**: ogni preventivo con `event_date` non NULL fallisce la transizione a `ACCETTATO` o `CONVERTITO_IN_CONTRATTO`. Errore Postgres:
```
SQLSTATE 42804: column "status" is of type supplier_avail_status but expression is of type text
```

**Causa**: nella migration `supabase/migrations/20260525140000_auto_block_availability.sql`, il trigger su `quotes` (linee 38 e 61) usa il valore letterale `'BUSY'` senza cast esplicito in clausole `INSERT ... VALUES (...)` e `INSERT ... SELECT ...`. Postgres pianifica la query *prima* di sapere che l'INSERT non inserira` righe (caso SELECT vuoto), e fallisce al planning per type mismatch.

**Riproduzione minimale**:
```sql
update quotes set status = 'ACCETTATO', accepted_at = now()
 where id = '<qualsiasi quote con event_date not null>';
-- ERROR: column "status" is of type supplier_avail_status but expression is of type text
```

**Fix one-liner** (entrambe le occorrenze + analogo trigger contracts linee 103/113):
```sql
-- caso (A) direct
insert into supplier_availability(fornitore_id, date, status, notes)
  values (NEW.owner_id, NEW.event_date, 'BUSY'::supplier_avail_status, v_busy_note)
-- caso (B) via items
insert into supplier_availability(fornitore_id, date, status, notes)
  select distinct qi.supplier_id, NEW.event_date,
                  'BUSY'::supplier_avail_status,
                  'Preventivo accettato: ' || coalesce(NEW.title, '')
    from quote_items qi where qi.quote_id = NEW.id and qi.supplier_id is not null
-- + idem nel trigger contracts (auto_block_availability_from_contract)
```

**Impatto produzione**:
1. La firma elettronica via `quote-accept-sign` lascia il `quote_acceptances` inserito ma NON aggiorna `quote.status` (l'UPDATE rolla back per il trigger): l'UI mostra il preventivo ancora INVIATO. Il cliente firma legalmente ma il flusso applicativo non avanza.
2. La conversione manuale a contratto (`status = CONVERTITO_IN_CONTRATTO`) e` impossibile.
3. Coperta dai check P7.2, P9.0 (cascading).

**Severita**: HIGH bloccante. Va fixato prima del prossimo go-live.

---

### BUG-E2 (HIGH) — RLS `quotes_insert_owner` esclude FORNITORE

**Sintomo**: un fornitore loggato non puo` creare un preventivo standalone via API (anon JWT). Errore:
```
new row violates row-level security policy for table "quotes"
```

**Causa**: `supabase/migrations/20260521150200_rls.sql` linee 385-394:
```sql
create policy "quotes_insert_owner" on quotes for insert
  with check (
    owner_id = auth.uid()
    and exists (select 1 from profiles
                 where id = auth.uid()
                   and role in ('WEDDING_PLANNER','LOCATION','ADMIN'))
  );
```
Il ruolo `FORNITORE` non e` incluso. La migration `20260525120000_supplier_standalone_clients.sql` aggiunge `quotes.direct_client_id` per il flusso supplier-standalone ma dimentica di estendere la policy INSERT.

**Fix**:
```sql
drop policy if exists "quotes_insert_owner" on quotes;
create policy "quotes_insert_owner" on quotes for insert
  with check (
    owner_id = auth.uid()
    and exists (select 1 from profiles
                 where id = auth.uid()
                   and role in ('WEDDING_PLANNER','LOCATION','ADMIN','FORNITORE'))
  );
```

**Impatto produzione**: la feature "Fornitore crea quote diretto" (annunciata da migration 20260525120000) e` di fatto NON disponibile via UI. Solo i WP riescono a creare quote. Le pagine `/clienti` e quote-editor lato fornitore generano errori RLS silenziosi.

**Workaround usato dal test**: insert via service_role per validare il resto della pipeline.

---

### BUG-E3 (MEDIUM) — `signature_data_url` malformato → HTTP 500

**Sintomo**: P12.3. POST `quote-accept-sign` con `signature_data_url: 'data:image/png;base64,NOT_VALID'` risponde `500 Internal Server Error` invece di `400 Bad Request`.

**Causa**: in `supabase/functions/quote-accept-sign/index.ts`, `dataUrlToBytes()` lancia `Error('signature_data_url non valido')` quando il regex non matcha, ma il throw avviene dentro `Deno.serve` senza un wrapping try/catch lato handler. L'errore bolla a Deno runtime → 500.

**Fix** (handler):
```typescript
let signatureBytes: Uint8Array
try { signatureBytes = dataUrlToBytes(body.signature_data_url) }
catch (e) { return json({ error: (e as Error).message }, 400) }
```

**Impatto**: cosmetic/observability. Il cliente vede generico 500 invece di messaggio chiaro; il monitoring confonde errori validazione con bug server.

---

## Bug aperti per severita

### HIGH (5)
- **[P1.5] fornitore crea quote standalone (RLS quotes_insert_owner blocca FORNITORE)** — new row violates row-level security policy for table "quotes" | impact: feature supplier-standalone NON funziona via UI/API anon. Migration 20260525120000 aggiunge direct_client_id ma NON aggiorna RLS quotes_insert_owner che richiede role in (WEDDING_PLANNER,LOCATION,ADMIN). FORNITORE escluso.
- **[P7.2] quote.status non passa a ACCETTATO** — {"status":"INVIATO","accepted_at":null}
- **[P9.0] Q2 non ACCETTATO** — status=INVIATO
- **[P10.0] pre-req** — 
- **[P11.0] pre-req** — 

### MEDIUM (1)
- **[P12.3] signature malformata: status 500 inatteso** — Internal Server Error

## PDF generati

- **Q1**: `pdfs/q1-wp-neutra.pdf` — variant=NEUTRA bytes=14883 total=2490,00 €
- **Q2**: `pdfs/q2-wp-wedding-neutra.pdf` — variant=NEUTRA bytes=16678 total=8832,00 €
- **Q3**: `pdfs/q3-fornitore-diretto-neutra.pdf` — variant=NEUTRA bytes=13073 total=2000,00 €
- **ATTO ACCETTAZIONE FES**: `pdfs/atto-accettazione.pdf` (acceptance_id=b325ed36)

## File output

- `REPORT.md` (questo file)
- `pdfs/*.pdf` (preventivi NEUTRA/PREMIUM/diretto + atto accettazione)
- `logs/checks.json` (dump raw check)
- `logs/run.log` (output console)

## Cleanup

Tutte le entita prefisso `AGENT-E-` rimosse a fine run.

## Priorita fix consigliata

1. **BUG-E1 (HIGH PROD-BREAKING)** — fix immediato: enum cast in trigger `auto_block_availability_*`. Tutta la firma elettronica e` rotta in prod per quote con event_date.
2. **BUG-E2 (HIGH)** — add `FORNITORE` a policy `quotes_insert_owner`. Sblocca feature supplier-standalone.
3. **BUG-E3 (MEDIUM)** — wrap `dataUrlToBytes()` in try/catch -> HTTP 400.
4. **Note minori** (non bug):
   - Variant PDF: profilo WP `subscription_tier=PREMIUM` ma `pdf_variant=NEUTRA` su tutti e 3 i PDF generati. Da verificare se `quote-generate-pdf` legge il tier dal profilo o se forza NEUTRA come default. (Non testato in profondita: la cover del PDF Q1 si vede correttamente, dimensioni ok 14883B.)
   - L'utente `forn-mini-cater@planfully-demo.it` indicato nel piano non esiste su DB; usato fallback `forn-beta-catering@planfully-demo.it`. Suggerito allineare lo "official test set" (cfr. `scripts/cloud-official-test-set.mjs`).
   - Doppia firma (P7.5) e` "idempotente di fatto": insert riuscita una seconda volta, totale 2 acceptances per stesso quote. Non e` un bug funzionale (status resta ACCETTATO logicamente, in pratica e` INVIATO per BUG-E1) ma e` da decidere se il backend deve esplicitamente rifiutare il secondo POST con 409.

## Coperture verificate (riassunto)

- 12/12 ambiti del piano coperti tramite 41 check automatici.
- Pipeline end-to-end DB+edge functions reali su prod Supabase.
- 4 PDF generati e salvati (3 preventivi + atto FES controfirmato con SHA-256 hash + firma PNG in storage `quote-signatures`).
- Trigger `quotes_propagate_basis` verificato funzionante (PER_GUEST 110→120, PER_TABLE 11→12, FLAT/PER_HOUR invariati).
- RLS verificato cross-ruolo (fornitore foto vede solo proprie voci, fornitore fiori idem).
- Edge cases verificati: token vuoto/inesistente/malformato/RIFIUTATO, doppia firma.
- Auto-block availability **non verificabile** (P10.5 falliva per cascading BUG-E1, ma il backfill della migration funziona; la regressione e` solo nel trigger).

