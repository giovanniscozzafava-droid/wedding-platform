# Wedding Platform

MVP per il settore wedding italiano: gestione fornitori, calendario condiviso, generatore preventivi.

Architettura "vasi comunicanti": i fornitori inseriscono dati una volta, capostipiti (Wedding Planner, Location) li riusano per costruire preventivi e coordinare eventi.

## Stack

- **Frontend:** React 18 + TypeScript strict + Vite + Tailwind v4 + shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Storage + Realtime + Edge Functions)
- **Email:** Resend (Edge Function)
- **PDF:** Puppeteer (Edge Function)
- **Test:** Vitest (unit) + Playwright (E2E) + SQL impersonation (RLS)

## Pre-requisiti

- Node.js >= 20
- Supabase CLI >= 2.90 (`brew install supabase/tap/supabase`)
- OrbStack o Docker Desktop (per Supabase locale)

## Avvio rapido

```bash
# 1. Avvia stack Supabase locale (Postgres + Auth + Storage + Studio)
npm run db:start

# 2. Copia chiavi nel frontend
npm run db:status
# copia URL + anon key in frontend/.env.local

# 3. Avvia frontend
npm run dev
# apre http://localhost:5173
```

## Script principali

| Comando | Cosa fa |
|---------|---------|
| `npm run dev` | Avvia frontend Vite (porta 5173) |
| `npm run build` | Build production frontend |
| `npm run db:start` | `supabase start` (Docker stack) |
| `npm run db:stop` | `supabase stop` |
| `npm run db:reset` | Reset DB locale + ri-applica migrations + seed |
| `npm run db:status` | Mostra URL/key locali |
| `npm run db:types` | Rigenera tipi TypeScript da schema |
| `npm test` | Test unitari Vitest |
| `npm run test:e2e` | Test E2E Playwright (chromium) |
| `npm run scenario` | Stress test 30 giorni realistico |

## Struttura

```
.
├── frontend/                 React + Vite + TS
│   └── src/
│       ├── lib/              supabase client, types, query helpers
│       ├── pages/            route pages
│       ├── components/       UI components (shadcn + custom)
│       └── hooks/            React Query hooks
├── supabase/
│   ├── migrations/           SQL versionato
│   ├── functions/            Edge Functions TypeScript (Deno)
│   ├── seed.sql              dati base + utenti test
│   └── config.toml
├── tests/
│   ├── e2e/                  Playwright
│   ├── sql/                  RLS impersonation tests
│   └── unit/                 test isolati (parser, helper)
├── docs/                     Dossier v2 + PRP v2 (riferimento)
└── playwright.config.ts
```

## Riferimenti

Documenti di progetto in `/docs/`. Versione di riferimento: v2 Supabase, aprile 2026.

## Stato attuale

Vedi `PROGRESS.md`.
