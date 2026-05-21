# Wedding Platform &mdash; PROGRESS

## Stato globale
- Inizio progetto: 2026-05-21
- Sessione attuale: ✅ MVP completato

## Fasi

### Fase 0 &mdash; Setup ambiente ✅
- OrbStack + Supabase CLI 2.90 + Node 25
- Vite + React 18 strict + TS strict + Tailwind v4 + Router 6 + React Query + Zustand + Zod
- Struttura repo `/frontend`, `/supabase/{migrations,functions}`, `/tests/{e2e,sql,unit}`, `/docs`
- shadcn vanilla (Button, Input, Label, Card) + class-variance-authority + tailwind-merge + lucide
- `.env.local` con keys Supabase locale (publishable + anon JWT + service_role)
- Playwright config con webServer auto-start
- Commit `ec1374f` (chore: initial project setup)

### Fase 1 &mdash; Schema DB completo ✅
4 migration:
- `20260521150000_schema.sql`: 16 tabelle + 9 enum + indici
- `20260521150100_triggers.sql`: updated_at + price_versions snapshot/close + quote totals calc + enforce FREE limit + handle_new_auth_user (tutte SECURITY DEFINER)
- `20260521150200_rls.sql`: RLS policy commentate per ognuna 14 tabelle + helper functions (is_admin, has_active_collab, ecc.)
- `20260521150300_seed_helpers.sql`: `seed_user(...)` helper (definita in migration per parser CLI)

Seed: 6 utenti (admin + Giulia WP + Villa Aurora + 3 fornitori), 4 collab, 19 categorie standard, 23 servizi, 5 modificatori, 10 foto.

### Fase 2 &mdash; RLS impersonation test ✅ 8/8
File `tests/sql/rls_tests.sql` + runner bash. Scenari:
1. Fornitore vede solo propri servizi
2. Fornitore non vede servizi altri fornitori
3. Capostipite vede servizi dei collab
4. Capostipite non vede servizi senza collab
5. Owner calendar entry vede campi sensibili
6. Participant accede solo via view ridotta
7. Non-owner non puo` UPDATE quote
8. anon: SELECT diretto bloccato, RPC con token OK

### Fase 3 &mdash; Auth ✅ 5/5 E2E
- AuthProvider + RequireAuth + pagine Login/Register/Forgot/Reset/Onboarding/Profile
- Tests: redirect protetta, login KO/OK, logout, signup, forgot via Mailpit

### Fase 4a &mdash; PRP-1 Fornitori ✅ 5/5 E2E
- Storage: 3 bucket (service-photos public, quote-pdfs privato, brand-assets public) + policy
- Edge Function `upload-photo` (sharp 400x400 thumb, validate mime/size/limit)
- Hooks `useCatalog` (services, categories, collabs, modifiers, photos)
- ServiceForm modal + CatalogPage (dispatch by role)
- Tests: visibilita owner/collab, CREATE via API + price_versions auto, UPDATE prezzo chiude+apre, RLS rifiuta cross-tenant

### Fase 4b &mdash; PRP-2 Calendario ✅ 4/4 E2E
- Edge Function `calendar-notify` (Resend con fallback `notification_queue`)
- Edge Function `calendar-export-ics` (VCALENDAR RFC 5545)
- Hooks useCalendar (entries + view ridotta + export token)
- EntryForm + CalendarPage (vista lista cronologica con palette stato)
- Tests: create entry con participants, view ridotta senza campi sensibili, owner vede tutto, iCal feed

### Fase 4c &mdash; PRP-3 Preventivi ✅ 5/5 E2E
- Edge Function `quote-generate-pdf` (jsPDF, layout NEUTRA/PREMIUM con brand colori)
- Edge Function `quote-send` (orchestrazione: PDF + access_token + calendar entry IN_TRATTATIVA + participants auto + email Resend)
- Hooks useQuotes + publicQuoteByToken/Accept/Reject (RPC anon idempotenti)
- QuotesPage dashboard + QuoteEditorPage (3 pannelli) + pagine pubbliche /p/{preview,accept,reject}/:token
- BrandSettingsPage con upgrade demo PREMIUM + upload logo
- Tests: trigger calcolo totali con markup chain, RLS isolamento, trigger limite FREE 10, send completo, anon accept

### Fase 5 &mdash; Stress test 30 giorni realistico ✅ 16/16 step
File `tests/e2e/realistic_scenario.spec.ts` esegue scenario completo:
seed-check, trattativa De Luca (preventivo 8 voci 4 fornitori), invio + PDF, accept cliente, Marini 22/09, limite FREE, upgrade PREMIUM, reject Marini, export iCal Mario, audit finale.

Log: `tests/e2e/realistic_scenario_log.md`. Screenshot: `tests/e2e/screenshots/`. Tempo run: ~11s.

### Fase 6 &mdash; Docs finali ✅
- PROGRESS.md (questo)
- README.md
- docs/ARCHITECTURE.md
- docs/KNOWN_ISSUES.md

## Statistica test cumulativa
- **8** test RLS impersonation SQL
- **5** test auth E2E
- **5** test catalog E2E
- **4** test calendar E2E
- **5** test quotes E2E
- **16** step stress test 30 giorni
- **TOTALE: 43 assert verdi**

## Decisioni pragmatiche / scope MVP
- pg_cron schedules (reminders nightly): rinviato. Reminders invocati manualmente in stress test.
- Trigger pg_net DB &rarr; Edge Function: rinviato. Notifica chiamata da client dopo mutation (best-effort).
- Vista calendario settimanale (PRP-2 WI-9): rinviata. Vista mensile e lista bastano per MVP.
- Admin UI categories (PRP-1 WI-12): rinviata. Admin gestisce via SQL/Studio.
- Preferenze notifiche UI (PRP-2 WI-11): rinviato. Default `immediate=true,digest=false`.

## Prossimo passo suggerito
- Deploy cloud Supabase + Vercel + dominio
- Stripe per upgrade PREMIUM reale
- Implementazione pg_cron reminders + pg_net trigger
- Vista calendario settimanale + drag&drop
- Test load (k6 / Artillery) sulle Edge Functions PDF
