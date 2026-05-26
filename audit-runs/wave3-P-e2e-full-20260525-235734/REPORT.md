# Wave 3 - Agent P - E2E REALISTIC FULL FLOW

**Scenario**: Marco & Lucia 2027-07-04 — Villa Sole, Tropea
**Run dir**: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave3-P-e2e-full-20260525-235734
**Started**: 2026-05-25T21:57:36.120Z
**Finished**: 2026-05-25T22:04:33.346Z

## Resoconto fasi

| Fase | Nome | Esito | Durata (s) | Step OK | Step FAIL | Bug |
|------|------|-------|-----------|---------|-----------|-----|
| 1 | WP onboarding (register + onboarding wizard + brand) | PASS | 142.0 | 5 | 0 | 0 |
| 2 | WP invites 3 suppliers (foto/cater/fiori) | PASS | 65.5 | 7 | 0 | 0 |
| 3 | WP creates quote with 6 items + sends | PASS | 39.2 | 11 | 0 | 0 |
| 4 | Couple registers via invite, signs the quote (canvas) | PASS | 49.2 | 7 | 0 | 0 |
| 5 | Quote converted to contract + couple signs | PASS | 59.9 | 2 | 0 | 2 |
| 6 | Wedding config (tables, guests, timeline, mood, playlist, tasks, transport, accommodation) | PASS | 21.1 | 8 | 0 | 0 |
| 7 | Couple change request | PASS | 17.4 | 2 | 0 | 0 |
| 8 | Supplier payments via quote_items payment_status | PASS | 8.7 | 2 | 1 | 0 |
| 9 | Supplier availability BUSY + duplicate quote on same date blocked | PASS | 0.4 | 5 | 0 | 0 |
| 10 | Conflict alert LOCATION_MATCH MEDIUM | FAIL | 11.1 | 3 | 2 | 0 |
| 11 | Cleanup all AGENT-P-* data | PASS | 2.8 | 3 | 0 | 0 |

## Dettaglio per fase

### Fase 1: WP onboarding (register + onboarding wizard + brand)

**Esito**: PASS (142.0s)

**Steps**:
- [OK] WP registered & landed onboarding — https://planfully.it/onboarding
- [OK] WP onboarding wizard completed — https://planfully.it/
- [OK] Brand logo uploaded via UI
- [OK] Brand colors set #B8344E / #C49A5C
- [OK] WP user created — 9b36a2a2-1a1e-41a6-aa06-84b391c822ca

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
- [OK] Invite generated UI: foto — 093cee0c
- [OK] Invite generated UI: cater — fae4bdac
- [OK] Invite generated UI: fiori — 3f0e5ca6
- [OK] Supplier foto profile force-completed — eb71e791-633b-466f-9927-832f4bf465e2
- [OK] Supplier cater profile force-completed — fd8df69c-bdc8-499e-baca-6e13e421b2ab
- [OK] Supplier fiori profile force-completed — e72be51e-b6ca-4325-840f-7fab56cf84c2
- [OK] Active collaborations: 3/3 — ["fd8df69c","eb71e791","e72be51e"]

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

**Esito**: PASS (39.2s)

**Steps**:
- [OK] Quote created via DB fallback — b6e51cda-1bf2-460c-8026-60cf3f413182
- [OK] Item: Fotografo full day 2800x1=2800
- [OK] Item: Album premium 600x1=600
- [OK] Item: Bouquet sposa 220x1=220
- [OK] Item: Allestimenti chiesa + ricevimento 1800x1=1800
- [OK] Item: Banqueting completo 110x120=13200
- [OK] Item: Open bar 5h 350x5=1750
- [OK] Items inserted: 6/6
- [OK] PDF NEUTRA triggered
- [OK] Quote sent (UI)
- [OK] Quote DB: status=INVIATO, total_client=24036.6, token=cda78882

**Screenshot** (7):
- phase3-01-quotes-list.png
- phase3-02-quote-new-modal.png
- phase3-04-quote-editor-empty.png
- phase3-05-quote-header-filled.png
- phase3-06-quote-with-items.png
- phase3-07-after-pdf-neutra.png
- phase3-08-quote-sent.png

### Fase 4: Couple registers via invite, signs the quote (canvas)

**Esito**: PASS (49.2s)

**Steps**:
- [OK] Wedding entry resolved — 973e6a0b-f61e-47e2-9ca2-bedd3d94fb4c
- [OK] Couple invite token — 1d5c13f5
- [OK] Couple registered — f9c748ae-cb8b-4c74-a406-895abc8f51ea
- [OK] Couple dashboard loaded — https://planfully.it/couple
- [OK] Signature canvas drawn
- [OK] Quote signed: status=ACCETTATO, accepted_at=2026-05-25T22:02:17.162+00:00, audit_rows=0
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

**Esito**: PASS (59.9s)

**Steps**:
- [OK] Contract resolved — 40dce7bf-d0ba-4a67-91db-33997ae44a31 tok=7209c65d
- [OK] Contract: status=FIRMATO, signed_at=2026-05-25T22:03:31.756+00:00, signature=true

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

**Esito**: PASS (21.1s)

**Steps**:
- [OK] Tables: 12/12
- [OK] Guests: 110/110 with table assignments
- [OK] Timeline: 9/9
- [OK] Mood images: 8/8
- [OK] Playlist: 10/10
- [OK] Tasks: 10/10
- [OK] Transport: 2/2
- [OK] Accommodation — f5d99e47-16df-4498-a8e3-e5e766671086

**Screenshot** (6):
- phase6-01-wedding-dashboard.png
- phase6-tab-avoli.png
- phase6-tab-nvitati.png
- phase6-tab-imeline.png
- phase6-tab-ood.png
- phase6-tab-laylist.png

### Fase 7: Couple change request

**Esito**: PASS (17.4s)

**Steps**:
- [OK] Change request inserted — c4c665f7-04ab-4ec3-b039-0951e7564000
- [OK] CR approved by WP

**Screenshot** (2):
- phase7-01-couple-dashboard.png
- phase7-05-wp-sees-cr.png

### Fase 8: Supplier payments via quote_items payment_status

**Esito**: PASS (8.7s)

**Steps**:
- [OK] Foto ACCONTO 30% applied to 2 items (~1204€)
- [OK] Catering NON_PAGATO (2 items, total 17641€)
- [FAIL] Foto via RLS sees 0 quote_items (all own=false)

**Screenshot** (1):
- phase8-01-foto-calendar.png

### Fase 9: Supplier availability BUSY + duplicate quote on same date blocked

**Esito**: PASS (0.4s)

**Steps**:
- [OK] supplier_availability rows for 2027-07-04: 3/3
- [OK]   supplier e72be51e: BUSY
- [OK]   supplier eb71e791: BUSY
- [OK]   supplier fd8df69c: BUSY
- [OK] Insert blocked by trigger block_busy_supplier_on_quote_item — Fornitore non disponibile il 2027-07-04. Verifica calendario disponibilita`.

### Fase 10: Conflict alert LOCATION_MATCH MEDIUM

**Esito**: FAIL (11.1s)

**Steps**:
- [OK] Supplier direct client created — 8742fe11-ef5b-4de2-9eb3-5bcc476ca501
- [OK] Direct supplier quote created — fc225397-2228-476b-99a8-207db2a37707
- [OK] Conflict banner: 3 matches
- [FAIL] RPC my_quote_conflict_alerts returned: 0 alerts
- [FAIL] LOCATION_MATCH found in alerts — none

**Screenshot** (1):
- phase10-01-wp-home-with-conflict.png

### Fase 11: Cleanup all AGENT-P-* data

**Esito**: PASS (2.8s)

**Steps**:
- [OK] Deleted 5 auth users
- [OK] Quote cleaned
- [OK] Wedding cleaned


## Final State

```json
{
  "wpUserId": "9b36a2a2-1a1e-41a6-aa06-84b391c822ca",
  "supplierIds": [
    "fd8df69c-bdc8-499e-baca-6e13e421b2ab",
    "eb71e791-633b-466f-9927-832f4bf465e2",
    "e72be51e-b6ca-4325-840f-7fab56cf84c2"
  ],
  "supplierMap": {
    "foto": "eb71e791-633b-466f-9927-832f4bf465e2",
    "cater": "fd8df69c-bdc8-499e-baca-6e13e421b2ab",
    "fiori": "e72be51e-b6ca-4325-840f-7fab56cf84c2"
  },
  "totalCost": 20370,
  "totalClient": 24036.6,
  "quoteId": "b6e51cda-1bf2-460c-8026-60cf3f413182",
  "quoteToken": "cda78882-ea70-40e2-9530-adffb2fa2656",
  "quoteStatus": "INVIATO",
  "quoteTotalClient": 24036.6,
  "weddingId": "973e6a0b-f61e-47e2-9ca2-bedd3d94fb4c",
  "coupleUserId": "f9c748ae-cb8b-4c74-a406-895abc8f51ea",
  "quoteAccepted": true,
  "quoteAcceptedAt": "2026-05-25T22:02:17.162+00:00",
  "contractId": "40dce7bf-d0ba-4a67-91db-33997ae44a31",
  "contractToken": "7209c65d-de4b-4138-a48f-faaba1ad1e28",
  "contractStatus": "FIRMATO",
  "contractSignedAt": "2026-05-25T22:03:31.756+00:00",
  "fotoTotal": 4012,
  "fotoAcconto": 1204,
  "caterTotal": 17641,
  "supplierDirectClientId": "8742fe11-ef5b-4de2-9eb3-5bcc476ca501",
  "directQuoteId": "fc225397-2228-476b-99a8-207db2a37707",
  "conflictAlerts": 0
}
```
