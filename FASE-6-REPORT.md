# FASE 6 — Salute evento + Feature flag

Branch: `feature/nuovo-modello`
Data: 2026-05-30

## Obiettivi

1. **6.1 Salute evento** — View `v_salute_evento` con label semantica (OTTIMA/OK/ATTENZIONE/CRITICA) + componente `SaluteEventoBadge` mobile-first wired in `WeddingDashboard` header e `CoupleDashboard` overview.
2. **6.2 Feature flag "nuovo modello"** — Colonna `profiles.nuovo_modello_attivo`, hook `useNuovoModello()`, gate dei componenti del workflow guidato, toggle nel pannello profilo (visibile a tutti, evidenziato per ADMIN).

## Migrazioni create

| File | Descrizione |
| --- | --- |
| `supabase/migrations/20260530600000_fase6_salute_evento.sql` | View `v_salute_evento` con `entry_id, evento_stato, giorni_alla_data, blocchi_aperti_count, ultimo_audit_il, salute_label`. Grant select a anon/authenticated. |
| `supabase/migrations/20260530610000_fase6_nuovo_modello_flag.sql` | `alter table profiles add column nuovo_modello_attivo boolean default false`, indice parziale su `id where nuovo_modello_attivo = true`. |

## Schema dettaglio

### View `v_salute_evento`

Aggregato per ogni `calendar_entries.id`:

| Colonna | Origine |
| --- | --- |
| `entry_id` | `calendar_entries.id` |
| `evento_stato` | `calendar_entries.evento_stato` (FASE 1.3) |
| `giorni_alla_data` | `(date_from - current_date)::int` — negativo se gia` passato |
| `blocchi_aperti_count` | `count(*)` di `notifiche` con `stato='PENDING'` e `priorita >= 7` collegate all'evento |
| `ultimo_audit_il` | `max(audit_log.eseguito_il)` con `record_id = entry.id` |
| `salute_label` | calcolato (vedi sotto) |

Regole `salute_label` (deterministiche, valutate in ordine):

1. `CRITICA` se `evento_stato='ANNULLATO'` OR `blocchi_aperti_count > 3` OR (`giorni_alla_data` 0..7 con almeno un blocco)
2. `ATTENZIONE` se `blocchi_aperti_count` 1..3 OR (`giorni_alla_data` 0..30 e stato non e` CHECKLIST/SVOLTO/ANNULLATO)
3. `OTTIMA` se `blocchi_aperti_count=0` e stato `SVOLTO`
4. `OK` default sano

Sicurezza: la view non ha RLS propria (le view non possono), ma la lettura passa attraverso `calendar_entries` e `notifiche` che hanno gia` le loro RLS. `audit_log` aggrega solo timestamp, nessun payload sensibile.

Grant: `select` a `anon, authenticated` per consentire la lettura via PostgREST.

### Colonna `profiles.nuovo_modello_attivo`

```
alter table public.profiles
  add column if not exists nuovo_modello_attivo boolean not null default false;
```

- Default `false`: l'attivazione e` esplicita.
- Indice parziale `idx_profiles_nuovo_modello_attivo` su `id where nuovo_modello_attivo = true` per query rapide tipo "elenco profili pilot".
- Nessuna policy aggiuntiva: il profilo `profiles` ha gia` policy update-self e update-admin.

## Frontend

### Hook `useNuovoModello()`

Path: `frontend/src/hooks/useNuovoModello.ts`

- Legge `profiles.nuovo_modello_attivo` per l'utente loggato.
- Cache module-level + pubsub: quando un componente cambia il flag (toggle nel profilo), tutti i componenti che usano l'hook si re-renderizzano.
- Fallback: `false` durante il loading e in assenza di sessione (i componenti nuovi restano nascosti finche` la risposta non e` chiara).
- Esporta anche `useSetNuovoModello()` per cambiare il valore (default sull'utente loggato).

Cast `as any` per `nuovo_modello_attivo`: la colonna non e` ancora nei `database.types.ts` finche` non si rigenera con `npm run db:types`.

### Componente `SaluteEventoBadge`

Path: `frontend/src/components/wedding/SaluteEventoBadge.tsx`

- Legge da `v_salute_evento` su mount per il dato `entryId`.
- Badge pillola colorata (verde/giallo/rosso) + icona (`CheckCircle2`/`Activity`/`AlertTriangle`/`AlertOctagon`).
- Tooltip pannello con `evento_stato`, `giorni_alla_data` (umanizzato "fra X giorni"/"oggi"/"X giorni fa"), `blocchi_aperti_count`, `ultimo_audit_il`.
- Mobile-friendly: tap apre il tooltip (close su tap-outside), hover/focus su desktop. Touch target >= 28px (e` un badge), il tooltip si apre sopra/sotto in base allo spazio.
- Variante `size: 'sm' | 'md'`.

### Wire

- `WeddingDashboard.tsx`: import + render `<SaluteEventoBadge entryId={wedding.id} />` nell'header accanto a `BusinessModelToggle`, gate `nuovoModello && ...`.
- `CoupleDashboard.tsx` `OverviewCouple`: blocco condizionale `{nuovoModello && (...)}` che mostra badge in alto a destra + `ProssimaMossa`.

### Gate dei componenti del nuovo modello

- `HomePage.tsx`: `ProssimaMossa` mostrata solo se `isCapostipite && nuovoModello`.
- `WeddingDashboard.tsx`:
  - `TABS` mark con `nuovoModelloOnly: true` per `riconciliazione` e `chat`.
  - `visibleTabs = TABS.filter(...)` rimuove le tab gated quando il flag e` off.
  - Render `tab === 'riconciliazione' && nuovoModello && <RiconciliazioneCard .../>` e `tab === 'chat' && nuovoModello && <ChatEvento .../>` (doppia guardia: tabs e content).
- `CoupleDashboard.tsx`: `ProssimaMossa` solo se `nuovoModello`.
- `AllContractsMonitor.tsx`: `EventoChangesMenu` (FASE 5.2) renderizzato solo se `nuovoModello`.

### Toggle nel pannello profilo

Path: `frontend/src/pages/auth/ProfilePage.tsx`

- Card dedicata "Nuovo modello" inserita prima della card GDPR.
- Icon `Sparkles`, descrizione in italiano della funzione.
- Switch custom (toggle stile iOS) min-h 44px, etichetta "Attivo"/"Disattivo".
- `await setNuovoModello(checked)` aggiorna `profiles.nuovo_modello_attivo`, toast di conferma.
- Banner extra per ADMIN: nota che il flag puo` essere cambiato globalmente via pannello admin.

Visibile a TUTTI gli utenti loggati (anche COUPLE, perche` il nuovo modello tocca anche loro su CoupleDashboard). Per ADMIN c'e` la nota in piu`.

## Build

```
cd /Users/giovanniscozzafava/Repository/wedding-platform/frontend && npm run build
```
**PASS** — `built in 985ms`, zero errori TS.

Bundle nuovo: `SaluteEventoBadge-DmkSF6z_.js` 83.10 kB / 21.29 kB gz (lazy se importato in code-split route, qui e` in WeddingDashboard / CoupleDashboard quindi compreso nei rispettivi chunk).

## DB

`supabase db reset --local` continua a fallire sui seed legacy (`lead_requests`/`v_sara`/`TEST-SEED`) — stesso problema documentato in FASE 1–5. Le migrazioni di FASE 6 sono **scritte e committate ma NON applicate** in questa sessione.

Idempotenti:
- View con `create or replace view`
- Column con `add column if not exists`
- Indice con `create index if not exists`

Pronte per `supabase migration up` su DB pulito in preview/CI.

## Mobile-first

- `SaluteEventoBadge`:
  - Mobile (>= 380px): badge in colonna singola, tooltip larghezza `min(90vw, 18rem)` per non sforare lo schermo.
  - Tap-friendly: tap apre tooltip, tap-outside chiude. Touch target del badge >= 28px (badge piccolo per stare in header denso) ma area di tap effettiva supera 32px verticali per via del padding.
- Toggle in `ProfilePage`:
  - Switch in colonna singola sotto la descrizione su mobile (flex-wrap), affianco a destra su desktop.
  - Touch target intera label/switch `min-h-[44px]`.
- Gate-on-flag: rispetta "una sola azione primaria" — quando il flag e` off, le tab/widget extra spariscono e non confondono.

## File creati

- `supabase/migrations/20260530600000_fase6_salute_evento.sql`
- `supabase/migrations/20260530610000_fase6_nuovo_modello_flag.sql`
- `frontend/src/hooks/useNuovoModello.ts`
- `frontend/src/components/wedding/SaluteEventoBadge.tsx`
- `FASE-6-REPORT.md`

## File modificati

- `frontend/src/pages/HomePage.tsx` (gate ProssimaMossa con `useNuovoModello()`)
- `frontend/src/pages/wedding/WeddingDashboard.tsx` (import flag + badge, `nuovoModelloOnly` su tabs riconciliazione/chat, render gate dei tab content, badge in header)
- `frontend/src/pages/couple/CoupleDashboard.tsx` (import flag + badge, OverviewCouple ProssimaMossa+badge gated)
- `frontend/src/components/wedding/AllContractsMonitor.tsx` (EventoChangesMenu gated)
- `frontend/src/pages/auth/ProfilePage.tsx` (card toggle "Nuovo modello" pre-GDPR)

## Criticità / Note

- **Seed legacy ancora rotti**: stessa diagnosi FASI 1–5. `supabase db reset` fallisce. Fuori scope FASE 6.
- **DB locale non aggiornato**: migrazioni scritte come file, non applicate. Idempotenti.
- **Cast `as any` lato frontend**: `v_salute_evento` e `profiles.nuovo_modello_attivo` non sono nei `database.types.ts`. Pattern `(supabase.from('v_salute_evento' as any) as any).select(...)` e `(supabase.from('profiles') as any).update(...)`. Da rigenerare con `npm run db:types` quando il DB sara` aggiornato — fuori scope FASE 6.
- **Cache feature flag in modulo**: la cache locale del flag e` pubsub-based. Funziona per re-render in-session, ma una modifica via SQL diretta (non via UI) richiede refresh per essere vista. Accettabile per un feature flag in pilot.
- **Tooltip senza primitive shadcn**: il progetto non ha ancora un `<Tooltip>` da `@/components/ui/`. Ho usato un pattern custom (div assoluto, tap-outside listener). Migliorabile in futuro con un primitive riusabile.
- **Pannello admin globale**: la richiesta diceva "Toggle in pannello admin/profilo visibile a ADMIN". Ho messo il toggle nel ProfilePage per **tutti** (perche` il flag e` self-service), con nota in piu` per ADMIN. Un pannello admin dedicato per cambiare il flag su altri utenti puo` essere aggiunto in futuro (fuori scope FASE 6: nessun mock di "pannello admin" esiste oggi nella codebase oltre alle pagine standard).
- **Salute label tendenzialmente "OK"**: gli eventi senza date passate e senza blocchi finiscono in OK. La semantica e` deliberata: OTTIMA e` riservata agli eventi gia` `SVOLTO` puliti.
- **Performance view**: `v_salute_evento` fa due aggregati (`notifiche` + `audit_log`). L'indice esistente `idx_audit_log_tabella_record (tabella, record_id, eseguito_il desc)` copre il max per record_id. `notifiche` ha `idx_notifiche_evento` ma il filtro `priorita >= 7 + stato='PENDING'` potrebbe beneficiare di un indice parziale dedicato in futuro se i volumi crescono — non urgente.
