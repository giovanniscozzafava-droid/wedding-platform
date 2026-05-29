# CLAUDE.md — wedding-platform (planfully.it)

> File di contesto per agenti di sviluppo (Claude Code / agente VS Code).
> Leggilo PRIMA di toccare qualsiasi cosa. È la fonte di verità sul progetto.

## Cos'è questo progetto
Gestionale wedding italiano "a vasi comunicanti", **online su planfully.it** con clienti reali.
Fornitori → Capostipiti (Wedding Planner / Location) → Coppia (cliente finale).
Funzioni: catalogo fornitori, calendario condiviso, preventivi, contratti, logistica evento
(invitati/tavoli/menu/timeline), area coppia, finanza/assicurazioni, social feed, referral.

NON confonderlo con la repo `skorpiov3`: quella è un altro prodotto (magazine + agenzia).
Questo è il GESTIONALE. Sono due codebase separate.

## Stack
- Frontend: React 18 + TypeScript **strict** + Vite + Tailwind v4 + shadcn-style. React Query + Zustand + Zod. ~60 pagine lazy-loaded in `frontend/src/pages/`.
- Backend: **Supabase hosted** (Postgres 17 + Auth + PostgREST + Storage + Edge Functions Deno). Email via Resend.
- Deploy: Vercel (frontend), dominio planfully.it. Dev locale: Supabase via Docker/OrbStack.

## Mappa rapida
- `frontend/src/pages/` — pagine (routing per ruolo in `frontend/src/App.tsx` via `RequireAuth roles={...}`)
- `frontend/src/components/` — UI per area (catalog, calendar, quote, wedding, social, feed, layout, ui)
- `frontend/src/hooks/`, `frontend/src/lib/` — hooks dati e client Supabase; tipi in `frontend/src/lib/database.types.ts`
- `supabase/migrations/` — schema versionato (~90 file `YYYYMMDDHHMMSS_*.sql`)
- `supabase/functions/` — 17 Edge Functions Deno
- `tests/` — Vitest unit, Playwright e2e, SQL RLS impersonation

## Modello ruoli
`user_role` enum: WEDDING_PLANNER, LOCATION, FORNITORE, ADMIN (+ `subrole` testo).
Le coppie entrano su invito (non sono nell'enum); `couple_role`: SPOSO/SPOSA/PARTNER/PERSONA_DI_FIDUCIA.
Sicurezza = RLS Postgres + helper SECURITY DEFINER (`is_admin`, `has_active_collab_with_supplier`, `is_entry_participant`, `is_quote_owner`).

## ⚠️ DANGER ZONES (dati reali in produzione)
- **Dati personali sensibili**: `event_guests` contiene età (inclusi MINORI) e accessibilità; coppie e clienti reali. Tratta RLS e query con la massima cura: un errore qui è un incidente GDPR, non un bug estetico.
- **RLS è la prima linea di difesa.** Ogni nuova tabella nasce con RLS abilitata e policy esplicite. Mai disabilitare RLS per "far funzionare" qualcosa.
- **MAI** mettere `service_role` o altri segreti nel frontend. Il service_role vive solo nelle Edge Functions.
- **Migrazioni**: mai modificare una migrazione già applicata; creane una nuova. Non aggiungere migrazioni "una-tantum" che manipolano dati di persone reali (es. delete/transfer di un utente) alla catena permanente.

## Regole d'ingaggio (obbligatorie)
1. Lavora SEMPRE su un branch dedicato (`feature/...` o `fix/...`). Mai commit diretti su `main`.
2. **Niente comandi sul database di PRODUZIONE** senza istruzione esplicita e supervisione umana: vietati `supabase db push`, `supabase link` al progetto prod, `functions deploy` in prod, qualsiasi scrittura sul DB hosted. In locale puoi usare `supabase db reset`, `db:types`, test.
3. Niente deploy su Vercel di tua iniziativa.
4. Ogni azione che scrive/cancella dati va sempre via soft-delete dove previsto; niente DELETE fisici di iniziativa.
5. `npm run build` deve passare prima di considerare un task finito. Esegui i test pertinenti.
6. Tocca solo ciò che il task chiede. Se per farlo funzionare devi cambiare altro, fermati e segnalalo invece di allargarti.
7. A fine task scrivi un report (`*-REPORT.md`) con: file toccati, cosa hai fatto, cosa NON sei riuscito a fare, e qualsiasi rischio notato.

## Comandi utili (dev locale)
```
npm install && npm --prefix frontend install
npm run db:start      # Supabase locale (Docker/OrbStack)
npm run db:reset      # applica tutte le migrazioni + seed da zero
npm run db:types      # rigenera i tipi TS dal DB locale
npm run dev           # frontend su localhost:5173
```

## Stato noto / debiti (vedi documento di coerenza)
- Sicurezza RLS rattoppata in molte migrazioni → da consolidare con audit.
- Upgrade PREMIUM è un bottone demo (nessun pagamento reale).
- Notifiche "best-effort" dal client (nessun trigger pg_net / pg_cron attivo).
- Documenti in `docs/` fermi allo snapshot MVP del 21/05: non riflettono l'espansione.
- `planfully.it` è referenziato anche da un'altra repo (`skorpiov3`): confine dominio da chiarire.

## Priorità di lavoro corrente
1. Audit RLS sulle tabelle con dati sensibili.
2. Igiene migrazioni (isolare seed/one-off).
3. Chiudere/nascondere le funzioni "finte" (pagamento).
4. Console customer-care / admin (già nel TODO: "Pagina /admin con override RLS per supporto").
Costruisci nuove funzioni solo dopo aver messo in sicurezza l'esistente.
