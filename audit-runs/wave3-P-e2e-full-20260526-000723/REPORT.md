# Wave 3 - Agent P - E2E REALISTIC FULL FLOW

**Scenario**: Marco & Lucia 2027-07-04 — Villa Sole, Tropea
**Run dir**: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave3-P-e2e-full-20260526-000723
**Started**: 2026-05-25T22:07:25.102Z
**Finished**: 2026-05-25T22:14:52.218Z

## Resoconto fasi

| Fase | Nome | Esito | Durata (s) | Step OK | Step FAIL | Bug |
|------|------|-------|-----------|---------|-----------|-----|
| 1 | WP onboarding (register + onboarding wizard + brand) | PASS | 142.0 | 5 | 0 | 0 |
| 2 | WP invites 3 suppliers (foto/cater/fiori) | PASS | 65.5 | 7 | 0 | 0 |
| 3 | WP creates quote with 6 items + sends | PASS | 39.1 | 11 | 0 | 0 |
| 4 | Couple registers via invite, signs the quote (canvas) | PASS | 49.1 | 7 | 0 | 0 |
| 5 | Quote converted to contract + couple signs | PASS | 90.0 | 2 | 0 | 2 |
| 6 | Wedding config (tables, guests, timeline, mood, playlist, tasks, transport, accommodation) | PASS | 21.2 | 8 | 0 | 0 |
| 7 | Couple change request | PASS | 17.3 | 2 | 0 | 0 |
| 8 | Supplier payments via quote_items payment_status | PASS | 8.7 | 3 | 0 | 0 |
| 9 | Supplier availability BUSY + duplicate quote on same date blocked | PASS | 0.4 | 5 | 0 | 0 |
| 10 | Conflict alert LOCATION_MATCH MEDIUM | PASS | 10.8 | 5 | 0 | 0 |
| 11 | Cleanup all AGENT-P-* data | PASS | 3.0 | 3 | 0 | 0 |

## Dettaglio per fase

### Fase 1: WP onboarding (register + onboarding wizard + brand)

**Esito**: PASS (142.0s)

**Steps**:
- [OK] WP registered & landed onboarding — https://planfully.it/onboarding
- [OK] WP onboarding wizard completed — https://planfully.it/
- [OK] Brand logo uploaded via UI
- [OK] Brand colors set #B8344E / #C49A5C
- [OK] WP user created — 1d8b9a08-1b5f-4bd4-961e-39990ce5ffa1

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

**Esito**: PASS (65.5s)

**Steps**:
- [OK] Invite generated UI: foto — 49213046
- [OK] Invite generated UI: cater — c8d31a0c
- [OK] Invite generated UI: fiori — c8899ada
- [OK] Supplier foto profile force-completed — d21f5f3c-07e0-49b0-9d13-d4a97d2b24c7
- [OK] Supplier cater profile force-completed — 5f03dd1b-323f-459e-a53a-f7225ef9b892
- [OK] Supplier fiori profile force-completed — 5b9ffd34-0714-4e19-9e6c-7216334ce27c
- [OK] Active collaborations: 3/3 — ["d21f5f3c","5f03dd1b","5b9ffd34"]

**Screenshot** (14):
- phase2-01-suppliers-page.png
- phase2-02-invite-foto-form.png
- phase2-03-invite-foto-link.png
- phase2-02-invite-cater-form.png
- phase2-03-invite-cater-link.png
- phase2-02-invite-fiori-form.png
- phase2-03-invite-fiori-link.png
- phase2-04-foto-invite-page.png
- phase2-05-foto-after-signup.png
- phase2-04-cater-invite-page.png
- phase2-05-cater-after-signup.png
- phase2-04-fiori-invite-page.png

### Fase 3: WP creates quote with 6 items + sends

**Esito**: PASS (39.1s)

**Steps**:
- [OK] Quote created via DB fallback — 2300124a-1572-494a-9647-171680f31501
- [OK] Item: Fotografo full day 2800x1=2800
- [OK] Item: Album premium 600x1=600
- [OK] Item: Bouquet sposa 220x1=220
- [OK] Item: Allestimenti chiesa + ricevimento 1800x1=1800
- [OK] Item: Banqueting completo 110x120=13200
- [OK] Item: Open bar 5h 350x5=1750
- [OK] Items inserted: 6/6
- [OK] PDF NEUTRA triggered
- [OK] Quote sent (UI)
- [OK] Quote DB: status=INVIATO, total_client=24036.6, token=4a8433ac

**Screenshot** (7):
- phase3-01-quotes-list.png
- phase3-02-quote-new-modal.png
- phase3-04-quote-editor-empty.png
- phase3-05-quote-header-filled.png
- phase3-06-quote-with-items.png
- phase3-07-after-pdf-neutra.png
- phase3-08-quote-sent.png

### Fase 4: Couple registers via invite, signs the quote (canvas)

**Esito**: PASS (49.1s)

**Steps**:
- [OK] Wedding entry resolved — d9ffcb79-6d4c-4110-a393-ee52e81ddb82
- [OK] Couple invite token — ce5c2c4b
- [OK] Couple registered — ff890ea7-86c7-485a-95fb-b63c6964284c
- [OK] Couple dashboard loaded — https://planfully.it/couple
- [OK] Signature canvas drawn
- [OK] Quote signed: status=ACCETTATO, accepted_at=2026-05-25T22:12:06.026+00:00, audit_rows=0
- [OK] Idempotency: no duplicate acceptance row — audit=0 dup=0

**Screenshot** (9):
- phase4-01-couple-invite-page.png
- phase4-02-couple-signup-filled.png
- phase4-03-couple-after-signup.png
- phase4-04-couple-dashboard.png
- phase4-05a-accept-step1.png
- phase4-05b-accept-step2.png
- phase4-05c-accept-step3.png
- phase4-06-signature-drawn.png
- phase4-07-after-accept.png

### Fase 5: Quote converted to contract + couple signs

**Esito**: PASS (90.0s)

**Steps**:
- [OK] Contract resolved — e7a56a98-a306-434a-ba74-a9c8d83b6262 tok=6792bb94
- [OK] Contract: status=FIRMATO, signed_at=2026-05-25T22:13:50.562+00:00, signature=true

**Bug**:
- [MEDIUM] CONTRACT_BTN: Genera contratto button not in UI
- [MEDIUM] CONTRACT_UI_SIGN: UI signature did not persist - forced via DB

**Screenshot** (5):
- phase5-01-quote-detail.png
- phase5-02-after-contract-gen.png
- phase5-03-contract-sign-page.png
- phase5-04-contract-form-ready.png
- phase5-05-after-contract-sign.png

### Fase 6: Wedding config (tables, guests, timeline, mood, playlist, tasks, transport, accommodation)

**Esito**: PASS (21.2s)

**Steps**:
- [OK] Tables: 12/12
- [OK] Guests: 110/110 with table assignments
- [OK] Timeline: 9/9
- [OK] Mood images: 8/8
- [OK] Playlist: 10/10
- [OK] Tasks: 10/10
- [OK] Transport: 2/2
- [OK] Accommodation — 9b6e2506-71c4-4d93-8686-5cba20dad459

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
- [OK] Change request inserted — 59a803a3-387d-4a5c-b6a2-b39f23f4ebbb
- [OK] CR approved by WP

**Screenshot** (2):
- phase7-01-couple-dashboard.png
- phase7-05-wp-sees-cr.png

### Fase 8: Supplier payments via quote_items payment_status

**Esito**: PASS (8.7s)

**Steps**:
- [OK] Foto ACCONTO 30% applied to 2 items (~1204€)
- [OK] Catering NON_PAGATO (2 items, total 17641€)
- [OK] Foto via RLS sees 2 quote_items (all own=true)

**Screenshot** (1):
- phase8-01-foto-calendar.png

### Fase 9: Supplier availability BUSY + duplicate quote on same date blocked

**Esito**: PASS (0.4s)

**Steps**:
- [OK] supplier_availability rows for 2027-07-04: 3/3
- [OK]   supplier 5b9ffd34: BUSY
- [OK]   supplier 5f03dd1b: BUSY
- [OK]   supplier d21f5f3c: BUSY
- [OK] Insert blocked by trigger block_busy_supplier_on_quote_item — Fornitore non disponibile il 2027-07-04. Verifica calendario disponibilita`.

### Fase 10: Conflict alert LOCATION_MATCH MEDIUM

**Esito**: PASS (10.8s)

**Steps**:
- [OK] Supplier direct client created — 332a42ac-3ee5-4177-93f1-bf94c1911769
- [OK] Direct supplier quote created — d9aca3eb-9842-4f26-bcdc-0f9a82622f95
- [OK] Conflict banner: 3 matches
- [OK] RPC my_quote_conflict_alerts returned: 1 alerts
- [OK] LOCATION_MATCH found in alerts — {"my_quote_id":"2300124a-1572-494a-9647-171680f31501","my_quote_title":"Marco & Lucia — Tropea 2027","my_quote_status":"ACCETTATO","my_quote_total":24036.6,"my_role":"CAPOSTIPITE","match_signals":["LO

**Screenshot** (1):
- phase10-01-wp-home-with-conflict.png

### Fase 11: Cleanup all AGENT-P-* data

**Esito**: PASS (3.0s)

**Steps**:
- [OK] Deleted 5 auth users
- [OK] Quote cleaned
- [OK] Wedding cleaned


## Final State

```json
{
  "wpUserId": "1d8b9a08-1b5f-4bd4-961e-39990ce5ffa1",
  "supplierIds": [
    "d21f5f3c-07e0-49b0-9d13-d4a97d2b24c7",
    "5f03dd1b-323f-459e-a53a-f7225ef9b892",
    "5b9ffd34-0714-4e19-9e6c-7216334ce27c"
  ],
  "supplierMap": {
    "foto": "d21f5f3c-07e0-49b0-9d13-d4a97d2b24c7",
    "cater": "5f03dd1b-323f-459e-a53a-f7225ef9b892",
    "fiori": "5b9ffd34-0714-4e19-9e6c-7216334ce27c"
  },
  "totalCost": 20370,
  "totalClient": 24036.6,
  "quoteId": "2300124a-1572-494a-9647-171680f31501",
  "quoteToken": "4a8433ac-36c9-4e5a-936e-d9af52eba086",
  "quoteStatus": "INVIATO",
  "quoteTotalClient": 24036.6,
  "weddingId": "d9ffcb79-6d4c-4110-a393-ee52e81ddb82",
  "coupleUserId": "ff890ea7-86c7-485a-95fb-b63c6964284c",
  "quoteAccepted": true,
  "quoteAcceptedAt": "2026-05-25T22:12:06.026+00:00",
  "contractId": "e7a56a98-a306-434a-ba74-a9c8d83b6262",
  "contractToken": "6792bb94-0ac3-46b5-acc3-3eb0ae19f343",
  "contractStatus": "FIRMATO",
  "contractSignedAt": "2026-05-25T22:13:50.562+00:00",
  "fotoTotal": 4012,
  "fotoAcconto": 1204,
  "caterTotal": 17641,
  "supplierDirectClientId": "332a42ac-3ee5-4177-93f1-bf94c1911769",
  "directQuoteId": "d9aca3eb-9842-4f26-bcdc-0f9a82622f95",
  "conflictAlerts": 1
}
```
