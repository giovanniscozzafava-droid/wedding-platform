# E2E Conflict Hotfix Replay — REPORT

**Run:** 2026-05-25T20-21-16
**Target:** https://planfully.it
**DB:** https://zfwlkvqxfzvubmfyxofs.supabase.co
**Hotfix migration:** 20260525200000_fix_conflict_alerts_owner_name.sql

## Verdetto: **HOTFIX ANCORA ROTTO**

- RPC Scenario A forn HIGH+EMAIL+LOC+DATE: FAIL (HTTP 400)
- RPC Scenario A wp   HIGH+EMAIL+LOC+DATE: FAIL (HTTP 400)
- RPC Scenario B forn MEDIUM LOC-only:     FAIL (HTTP 400)
- RPC Scenario B wp   MEDIUM LOC-only:     FAIL (HTTP 400)
- UI WP banner alert visibile:             FAIL
- UI Forn banner alert visibile:           FAIL

## BUG-002 [CRITICAL] — Nuovo bug introdotto/scoperto dall'hotfix

**Errore Postgres restituito ad ogni chiamata:**
```
code:    42804
message: structure of query does not match function result type
details: Returned type character varying(200) does not match expected type text in column 2.
```

**Root cause:**
La RETURNS TABLE della function dichiara `my_quote_title text` (colonna 2), ma `quotes.title` è `varchar(200)`. La hotfix precedente non toccava questa parte; tuttavia il vecchio bug `p.email` faceva fallire la planning fase prima — ora che `p.email` è rimosso, Postgres arriva al type-check delle colonne e il mismatch varchar→text fa schiantare l'esecuzione.

**Conseguenza:** la RPC ritorna sempre `42804` → frontend riceve errore → `ConflictAlertsBanner` non si renderizza mai (silent fail nel `useQuery`). Nessun alert è visibile né lato WP né lato Fornitore, anche se le righe candidate esistono ed il `WHERE` matcherebbe correttamente.

**Fix proposto (1 riga):**
Castare esplicitamente nel `SELECT` finale OPPURE rilassare il return type:
```sql
-- opzione A — cast nel SELECT
m.title::text                          as my_quote_title,
-- opzione B — return type a varchar
my_quote_title         varchar,
```
Best practice: cast esplicito (`::text`) per ognuna delle 4 colonne `text` che pescano da varchar (`my_quote_title`, `my_role`, `other_owner_role`, `other_owner_name`). Probabilmente serve anche `o.title::text` se mai esposto e `m.status::text`/`o.status::text` se sono enum (già castati). Verifica che pure `total_client` (numeric) e `event_date` (date) combacino.

**Repro:**
```bash
curl -X POST \
  -H "apikey: <ANON>" -H "Authorization: Bearer <USER_JWT>" \
  -H "content-type: application/json" \
  https://zfwlkvqxfzvubmfyxofs.supabase.co/rest/v1/rpc/my_quote_conflict_alerts -d '{}'
# → HTTP 400 con il 42804 sopra
```

## RPC Status
### Scenario A (EMAIL_MATCH HIGH)
```json
{
  "forn": {
    "http": 400,
    "ok": false,
    "count": 0,
    "sample": [],
    "error": {
      "code": "42804",
      "details": "Returned type character varying(200) does not match expected type text in column 2.",
      "hint": null,
      "message": "structure of query does not match function result type"
    }
  },
  "wp": {
    "http": 400,
    "ok": false,
    "count": 0,
    "sample": [],
    "error": {
      "code": "42804",
      "details": "Returned type character varying(200) does not match expected type text in column 2.",
      "hint": null,
      "message": "structure of query does not match function result type"
    }
  }
}
```
### Scenario B (LOCATION_MATCH MEDIUM mascherato)
```json
{
  "forn": {
    "http": 400,
    "ok": false,
    "count": 0,
    "sample": [],
    "error": {
      "code": "42804",
      "details": "Returned type character varying(200) does not match expected type text in column 2.",
      "hint": null,
      "message": "structure of query does not match function result type"
    }
  },
  "wp": {
    "http": 400,
    "ok": false,
    "count": 0,
    "sample": [],
    "error": {
      "code": "42804",
      "details": "Returned type character varying(200) does not match expected type text in column 2.",
      "hint": null,
      "message": "structure of query does not match function result type"
    }
  }
}
```

## Step results
### Scenario A
- PASS — 1 WP crea preventivo (quote 1dba6fc8-11de-4a11-8963-2ecd858deec0)
- PASS — 2 voce fornitore aggiunta
- PASS — 3 cliente diretto fornitore creato
- PASS — 4 quote diretto fornitore creato (quote 18e182fd-de72-455b-93e0-830cef7cdb38)
- FAIL — 5a RPC forn HTTP 200 (http=400 err={"code":"42804","details":"Returned type character varying(200) does not match expected type text in column 2.","hint":null,"message":"structure of query does not match function result type"})
- FAIL — 5b RPC wp HTTP 200 (http=400 err={"code":"42804","details":"Returned type character varying(200) does not match expected type text in column 2.","hint":null,"message":"structure of query does not match function result type"})
- FAIL — 6a Fornitore vede alert HIGH (severity=undefined signals=undefined other_owner=undefined)
- FAIL — 6b WP vede alert HIGH (severity=undefined signals=undefined other_owner=undefined)
- FAIL — 7a Forn signals include EMAIL+LOCATION+DATE (signals=undefined)
- FAIL — 7b WP signals include EMAIL+LOCATION+DATE (signals=undefined)
- PASS — UI WP banner Beta visibile (OK)
- FAIL — UI WP ConflictAlertsBanner visibile (mancante)

### Scenario B
- PASS — 1 WP crea preventivo (quote f3f6b05a-feb7-4e9b-8de8-ca8d7a997361)
- PASS — 2 voce fornitore aggiunta
- PASS — 3 cliente diretto creato (nome+email diversi)
- PASS — 4 quote diretto fornitore creato
- FAIL — 5a RPC forn HTTP 200 (http=400)
- FAIL — 5b RPC wp HTTP 200 (http=400)
- FAIL — 6a Forn vede alert MEDIUM LOCATION-only (severity=undefined signals=undefined)
- FAIL — 6b WP vede alert MEDIUM LOCATION-only (severity=undefined signals=undefined)
- PASS — UI Forn banner Beta visibile (OK)
- FAIL — UI Forn ConflictAlertsBanner visibile (mancante)

## BUG
### [CRITICAL] Scenario A: alert HIGH EMAIL_MATCH non corretto post-hotfix
**Repro:** WP crea quote+voce fornitore; Forn crea cliente+quote diretto stessa email/data/location; RPC entrambi i lati
**Expected:** Forn e WP vedono riga HIGH con signals EMAIL_MATCH+LOCATION_MATCH+DATE_MATCH
**Actual:** forn=undefined wp=undefined

### [CRITICAL] Scenario B: LOCATION_MATCH mascherato non rilevato correttamente
**Repro:** WP+Forn stessa location/data, nome+email DIVERSI
**Expected:** Entrambi lato vedono row MEDIUM con signals=[LOCATION_MATCH,DATE_MATCH] (no EMAIL_MATCH, no NAME_EXACT)
**Actual:** forn=undefined wp=undefined

### [HIGH] ConflictAlertsBanner non visibile lato WP post-hotfix
**Repro:** WP ha alert HIGH+MEDIUM via RPC, apre /
**Expected:** Banner rosa con conteggio conflitti
**Actual:** banner assente

### [HIGH] ConflictAlertsBanner non visibile lato Fornitore post-hotfix
**Repro:** Fornitore con quote diretto in conflitto, apre /
**Expected:** Banner con conteggio alert
**Actual:** banner assente

## NOTES
- fornFoto profile: {"business_name":"Marco Bianchi Photography","full_name":"Marco Bianchi","role":"FORNITORE"}

## File
- Screenshot WP: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/conflict-test-hotfix-2026-05-25T20-21-16/ui-wp-home.png
- Screenshot Forn: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/conflict-test-hotfix-2026-05-25T20-21-16/ui-forn-home.png
- /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/conflict-test-hotfix-2026-05-25T20-21-16/results.json