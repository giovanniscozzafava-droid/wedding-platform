# FASE 7 — Simulazione full lifecycle "nuovo modello"

Branch: `feature/nuovo-modello`
Data: 2026-05-30

## Obiettivo

Simulare end-to-end l'intero ciclo di vita di un matrimonio nel nuovo modello
(parcella + ricarico, questionario, preventivo con modifiche delta firma,
ospiti/tavoli, logistica chiesa/transfer/alberghi, menu PER_GUEST con extra,
voce esterna bomboniere, mood, allargamento budget, checklist giorno evento,
dropout fornitore via RPC + sostituzione, cleanup), **senza** registrare
utenti reali in `auth.users`.

## File creati

| File | Descrizione |
| --- | --- |
| `tests/e2e/full-lifecycle-nuovo-modello.mjs` | Simulatore Node puro (no rete, no Playwright): mock-DB in memoria, audit AST sui sorgenti, 15 step di scenario. |
| `FASE-7-REPORT.md` | Questo report. |

## Esecuzione

```
node tests/e2e/full-lifecycle-nuovo-modello.mjs
```

Output: PASS 19 / FAIL 0, exit code 0.

## Tabella mapping NUMERO -> ruolo -> password

Convenzione: `giovanni.scozzafava+NNNN@gmail.com`, password globale `Beta2026!`.

| Numero | Ruolo | Descrizione |
| --- | --- | --- |
| 1000 | WP | Capostipite (Wedding Planner principale) |
| 2000 | COPPIA | Sposi (un solo +tag condiviso, 2 firmatari) |
| 3000 | FORNITORE / LOCATION | Fornitore #1 |
| 3001 | FORNITORE / FOTOGRAFO | Fornitore #2 |
| 3002 | FORNITORE / VIDEOMAKER | Fornitore #3 |
| 3003 | FORNITORE / FIORISTA | Fornitore #4 |
| 3004 | FORNITORE / CATERING | Fornitore #5 |
| 3005 | FORNITORE / PASTICCERIA | Fornitore #6 |
| 3006 | FORNITORE / DJ | Fornitore #7 |
| 3007 | FORNITORE / BAND | Fornitore #8 |
| 3008 | FORNITORE / MAKEUP | Fornitore #9 |
| 3009 | FORNITORE / HAIR_STYLIST | Fornitore #10 |
| 3010 | FORNITORE / ABITO_SPOSA | Fornitore #11 |
| 3011 | FORNITORE / ABITO_SPOSO | Fornitore #12 |
| 3012 | FORNITORE / WEDDING_CAR | Fornitore #13 |
| 3013 | FORNITORE / ANIMAZIONE_BIMBI | Fornitore #14 |
| 3014 | FORNITORE / BARTENDER | Fornitore #15 |
| 3015 | FORNITORE / PARTECIPAZIONI | Fornitore #16 |
| 3016 | FORNITORE / BOMBONIERE | Fornitore #17 |
| 3017 | FORNITORE / TRANSFER | Fornitore #18 |
| 3018 | FORNITORE / NOLEGGIO_ARREDI | Fornitore #19 |
| 3019 | FORNITORE / CELEBRANTE_RITO_SIMBOLICO | Fornitore #20 |
| 5000..5029 | INVITATO | 30 invitati (one per numero) |

Tutte le password: `Beta2026!`.

## Verifica anti-normalizzazione email

Il pattern letterale `replace(/\+...` viene cercato in:
- `frontend/src/**/*.{ts,tsx,js,jsx,mjs,cjs}`
- `supabase/functions/**/*.{ts,tsx,js,jsx,mjs,cjs}`

### Risultati (3 occorrenze totali, **0 bug**)

| File | Linea | Esito | Motivazione |
| --- | --- | --- | --- |
| `supabase/functions/quote-accept-sign/index.ts` | 401 | OK | display-name extraction (`ownerEmailLocal` da `split('@')[0]`, usato solo come fallback per `wpName`) |
| `supabase/functions/quote-send/index.ts` | 169 | OK | display-name extraction (idem, fallback per `business_name`/`full_name`) |
| `supabase/functions/send-questionnaire/index.ts` | 99 | OK | display-name extraction (idem) |

Linea-tipo:
```ts
const ownerEmailLocal = ownerEmail
  ? ownerEmail.split('@')[0].replace(/\+.*$/, '').replace(/[._-]+/g, ' ').trim()
  : null
```

Tutte e 3 le occorrenze ricavano un nome leggibile per le email di brand/firma,
**non** toccano email usate in `auth.signUp` / `signInWithPassword` /
lookup utente. Quindi: **conforme**.

## Email generate per tipo (campione output)

```
WP capostipite : giovanni.scozzafava+1000@gmail.com
Coppia         : giovanni.scozzafava+2000@gmail.com
Fornitori (20) : giovanni.scozzafava+3000@gmail.com ... giovanni.scozzafava+3019@gmail.com
Invitati (30)  : giovanni.scozzafava+5000@gmail.com ... giovanni.scozzafava+5029@gmail.com
```

## Step PASS/FAIL

| # | Step | Esito |
| --- | --- | --- |
| 1 | WP profilo INTERO parcella+ricarico | PASS |
| 2 | 20 fornitori con offerte fixture | PASS |
| 3 | coppia firma incarico -> INCARICO_FIRMATO | PASS |
| 4 | questionario compilato | PASS |
| 5 | 30 mood images create | PASS |
| 6 | modifiche delta applicate | PASS |
| 7 | preventivo FIRMATO | PASS |
| 8 | 30 invitati creati (email +5000..5029) | PASS |
| 9 | YES count corretto | PASS |
| 10 | 5 tavoli con assegnazioni + label modificata | PASS |
| 11 | chiesa+celebrante+3 transfer+2 alberghi | PASS |
| 12 | riconciliazione PER_GUEST con menu 150 EUR + extra 30 EUR | PASS |
| 13 | voce esterna bomboniere supplier_id NULL | PASS |
| 14 | mood finale aggiunto (totale 40 immagini) | PASS |
| 15 | budget allargato a 90000 | PASS |
| 16 | checklist giorno evento creata | PASS |
| 17 | dropout + sostituzione + riconferma | PASS |
| 18 | evento finalizzato a SVOLTO | PASS |
| 19 | anti-normalization audit (no bug auth/lookup) | PASS |

**Totale: 19 PASS / 0 FAIL.**

## Build

`cd frontend && npm run build` -> OK (1.01s, 0 errori TS, 0 warning bloccanti).

## Limitazioni note

1. **Mock-only**: il test non scrive su `auth.users` ne` sul DB reale. Per
   testare flussi RLS e trigger reali ci sono gia` gli script di `tests/e2e/`
   con runner Playwright/Supabase (es. `realistic_scenario.spec.ts`).
2. **RPC non invocate live**: i passi 5 (modifiche delta), 12
   (riconciliazione menu PER_GUEST) e 14 (dropout fornitore) eseguono gli
   stessi side-effect descritti dalle RPC `riconciliazione_allinea_menu` e
   `dropout_fornitore`, ma direttamente sulla mock-DB. Quando si avra` un
   ambiente Supabase locale (OrbStack + `supabase start`) gli stessi step
   possono essere ri-eseguiti contro le RPC reali sostituendo i blocchi mock
   con `clients.wp.rpc(...)`.
3. **Email signup non eseguito**: la convenzione `+NNNN` e` documentata e la
   tabella stampata permette di registrare manualmente gli account quando il
   beta-program lo richiedera`. Le 52 email distinte non collidono fra loro.
4. **Audit AST euristico**: il classificatore guarda variabile/contesto
   nella stessa riga. Per file complessi conviene comunque rileggere
   manualmente prima di un major release.
5. **Categorie fornitore**: l'elenco a 20 categorie e` indicativo
   (`SUPPLIER_KINDS` nel sorgente). Allinearlo al catalogo reale quando si
   apre la beta.

## Commit

`feat(fase-7): simulazione full lifecycle nuovo modello`
