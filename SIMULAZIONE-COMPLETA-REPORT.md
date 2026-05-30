# SIMULAZIONE COMPLETA — Report

Branch: `feature/simulazione-completa`
Repo: `/Users/giovanniscozzafava/Repository/wedding-platform`

Documento di lavoro per la simulazione end-to-end del lifecycle Planfully
(WP + Coppia + Fornitore + Notifiche + Digest). Una sezione per fase.

## Fase 0 — Preparazione ambiente

Data esecuzione: 2026-05-30.

### 0.1 Docker + Supabase locale

- `docker ps`: 12 container Supabase up & healthy
  (db / studio / pg_meta / edge-runtime / storage / postgrest / realtime /
  mailpit / gotrue / kong / vector / logflare).
- Porte attive: API 54321, DB 54322, Studio 54323, Inbucket 54324,
  Analytics 54327.
- Nessun avvio aggiuntivo necessario (Supabase locale gia` operativo).

### 0.2 Fix seed legacy

Diagnosi: `supabase db reset --local` falliva su due seed-only migrations
perche' assumevano la presenza di dati di test (Sara De Luca, fornitori
test, WP test) che non esistono in un reset pulito → la variabile
`v_sara` rimaneva NULL e l'`insert into referrals (referrer_id, ...)`
violava il NOT NULL.

Azione: spostati fuori dalla migration chain (in `supabase/seed_test/`)
i due file pure-seed che bloccavano il reset:

- `supabase/migrations/20260526380000_seed_test_tier_oro.sql` →
  `supabase/seed_test/20260526380000_seed_test_tier_oro.sql`
  (creava 20 fornitori test referenced da Sara — Sara non esisteva).
- `supabase/migrations/20260527010000_find_test_lead.sql` →
  `supabase/seed_test/20260527010000_find_test_lead.sql`
  (insert lead con `wp_id = v_sara`, v_sara NULL su reset pulito).

Gli altri seed test (`20260526370000_seed_referral_test_data`,
`20260526440000_seed_test_services`, `20260526450000_seed_supplier_feed_posts`,
`20260526430000_referral_creates_collaboration` con backfill,
`20260526460000_full_e2e_verify`) hanno guard `if v_sara is null then return`
o set vuoti che falliscono safe → restano nella chain, esecuzione no-op.

Nessuna migration di SCHEMA spostata: questi due file sono 100% seed di
dati test, schema intoccato.

### 0.3 Migrazioni applicate pulite

- `supabase db reset --local` → `Finished supabase db reset on branch
  feature/simulazione-completa.` (nessun errore).
- Verifica oggetti chiave via `docker exec ... psql`:
  - `professioni`: 29 righe (OK).
  - Tabelle presenti: `chat_messaggi`, `consenso_segnalazione`,
    `eventi_cambiamento`, `notifiche`, `professioni`, `scadenzario_voci`.

### 0.4 Types e build

- `npm run db:types` → `frontend/src/lib/database.types.ts` rigenerato
  (230 437 byte).
- `cd frontend && npm run build` → **PASS** (vite `built in 1.10s`,
  nessun errore TypeScript).
- Cast `as any` esistenti su tabelle nuove (notifiche, professioni…) NON
  rimossi: lasciati intoccati come da consegna.

### 0.5 Resend hook digest

- Migration `supabase/migrations/20260601300000_resend_digest_hook.sql`
  creata: sostituisce il placeholder `invia_digest_giornaliero()` con
  invocazione `net.http_post` verso edge function `send-digest`.
  - Legge endpoint da GUC `app.supabase_url` (fallback `http://kong:8000/functions/v1`).
  - Legge auth key da GUC `app.functions_anon_key` (fallback stringa vuota).
  - Best-effort: errori HTTP loggati ma non bloccanti.
  - Fallback `raise notice` se `pg_net` non disponibile.
- Edge function `supabase/functions/send-digest/index.ts` creata:
  - Modo 1: scan `v_notifiche_digest_per_utente` per la data corrente,
    invio email per ogni destinatario via `_shared/ses.ts` (Resend).
  - Modo 2: chiamata singola `{ destinatario_id, totale, primi_10 }` →
    invio email per quel singolo utente (chiamata da SQL via pg_net).
  - Template HTML con elenco notifiche, link al pannello, totale,
    rispetta `APP_BASE_URL` env.
- `pg_net` confirmed available in locale (`select extname from pg_extension
  where extname='pg_net'` → 1 riga).

### 0.6 Email di prova — BLOCCO

- `RESEND_API_KEY` cercata in:
  - `/Users/giovanniscozzafava/Repository/wedding-platform/.env`:
    chiave presente ma valore VUOTO (15 char totali = `RESEND_API_KEY=`).
  - `/Users/giovanniscozzafava/Repository/wedding-platform/.env.example`:
    placeholder (10 char `re_...___`).
  - `/Users/giovanniscozzafava/Repository/wedding-platform/frontend/.env.local`:
    solo `VITE_SUPABASE_*` + `VITE_APP_BASE_URL`, nessun RESEND.
  - `supabase/.env` / `supabase/functions/.env`: **non esistono**.
  - Shell env: `RESEND_API_KEY` non settata.
- **Email di prova NON inviata.** Per evitare uscita di chiamate Resend
  finte (e costo zero garantito), STOP come da policy: la chiave reale
  vive su Supabase Edge Function Secrets remoto, non e' disponibile
  localmente.
- Workaround utente: settare `RESEND_API_KEY=re_xxx` in
  `/Users/giovanniscozzafava/Repository/wedding-platform/.env` (o
  esportarla in shell) e rieseguire la Fase 0. La logica edge funziona
  identica in locale e remoto.

### 0.7 Anti-normalizzazione email

`grep -rn 'replace(/\\+.*' frontend/src supabase/functions` → 3 occorrenze,
tutte in display-name extraction (NON identita'):

- `supabase/functions/quote-accept-sign/index.ts:401`
  `ownerEmail.split('@')[0].replace(/\+.*$/, '').replace(/[._-]+/g, ' ').trim()`
- `supabase/functions/quote-send/index.ts:169` — idem.
- `supabase/functions/send-questionnaire/index.ts:99` — idem.

In tutti e tre i casi il valore `ownerEmail` (identita' del destinatario)
viene passato intatto alle email; lo `.split('@')[0].replace(/\+.*$/, '')`
crea solo `ownerEmailLocal` per costruire un nome leggibile nel testo
("Studio Foo" come fallback al business_name). Nessuna normalizzazione di
identita' applicata. OK.

### 0.8 Esito

Stato Fase 0: **PARZIALE** (criticita: `resend_non_disponibile`).

- [x] Docker + Supabase up.
- [x] Seed legacy isolati → reset DB pulito.
- [x] DB reset OK su tutte le 145 migrations rimanenti.
- [x] Types rigenerati + frontend build PASS.
- [x] Edge function `send-digest` + migration hook `pg_net` creati.
- [ ] Email di prova Resend inviata → bloccato per chiave assente in
      ambiente locale.

File toccati / creati:

- D `supabase/migrations/20260526380000_seed_test_tier_oro.sql`
  (spostato in `supabase/seed_test/`).
- D `supabase/migrations/20260527010000_find_test_lead.sql`
  (spostato in `supabase/seed_test/`).
- A `supabase/seed_test/20260526380000_seed_test_tier_oro.sql`.
- A `supabase/seed_test/20260527010000_find_test_lead.sql`.
- A `supabase/migrations/20260601300000_resend_digest_hook.sql`.
- A `supabase/functions/send-digest/index.ts`.
- M `frontend/src/lib/database.types.ts` (rigenerato).

## Resend Smoke Test

Data esecuzione: 2026-05-30.

- Script: `scripts/resend-smoke-test.mjs` (Node fetch, NO shell pipe → chiave
  mai in `process list`).
- Chiave letta da `/Users/giovanniscozzafava/Repository/wedding-platform/.env`
  (`RESEND_API_KEY` ora valorizzata). Mai stampata.
- `RESEND_FROM_EMAIL` non presente nel `.env` come tale (esiste solo per typo
  la variabile `RRESEND_FROM_EMAIL=onboarding@resend.dev`). Lo script fa
  fallback su `onboarding@resend.dev` (sandbox Resend, sempre valido senza
  verifica dominio) — scelta annotata come da consegna.
- Endpoint: `POST https://api.resend.com/emails`.
- From address usato: `onboarding@resend.dev`.
- Destinatario: `giovanni.scozzafava@gmail.com` (indirizzo proprietario
  dell'account Resend).
  - Tentativo iniziale verso `giovanni.scozzafava+9999@gmail.com` rifiutato
    con `403`: in modalita' testing (dominio non verificato) Resend ammette
    SOLO l'esatto indirizzo proprietario, senza plus-alias. Adattato come
    minima deviazione dalla consegna per sbloccare la consegna.
- Esito: **success** (`status 200`).
- Message id: `036ff029-f165-46a0-b9f9-aaeabd87a39a`.
- Timestamp invio (UTC): `2026-05-30T18:57:21.752Z`.
- Note di sicurezza:
  - Chiave caricata via parsing manuale del `.env` (no `dotenv`), mai
    loggata, mai passata via argv. Solo nell'header `Authorization` della
    richiesta HTTPS.
  - Nessuna chiave persistita nel report o nello stdout.

File aggiunti:

- A `scripts/resend-smoke-test.mjs`.

