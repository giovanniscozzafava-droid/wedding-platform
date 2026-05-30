# Revisione modello — capostipite-erogatore + ambiti dinamici

Documento di tracciamento delle revisioni applicate al modello dati e al
flusso "prossima mossa" del nuovo workflow capostipite-erogatore.

Ogni sezione viene appesa via task automatici: contiene differenze schema vs
spec trovate, migrazioni create, file frontend toccati, esito build.

---

## Task A — Proprieta' azioni + 0 EUR

### Differenze schema vs spec trovate

- **`refresh_notifiche_per_evento` (FASE 2.1, file
  `supabase/migrations/20260530200000_fase2_notifiche.sql`)**:
  nello stato `LEAD` l'OWNER del calendar_entry (capostipite) riceveva una
  notifica `FIRMA_INCARICO` con titolo "Firma l'incarico capostipite". Nel
  nuovo modello capostipite-erogatore e` semanticamente errata: in LEAD non
  esiste ancora un incarico, e` il capostipite che lo PROPONE alla coppia. La
  coppia firma in un secondo momento (`COPPIA_FIRMA_INCARICO`). Fix con
  CREATE OR REPLACE della funzione (vedi migrazione nuova).
- **`COPPIA_FIRMA_INCARICO`**: il link era statico `/couple` e il titolo
  generico ("Firma l'incarico col tuo wedding planner"). Nel nuovo modello il
  capostipite puo` essere Location o altro: serve deep-link
  `/couple?firmaIncarico=<entry_id>` e titolo personalizzato col nome del
  capostipite ("Firma l'incarico con <nome>").
- **`quote_items.quantity`**: la colonna ha una check column-level inline
  `quantity > 0` (file `20260521150000_schema.sql` riga 222). E` *piu`
  restrittiva* del successivo constraint `qitems_quantity_range` (>= 0 AND
  <= 99999) aggiunto da `20260526020000_quote_hardening.sql`. Postgres applica
  *entrambe* le check: la column-level inline bloccava ancora `quantity = 0`.
  Fix con drop dinamico (per nome auto-generato) + ricreazione nominata
  `qitems_quantity_non_negative` (>= 0).
- **Tutti gli altri vincoli numerici** (`quotes.total_cost`,
  `quotes.total_client`, `quote_items.snapshot_price`, `services.base_price`,
  `service_modifiers.price`, `scadenzario_voci.importo_eur`) **gia` permettono
  zero** (check `>= 0`). Verificato file-by-file. Nessun trigger
  (`trg_quotes_validate_status` in `20260526020000_quote_hardening.sql` e
  successivi v2/v3) impone min > 0 sui totali.

### Migrazioni create

1. **`supabase/migrations/20260531100000_revisione_a_fix_proprieta_azioni.sql`**
   - `CREATE OR REPLACE function public.refresh_notifiche_per_evento(uuid)`
   - LEAD owner: tipo `PROPONI_INCARICO`, titolo "Proponi il tuo incarico
     alla coppia", link `/quotes?entry=<id>`, priorita 9.
   - LEAD coppia: tipo `COPPIA_FIRMA_INCARICO`, titolo "Firma l'incarico
     con <nome capostipite>", link `/couple?firmaIncarico=<id>`, priorita 9.
   - Nome capostipite letto da `profiles.full_name`, fallback
     `profiles.business_name`, fallback "il tuo capostipite".
   - Le chiusure "DONE" dei tipi obsoleti escludono i `PROMEMORIA_%` (FASE 4)
     e le `COPPIA_%` (cosi` la coppia continua a vedere la sua TODO mentre
     l'owner avanza la propria).
   - Backfill: chiude le `FIRMA_INCARICO` PENDING legacy assegnate
     all'owner; rigenera le notifiche per tutti i `calendar_entries` in stato
     LEAD per produrre subito i nuovi titoli/link.
2. **`supabase/migrations/20260531110000_revisione_a_allow_zero.sql`**
   - Drop dinamico via `pg_constraint` di qualsiasi check anonima su
     `quote_items.quantity` con `>` ma senza `>=`.
   - Add `qitems_quantity_non_negative` (`quantity >= 0`) idempotente.
   - `COMMENT ON COLUMN` espliciti su `quotes.total_client`,
     `quotes.total_cost`, `quotes.margin_amount`, `scadenzario_voci.importo_eur`
     che documentano "0 valido, caso incarico gratuito Location".

### File frontend toccati

Nessun file frontend modificato. Verifiche eseguite:
- `frontend/src/pages/QuoteEditorPage.tsx`: nessun `min="1"` su campi
  monetari, riga 568 ha `<Input type="number" step="0.5">` su quantity senza
  min (OK con `quantity >= 0` lato DB).
- `frontend/src/components/wedding/PagamentiTab.tsx` riga 103-104: la
  validazione client e` `Number.isFinite(importo) || importo < 0` -> ammette
  gia` zero.
- `frontend/src/components/wedding/AllContractsMonitor.tsx`: nessuna
  validazione `> 0` su importi.
- Unici `min="1"` trovati nel repo sono su `party_size` (Guests/RSVP) e
  sono semanticamente corretti (party di 0 persone non ha senso) — non
  toccati.
- `QuoteEditorPage.tsx` riga 289-291: `amount <= 0` blocca *solo* la
  registrazione di un *acconto* esplicito (non puo` essere zero, e` un
  pagamento parziale). Lasciato com'era: registrare "acconto 0" e` un caso
  d'uso degenere (semanticamente `NON_PAGATO` o `SALDATO`).

### Esito build

- `cd frontend && npm run build` -> PASS (1.01s, vite, nessun warning
  bloccante). Output snapshot conservato dal task runner.

### Note

- `supabase db reset --local` non eseguito (vincolo: il task chiede solo
  build pass e file migrazione pronti). Le migrazioni sono idempotenti e
  pronte all'applicazione su DB pulito o esistente.
- Il deep-link `/couple?firmaIncarico=<entry_id>` e` solo emesso dalla
  notifica: il componente `CoupleDashboard` potra` leggere il query param
  in un task successivo per scrollare/aprire automaticamente il modal di
  firma incarico.
