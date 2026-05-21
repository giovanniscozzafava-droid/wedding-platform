# Wedding Platform

MVP gestionale per il settore wedding italiano: catalogo fornitori, calendario condiviso, generatore preventivi. Architettura "vasi comunicanti" su Supabase + React.

**Stato**: MVP completato — 43 test verdi (8 RLS SQL + 27 E2E + 16 step stress test 30 giorni).

## Stack

- **Frontend**: React 18 + TypeScript strict + Vite 8 + Tailwind v4 + shadcn-style components
- **State**: React Query + Zustand + Zod
- **Backend**: Supabase (Postgres 17 + Auth + Storage + Realtime + Edge Functions Deno)
- **Email**: Resend (fallback Mailpit locale)
- **PDF**: jsPDF in Edge Function
- **Test**: Vitest unit + Playwright E2E + SQL impersonation

## Pre-requisiti

- macOS / Linux
- Node.js >= 20
- OrbStack o Docker Desktop (per Supabase locale)
- Supabase CLI >= 2.90 (`brew install supabase/tap/supabase`)

## Setup ambiente dev (5 min)

```bash
# 1. clona / entra
cd wedding-platform

# 2. avvia OrbStack (se non già attivo)
orb start

# 3. install deps
npm install
npm --prefix frontend install
npx playwright install chromium

# 4. avvia Supabase locale (download ~1GB di immagini al primo run)
npm run db:start

# 5. applica migrations + seed
npm run db:reset

# 6. (opzionale) genera tipi TS aggiornati
npm run db:types

# 7. avvia frontend
npm run dev
# apre http://localhost:5173 — login con giulia@wp-test.it / Test123!
```

In parallelo, per le Edge Functions:

```bash
supabase functions serve --env-file .env --no-verify-jwt
```

## Utenti di test seed (password: `Test123!`)

| Email | Ruolo |
|---|---|
| `admin@wp-test.it` | ADMIN |
| `giulia@wp-test.it` | Wedding Planner |
| `manager@villaaurora-test.it` | Location (Villa Aurora) |
| `info@fioreriabianchi-test.it` | Fornitore (fioraio) |
| `mario@foto-test.it` | Fornitore (fotografo) |
| `info@cateringsole-test.it` | Fornitore (catering) |

URL utili dev:
- App: http://localhost:5173
- Supabase Studio: http://127.0.0.1:54323
- Mailpit (email locali): http://127.0.0.1:54324
- API REST: http://127.0.0.1:54321

## Script disponibili

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Avvia frontend Vite (porta 5173, strict) |
| `npm run build` | Build production frontend |
| `npm run lint` | ESLint frontend |
| `npm test` | Vitest unit |
| `npm run db:start` | `supabase start` |
| `npm run db:stop` | `supabase stop` |
| `npm run db:reset` | Reset DB locale + ri-applica migrations + seed |
| `npm run db:status` | Mostra URL/key locali |
| `npm run db:types` | Rigenera tipi TS da schema DB |
| `npm run test:e2e` | Run tutti i Playwright E2E |
| `npm run test:e2e:headed` | E2E con browser visibile |
| `npm run test:e2e:ui` | Playwright UI interattiva |
| `npm run scenario` | Stress test 30 giorni completo |

## Esecuzione test

```bash
# 1. Test RLS SQL (impersonation diretta Postgres)
bash tests/sql/run_rls_tests.sh
# output in tests/sql/rls_test_results.md

# 2. Test E2E Playwright (richiede: db:reset + supabase functions serve)
npm run db:reset
supabase functions serve --env-file .env --no-verify-jwt &
npm run test:e2e

# 3. Stress test 30 giorni (subset di E2E ma full scenario)
npm run scenario
# log: tests/e2e/realistic_scenario_log.md
# screenshot: tests/e2e/screenshots/
```

## Struttura del repo

```
.
├── frontend/                 React + Vite + TS
│   └── src/
│       ├── lib/              supabase client, auth context, types DB
│       ├── pages/            route pages (Login, Catalog, Calendar, Quotes, ...)
│       ├── pages/public/     pagine senza auth (/p/preview /p/accept /p/reject)
│       ├── components/       UI components (shadcn + custom per dominio)
│       └── hooks/            React Query hooks (useCatalog, useCalendar, useQuotes)
├── supabase/
│   ├── migrations/           4 file SQL versionati
│   ├── functions/            Edge Functions Deno (upload-photo, calendar-notify,
│   │                         calendar-export-ics, quote-generate-pdf, quote-send)
│   ├── seed.sql              dati base + utenti test
│   └── config.toml           porte, auth, smtp
├── tests/
│   ├── e2e/                  Playwright + stress scenario
│   ├── sql/                  RLS impersonation tests
│   └── unit/                 placeholder per test isolati
├── docs/
│   ├── 1-Dossier-v2-Supabase.docx
│   ├── 3-PRP-1-Fornitori-v2.docx
│   ├── 4-PRP-2-Calendario-v2.docx
│   ├── 5-PRP-3-Preventivi-v2.docx
│   ├── ARCHITECTURE.md       overview tecnico + decisioni
│   └── KNOWN_ISSUES.md       limitazioni e TODO post-MVP
├── PROGRESS.md               storia fasi + statistica test
└── playwright.config.ts
```

## Comportamenti chiave

- **Limite tier FREE**: il trigger `enforce_free_quote_limit` rifiuta l'11esimo preventivo attivo con messaggio in italiano.
- **Snapshot prezzi**: ogni voce di preventivo congela `snapshot_price`. Quando il fornitore aggiorna il prezzo del servizio, il trigger su `services.base_price` chiude la vecchia `price_versions` e ne apre una nuova, ma il preventivo già emesso resta invariato.
- **Cascade accept/reject cliente**: la RPC `quote_accept_by_token` aggiorna `quotes.status='ACCETTATO'` E `calendar_entries.status='OPZIONATA'` in una sola chiamata. `quote_reject_by_token` cascadea a `CANCELLATA`.
- **iCal export**: feed VCALENDAR per fornitore protetto da token UUID con scadenza 90 giorni.
- **Participant view ridotta**: i fornitori vedono gli eventi a cui sono agganciati MA solo via view `calendar_entries_for_participants` che esclude `client_name`, `client_email`, `value_amount`, `notes`.

## Riferimenti

Documenti di progetto v2 (aprile 2026) in [`/docs/`](./docs/).

## Stato e roadmap

- ✅ **MVP completato**: vedi [`PROGRESS.md`](./PROGRESS.md)
- ⚠️ **Limitazioni note**: vedi [`docs/KNOWN_ISSUES.md`](./docs/KNOWN_ISSUES.md)
- 📐 **Architettura**: vedi [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
