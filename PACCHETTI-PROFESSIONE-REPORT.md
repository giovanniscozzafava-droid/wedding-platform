# Pacchetti professione — Verticalizzazione

Branch: `feature/pacchetti-professione` (partito da `feature/nuovo-modello`).
Obiettivo: il prodotto deve "vestirsi" della professione del fornitore — niente
piu` "wedding generico". Il fornitore vede etichette, servizi-tipo, clausole e
consigli scritti come glielo direbbe un collega del mestiere.

---

## FASE 1 — Motore + verifica su 2 professioni (Fotografo + Fiorista)

Stato: **completata**. Build frontend: **PASS**.

### Schema (migrazione `20260601100000_pacchetti_professione_schema.sql`)

Cinque tabelle nuove + due colonne su `profiles`.

#### 1. `professioni`
Definizione della professione + etichette UI + default unita.

| Colonna           | Tipo       | Note                                                  |
|-------------------|------------|-------------------------------------------------------|
| `id`              | uuid PK    | gen_random_uuid                                       |
| `nome`            | text       |                                                       |
| `slug`            | text uniq  | es. `fotografo`, `fiorista`, `generico`               |
| `gruppo`          | text       | `IMMAGINE` / `COORDINAMENTO` / `LUOGO_CIBO` / `ALLESTIMENTI` / `BELLEZZA` / `MUSICA` / `ABBIGLIAMENTO` / `MOBILITA` / `EXTRA` / `FALLBACK` |
| `icona`           | text       | nome icona Lucide (es. `Camera`, `Flower2`)           |
| `etichette`       | jsonb      | `{servizio_label, catalogo_label, preventivo_label, empty_state, icona}` |
| `unita_default`   | jsonb      | `{quantity_basis_default, service_unit_default}`      |
| `attiva`          | boolean    | default `true`                                        |
| `sort_order`      | int        | default 100                                           |

#### 2. `servizio_template`
Catalogo servizi-tipo per professione.

| Colonna           | Tipo                | Note                                                  |
|-------------------|---------------------|-------------------------------------------------------|
| `professione_id`  | uuid FK on delete cascade |                                                 |
| `nome`            | text                |                                                       |
| `descrizione`     | text                |                                                       |
| `prezzo_base`     | numeric(10,2)       |                                                       |
| `quantity_basis`  | text check          | `FLAT|PER_GUEST|PER_TABLE|PER_HOUR`                   |
| `service_unit`    | text check          | `PEZZO|PERSONA|ORA|EVENTO`                            |
| `sort_order`      | int                 |                                                       |
| `is_default_pack` | boolean             | default `true` (pre-selezionato in import)            |

#### 3. `clausola_template`
Clausole contrattuali specifiche per professione.

| Colonna           | Tipo                | Note                                                  |
|-------------------|---------------------|-------------------------------------------------------|
| `professione_id`  | uuid FK on delete cascade |                                                 |
| `categoria`       | text                | `OGGETTO/CORRISPETTIVI/PAGAMENTI/RECESSO/FORZA_MAGGIORE/RESPONSABILITA/PROPRIETA_INTELLETTUALE/PRIVACY_GDPR/FORO/SOSTITUZIONI/ALTRE` |
| `per_modalita`    | text                | `INTERO|SEGNALAZIONE|NULL` (universale)               |
| `titolo`          | text                |                                                       |
| `body`            | text                |                                                       |
| `sort_order`      | int                 |                                                       |

#### 4. `consiglio`
Consigli operativi del mestiere, contestuali a una vista del prodotto.

| Colonna           | Tipo                | Note                                                  |
|-------------------|---------------------|-------------------------------------------------------|
| `professione_id`  | uuid FK on delete cascade |                                                 |
| `contesto`        | text check          | `PREVENTIVO|SERVIZI|CONTRATTI|GIORNO`                 |
| `titolo`          | text                |                                                       |
| `testo`           | text                |                                                       |
| `sort_order`      | int                 |                                                       |

#### 5. `checklist_template`
Checklist giorno-evento, organizzata per momento.

| Colonna           | Tipo                | Note                                                  |
|-------------------|---------------------|-------------------------------------------------------|
| `professione_id`  | uuid FK on delete cascade |                                                 |
| `voce`            | text                |                                                       |
| `momento`         | text check          | `PRIMA_EVENTO|ARRIVO|DURANTE|PARTENZA`                |
| `sort_order`      | int                 |                                                       |

#### Estensione `profiles`
- `professione_id uuid references professioni(id) on delete set null`
- `capacita_secondarie uuid[] not null default '{}'::uuid[]` — predispone multi-professione (capacita` secondarie), NON usata in FASE 1.

#### RLS
Tutte e 5 le tabelle template: `SELECT` a tutti gli `authenticated`,
`INSERT/UPDATE/DELETE` solo `ADMIN`. Idempotenti (drop policy if exists +
create policy).

### Differenze rispetto allo schema esistente

Lo schema reale conferma le ipotesi del brief:
- `services.fornitore_id` (NON `supplier_id`) — confermato.
- `quote_items.quantity_basis` enum `FLAT|PER_GUEST|PER_TABLE|PER_HOUR` — confermato.
- `quote_items.unit_snapshot` enum `service_unit` (`PEZZO|PERSONA|ORA|EVENTO`) — confermato.

Altre osservazioni:
- `services.unit` (non `service_unit`) — il nome breve della colonna sulla tabella `services` e` `unit`, l'enum si chiama `service_unit`. Importante per il payload `insert` in `PackImportPicker`.
- Esiste gia` `standard_contract_clauses` (FASE D di un'altra iniziativa) con la sua RPC `list_standard_clauses`. Le nuove `clausola_template` NON la sostituiscono: si **affiancano**, ed entrambe sono leggibili dal `StandardClausesBuilder` che ora le mostra unite (le specifiche-professione marcate visivamente).
- Esistono gia` `service_categories.subrole` (categorie standard per subrole, es. `fotografo`, `fioraio`) — il PackImportPicker riusa quelle categorie come `category_id` per i servizi importati.
- `profiles.subrole` esiste ed e` ortogonale a `professione_id`: il subrole nasce dall'invito/onboarding precedente (con elenco fisso `lib/supplierSubroles.ts`), mentre `professione_id` punta a una tabella centrale con etichette UI dinamiche. In FASE 2/3 si potrebbe deprecare il subrole o sincronizzarlo via trigger. Per ora coesistono — non distruttivo.

### Professioni seedate (3)

| slug       | gruppo       | servizi | clausole | consigli | checklist |
|------------|--------------|---------|----------|----------|-----------|
| `fotografo`| IMMAGINE     | 7       | 4        | 5        | 8         |
| `fiorista` | ALLESTIMENTI | 8       | 4        | 5        | 7         |
| `generico` | FALLBACK     | 0       | 0        | 0        | 0         |

`Generico` e` il fallback: nessun template; chi non sceglie professione vede le
etichette generiche definite nelle `etichette` di `Generico`.

### Backfill

`update public.profiles set professione_id = (select id from professioni where slug = 'generico') where professione_id is null;`

Best-effort, idempotente.

### Confronto Fotografo vs Fiorista

Stessa struttura tecnica, vestizione completamente diversa. Niente if/else sul
nome professione: tutto pesca dalla riga di `professioni`.

| Aspetto                  | Fotografo                                | Fiorista                                       |
|--------------------------|------------------------------------------|------------------------------------------------|
| `etichette.catalogo_label` | "I miei pacchetti foto"               | "Catalogo allestimenti"                        |
| `etichette.servizio_label` | "Reportage e pacchetti"               | "I tuoi allestimenti floreali"                 |
| `etichette.preventivo_label` | "Pacchetto foto"                    | "Allestimento floreale"                        |
| `etichette.empty_state`  | "Crea il tuo primo pacchetto fotografico" | "Crea il tuo primo allestimento"            |
| Icona Lucide             | `Camera`                                 | `Flower2`                                      |
| `unita_default`          | FLAT / EVENTO                            | FLAT / PEZZO                                   |
| Servizio top              | "Reportage matrimonio - giornata completa" 2200€ | "Arco/altare cerimonia rito civile" 850€ |
| Servizio peculiare        | "Photobox digitale + galleria online 12 mesi" | "Petali per il lancio (kg)"               |
| Clausola peculiare        | "Diritti d'autore e uso portfolio"      | "Fiori stagionali alternativi a parita` di costo" |
| Consiglio GIORNO         | "Arriva 2h prima del rito"               | "Arriva 4h prima per l'allestimento sala/altare" |
| Consiglio CONTRATTI      | "Specifica nero su bianco il diritto di portfolio" | "Clausola specifica per fiori non disponibili last-minute" |

### Motore frontend

- **Hook `useProfessione`** — legge `profiles.professione_id`, ritorna `{professione, etichette, unita_default}`. Fallback automatico a `Generico` se non settata. Espone anche `useProfessioniList` (per onboarding) e `useServizioTemplate(id)` (per PackImportPicker).

- **Componente `PackImportPicker`** — lista i `servizio_template` della professione corrente con checkbox. Pre-seleziona quelli `is_default_pack`. Bottone "Importa N servizi" inserisce righe in `services` riusando `category_id` della prima categoria del subrole. Mobile-first: layout single-column su mobile, pulsanti `min-h-44px`, sheet sul fondo dello schermo.

- **Componente `ProfessionPicker`** — card-grid 1col mobile / 2col >=640px. Carica le professioni attive, mostra icona+nome+`servizio_label`, ordinate `FALLBACK` in fondo.

- **Onboarding fornitore (`ProviderOnboardingWizard`)** — aggiunto step **Professione** subito dopo Identita`. Mostra ProfessionPicker e, se selezionata una professione non-Generico, offre il bottone "Importa starter pack" che apre PackImportPicker.

- **`CatalogPage`** — titolo, eyebrow, descrizione, EmptyState e bottone "Starter pack" ora dinamici da `useProfessione`:
  - Fotografo vede eyebrow "Fotografo" + titolo "I miei pacchetti foto" + empty-state "Crea il tuo primo pacchetto fotografico".
  - Fiorista vede eyebrow "Fiorista" + titolo "Catalogo allestimenti" + empty-state "Crea il tuo primo allestimento".

- **`StandardClausesBuilder`** — accetta nuovo prop `professioneId`. Quando passato, carica anche `clausola_template` della professione e le mostra accanto alle standard, con badge "Professione" (pre-selezionate perche` is_default = true). Filtro `per_modalita` continua a funzionare.

### Verifica vestizione su 2 (test manuale)

Lo stesso codice produce 2 UI diverse senza if/else sul nome:

**Profilo A — `professione_id = fotografo`**:
- Catalog: eyebrow "Fotografo" + title "I miei pacchetti foto" + empty "Crea il tuo primo pacchetto fotografico"
- PackImportPicker mostra 7 voci con "Reportage matrimonio - giornata completa", "Servizio second-shooter", "Album fine art" ecc., pre-selezionate quelle con `is_default_pack = true` (5 di 7)
- StandardClausesBuilder (con `professioneId=fotografo`) mostra in aggiunta 4 clausole-professione marcate (OGGETTO "Reportage e consegna materiali", CORRISPETTIVI con "60 giorni consegna", PROPRIETA_INTELLETTUALE diritti d'autore, FORZA_MAGGIORE sostituzione)

**Profilo B — `professione_id = fiorista`**:
- Catalog: eyebrow "Fiorista" + title "Catalogo allestimenti" + empty "Crea il tuo primo allestimento"
- PackImportPicker mostra 8 voci con "Bouquet sposa fine-art", "Centrotavola tondo medio (set di 10)", "Arco/altare cerimonia", "Petali per il lancio (kg)" ecc., pre-selezionate 6 di 8
- StandardClausesBuilder (con `professioneId=fiorista`) mostra in aggiunta 4 clausole-professione (OGGETTO "Allestimenti floreali e tempi montaggio", CORRISPETTIVI stagionalita`, SOSTITUZIONI fiori alternativi, RECESSO penali post acquisto fiori)

### Idempotenza migration

Verificata applicando la migration manualmente via `psql` sul container `supabase_db_wedding-platform` (il `supabase db reset` si interrompe sul seed legacy `20260526380000_seed_test_tier_oro.sql` per `v_sara/TEST-SEED` — failure pre-esistente e accettabile per il task). La migration usa:
- `create table if not exists` per le 5 tabelle nuove
- `add column if not exists` per le 2 colonne su `profiles`
- `drop policy if exists` + `create policy` per RLS
- `on conflict (slug) do update` per le 3 professioni
- `delete + insert` per i template (clean slate per slug, ri-applicabile)

### File toccati

**Migrazione**
- `supabase/migrations/20260601100000_pacchetti_professione_schema.sql` *(nuovo)*

**Hooks/lib**
- `frontend/src/hooks/useProfessione.ts` *(nuovo)*

**Componenti**
- `frontend/src/components/professione/PackImportPicker.tsx` *(nuovo)*
- `frontend/src/components/professione/ProfessionPicker.tsx` *(nuovo)*
- `frontend/src/components/wedding/StandardClausesBuilder.tsx` *(modificato — accetta `professioneId`)*

**Pagine**
- `frontend/src/pages/CatalogPage.tsx` *(modificato — etichette dinamiche + bottone Starter pack + Empty state importatore)*
- `frontend/src/pages/auth/ProviderOnboardingWizard.tsx` *(modificato — step "Professione" + PackImportPicker integrato)*

**Report**
- `PACCHETTI-PROFESSIONE-REPORT.md` *(nuovo)*

### Criticita` / aperti

- Il `supabase db reset` locale fallisce su `20260526380000_seed_test_tier_oro.sql` (failure pre-esistente, non legata a questa fase). Migration applicata via `docker exec psql` direttamente sul container, poi registrata in `supabase_migrations.schema_migrations`.
- `database.types.ts` NON e` stato rigenerato in FASE 1: per ora le query alla tabella `professioni` / `servizio_template` / `clausola_template` / `consiglio` / `checklist_template` usano il pattern `(supabase as any).from(...)` gia` ampiamente usato altrove nel codebase (26 occorrenze). In FASE 2 potremmo rigenerare types.
- `Profile` TypeScript (in `lib/auth.tsx`) NON include ancora `professione_id` / `capacita_secondarie`. `useProfessione` evita la dipendenza facendo una sua read mirata su `profiles`. Da consolidare in FASE 2.
- Il backfill setta `Generico` per TUTTI i profili (incluso COUPLE/WP/ADMIN). Per ora innocuo (FOREIGN KEY su professione attiva, RLS read-anon-auth) ma se in FASE 2 portiamo etichette in viste WP/COUPLE, conviene filtrare il backfill ai soli `role in ('FORNITORE','LOCATION','WEDDING_PLANNER')`.
- `StandardClausesBuilder` usa `slug.startsWith('prof-')` come segnale visivo per le clausole specifiche-professione (id prefisso `prof:`). Funziona ma e` fragile: in FASE 2 conviene aggiungere un campo discriminator esplicito (es. `source: 'std' | 'prof'`).

### Da validare con i fornitori

- **Fotografo**: confermare 7 servizi-tipo e clausole con un fotografo matrimonialista reale. Punti critici: tempi consegna 60gg, diritti di portfolio nero su bianco, sostituzione professionista equivalente.
- **Fiorista**: confermare 8 servizi-tipo e clausole con un fiorista matrimonialista reale. Punti critici: stagionalita` (+30-100% off-season), penali post-acquisto fiori (curva graduata 60/15/7gg), 10% scorta di sicurezza.
