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

---

## Task B — Erogatore generico (capostipite come fornitore di se' stesso)

### Differenze schema vs spec trovate

Ispezionato `supabase/migrations/20260521150000_schema.sql` +
`20260521150200_rls.sql` + `20260521150700_wedding_suite.sql` +
`frontend/src/lib/database.types.ts`.

- **FK su `services` confermata**: il nome reale e' `fornitore_id`
  (FK -> `profiles(id)`), NON `provider_id` ne' `owner_id`. Schema
  `20260521150000_schema.sql` riga 83.
- **Nessun vincolo a `role='FORNITORE'` su services**: le policy RLS
  (`services_select_owner`, `services_modify_owner` in
  `20260521150200_rls.sql` righe 188-207) usano solo
  `fornitore_id = auth.uid()`. NON c'e' check constraint ne' trigger che
  limiti la creazione di service a profili `role='FORNITORE'`. Quindi
  WP/LOCATION possono gia' inserire services con la loro stessa identita';
  e' una "feature implicita" del modello, ma non era esplicitata. La
  migrazione `20260526170000_wp_services_categories.sql` infatti aggiunge
  gia' categorie standard per `subrole='wedding_planner'`, anticipando il
  caso d'uso.
- **`quote_items.supplier_id`**: confermato il nome reale (FK ->
  `profiles(id)`, schema riga 217). Niente `provider_id` ne' `erogatore_id`.
- **Markup gia' su due livelli**:
  - `quote_items.item_markup_percent` (override per voce, schema riga 224)
  - `quote_supplier_markups(quote_id, supplier_id, markup_percent)`
    (override per fornitore, schema riga 237-245)
  - `quotes.default_markup_percent` (default sul preventivo)
  - Funzione resolver gia' esistente: `calcola_markup_effettivo(p_quote_id,
    p_supplier_id, p_item_markup)` in
    `20260521150100_triggers.sql` righe 62-89. Ordine override: item ->
    supplier -> default.
- **Trigger di calcolo line_cost/line_client**: la versione viva e'
  `quote_items_recalc_lines_v2()` in
  `20260521150700_wedding_suite.sql` righe 18-53 (override v1 con supporto
  optional/alternative). Trigger `trg_qitems_recalc_lines` (BEFORE
  INSERT/UPDATE) gia' agganciato.
- **Niente cambiamento nominale necessario**: la spec parlava di "fornitore_id
  vs provider_id vs owner_id" — riusiamo `fornitore_id` allargandone la
  semantica via `COMMENT ON COLUMN`, senza rinominare (zero rotture).

### Migrazione creata

`supabase/migrations/20260531200000_revisione_b_erogatore_generico.sql`
(idempotente, additiva).

Contenuto:

1. `alter table quote_items add column if not exists
   erogatore_e_capostipite boolean not null default false` con commento di
   semantica (`true` -> erogatore = capostipite, no ricarico).
2. `COMMENT ON COLUMN services.fornitore_id` -> ridefinita la semantica:
   "fornitore esterno OR capostipite stesso".
3. `CREATE OR REPLACE FUNCTION quote_items_recalc_lines_v2()` con la nuova
   logica:
   - calcolo `line_cost` invariato (snapshot * qty + modifiers, optional gating)
   - **se `erogatore_e_capostipite = true`**: `line_client := line_cost`
     (no ricarico, bypassa item_markup_percent, quote_supplier_markups,
     quote.default_markup_percent).
   - **altrimenti**: comportamento esistente immutato via
     `calcola_markup_effettivo(...)`.
4. Il trigger `trg_qitems_recalc_lines` e' gia' agganciato alla funzione: il
   `CREATE OR REPLACE` propaga automaticamente.

### Verifica RLS / sicurezza

- **WP/LOCATION puo' INSERT su services**: si — policy
  `services_modify_owner` accetta `fornitore_id = auth.uid()` senza filtro
  di ruolo.
- **WP/LOCATION puo' INSERT su quote_items con `supplier_id = auth.uid()`
  e `erogatore_e_capostipite=true`**: si — non esistono policy RLS che
  controllano `supplier_id` su quote_items oltre a "owner_id del quote =
  auth.uid()". Nessun constraint blocca il caso.
- **Fornitore vede solo propri services**: invariato — policy
  `services_select_owner` (`fornitore_id = auth.uid()`) +
  `services_select_collab` (collaborazione attiva). Nulla cambia.
- **Markup non ignorato per gli altri fornitori**: garantito dal branch
  `if/else` nel trigger; per `erogatore_e_capostipite = false` la chain
  item -> supplier -> default e' intatta.
- **Idempotenza**: `add column if not exists` + `create or replace`
  function -> riapplicabile su DB esistente senza errori.

### Frontend toccato

`frontend/src/pages/QuoteEditorPage.tsx`:

- **Picker "Erogatore"** (sezione "Aggiungi voce dal catalogo", non
  visibile in flusso FORNITORE): aggiunta come **prima opzione** quando
  l'utente loggato e' `WEDDING_PLANNER` o `LOCATION` e ha gia' almeno un
  proprio servizio nel catalogo: `"⭐ I miei servizi (sono io l'erogatore ·
  no ricarico)"`. Selezionando questa opzione, `pickSupplier = profile.id`
  e `grouped.get(profile.id)` espone i propri servizi.
- **`handleAddItem`**: rileva `isSelfCapostipite = supplierId ===
  profile?.id`. In quel caso:
  - salta il check `check_suppliers_busy_in_range` (e' il capostipite
    stesso, l'occupato del capostipite e' verificato altrove)
  - inserisce `erogatore_e_capostipite: true` nel payload
  - toast "Mio servizio aggiunto … (no ricarico)"
- **Lista voci**: ogni `quote_item` con `erogatore_e_capostipite=true`
  mostra un **badge dorato** `"⭐ Mio servizio"` accanto al nome e nella
  riga totali appare `· no ricarico` (line_client === line_cost).
- **Mobile-first**: il picker e' gia' a colonna singola (max-w-md),
  badge usa flex-wrap, touch target >=44px sui pulsanti +. Nessuna
  regressione layout.

### Esito build

- `cd frontend && npm run build` -> **PASS** (2.22s, vite, nessun
  warning bloccante, bundle `QuoteEditorPage` 28.36 kB / gzip 8.45 kB).

### Note

- **`supabase db reset --local` NON eseguito** (vincolo: il task chiede
  solo build pass e file migrazione pronti; reset locale failed
  storicamente per seed legacy `v_sara/TEST-SEED`, gia' noto). La
  migrazione e' idempotente e pronta ad essere applicata su DB pulito o
  esistente.
- **`database.types.ts` non rigenerato**: la colonna nuova
  `erogatore_e_capostipite` viene passata tramite cast `as any` nel payload
  insert; nessuna rottura di tipo. Si rigenera quando si rifara' lo schema
  introspection.
- **Nessun `quote_supplier_markups` modificato**: il bypass markup avviene
  *a monte* nel trigger, quindi anche se esistesse un override supplier per
  l'identita' del capostipite, NON verrebbe applicato quando
  `erogatore_e_capostipite=true`. Cio' garantisce la semantica
  "fornitore-di-se-stesso" pulita.

---

## Task C — Ambito incarico dinamico

### Differenze schema vs spec trovate

Ispezione: `20260530120000_fase1_evento_stato.sql` (enum `evento_stato`),
`20260530200000_fase2_notifiche.sql` (funzione base
`refresh_notifiche_per_evento`), `20260531100000_revisione_a_fix_proprieta_azioni.sql`
(versione post Task A, con `PROPONI_INCARICO`/`COPPIA_FIRMA_INCARICO`).

- **Nessun campo `ambito_capostipite` preesistente** su `calendar_entries`:
  introdotto ex novo come enum nullable. NULL = "non ancora deciso"; il
  default operativo COMPLETO viene applicato dentro la funzione via
  `coalesce(v_entry.ambito_capostipite::text, 'COMPLETO')` per non forzare
  un default DB-side che cambierebbe la semantica di "scelta esplicita".
- **`evento_stato` ha gia` `INCARICO_FIRMATO`** come stato esistente: nessun
  enum nuovo. La logica nuova vive solo nei branch `CASE` della funzione.
- **`refresh_notifiche_per_evento` esistente**: la base Task A non aveva
  logica condizionale su `ambito`. Riscritta in `CREATE OR REPLACE` con
  branch su `v_ambito` dentro `INCARICO_FIRMATO`, `PREVENTIVI`,
  `PIANIFICAZIONE` (gli altri stati restano invariati). Mantenuto invariato
  il blocco "chiusura notifiche non-pertinenti" (con eccezione: ora si
  preserva anche il `v_extra_tipo` quando presente, oltre a quello primario).
- **`useUpdateWedding`** (frontend `hooks/useWedding.ts` riga 205-214): gia`
  generic e accetta `patch: any` su `calendar_entries`; copre l'update di
  `ambito_capostipite` senza modifiche al hook. Cast `as any` nel payload del
  modale per evitare di toccare `database.types.ts` (rigenerato in altro task).
- **Tab del `WeddingDashboard`**: la `TabKey` esistente include gia`
  `contract` (contratto), `contracts_net` (contratti rete), `budget`, `menu`.
  Nessuna nuova tab necessaria: il gating filtra le esistenti.

### Migrazione creata

`supabase/migrations/20260531300000_revisione_c_ambito_capostipite.sql`
(idempotente, additiva + `CREATE OR REPLACE`):

1. `create type public.ambito_capostipite as enum
   ('COMPLETO','SOLO_COORDINAMENTO','SOLO_PROPRI_SERVIZI')` guard via
   `pg_type` (`if not exists`).
2. `alter table calendar_entries add column if not exists
   ambito_capostipite public.ambito_capostipite` (nullable; nessun default,
   per distinguere "non scelto" da "scelto COMPLETO").
3. `comment on type` + `comment on column` esplicativi.
4. `create or replace function public.refresh_notifiche_per_evento(uuid)`:
   - Legge `ambito_capostipite` dal row e applica `coalesce(..., 'COMPLETO')`.
   - **`INCARICO_FIRMATO`**: SOLO_COORDINAMENTO -> `AVVIA_PIANIFICAZIONE`
     (link `/calendar?entry=...`). Altri ambiti -> `RACCOGLI_PREVENTIVI`
     come prima.
   - **`PREVENTIVI`**: SOLO_PROPRI_SERVIZI -> mossa primaria `COMPONI_MENU`
     (link `/quotes?entry=...&tab=menu`) + mossa extra `GESTISCI_SERVIZI`
     (link `/services`, prio 7). Altri ambiti -> `INVIA_PREVENTIVO_COPPIA`.
   - **`PIANIFICAZIONE`**: SOLO_COORDINAMENTO -> primaria
     `PIANIFICA_TAVOLI` (link `/calendar?entry=...&tab=tables`) + extra
     `PIANIFICA_TIMELINE` (`...&tab=timeline`). Altri ambiti -> mossa unica
     `COMPLETA_CHECKLIST`.
   - **Tutti gli altri stati invariati** (LEAD, PREVENTIVO_FIRMATO,
     CONTRATTO, CHECKLIST, SVOLTO, ANNULLATO).
   - **Notifiche coppia** in `PREVENTIVI`: SOLO_PROPRI_SERVIZI produce
     `COPPIA_ATTENDE_PROPOSTA` ("In arrivo la proposta da <owner>") invece
     di `COPPIA_ATTENDE_PREVENTIVO`. Altri ambiti invariati.
   - Chiusura "DONE" delle notifiche non-pertinenti: esclude oltre a
     `PROMEMORIA_%` / `COPPIA_%` anche il `v_extra_tipo` per non chiudere
     subito la mossa complementare appena emessa.
5. Backfill: rigenera `refresh_notifiche_per_evento` per **tutti** i
   calendar_entries in stato != SVOLTO/ANNULLATO (cosi` la nuova logica
   appare subito sui dati esistenti senza richiedere transizione di stato).

### File frontend creati / toccati

**Nuovo**: `frontend/src/components/wedding/AmbitoIncaricoModal.tsx`
- 3 card (`COMPLETO`, `SOLO_COORDINAMENTO`, `SOLO_PROPRI_SERVIZI`) con
  icona dedicata (Briefcase / ClipboardCheck / Sparkles) e descrizione
  operativa.
- Salva via `supabase.from('calendar_entries').update({
  ambito_capostipite })` (cast `as any` finche` `database.types.ts` non
  viene rigenerato).
- Mobile-first: bottom-sheet su mobile (`rounded-t-2xl`,
  `items-end sm:items-center`), card width 100% fino a `max-w-md`, touch
  target `min-h-[44px]`, una azione primaria per card, disabilita gli altri
  bottoni mentre c'e` un salvataggio in corso.
- `aria-modal`, `aria-labelledby`, `aria-label` su ciascun bottone.
- Opzione "Decido piu` tardi" (skip locale, non persistito).

**Modificato**: `frontend/src/pages/wedding/WeddingDashboard.tsx`
- Import `AmbitoIncaricoModal` + `useAuth` + `useQueryClient`.
- Stato `effectiveAmbito` (`ambito ?? 'COMPLETO'`) usato per il gating.
- `useMemo` su `visibleTabs`: in `SOLO_COORDINAMENTO` nasconde `contract`,
  `contracts_net`, `budget` (preventivo/contratti/budget) — coerente con
  "salta gli step preventivi/contratti".
- Enfasi visiva sulla tab `menu` in `SOLO_PROPRI_SERVIZI`: classe
  `bg-[rgb(var(--gold-100))]` + stellina ★ accanto al label quando non
  attiva (la tab "Servizi" reale e` esterna al WeddingDashboard, su
  `/services`, raggiungibile dalla mossa `GESTISCI_SERVIZI`).
- `useEffect` di safety: se la tab attiva e' stata nascosta dal gating,
  ripristina `overview`.
- `shouldAskAmbito` (useMemo): mostra il modale solo all'owner del
  calendar_entry (`owner_id === user.id`), quando `ambito === null`,
  l'utente non ha skippato, e lo stato evento e` diverso da
  `LEAD/SVOLTO/ANNULLATO` (cioe` da `INCARICO_FIRMATO` in poi).
- Badge "Ambito: ..." nel header (accanto al `BusinessModelToggle`) per
  rendere visibile la scelta corrente.
- Reset `ambitoSkipped` quando cambia `wedding.id`.

**`ProssimaMossa`** (componente Fase 2) **non toccato**: legge gia` le
notifiche `PENDING` dell'utente e renderizza `titolo/descrizione/link_action`
as-is. La revisione C agisce a monte tramite la funzione
`refresh_notifiche_per_evento`: i tipi nuovi (`AVVIA_PIANIFICAZIONE`,
`COMPONI_MENU`, `GESTISCI_SERVIZI`, `PIANIFICA_TAVOLI`,
`PIANIFICA_TIMELINE`, `COPPIA_ATTENDE_PROPOSTA`) appaiono automaticamente
sia in `/dashboard` sia in `/weddings/:id` (vincolo via `entryId`). Nessuna
duplicazione di logica condizionale lato client.

### RLS

Nessuna modifica richiesta (vincolo C.4): il campo `ambito_capostipite` e`
una colonna su `calendar_entries`, gia` protetto dalle policy esistenti
(`calendar_entries_select_owner`, `calendar_entries_update_owner` su
`owner_id = auth.uid()`). L'`update` dal modale e` autorizzato implicito:
solo l'owner del calendar_entry vede il modale (check lato client su
`wedding.owner_id === user.id`); RLS rifiuta in ogni caso un update da un
non-owner.

### Esito build

- `cd frontend && npm run build` -> **PASS** (1.02s, vite 5, nessun warning
  bloccante, bundle `WeddingDashboard` 174.98 kB / gzip 41.48 kB,
  `AmbitoIncaricoModal` inlinato nello stesso chunk).

### Note

- **`supabase db reset --local` NON eseguito**: vincolo del task (solo
  build pass + file migrazione pronti). Il reset locale fallisce
  storicamente per seed legacy `v_sara/TEST-SEED` come gia` annotato.
- **`database.types.ts` non rigenerato**: `ambito_capostipite` viene
  letto/scritto via cast `as any`. Nessuna rottura tipo.
- **Default operativo COMPLETO dentro la funzione** (e non `DEFAULT
  'COMPLETO'` sulla colonna): scelta intenzionale per poter distinguere
  "owner deve ancora decidere" (NULL) da "owner ha esplicitamente scelto
  completo". Il modale appare *solo* per NULL.
- **Tab "Servizi"**: non esiste come tab del WeddingDashboard (i servizi
  vivono su `/services`, fuori dal contesto evento). Per "enfasi" si e`
  scelta solo la tab `menu` interna; la mossa `GESTISCI_SERVIZI` nella
  ProssimaMossa porta correttamente a `/services`.
- **Backfill**: la funzione e` rigenerata su tutti gli eventi attivi al
  termine della migrazione. Eventi in `LEAD` non sono toccati (la logica
  LEAD e` invariata rispetto a Task A).
- **Idempotenza**: enum guard via `pg_type`, `add column if not exists`,
  `create or replace function`, `on conflict do update` su notifiche.
  Riapplicabile su DB pulito o esistente.

