# FASE 2 — Workflow guidato

Branch: `feature/nuovo-modello`
Data: 2026-05-30

## Obiettivi

1. **Tabella `notifiche`**: notifiche "prossima mossa" generate dal workflow evento (FASE 1.3).
2. **Funzione `refresh_notifiche_per_evento(p_entry_id uuid)`**: popola/aggiorna le notifiche in base a `calendar_entries.evento_stato`. Upsert idempotente.
3. **Trigger `AFTER UPDATE OF evento_stato`**: ogni transizione chiama il refresh.
4. **Componente `ProssimaMossa.tsx`**: legge le notifiche PENDING dell'utente loggato, ordina per priorità desc, mostra pulsanti grandi (>=44px) col `link_action`. Mobile-first colonna singola.
5. **Wire**: `HomePage` (capostipiti) e `CoupleDashboard.OverviewCouple` (coppia, filtrato per `entryId`).

## Migrazioni create

| File | Descrizione |
| --- | --- |
| `supabase/migrations/20260530200000_fase2_notifiche.sql` | Tabella `notifiche` + indici + RLS + funzione `refresh_notifiche_per_evento` + trigger `trg_notifiche_evento_stato` + backfill iniziale. |

### Schema `notifiche`

```
id                uuid pk default gen_random_uuid()
destinatario_id   uuid not null fk profiles(id) on delete cascade
evento_id         uuid fk calendar_entries(id) on delete cascade
tipo              text not null            -- es. FIRMA_INCARICO, RACCOGLI_PREVENTIVI
titolo            text not null
descrizione       text
link_action       text                     -- interno (/...) o esterno (https://...)
owner_della_mossa uuid fk profiles(id) on delete set null
stato             text default 'PENDING'   -- check (PENDING|DONE|SKIPPED)
priorita          int  default 5
creato_il         timestamptz not null default now()
letto_il          timestamptz
```

Indici:
- `ux_notifiche_dest_evento_tipo` UNIQUE `(destinatario_id, evento_id, tipo)` — chiave per upsert.
- `idx_notifiche_dest_stato_priorita` `(destinatario_id, stato, priorita desc, creato_il desc)` — query del componente.
- `idx_notifiche_evento` `(evento_id)`.

### Mappa `evento_stato -> mossa` (capostipite owner)

| Stato evento | tipo notifica | priorita | link_action |
| --- | --- | --- | --- |
| LEAD | FIRMA_INCARICO | 9 | /calendar?entry=<id> |
| INCARICO_FIRMATO | RACCOGLI_PREVENTIVI | 8 | /quotes?entry=<id> |
| PREVENTIVI | INVIA_PREVENTIVO_COPPIA | 8 | /quotes?entry=<id> |
| PREVENTIVO_FIRMATO | PREPARA_CONTRATTO | 8 | /contracts?entry=<id> |
| CONTRATTO | AVVIA_PIANIFICAZIONE | 7 | /calendar?entry=<id> |
| PIANIFICAZIONE | COMPLETA_CHECKLIST | 7 | /calendar?entry=<id> |
| CHECKLIST | EVENTO_IMMINENTE | 9 | /calendar?entry=<id> |
| SVOLTO / ANNULLATO | — (chiusura PENDING residue a DONE) | — | — |

### Mappa per la coppia

| Stato evento | tipo | titolo coppia | priorita |
| --- | --- | --- | --- |
| LEAD | COPPIA_FIRMA_INCARICO | Firma l'incarico col tuo wedding planner | 9 |
| PREVENTIVI | COPPIA_ATTENDE_PREVENTIVO | Il preventivo arriva a breve | 5 |
| CONTRATTO | COPPIA_FIRMA_CONTRATTO | Firma il contratto del matrimonio | 9 |

Membri "coppia" sono dedotti da `calendar_entry_participants` con `role_in_entry ilike 'COUPLE%'`. Il guard `exception when others` evita di rompere il trigger se la colonna manca su qualche ambiente.

### Idempotenza

Ogni chiamata a `refresh_notifiche_per_evento`:
1. Chiude a `DONE` tutte le PENDING di tipo **diverso** da quello corrente per lo stesso evento.
2. Fa upsert (`on conflict (destinatario_id, evento_id, tipo) do update`) della notifica corrente: il record è uno solo per (destinatario, evento, tipo).
3. Se lo stato è finale (`SVOLTO`/`ANNULLATO`), chiude tutte le PENDING senza crearne di nuove.

### Trigger

`trg_notifiche_evento_stato` AFTER UPDATE OF `evento_stato` su `calendar_entries`. Chiama `refresh_notifiche_per_evento(NEW.id)` solo se lo stato è effettivamente cambiato.

### Backfill

Al deploy iniziale, la migrazione esegue `refresh_notifiche_per_evento(id)` su tutti i `calendar_entries` esistenti per popolare la prima ondata di notifiche in base allo stato corrente.

## RLS

- `select`: `destinatario_id = auth.uid() OR is_admin()`.
- `update`: solo il destinatario sulle proprie notifiche (per marcare `letto_il`, `stato='DONE'/'SKIPPED'`).
- Nessuna policy `insert`/`delete` da client → tutti gli insert passano per `refresh_notifiche_per_evento` (security definer); i delete avvengono solo via cascade FK (evento o profilo cancellati).

## Componente `ProssimaMossa.tsx`

Path: `frontend/src/components/workflow/ProssimaMossa.tsx`

API:
```tsx
<ProssimaMossa
  limit={5}            // default 5
  entryId={entryId?}   // se fornito, filtra per evento (couple overview)
  title="..."          // default "La tua prossima mossa"
  className="..."
/>
```

Caratteristiche mobile-first:
- Lista verticale a **una colonna** su mobile.
- Ogni voce è un **pulsante grande** `min-h-[44px]` con icona + titolo + descrizione + chevron destra.
- Pulsante secondario "Fatto" sempre `min-h-[44px]`.
- Badge "Urgente" automatico per priorità >= 9.
- Empty state esplicito con messaggio rassicurante (in pari col workflow).
- Loading state non bloccante.
- Best-effort sugli errori: in caso di failure della query, mostra empty state invece di crashare la pagina.

## Wire

| File | Modifica |
| --- | --- |
| `frontend/src/pages/HomePage.tsx` | Import `ProssimaMossa` e rendering sopra l'activity feed, solo per capostipiti (`isCapostipite`, già esistente). |
| `frontend/src/pages/couple/CoupleDashboard.tsx` | Import `ProssimaMossa` e rendering in `OverviewCouple`, in cima, filtrato per `entryId`, con titolo "La vostra prossima mossa". |

I fornitori (FORNITORE puro) **non vedono** la card su HomePage (la guard `isCapostipite` esclude `FORNITORE`/`COUPLE`).

## Verifiche

### Build frontend

```
cd /Users/giovanniscozzafava/Repository/wedding-platform/frontend && npm run build
```
**PASS** (`built in 987ms`, 2714 modules, nessun errore TS).

### DB

`supabase db reset --local` continua a fallire nello stesso punto pre-esistente (`seed_test_tier_oro.sql` + altri seed legacy che usano la variabile `v_sara` non definita). Stesso esito documentato in FASE-1.

Verifica diretta via `psql` in container `supabase_db_wedding-platform`: applicate manualmente tutte le migrazioni 2026-05-27 → 2026-05-30 (saltando i seed rotti), inclusa la nuova `20260530200000_fase2_notifiche.sql`. **Tutte le migrazioni applicate senza errori**.

### Smoke test trigger + state machine

Eseguito uno scenario completo:
1. Insert `calendar_entries` con `evento_stato = LEAD` (default) → `refresh_notifiche_per_evento` manuale → notifica `FIRMA_INCARICO` PENDING (priorita 9).
2. `LEAD → INCARICO_FIRMATO`: trigger scatta, vecchia notifica → DONE, nuova `RACCOGLI_PREVENTIVI` PENDING (priorita 8).
3. `INCARICO_FIRMATO → PREVENTIVI`: vecchie a DONE, nuova `INVIA_PREVENTIVO_COPPIA` PENDING (priorita 8).
4. `PREVENTIVI → PREVENTIVO_FIRMATO → CONTRATTO → PIANIFICAZIONE → CHECKLIST → SVOLTO`: ogni transizione genera la nuova PENDING e chiude la vecchia. A `SVOLTO` tutte le PENDING sono chiuse a DONE.
5. Upsert idempotente verificato: ri-chiamare `refresh` sullo stesso stato non duplica righe.

## Mobile-first

- `ProssimaMossa` rispetta i vincoli (>=380px colonna singola): grid mai usato, lista flex column con gap-3.
- Touch target: `min-h-[44px]` su pulsante principale + pulsante "Fatto".
- Una azione primaria per riga (apri link), una secondaria pari-livello (Fatto).
- `line-clamp-3` sulla descrizione per evitare card alte sproporzionate su mobile.
- Edge-fade visivo gestito dai container già esistenti (HomePage e CoupleDashboard).

## Criticità / Note

- **Seed legacy rotti**: continua il problema documentato in FASE-1 (seed `v_sara`/`TEST-SEED`/lead test). `supabase db reset` resta inutilizzabile finché qualcuno non ripulisce i seed. Tutte le migrazioni di schema sono comunque applicabili individualmente — verificato.
- **Cast `as any` sui types**: come in FASE-1, `notifiche` non è ancora nei types generati. Uso `(supabase.from('notifiche' as any) as any)` finché `npm run db:types` non viene rigenerato (fuori scope FASE 2).
- **Estensione coppia minimal**: in questa fase emettiamo notifiche-coppia solo nei 3 stati in cui sono attori (LEAD, PREVENTIVI, CONTRATTO). Stati operativi come `CHECKLIST`/`PIANIFICAZIONE` non generano rumore lato coppia. Espandibile in fasi future modificando solo `refresh_notifiche_per_evento` (nessuna migrazione di schema necessaria).
- **Realtime non incluso**: il componente fa `select` on mount + dopo "Fatto". Subscribe a `postgres_changes` su `notifiche` è un'estensione naturale ma fuori scope di questa fase.
