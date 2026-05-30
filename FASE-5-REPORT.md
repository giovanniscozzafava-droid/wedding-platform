# FASE 5 — Cambiamenti evento + Chat

Branch: `feature/nuovo-modello`
Data: 2026-05-30

## Obiettivi

1. **5.1 Chat evento** — Tabella `chat_messaggi` con citazione voci preventivo, RLS basata su `is_evento_member`, componente mobile-first `ChatEvento.tsx`.
2. **5.2 Cambiamenti evento** — Tabella `eventi_cambiamento` + 3 RPC transazionali (`riprogramma_evento`, `dropout_fornitore`, `annulla_evento`) e menu kebab `EventoChangesMenu.tsx` nel monitor contratti con conferme in lingua umana.

## Migrazioni create

| File | Descrizione |
| --- | --- |
| `supabase/migrations/20260530500000_fase5_chat_messaggi.sql` | Helper `is_evento_member(uuid)`, tabella `chat_messaggi`, RLS (select/insert/update solo membri evento). |
| `supabase/migrations/20260530510000_fase5_eventi_cambiamento.sql` | Enum `evento_cambiamento_tipo`/`stato`, tabella `eventi_cambiamento`, RPC `riprogramma_evento`, `dropout_fornitore`, `annulla_evento`. |

## Schema dettaglio

### Helper `is_evento_member(p_entry uuid) returns boolean`

`security definer`, `stable`, `search_path = public`. True se l'utente loggato è:
- owner del `calendar_entries`
- presente in `calendar_entry_participants`
- presente in `wedding_couple_members` per quel `entry_id`
- supplier con almeno una riga in `quote_items` collegata al `quote_id` dell'evento
- admin

Riusabile in altre policy future.

### Tabella `chat_messaggi`

```
id                  uuid pk
entry_id            uuid fk calendar_entries on delete cascade
mittente_id         uuid fk profiles on delete cascade
corpo               text not null check length > 0
allegato_url        text
voce_quote_item_id  uuid fk quote_items on delete set null   -- citazione voce
letto_il            timestamptz
creato_il           timestamptz default now()
```

Indici:
- `idx_chat_messaggi_entry_creato (entry_id, creato_il desc)` — feed cronologico
- `idx_chat_messaggi_mittente`
- `idx_chat_messaggi_voce` parziale su `voce_quote_item_id is not null`

RLS:
- SELECT: `is_evento_member(entry_id)`
- INSERT: `mittente_id = auth.uid() and is_evento_member(entry_id)`
- UPDATE: `is_evento_member(entry_id)` (per marcare `letto_il`)
- DELETE: nessuna policy (immutabile; cascade su entry delete)

### Tabella `eventi_cambiamento`

```
id           uuid pk
entry_id     uuid fk calendar_entries on delete cascade
tipo         evento_cambiamento_tipo (RIPROGRAMMA | DROPOUT_FORNITORE | ANNULLAMENTO)
payload      jsonb default '{}'
eseguito_da  uuid fk profiles on delete set null
eseguito_il  timestamptz default now()
stato        evento_cambiamento_stato default 'IN_CORSO'
```

RLS: SELECT per membri evento (riusa `is_evento_member`). Nessuna policy INSERT/UPDATE/DELETE: scritture solo via RPC security definer.

### RPC `riprogramma_evento(p_entry_id uuid, p_nuova_data date) returns jsonb`

Transazione plpgsql:
1. Lock pessimistico su `calendar_entries` (`for update`).
2. Authz: owner WP o admin. Stato evento non finale (`SVOLTO`/`ANNULLATO`).
3. `UPDATE calendar_entries.date_from/date_to` (preserva durata `date_to - date_from`).
4. DELETE su `supplier_availability` per i fornitori del quote, sulla **data vecchia**, status `BUSY/TENTATIVE` (libera disponibilità).
5. `UPDATE quotes.event_date` + `UPDATE contracts.event_date` → i trigger esistenti (`trg_quotes_auto_avail`, `trg_contracts_auto_avail`) ribloccano la nuova data.
6. Upsert notifica `RICONFERMA_DATA_EVENTO` (priorità 9) per ogni `quote_items.supplier_id` distinto.
7. Notifica `EVENTO_RIPROGRAMMATO` per WP owner.
8. Riga `eventi_cambiamento` con payload `{old_date_from, old_date_to, new_date_from, new_date_to, fornitori_da_riconfermare}`.

Returns `jsonb {ok, cambio_id, old_date_from, new_date_from, fornitori_da_riconfermare}`.

### RPC `dropout_fornitore(p_quote_item_id uuid, p_motivo text) returns jsonb`

Transazione plpgsql:
1. Carica `quote_items` + `quotes` + `calendar_entries` (collegato via `quote_id`).
2. Authz: owner del quote o owner del calendar_entry o admin.
3. `UPDATE quote_items SET supplier_id = NULL`, annota motivo in `description_snapshot` con timestamp.
4. DELETE `supplier_availability` per quel fornitore sulla data evento (status `BUSY/TENTATIVE`).
5. Notifica WP owner: `DROPOUT_FORNITORE_<quote_item_id>` priorità 10 (urgente), titolo "Sostituisci fornitore: <nome voce>".
6. Riga `eventi_cambiamento` con payload `{quote_item_id, quote_id, fornitore_id, fornitore_nome, voce_nome, motivo}`.

### RPC `annulla_evento(p_entry_id uuid, p_motivo text) returns jsonb`

Soft-cancel transazionale:
1. Lock + authz (owner WP o admin), no-op se già `SVOLTO/ANNULLATO`.
2. `UPDATE calendar_entries`: `evento_stato='ANNULLATO'`, `status='CANCELLATA'` (l'enum `entry_status` usa `CANCELLATA`, non `ANNULLATO`), annota motivo in `notes`.
3. DELETE `supplier_availability` legate ai supplier del quote sulla data evento (`BUSY/TENTATIVE`).
4. `UPDATE quotes`: `status='RIFIUTATO'`, `rejection_reason='Evento annullato: ...'`, `rejected_at`.
5. `UPDATE contracts`: `status='ANNULLATO'` su tutti i contratti dell'entry.
6. Calcola unione destinatari (owner + `wedding_couple_members.user_id` + `calendar_entry_participants.user_id` + supplier del quote) e upsert notifica `EVENTO_ANNULLATO` priorità 10 a tutti.
7. Riga `eventi_cambiamento` con payload completo `{motivo, quote_id, availability_liberate, quotes_aggiornati, contracts_annullati, notifiche_inviate, data_evento, recuperabile:true}`.

Recuperabilità: i dati restano (no DELETE su `calendar_entries`/`quotes`/`contracts`). Un admin può rovesciare manualmente (riapertura fuori scope FASE 5).

## Frontend

### `ChatEvento.tsx`

Path: `frontend/src/components/wedding/ChatEvento.tsx`.

Mobile-first:
- Header con titolo + sottotitolo (visibilità).
- Lista messaggi in `Card` scrollabile `max-h 60vh` con scroll automatico all'ultimo elemento (`scrollIntoView({behavior:'smooth', block:'end'})`).
- Bubble allineate destra/sinistra (`bg-gold-100` per i propri, `bg-bg-sunken` per altri), max-w 85% mobile / 70% desktop, `break-words`, `whitespace-pre-wrap`.
- Etichetta voce citata (badge con icona `Quote` e nome snapshot).
- Composer in basso: selettore opzionale "Cita voce preventivo" (`<select>` con min-h 44px), `Textarea` (rows=3, min-h 88px), unico CTA primario `Invia` (gold, min-h 44px).

### `EventoChangesMenu.tsx`

Path: `frontend/src/components/wedding/EventoChangesMenu.tsx`.

Menu kebab (button "Azioni evento" con icona `MoreVertical`, min 44px×44px) che apre dropdown con 3 voci:

1. **Riprogramma evento** → modale `RiprogrammaModal`:
   - Mostra data attuale in box info.
   - Input `type="date"` (min-h 44px) per nuova data.
   - CTA "Conferma riprogrammazione" (gold) disabled finché data non scelta.
   - Conferma toast: "Evento spostato. Notifica inviata a N fornitori per riconferma."

2. **Segnala dropout fornitore** → modale `DropoutModal`:
   - Carica le voci `quote_items` con `supplier_id != null` (con embed `profiles!quote_items_supplier_id_fkey`).
   - `Select` voce (mostra nome voce + nome fornitore) + `Textarea` motivo.
   - Box riepilogo "Stai segnalando dropout per: ...".
   - CTA "Registra dropout" disabled finché voce + motivo presenti.

3. **Annulla evento** → modale `AnnullaModal`:
   - Banner rosa con `AlertTriangle` che spiega in italiano cosa succede.
   - `Textarea` motivo + `Input` "scrivi `ANNULLA` per confermare" (double-confirm anti-tap).
   - CTA `destructive` "Conferma annullamento evento" disabled finché entrambi i campi validi.

Mobile-first per tutti i modali:
- `flex items-end sm:items-center` → bottom-sheet su mobile, centrato su desktop.
- `rounded-t-2xl sm:rounded-2xl`, max-w-lg.
- Footer `flex-col-reverse sm:flex-row` (CTA primario in alto su mobile).
- Tutti i button min-h 44px, full-width su mobile.
- Una sola azione primaria per modale.

### `AllContractsMonitor.tsx` (modificato)

- Import `EventoChangesMenu`.
- Header trasformato in `flex items-start justify-between flex-wrap`, con `EventoChangesMenu` a destra.
- `onChanged` ricarica la lista contratti.

### `WeddingDashboard.tsx` (modificato)

- Import `MessageCircle` da `lucide-react`, import `ChatEvento`.
- Nuovo `TabKey` `'chat'`.
- Voce TABS `{ key: 'chat', label: 'Chat', icon: MessageCircle }` inserita dopo Riconciliazione, prima di Checklist.
- Render: `{tab === 'chat' && <ChatEvento entryId={wedding.id} />}`.

## Build

```
cd /Users/giovanniscozzafava/Repository/wedding-platform/frontend && npm run build
```
**PASS** — `built in 957ms`, nessun errore TS.

Fixati durante build:
- `chat_messaggi` non è ancora nei `database.types.ts` (verrà rigenerato a DB applicato): uso pattern `(supabase as any).from('chat_messaggi')`.
- `ModalFooter.onConfirm` tipo `() => unknown | Promise<unknown>` con `void Promise.resolve(onConfirm())` per accettare gli handler che ritornano dal `toast.error()`.

## DB

`supabase db reset --local` continua a fallire sui seed legacy (`lead_requests`/`v_sara`/`TEST-SEED`) — stesso problema documentato in FASE 1/2/3/4. Le migrazioni di FASE 5 sono **scritte e committate ma NON applicate** in questa sessione. Sono idempotenti (DO blocks su enum, `create table if not exists`, `create or replace function`, `drop policy if exists` + `create policy`) e pronte ad essere applicate appena i seed legacy verranno ripuliti.

Per applicarle in preview/CI: il workflow Supabase eseguirà `supabase migration up` su un DB pulito.

## Mobile-first

- `ChatEvento`: layout colonna singola < 380px, max-w 85% per le bubble (lasciamo margine respiro), selettore + textarea + CTA tutti min-h 44px, una sola azione primaria (Invia).
- `EventoChangesMenu`: kebab button 44×44 minimo, modali bottom-sheet su mobile con flex-col-reverse footer, CTA full-width.
- Le modali rispettano "una sola azione primaria" + conferma forte (typing `ANNULLA`) per la mossa irreversibile.

## File creati

- `supabase/migrations/20260530500000_fase5_chat_messaggi.sql`
- `supabase/migrations/20260530510000_fase5_eventi_cambiamento.sql`
- `frontend/src/components/wedding/ChatEvento.tsx`
- `frontend/src/components/wedding/EventoChangesMenu.tsx`
- `FASE-5-REPORT.md`

## File modificati

- `frontend/src/components/wedding/AllContractsMonitor.tsx` (header + EventoChangesMenu + onChanged reload)
- `frontend/src/pages/wedding/WeddingDashboard.tsx` (import MessageCircle/ChatEvento, TabKey 'chat', voce TABS, render tab)

## Criticità / Note

- **Seed legacy ancora rotti**: stessa diagnosi delle FASI 1-4. `supabase db reset` non si completa. Fuori scope FASE 5.
- **DB locale non aggiornato**: migrazioni scritte come file, non applicate. Idempotenti.
- **Cast `as any` lato frontend**: la tabella `chat_messaggi`, le viste e le RPC nuove non sono nei `database.types.ts`. Pattern usato: `(supabase as any).from('chat_messaggi')` e `(supabase as any).rpc(...)`. Da rigenerare con `npm run db:types` quando il DB sarà aggiornato — fuori scope FASE 5.
- **`entry_status` enum usa `CANCELLATA`** (non `ANNULLATO`). La RPC `annulla_evento` setta `status='CANCELLATA'` (compat) e `evento_stato='ANNULLATO'` (workflow nuovo, FASE 1.3).
- **Recupero post-annullamento**: i dati restano, ma non c'è ancora una RPC pubblica `ripristina_evento`. È un'azione admin (annotata nel payload `recuperabile:true`). Miglioria futura.
- **Notifica `RICONFERMA_DATA_EVENTO`**: il link punta a `/supplier/availability?date=...`. La pagina esiste (`SupplierAvailabilityPage`), il deep-link a una data specifica è una miglioria futura.
- **Chat realtime**: la chat usa polling tramite refresh (`load()`) dopo invio. Per realtime live si potrà aggiungere `supabase.channel(...).on('postgres_changes', ...)` in futuro (fuori scope FASE 5).
- **`is_evento_member` come security definer + stable**: ne hardcodo le quattro vie d'accesso (owner / participant / wedding_couple_members / supplier nel quote). Se in futuro emergono altri ruoli (es. invitati che vedono certe chat?), va estesa.
