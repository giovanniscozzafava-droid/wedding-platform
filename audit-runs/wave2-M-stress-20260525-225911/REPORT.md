# WAVE 2 — AGENT M — STRESS & RACE CONDITIONS

**Run**: 2026-05-25T21:08:21.904Z
**Output**: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave2-M-stress-20260525-225911
**Prefix**: `AGENT-M-`

## Summary stats
```json
{
  "A": {
    "verdict": "PASS",
    "ok": 50,
    "errors": 0,
    "total_ms": 296,
    "n": 50,
    "p50": 253.01,
    "p95": 273.59,
    "p99": 292.81,
    "max": 292.81,
    "throughput": 169
  },
  "B": {
    "verdict": "FAIL",
    "ok": 5,
    "rejected": 0,
    "acceptances_in_db": 5,
    "final_quote_status": "ACCETTATO",
    "total_ms": 1651,
    "n": 5,
    "p50": 1394.82,
    "p95": 1650.45,
    "p99": 1650.45,
    "max": 1650.45
  },
  "C": {
    "verdict": "PASS",
    "upsert_ok": 5,
    "upsert_err": 0,
    "rows_in_db": 1,
    "final_status": "BUSY",
    "n": 5,
    "p50": 68.04,
    "p95": 68.2,
    "p99": 68.2,
    "max": 68.2
  },
  "D": {
    "verdict": "PASS",
    "ok": 100,
    "errors": 0,
    "bad_rows": 0,
    "total_ms": 845,
    "inserted_within_60s": true,
    "n": 100,
    "p50": 74.3,
    "p95": 97.41,
    "p99": 100.91,
    "max": 100.91,
    "throughput": 118
  },
  "E": {
    "verdict": "PASS",
    "ok": 50,
    "errors": 0,
    "in_db": 50,
    "total_ms": 154,
    "n": 50,
    "p50": 131.13,
    "p95": 143.02,
    "p99": 152.64,
    "max": 152.64,
    "throughput": 324
  },
  "F": {
    "verdict": "PASS",
    "elapsed_ms": 1406,
    "http_status": 502,
    "body_preview": "{\"error\":\"Pagina non raggiungibile: chrome:error sending request from 10.31.16.60:3\"}",
    "error": null,
    "n": 1,
    "p50": 1406.37,
    "p95": 1406.37,
    "p99": 1406.37,
    "max": 1406.37
  },
  "G": {
    "verdict": "PASS",
    "has_access": true,
    "has_refresh": true,
    "expires_in": 3600,
    "expires_at": 1779746899,
    "refresh_ok": true,
    "refresh_ms": 98,
    "new_access": "eyJhbGciOiJFUzI1NiIsImtpZCI6Ij...",
    "invalid_jwt_msg": "Invalid API key",
    "n": 1,
    "p50": 304.95,
    "p95": 304.95,
    "p99": 304.95,
    "max": 304.95
  },
  "H": {
    "verdict": "PASS",
    "insert_rejected": true,
    "error": "Fornitore non disponibile il 2027-07-21. Verifica calendario disponibilita`.",
    "code": "P0001",
    "orphan_items": 0,
    "totals_unchanged": true,
    "latency_ms": 70,
    "n": 1,
    "p50": 69.63,
    "p95": 69.63,
    "p99": 69.63,
    "max": 69.63
  },
  "extra_qsend": {
    "verdict": "PASS",
    "ok": 10,
    "statuses": [
      200,
      200,
      200,
      200,
      200,
      200,
      200,
      200,
      200,
      200
    ],
    "final_status": "INVIATO",
    "email_log_entries": 6,
    "n": 10,
    "p50": 1272.54,
    "p95": 1543.35,
    "p99": 1543.35,
    "max": 1543.35
  }
}
```

## A. Connection pool / RPC contention
- **Verdict**: PASS
- 50 client paralleli (service_role) SELECT quotes
- OK 50/50, errors 0, total 296ms
- p50 253.01ms · p95 273.59ms · p99 292.81ms
- throughput 169 req/s


## B. Quote double-firm idempotency
- **Verdict**: FAIL
- 5 POST paralleli stesso token
- HTTP 200: 5, errors: 0
- quote_acceptances rows: 5 (atteso <= 1)
- acceptance_ids in DB: 7da07fb7-08bc-4e57-b666-02c5f45cb98c, 634cbe0b-a3f9-471b-8225-79ba239dd1ca, fc6e7b4c-2e1d-4631-a359-c2c700f09064, 2721918b-35cf-43ab-b153-b6ab70918f69, 2fc76842-81a6-4445-b4df-e31e8565573e
- final quote status: ACCETTATO
- p99: 1650.45ms


**Repro**: `POST /functions/v1/quote-accept-sign` 5 chiamate parallele stesso token. Atteso: 1 success + 4 rejected con 409. Trovato: 5 righe DB + 5 HTTP 200.

## C. Supplier availability race
- **Verdict**: PASS
- 5 upsert paralleli su (fornitore, 2028-12-12)
- upsert OK 5/5, errors 0
- rows_in_db: 1 (atteso 1, unique constraint)
- final status: BUSY
- p99 68.2ms

## D. Quote spam (100 in 60s)
- **Verdict**: PASS
- inseriti: 100/100 in 845ms
- errors: 0
- rows campione con valori calcolati NULL: 0
- throughput 118 req/s
- p99 100.91ms


## E. Couple change request flood
- **Verdict**: PASS
- 50 CCR su stesso wedding in 154ms
- inseriti 50/50, db 50
- errors: 0
- throughput 324 req/s
- p99 152.64ms


## F. Edge function timeout
- **Verdict**: PASS
- POST import-pin-url con URL slow (15s)
- elapsed: 1406ms
- HTTP status: 502
- body: `{"error":"Pagina non raggiungibile: chrome:error sending request from 10.31.16.60:3"}`


## G. JWT expiry / auto-refresh
- **Verdict**: PASS
- signin ok, has_access=true, has_refresh=true
- expires_in: 3600s
- refresh_ok: true (98ms)
- invalid jwt -> code=undefined msg=Invalid API key

## H. Transaction integrity (BUSY trigger rollback)
- **Verdict**: PASS
- insert quote_item con supplier BUSY su 2027-07-21
- insert rejected: true
- trigger error: Fornitore non disponibile il 2027-07-21. Verifica calendario disponibilita`.
- orphan items in DB: 0 (atteso 0)
- totals invariati: true
- latency: 70ms

## EXTRA. quote-send 10 parallel
- **Verdict**: PASS
- ok 10/10, status codes: 200,200,200,200,200,200,200,200,200,200
- quote final status: INVIATO
- sent_email_log entries: 6
- p99 1543.35ms

## Bugs

- **[CRITICAL]** [B] Double-firm: 5 quote_acceptances per stessa quote — idempotency broken
- **[MEDIUM]** [extra] Email log ha 6 entries da 10 chiamate parallele — log duplicato