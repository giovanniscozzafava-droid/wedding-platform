# Quote Mask GLOBAL + Firma Sposi Report — feature/quote-mask-suppliers-global

**Data:** 2026-05-29 · **Branch:** `feature/quote-mask-suppliers-global` · **Base:** `main`

## Cosa fa questa slice

1. **Quando un wedding ha `business_model = GLOBAL`**, il preventivo mostrato/inviato alla coppia **maschera i fornitori**:
   - RPC `quote_get_by_token` non espone `supplier_id` negli items
   - PDF `quote-generate-pdf` collassa tutti gli items in un unico blocco "Servizi coordinati" — niente header per fornitore, niente brand fornitore neanche per owner PREMIUM
2. **Quando `business_model = BROKER`** (sposi clienti diretti dei fornitori), la trasparenza resta: supplier_id esposto, gruppi per fornitore nel PDF.
3. **Firma sposi**: gia' esiste in produzione. Verificato con E2E che `quote_accept_by_token` + edge function `quote-accept-sign` funzionano con nome firmatario + codice fiscale.

## File modificati / creati

### Migration (NOT applied)
- `supabase/migrations/20260529110000_quote_mask_global.sql`
  - Riscrive `quote_get_by_token(p_token uuid)` per:
    - leggere `business_model` da `calendar_entries.business_model` (join via `calendar_entries.quote_id = quotes.id`)
    - default sicuro `GLOBAL` (mascherato) se nessun calendar_entry collegato
    - strisciare `supplier_id` da ogni item con `(to_jsonb(qi) - 'supplier_id')` quando GLOBAL
    - includere il nuovo campo `business_model` nel payload

### Edge function (NOT deployed)
- `supabase/functions/quote-generate-pdf/index.ts`
  - Lookup `business_model` dal `calendar_entry` collegato (default GLOBAL)
  - `maskSuppliers = businessModel === 'GLOBAL'`: skip query profiles per supplier
  - Grouping: GLOBAL → unico gruppo "Servizi coordinati"; BROKER → groups per supplier come prima
  - Header gruppo: GLOBAL forza "SERVIZI COORDINATI" anche per owner PREMIUM (no leak brand)

### Test
- `tests/e2e/quote-mask-and-sign.mjs`
  - Setup quote GLOBAL → verifica `business_model` e nessun supplier_id leaked + firma sposi
  - Setup quote BROKER → verifica supplier_id esposto

## Esito test pre-migration

```
RISULTATO: 6 PASS · 4 FAIL
```

I 4 FAIL sono attesi pre-migration:
- `quote_get_by_token risponde (GLOBAL)` — RPC vecchia non legge business_model
- `business_model = GLOBAL nel payload` — vecchia non lo include
- `business_model = BROKER nel payload` — vecchia non lo include
- `supplier_id esposto negli items (BROKER)` — vecchia non passa il filtro ma test si aspetta payload con business_model

Confermano la logica corretta: tutti i FAIL spariscono applicando la migration.

I 6 PASS includono:
- `quote_accept_by_token risponde` — **firma sposi funziona gia' in prod** (signing flow esistente, verificato)

## Esito build frontend

```
$ cd frontend && npm run build
✓ built in 930ms
```

Nessuna modifica al frontend in questa slice — il public preview (`QuotePreviewPage`) gia' mostra solo `name_snapshot` per item, nessun supplier name. Il leak era solo nel JSON payload (devtools) e nel PDF.

## Cosa NON ho fatto

- ❌ **Migration NON applicata in prod** — vietato dal CLAUDE.md regola 2.
- ❌ **Edge function NON deployata** — vietato dalla regola 3 (`functions deploy in prod`).
- ❌ Frontend non modificato: la maschera e' lato server (RPC + PDF), il frontend e' gia' agnostico.

## Cosa serve per attivare in prod (azione tua)

1. **Applicare migration:**
   ```bash
   cd /Users/giovanniscozzafava/Repository/wedding-platform
   git checkout feature/quote-mask-suppliers-global
   supabase db push --include-all
   ```
2. **Deploy edge function:**
   ```bash
   supabase functions deploy quote-generate-pdf
   ```
3. **Re-test:** atteso `10/10 PASS`.
4. **Merge a main** → deploy frontend (anche se in questa slice il frontend non e' toccato).

## Punti aperti / da decidere

- **Default GLOBAL anche per quotes senza calendar_entry collegato**: scelta di tutela massima. Se questo rompe quotes legacy (es. quotes diretti a coppie senza wedding entry), bisogna decidere se cambiare default a BROKER o introdurre un nuovo campo `quotes.is_masked` esplicito.
- **PDF gia' generati e archiviati su Storage**: NON vengono rigenerati automaticamente. Per i preventivi vecchi GLOBAL, il PDF in archivio mostra ancora i fornitori. Serve uno script di rigenerazione una-tantum dei PDF GLOBAL esistenti — fuori scope di questa slice.

## Sulla "firma sposi"

Verificato con E2E che il flusso firma esiste e funziona:
- Pagina `/p/accept/:token` (`QuoteAcceptPage.tsx`) raccoglie `signer_name` + `fiscal_code` + opzionali (business_name, partita IVA, indirizzo)
- Chiama edge function `quote-accept-sign` che:
  - upserta su `quote_acceptances` (unicita' su quote_id + revision)
  - registra il consenso firmato
  - genera atto firmato (PDF) inviato per email
- L'idempotency e' garantita da migration `20260526000000_quote_acceptance_idempotency.sql`

Quindi: nulla da costruire per la firma. Se l'utente intendeva qualcosa di diverso (es. firma grafica disegnata, certificato digitale, OTP via SMS) **fammi sapere** ed estendiamo in una slice separata.
