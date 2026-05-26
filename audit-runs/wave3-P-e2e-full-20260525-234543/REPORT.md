# Wave 3 - Agent P - E2E REALISTIC FULL FLOW

**Scenario**: Marco & Lucia 2027-07-04 — Villa Sole, Tropea
**Run dir**: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave3-P-e2e-full-20260525-234543
**Started**: 2026-05-25T21:45:44.957Z
**Finished**: 2026-05-25T21:52:18.022Z

## Resoconto fasi

| Fase | Nome | Esito | Durata (s) | Step OK | Step FAIL | Bug |
|------|------|-------|-----------|---------|-----------|-----|
| 1 | WP onboarding (register + onboarding wizard + brand) | PASS | 142.0 | 5 | 0 | 0 |
| 2 | WP invites 3 suppliers (foto/cater/fiori) | PASS | 48.7 | 2 | 1 | 3 |
| 3 | WP creates quote with 6 items + sends | PASS | 38.7 | 4 | 1 | 6 |
| 4 | Couple registers via invite, signs the quote (canvas) | FAIL | 43.1 | 5 | 1 | 1 |
| 5 | Quote converted to contract + couple signs | FAIL | 60.1 | 0 | 2 | 3 |
| 6 | Wedding config (tables, guests, timeline, mood, playlist, tasks, transport, accommodation) | PASS | 21.3 | 6 | 2 | 2 |
| 7 | Couple change request | PASS | 17.3 | 2 | 0 | 0 |
| 8 | Supplier payments via quote_items payment_status | PASS | 8.6 | 2 | 1 | 0 |
| 9 | Supplier availability BUSY + duplicate quote on same date blocked | PASS | 0.4 | 0 | 1 | 1 |
| 10 | Conflict alert LOCATION_MATCH MEDIUM | FAIL | 10.7 | 2 | 3 | 1 |
| 11 | Cleanup all AGENT-P-* data | FAIL | 2.2 | 2 | 1 | 0 |

## Dettaglio per fase

### Fase 1: WP onboarding (register + onboarding wizard + brand)

**Esito**: PASS (142.0s)

**Steps**:
- [OK] WP registered & landed onboarding — https://planfully.it/onboarding
- [OK] WP onboarding wizard completed — https://planfully.it/
- [OK] Brand logo uploaded via UI
- [OK] Brand colors set #B8344E / #C49A5C
- [OK] WP user created — fc14c1d7-3a81-4e4c-bcf7-be2117851090

**Screenshot** (10):
- phase1-01-register-page.png
- phase1-02-register-filled.png
- phase1-03-onboarding-step0.png
- phase1-04-onboarding-step1.png
- phase1-05-onboarding-step2.png
- phase1-06-onboarding-step3.png
- phase1-07-onboarding-step4.png
- phase1-08-wp-home.png
- phase1-09-brand-page.png
- phase1-10-brand-saved.png

### Fase 2: WP invites 3 suppliers (foto/cater/fiori)

**Esito**: PASS (48.7s)

**Steps**:
- [OK] Invite generated UI: foto — ec884b8d
- [OK] Supplier foto profile force-completed — 040e9b0c-b94c-420f-aea0-45ace6243067
- [FAIL] Active collaborations: 1/3 — ["040e9b0c"]

**Bug**:
- [HIGH] INVITE_MODAL: Cannot open invite modal for cater
- [HIGH] INVITE_MODAL: Cannot open invite modal for fiori
- [HIGH] COLLAB: Only 1/3 collaborations active

**Screenshot** (6):
- phase2-01-suppliers-page.png
- phase2-02-invite-foto-form.png
- phase2-03-invite-foto-link.png
- phase2-04-foto-invite-page.png
- phase2-05-foto-after-signup.png
- phase2-07-wp-suppliers-list.png

### Fase 3: WP creates quote with 6 items + sends

**Esito**: PASS (38.7s)

**Steps**:
- [OK] Quote created via DB fallback — d6aed1b5-e1a3-4e93-a4a1-d34b168c999e
- [FAIL] Items inserted: 0/6
- [OK] PDF NEUTRA triggered
- [OK] Quote sent (UI)
- [OK] Quote DB: status=INVIATO, total_client=0, token=961c63ac

**Bug**:
- [MEDIUM] SERVICE_INSERT: Fotografo full day: Could not find the 'currency' column of 'services' in the schema cache
- [MEDIUM] SERVICE_INSERT: Album premium: Could not find the 'currency' column of 'services' in the schema cache
- [HIGH] SUPPLIER_MISSING: Bouquet sposa
- [HIGH] SUPPLIER_MISSING: Allestimenti chiesa + ricevimento
- [HIGH] SUPPLIER_MISSING: Banqueting completo
- [HIGH] SUPPLIER_MISSING: Open bar 5h

**Screenshot** (7):
- phase3-01-quotes-list.png
- phase3-02-quote-new-modal.png
- phase3-04-quote-editor-empty.png
- phase3-05-quote-header-filled.png
- phase3-06-quote-with-items.png
- phase3-07-after-pdf-neutra.png
- phase3-08-quote-sent.png

### Fase 4: Couple registers via invite, signs the quote (canvas)

**Esito**: FAIL (43.1s)

**Steps**:
- [OK] Wedding entry resolved — 0e544016-7e14-4170-8379-2006c2e83913
- [OK] Couple invite token — 5a061c9f
- [OK] Couple registered — 8f563bc6-322d-4169-8852-f8e2b2a45abe
- [OK] Couple dashboard loaded — https://planfully.it/couple
- [FAIL] Quote signed: status=INVIATO, accepted_at=null, audit_rows=0
- [OK] Idempotency: no duplicate acceptance row — audit=0 dup=0

**Bug**:
- [HIGH] CANVAS_MISSING: no canvas on accept page

**Screenshot** (6):
- phase4-01-couple-invite-page.png
- phase4-02-couple-signup-filled.png
- phase4-03-couple-after-signup.png
- phase4-04-couple-dashboard.png
- phase4-05-accept-page.png
- phase4-07-after-accept.png

### Fase 5: Quote converted to contract + couple signs

**Esito**: FAIL (60.1s)

**Steps**:
- [FAIL] Contract resolved — null tok=undefined
- [FAIL] Contract: status=undefined, signed_at=undefined, signature=false

**Bug**:
- [MEDIUM] CONTRACT_BTN: Genera contratto button not in UI
- [HIGH] CONTRACT_INSERT: null value in column "total_amount" of relation "contracts" violates not-null constraint
- [MEDIUM] CONTRACT_UI_SIGN: UI signature did not persist - forced via DB

**Screenshot** (5):
- phase5-01-quote-detail.png
- phase5-02-after-contract-gen.png
- phase5-03-contract-sign-page.png
- phase5-04-contract-form-ready.png
- phase5-05-after-contract-sign.png

### Fase 6: Wedding config (tables, guests, timeline, mood, playlist, tasks, transport, accommodation)

**Esito**: PASS (21.3s)

**Steps**:
- [OK] Tables: 12/12
- [OK] Guests: 110/110 with table assignments
- [OK] Timeline: 9/9
- [OK] Mood images: 8/8
- [FAIL] Playlist: undefined/10
- [OK] Tasks: 10/10
- [FAIL] Transport: undefined/2
- [OK] Accommodation — 0f2a0d48-2a05-4337-9778-5277fdf3d0d8

**Bug**:
- [MEDIUM] PLAYLIST: new row for relation "event_playlist" violates check constraint "event_playlist_moment_check"
- [MEDIUM] TRANSPORT: invalid input value for enum transport_kind: "BUS"

**Screenshot** (6):
- phase6-01-wedding-dashboard.png
- phase6-tab-avoli.png
- phase6-tab-nvitati.png
- phase6-tab-imeline.png
- phase6-tab-ood.png
- phase6-tab-laylist.png

### Fase 7: Couple change request

**Esito**: PASS (17.3s)

**Steps**:
- [OK] Change request inserted — 9a9640a5-557c-4a2c-abad-7e78bd770bb1
- [OK] CR approved by WP

**Screenshot** (2):
- phase7-01-couple-dashboard.png
- phase7-05-wp-sees-cr.png

### Fase 8: Supplier payments via quote_items payment_status

**Esito**: PASS (8.6s)

**Steps**:
- [OK] Foto ACCONTO 30% applied to 0 items (~0€)
- [OK] Catering NON_PAGATO (0 items, total 0€)
- [FAIL] Foto does NOT see wedding total — bodyContainsFullTotal=true

**Screenshot** (1):
- phase8-01-foto-calendar.png

### Fase 9: Supplier availability BUSY + duplicate quote on same date blocked

**Esito**: PASS (0.4s)

**Steps**:
- [FAIL] supplier_availability rows for 2027-07-04: undefined/3

**Bug**:
- [HIGH] TRIGGER_MISSING: quote_item inserted on BUSY date without block

### Fase 10: Conflict alert LOCATION_MATCH MEDIUM

**Esito**: FAIL (10.7s)

**Steps**:
- [OK] Supplier direct client created — 61bfba16-f726-48d3-9114-f8cb2ba9d8a7
- [OK] Direct supplier quote created — 30ab2e50-b2c2-4d3d-befe-553ec9731120
- [FAIL] Conflict banner: 0 matches
- [FAIL] RPC my_quote_conflict_alerts returned: 0 alerts
- [FAIL] LOCATION_MATCH found in alerts — none

**Bug**:
- [MEDIUM] CONFLICT_BANNER: No conflict alert banner visible in WP home

**Screenshot** (1):
- phase10-01-wp-home-with-conflict.png

### Fase 11: Cleanup all AGENT-P-* data

**Esito**: FAIL (2.2s)

**Steps**:
- [FAIL] Deleted 3 auth users
- [OK] Quote cleaned
- [OK] Wedding cleaned


## Final State

```json
{
  "wpUserId": "fc14c1d7-3a81-4e4c-bcf7-be2117851090",
  "supplierIds": [
    "040e9b0c-b94c-420f-aea0-45ace6243067"
  ],
  "supplierMap": {
    "foto": "040e9b0c-b94c-420f-aea0-45ace6243067",
    "cater": null,
    "fiori": null
  },
  "totalCost": 0,
  "totalClient": 0,
  "quoteId": "d6aed1b5-e1a3-4e93-a4a1-d34b168c999e",
  "quoteToken": "961c63ac-e134-4e71-acf9-54e15f591b40",
  "quoteStatus": "INVIATO",
  "quoteTotalClient": 0,
  "weddingId": "0e544016-7e14-4170-8379-2006c2e83913",
  "coupleUserId": "8f563bc6-322d-4169-8852-f8e2b2a45abe",
  "quoteAccepted": false,
  "quoteAcceptedAt": null,
  "contractId": null,
  "contractToken": null,
  "fotoTotal": 0,
  "fotoAcconto": 0,
  "caterTotal": 0,
  "supplierDirectClientId": "61bfba16-f726-48d3-9114-f8cb2ba9d8a7",
  "directQuoteId": "30ab2e50-b2c2-4d3d-befe-553ec9731120",
  "conflictAlerts": 0
}
```
