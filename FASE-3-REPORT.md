# FASE 3 — Soldi & Contratti

Branch: `feature/nuovo-modello`
Data: 2026-05-30

## Obiettivi

1. **3.1 Scadenzario** — Tabella `scadenzario_voci` (acconti, saldi, rate, penali, rimborsi) per evento, con debitore/creditore, scadenza, stato pagato. RLS: owner wedding RW; debitore+creditore read; admin tutto. Nuova tab "Pagamenti" mobile-first in `WeddingDashboard`.
2. **3.2 Templates fornitore + clausole SEGNALAZIONE** — `supplier_contract_templates.per_modalita` (default `INTERO`). 4 clausole standard per la modalita SEGNALAZIONE (Oggetto, Corrispettivi, Provvigione, GDPR). `StandardClausesBuilder` con filtro modalita.
3. **3.3 Conferma riga preventivo** — `quote_items.supplier_confirmed_at` + `supplier_confirmed_by`. RPC `supplier_confirm_quote_item(p_item_id)` security definer. Trigger after insert su `quote_items` che crea notifica `FORNITORE_CONFERMA_VOCE`. UI sezione "Da confermare" in `SupplierContractsPage`.
4. **3.4 Consenso segnalazione** — Tabella `consenso_segnalazione (entry, couple, supplier)` con dato_il/revocato_il. RLS minimal. RPC `supplier_view_couple_minimal(p_entry)` ritorna `{couple_name, contact_email, date_from, location_short, related_items}` solo se consenso attivo.

## Migrazioni create

| File | Descrizione |
| --- | --- |
| `supabase/migrations/20260530300000_fase3_scadenzario.sql` | Enum `scadenza_tipo`. Tabella `scadenzario_voci` + indici + RLS + trigger updated_at + trigger pagato_il auto. |
| `supabase/migrations/20260530310000_fase3_clausole_segnalazione.sql` | `supplier_contract_templates.per_modalita` + `standard_contract_clauses.per_modalita`. Seed 4 clausole standard SEGNALAZIONE (upsert idempotente). RPC `list_standard_clauses` aggiornata per esporre `per_modalita`. |
| `supabase/migrations/20260530320000_fase3_quote_item_confirm.sql` | `quote_items.supplier_confirmed_at`/`_by`. RPC `supplier_confirm_quote_item`. Trigger after insert `quote_items` → notifica `FORNITORE_CONFERMA_VOCE`. |
| `supabase/migrations/20260530330000_fase3_consenso_segnalazione.sql` | Tabella `consenso_segnalazione` + indici + trigger updated_at + RLS. RPC `supplier_view_couple_minimal`. |

## Schema dettaglio

### `scadenzario_voci`

```
id            uuid pk default gen_random_uuid()
entry_id      uuid fk calendar_entries(id) on delete cascade
titolo        text not null
descrizione   text
importo_eur   numeric(10,2) not null check >= 0
tipo          scadenza_tipo not null   -- ACCONTO|SALDO|RATA|PENALE|RIMBORSO
debitore_id   uuid fk profiles(id) on delete set null
creditore_id  uuid fk profiles(id) on delete set null
scadenza      date
pagato        boolean not null default false
pagato_il     timestamptz              -- auto-set quando pagato passa a true
metodo        text
note          text
created_at/updated_at
```

Indici: `(entry_id, scadenza)`, `(debitore_id)`, `(creditore_id)`, `(entry_id, pagato) where pagato=false`.

Trigger:
- `trg_scad_updated_at` (before update).
- `trg_scad_pagato_il` (before ins/upd): auto-set/clear `pagato_il`.

RLS:
- `select`: owner wedding | debitore | creditore | admin.
- `insert/update/delete`: owner wedding | admin.

### `supplier_contract_templates.per_modalita`

```
per_modalita  modalita_incasso not null default 'INTERO'
```

Indice composto `(fornitore_id, per_modalita)`.

### `standard_contract_clauses.per_modalita`

```
per_modalita  modalita_incasso null    -- NULL = universale
```

Indice `(per_modalita) where not null`.

Le 4 clausole SEGNALAZIONE seedate:
- `oggetto-segnalazione` (OGGETTO, default, sort 11)
- `corrispettivi-segnalazione` (CORRISPETTIVI, default, sort 21)
- `provvigione-segnalazione` (CORRISPETTIVI, default, sort 25)
- `privacy-segnalazione` (PRIVACY_GDPR, default, sort 81)

Upsert idempotente su `slug` (ri-eseguibile senza errori).

### `quote_items` (alter)

```
supplier_confirmed_at  timestamptz
supplier_confirmed_by  uuid fk profiles(id) on delete set null
```

Indice parziale per "in attesa di conferma": `(supplier_id) where supplier_id is not null and supplier_confirmed_at is null`.

RPC `supplier_confirm_quote_item(p_item_id uuid)`:
- security definer
- verifica `auth.uid() = qi.supplier_id`
- idempotente (re-call ok)
- chiude la notifica pendente `FORNITORE_CONFERMA_VOCE` collegata.

Trigger `trg_notify_supplier_quote_item` (after insert):
- crea notifica `FORNITORE_CONFERMA_VOCE` con priorita 7, link `/supplier/contracts?confirm=<item_id>`.
- usa upsert su `(destinatario, evento, tipo)` per non duplicare.
- best-effort: `exception when others then null` se la tabella `notifiche` manca.

### `consenso_segnalazione`

```
id              uuid pk default gen_random_uuid()
entry_id        uuid fk calendar_entries(id) on delete cascade
couple_user_id  uuid fk profiles(id) on delete cascade
supplier_id     uuid fk profiles(id) on delete cascade
versione        text default 'v1.0'
dato_il         timestamptz
revocato_il     timestamptz
note            text
unique (entry_id, couple_user_id, supplier_id)
```

Indici: `(entry_id)`, `(supplier_id)`, `(couple_user_id)`, `(entry_id, supplier_id) where dato_il is not null and revocato_il is null`.

RLS:
- `select`: couple_user_id=auth | supplier_id=auth | owner wedding | admin.
- `insert`: couple | owner wedding | admin.
- `update`: couple (dare/revocare) | owner wedding | admin.
- `delete`: owner wedding | admin.

RPC `supplier_view_couple_minimal(p_entry uuid)`:
- security definer
- verifica `auth.uid()` autenticato
- verifica esistenza consenso attivo per `(p_entry, auth.uid())`
- se assente → ritorna 0 righe (no leak)
- se presente → `couple_name, contact_email, date_from, location_short, related_items(jsonb)` con le `quote_items` del fornitore relative a quel preventivo.

## Frontend

### Nuovo `PagamentiTab.tsx`

Path: `frontend/src/components/wedding/PagamentiTab.tsx`.

Caratteristiche mobile-first (>=380px colonna singola, touch >=44px):
- Header con titolo + CTA "Aggiungi voce" (min-h-44).
- 3 KPI card responsive (Totale previsto / Incassato / Da incassare).
- Form add inline (titolo, tipo, importo, scadenza, metodo, descrizione) con grid 1 col su mobile, 2 col >=sm.
- Lista voci: ogni card ha un toggle pagato grande (44x44, full circle), pill colorata per tipo, badge "Scaduto" se `scadenza < oggi` e non pagato, importo grande tabular-nums, delete in icon-button.
- Empty state esplicito con icona wallet.
- Una azione primaria per riga.
- Best-effort sul fetch profili coinvolti (nomi debitore/creditore).

Wire: aggiunto `payments` come TabKey in `WeddingDashboard.tsx` con icona Wallet, label "Pagamenti", tra "Budget" e "Checklist".

### `StandardClausesBuilder` con filtro modalita

Modifiche `frontend/src/components/wedding/StandardClausesBuilder.tsx`:
- Esportato tipo `ModalitaIncasso = 'INTERO' | 'SEGNALAZIONE'`.
- Esteso `StandardClause` con `per_modalita: ModalitaIncasso | null`.
- Nuovo prop opzionale `modalita?: ModalitaIncasso` per pre-impostare il filtro.
- Filter pill row mobile-first sotto l'header (TUTTE / Incasso intero / Segnalazione), tap target 36px (filtro non primario, ma >=ergonomico).
- Le clausole con `per_modalita = null` sono sempre visibili (universali).
- I default pre-selezionati al mount tengono conto del filtro iniziale.

### `SupplierContractsPage` — sezione "Da confermare"

Modifiche `frontend/src/pages/SupplierContractsPage.tsx`:
- Carica `quote_items` con `supplier_id = me` e `supplier_confirmed_at is null`.
- Arricchisce con dati evento (`calendar_entries` via `quote_id`).
- Sezione in alto pagina mostra ogni voce in attesa con CTA "Conferma" (min-h-44, w-full su mobile) che chiama RPC `supplier_confirm_quote_item`.
- Supporta deep link `?confirm=<item_id>` (la notifica dalla FASE 2 link_action punta qui) — scroll automatico alla card.
- Badge contatore "N in attesa" nell'header sezione.

## Build

```
cd /Users/giovanniscozzafava/Repository/wedding-platform/frontend && npm run build
```
**PASS** — `built in 985ms`, nessun errore TS.

## DB

`supabase db reset --local` continua a fallire sui seed legacy (`v_sara`/`TEST-SEED`/`lead_requests` test) — stesso problema documentato in FASE-1 e FASE-2. Le migrazioni di schema sono state lasciate come file e sono pronte per essere applicate quando i seed verranno ripuliti (fuori scope FASE 3).

L'applicazione manuale via `psql` nel container Docker è stata negata dal sandbox in questa sessione per policy (vincoli del workflow), quindi le migrazioni sono **scritte e committate ma NON ancora applicate al DB locale**. Sono testabili in CI/preview Supabase non appena i seed legacy verranno corretti.

## Mobile-first

Tutto il nuovo UI rispetta i vincoli:
- `PagamentiTab`: colonna singola su mobile, tap-target 44px su toggle pagato + delete + CTA, una azione primaria per riga.
- `StandardClausesBuilder`: filter row scorrevole, pill 36px (filtro secondario), il pulsante "Componi" rimane full-width nello stack mobile.
- `SupplierContractsPage > Da confermare`: card stack verticale, CTA "Conferma" full-width su mobile (44px).

## File toccati / creati

Creati:
- `supabase/migrations/20260530300000_fase3_scadenzario.sql`
- `supabase/migrations/20260530310000_fase3_clausole_segnalazione.sql`
- `supabase/migrations/20260530320000_fase3_quote_item_confirm.sql`
- `supabase/migrations/20260530330000_fase3_consenso_segnalazione.sql`
- `frontend/src/components/wedding/PagamentiTab.tsx`
- `FASE-3-REPORT.md`

Modificati:
- `frontend/src/pages/wedding/WeddingDashboard.tsx` (import + tab `payments`)
- `frontend/src/components/wedding/StandardClausesBuilder.tsx` (filtro modalita)
- `frontend/src/pages/SupplierContractsPage.tsx` (sezione "Da confermare" + RPC confirm)

## Criticità / Note

- **Seed legacy ancora rotti**: stessa diagnosi delle FASI precedenti. `supabase db reset` non si completa fino a quando non si fixano i seed `v_sara`/`TEST-SEED`. Fuori scope FASE 3.
- **DB locale non aggiornato in questa sessione**: l'esecuzione manuale via Docker è stata negata dal sandbox; le migrazioni sono pronte come file (idempotenti dove possibile — `add column if not exists`, `on conflict do nothing/update`).
- **Cast `as any` lato frontend**: la tabella `scadenzario_voci`, `consenso_segnalazione`, le nuove colonne `supplier_confirmed_at`/`per_modalita` non sono ancora nei types generati. Usato `(supabase.from('...' as any) as any)` e `(supabase as any).rpc(...)` finché `npm run db:types` non viene rigenerato — fuori scope FASE 3.
- **`supplier_view_couple_minimal` location_short**: per non esporre indirizzi civici, viene ricavata dal `title` dell'evento come stringa breve. Si puo` raffinare in futuro aggiungendo un campo `location_short` esplicito su `calendar_entries`.
- **Notifica fornitore per ogni quote_item**: il trigger usa upsert su `(destinatario, evento, tipo='FORNITORE_CONFERMA_VOCE')`, quindi se piu` righe dello stesso fornitore vengono inserite sullo stesso evento, la notifica viene aggiornata a puntare all'ultima riga. Il fornitore vede comunque la lista completa "Da confermare" nella pagina dedicata. Una estensione futura puo` usare un `tipo` unico per item o piu` righe per evento.
- **RPC `list_standard_clauses` ora ritorna `per_modalita`**: aggiunto come ultima colonna per non rompere chiamanti esistenti che fanno `select c.id, c.title, ...` per posizione.
