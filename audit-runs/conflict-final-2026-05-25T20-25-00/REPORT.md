# E2E Conflict Hotfix Replay — REPORT

**Run:** 2026-05-25T20-25-00
**Target:** https://planfully.it
**DB:** https://zfwlkvqxfzvubmfyxofs.supabase.co
**Hotfix migration:** 20260525200000_fix_conflict_alerts_owner_name.sql

## Verdetto: **HOTFIX OK (RPC + UI)**

- RPC Scenario A forn HIGH+EMAIL+LOC+DATE: PASS
- RPC Scenario A wp   HIGH+EMAIL+LOC+DATE: PASS
- RPC Scenario B forn MEDIUM LOC-only:     PASS
- RPC Scenario B wp   MEDIUM LOC-only:     PASS
- UI WP banner alert visibile:             PASS
- UI Forn banner alert visibile:           PASS

## RPC Status
### Scenario A (EMAIL_MATCH HIGH)
```json
{
  "forn": {
    "http": 200,
    "ok": true,
    "count": 1,
    "sample": [
      {
        "my_quote_id": "caa870d4-90d9-4272-a97b-42c2196dc12d",
        "my_quote_title": "E2E-HOTFIX-2026-05-25T20-25-00 A FORN Anna&Marco",
        "my_quote_status": "BOZZA",
        "my_quote_total": 0,
        "my_role": "FORNITORE_DIRETTO",
        "match_signals": [
          "EMAIL_MATCH",
          "LOCATION_MATCH",
          "DATE_MATCH"
        ],
        "other_quote_id": "90f5cba9-58a4-4f4a-afd5-f58a49be0cac",
        "other_owner_role": "WEDDING_PLANNER",
        "other_owner_name": "Beta Wedding Studio",
        "other_quote_event_date": "2027-04-17",
        "other_quote_total": 2500,
        "other_quote_status": "BOZZA",
        "conflict_severity": "HIGH"
      }
    ],
    "error": null
  },
  "wp": {
    "http": 200,
    "ok": true,
    "count": 1,
    "sample": [
      {
        "my_quote_id": "90f5cba9-58a4-4f4a-afd5-f58a49be0cac",
        "my_quote_title": "E2E-HOTFIX-2026-05-25T20-25-00 A WP Anna&Marco",
        "my_quote_status": "BOZZA",
        "my_quote_total": 2500,
        "my_role": "CAPOSTIPITE",
        "match_signals": [
          "EMAIL_MATCH",
          "LOCATION_MATCH",
          "DATE_MATCH"
        ],
        "other_quote_id": "caa870d4-90d9-4272-a97b-42c2196dc12d",
        "other_owner_role": "FORNITORE",
        "other_owner_name": "Marco Bianchi Photography",
        "other_quote_event_date": "2027-04-17",
        "other_quote_total": 0,
        "other_quote_status": "BOZZA",
        "conflict_severity": "HIGH"
      }
    ],
    "error": null
  }
}
```
### Scenario B (LOCATION_MATCH MEDIUM mascherato)
```json
{
  "forn": {
    "http": 200,
    "ok": true,
    "count": 2,
    "sample": [
      {
        "my_quote_id": "caa870d4-90d9-4272-a97b-42c2196dc12d",
        "my_quote_title": "E2E-HOTFIX-2026-05-25T20-25-00 A FORN Anna&Marco",
        "my_quote_status": "BOZZA",
        "my_quote_total": 0,
        "my_role": "FORNITORE_DIRETTO",
        "match_signals": [
          "EMAIL_MATCH",
          "LOCATION_MATCH",
          "DATE_MATCH"
        ],
        "other_quote_id": "90f5cba9-58a4-4f4a-afd5-f58a49be0cac",
        "other_owner_role": "WEDDING_PLANNER",
        "other_owner_name": "Beta Wedding Studio",
        "other_quote_event_date": "2027-04-17",
        "other_quote_total": 2500,
        "other_quote_status": "BOZZA",
        "conflict_severity": "HIGH"
      },
      {
        "my_quote_id": "72da63e8-6d17-4a25-ab93-7e0e5b8f0ae1",
        "my_quote_title": "E2E-HOTFIX-2026-05-25T20-25-00 B FORN G.Bianchi",
        "my_quote_status": "BOZZA",
        "my_quote_total": 0,
        "my_role": "FORNITORE_DIRETTO",
        "match_signals": [
          "LOCATION_MATCH",
          "DATE_MATCH"
        ],
        "other_quote_id": "7eec6f01-6a3e-4c2b-88a6-3227999de3e9",
        "other_owner_role": "WEDDING_PLANNER",
        "other_owner_name": "Beta Wedding Studio",
        "other_quote_event_date": "2027-10-09",
        "other_quote_total": 2000,
        "other_quote_status": "BOZZA",
        "conflict_severity": "MEDIUM"
      }
    ],
    "error": null
  },
  "wp": {
    "http": 200,
    "ok": true,
    "count": 2,
    "sample": [
      {
        "my_quote_id": "90f5cba9-58a4-4f4a-afd5-f58a49be0cac",
        "my_quote_title": "E2E-HOTFIX-2026-05-25T20-25-00 A WP Anna&Marco",
        "my_quote_status": "BOZZA",
        "my_quote_total": 2500,
        "my_role": "CAPOSTIPITE",
        "match_signals": [
          "EMAIL_MATCH",
          "LOCATION_MATCH",
          "DATE_MATCH"
        ],
        "other_quote_id": "caa870d4-90d9-4272-a97b-42c2196dc12d",
        "other_owner_role": "FORNITORE",
        "other_owner_name": "Marco Bianchi Photography",
        "other_quote_event_date": "2027-04-17",
        "other_quote_total": 0,
        "other_quote_status": "BOZZA",
        "conflict_severity": "HIGH"
      },
      {
        "my_quote_id": "7eec6f01-6a3e-4c2b-88a6-3227999de3e9",
        "my_quote_title": "E2E-HOTFIX-2026-05-25T20-25-00 B WP Giulia&Stefano",
        "my_quote_status": "BOZZA",
        "my_quote_total": 2000,
        "my_role": "CAPOSTIPITE",
        "match_signals": [
          "LOCATION_MATCH",
          "DATE_MATCH"
        ],
        "other_quote_id": "72da63e8-6d17-4a25-ab93-7e0e5b8f0ae1",
        "other_owner_role": "FORNITORE",
        "other_owner_name": "Marco Bianchi Photography",
        "other_quote_event_date": "2027-10-09",
        "other_quote_total": 0,
        "other_quote_status": "BOZZA",
        "conflict_severity": "MEDIUM"
      }
    ],
    "error": null
  }
}
```

## Step results
### Scenario A
- PASS — 1 WP crea preventivo (quote 90f5cba9-58a4-4f4a-afd5-f58a49be0cac)
- PASS — 2 voce fornitore aggiunta
- PASS — 3 cliente diretto fornitore creato
- PASS — 4 quote diretto fornitore creato (quote caa870d4-90d9-4272-a97b-42c2196dc12d)
- PASS — 5a RPC forn HTTP 200 (http=200 err=null)
- PASS — 5b RPC wp HTTP 200 (http=200 err=null)
- PASS — 6a Fornitore vede alert HIGH (severity=HIGH signals=["EMAIL_MATCH","LOCATION_MATCH","DATE_MATCH"] other_owner=Beta Wedding Studio)
- PASS — 6b WP vede alert HIGH (severity=HIGH signals=["EMAIL_MATCH","LOCATION_MATCH","DATE_MATCH"] other_owner=Marco Bianchi Photography)
- PASS — 7a Forn signals include EMAIL+LOCATION+DATE (signals=["EMAIL_MATCH","LOCATION_MATCH","DATE_MATCH"])
- PASS — 7b WP signals include EMAIL+LOCATION+DATE (signals=["EMAIL_MATCH","LOCATION_MATCH","DATE_MATCH"])
- PASS — UI WP banner Beta visibile (OK)
- PASS — UI WP ConflictAlertsBanner visibile (testo trovato)

### Scenario B
- PASS — 1 WP crea preventivo (quote 7eec6f01-6a3e-4c2b-88a6-3227999de3e9)
- PASS — 2 voce fornitore aggiunta
- PASS — 3 cliente diretto creato (nome+email diversi)
- PASS — 4 quote diretto fornitore creato
- PASS — 5a RPC forn HTTP 200 (http=200)
- PASS — 5b RPC wp HTTP 200 (http=200)
- PASS — 6a Forn vede alert MEDIUM LOCATION-only (severity=MEDIUM signals=["LOCATION_MATCH","DATE_MATCH"])
- PASS — 6b WP vede alert MEDIUM LOCATION-only (severity=MEDIUM signals=["LOCATION_MATCH","DATE_MATCH"])
- PASS — UI Forn banner Beta visibile (OK)
- PASS — UI Forn ConflictAlertsBanner visibile (testo trovato)

## BUG
Nessun bug rilevato.
## NOTES
- fornFoto profile: {"business_name":"Marco Bianchi Photography","full_name":"Marco Bianchi","role":"FORNITORE"}

## File
- Screenshot WP: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/conflict-final-2026-05-25T20-25-00/ui-wp-home.png
- Screenshot Forn: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/conflict-final-2026-05-25T20-25-00/ui-forn-home.png
- /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/conflict-final-2026-05-25T20-25-00/results.json