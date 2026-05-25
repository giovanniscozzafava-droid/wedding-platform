# Wave3-O Regression Report (backend portion)

- Started: 2026-05-25T21:24:10.919Z
- Ended: 2026-05-25T21:24:17.123Z
- Prod: https://planfully.it (deploy gygrx4er4)
- Output dir: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave3-O-regression-20260525-231843

## Verdicts

| ID | Title | Verdict |
|----|-------|---------|
| R1 | quote-accept-sign idempotency | PASS |
| R4 | bundle split + initial gz<350KB | PASS |
| R5 | RLS scope fornitore foto | PASS |

## Details
```json
[
  {
    "id": "R4",
    "title": "bundle split chunks present + initial gz<350KB",
    "verdict": "PASS",
    "details": {
      "chunks": [
        "assets/index-B0O5cRfz.js",
        "assets/vendor-pdf-DvHkrW-m.js",
        "assets/vendor-motion-BnPlfCCY.js",
        "assets/vendor-react-DyTvu2tV.js",
        "assets/vendor-supabase-BDjhuu4N.js",
        "assets/vendor-query-tqMhkkzg.js",
        "assets/vendor-ui-NSTwVXc9.js"
      ],
      "missing_chunks": [],
      "sizes": {
        "assets/index-B0O5cRfz.js": {
          "raw": 564394,
          "decoded": 564394
        },
        "assets/vendor-pdf-DvHkrW-m.js": {
          "raw": 624441,
          "decoded": 624441
        },
        "assets/vendor-motion-BnPlfCCY.js": {
          "raw": 132135,
          "decoded": 132135
        },
        "assets/vendor-react-DyTvu2tV.js": {
          "raw": 156232,
          "decoded": 156232
        },
        "assets/vendor-supabase-BDjhuu4N.js": {
          "raw": 199502,
          "decoded": 199502
        },
        "assets/vendor-query-tqMhkkzg.js": {
          "raw": 35370,
          "decoded": 35370
        },
        "assets/vendor-ui-NSTwVXc9.js": {
          "raw": 55636,
          "decoded": 55636
        }
      },
      "initial_gz_bytes": 309135,
      "initial_gz_kb": "301.9",
      "threshold_kb": 350,
      "checks": {
        "allPresent": true,
        "sizeOk": true
      }
    }
  },
  {
    "id": "R1",
    "title": "quote-accept-sign idempotency (10 parallel)",
    "verdict": "PASS",
    "details": {
      "quote_id": "0725d704-7f35-4224-9bd8-7906e4df0a3c",
      "access_token": "0d8a74c5-0451-4d18-8296-2fb6027ba7a2",
      "results": [
        {
          "idx": 0,
          "status": 409,
          "msg": "Preventivo già firmato da un'altra sessione. Ricarica la pagina."
        },
        {
          "idx": 1,
          "status": 409,
          "msg": "Preventivo già firmato da un'altra sessione. Ricarica la pagina."
        },
        {
          "idx": 2,
          "status": 200,
          "msg": "6226a585-481f-41a4-b91e-9e86f295d5f3"
        },
        {
          "idx": 3,
          "status": 409,
          "msg": "Preventivo già firmato da un'altra sessione. Ricarica la pagina."
        },
        {
          "idx": 4,
          "status": 409,
          "msg": "Preventivo già accettato. Non è possibile firmarlo una seconda volta."
        },
        {
          "idx": 5,
          "status": 409,
          "msg": "Preventivo già accettato. Non è possibile firmarlo una seconda volta."
        },
        {
          "idx": 6,
          "status": 409,
          "msg": "Preventivo già firmato da un'altra sessione. Ricarica la pagina."
        },
        {
          "idx": 7,
          "status": 409,
          "msg": "Preventivo già firmato da un'altra sessione. Ricarica la pagina."
        },
        {
          "idx": 8,
          "status": 409,
          "msg": "Preventivo già firmato da un'altra sessione. Ricarica la pagina."
        },
        {
          "idx": 9,
          "status": 409,
          "msg": "Preventivo già firmato da un'altra sessione. Ricarica la pagina."
        }
      ],
      "count_200": 1,
      "count_409": 9,
      "count_other": 0,
      "db_acceptance_count": 1,
      "db_quote_status": "ACCETTATO",
      "db_quote_accepted_at": "2026-05-25T21:24:13.583+00:00",
      "db_audit_log_entries": 1,
      "checks": {
        "okCount": true,
        "conflictCount": true,
        "dbCount": true,
        "dbStatus": true,
        "dbAcceptedAt": true,
        "dbAuditOne": true
      }
    }
  },
  {
    "id": "R5",
    "title": "RLS scope fornitore foto: 0 leak su Andrea wedding",
    "verdict": "PASS",
    "details": {
      "andrea_id": "c1b8b3bc-d3a0-4398-8f95-32aa81aa5c60",
      "andrea_title": "Andrea e Sofia",
      "andrea_quote_id": "b40a663c-4de8-4db2-8a49-a27ddbc81c3c",
      "pre_isolation": {
        "isParticipant": false,
        "isQItemsInvolved": false,
        "isTimeline": false
      },
      "leak_rows": 0,
      "error": null,
      "counts": {
        "calendar_entries": 0,
        "event_guests": 0,
        "event_tables": 0,
        "event_subevents": 0,
        "event_transport": 0,
        "event_accommodations": 0
      }
    }
  }
]
```
