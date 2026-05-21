# Wedding Platform &mdash; PROGRESS

## Stato globale
- Inizio progetto: 2026-05-21
- Sessione attuale: in corso

## Fasi

### Fase 0 &mdash; Setup ambiente
**Stato:** in corso
- [x] Container runtime: OrbStack installato e attivo (docker context = orbstack)
- [x] Repo creato: `/Users/giovanniscozzafava/Repository/wedding-platform/`
- [x] Vite + React 18 + TS strict (downgrade da React 19 / Router 7 per allineare a stack briefing)
- [x] Tailwind v4 via `@tailwindcss/vite`
- [x] Supabase CLI init (cartelle migrations/functions, config.toml)
- [x] Documenti v2 copiati in `/docs/`
- [x] `.env.example` root + `frontend/.env.example`
- [x] Root `package.json` con script alias (`db:start`, `db:reset`, `db:types`, `scenario`, ecc.)
- [x] Playwright config con webServer auto-start
- [ ] `supabase start` (pull Docker, primo run lento)
- [ ] `.env.local` popolato con anon key vera
- [ ] Frontend `npm run dev` verde
- [ ] Git init + primo commit

### Note tecniche di Fase 0
- Documenti **0-GUIDA-OPERATIVA** e **2-Workflow-v2** non trovati: procedo con inferenza standard.
- Stack briefing dice React 18 + Router v6 &mdash; downgrade fatto. Vite 8 + Tailwind v4 (latest stabili).
- shadcn/ui: setup rinviato al primo componente UI in Fase 3 (login/register).

### Fasi successive
- Fase 1 (schema + seed): pending
- Fase 2 (RLS tests): pending
- Fase 3 (Auth): pending
- Fase 4a PRP-1 Fornitori: pending
- Fase 4b PRP-2 Calendario: pending
- Fase 4c PRP-3 Preventivi: pending
- Fase 5 (stress test 30 giorni): pending
- Fase 6 (report finale): pending

## Problemi incontrati / soluzioni
- **OrbStack install via `brew --cask`:** postflight killed da macOS. Risolto: install GUI manuale.
- **Vite scaffold ha messo React 19 + Router 7:** downgrade a React 18 + Router 6 come da briefing.

## Prossimo step
Attendere fine `supabase start`, leggere anon key, popolare `.env.local`, verificare `npm run dev`, git init + commit, passare a Fase 1.
