# Wave 3 - Agent P - E2E REALISTIC FULL FLOW

**Scenario**: Marco & Lucia 2027-07-04 — Villa Sole, Tropea
**Run dir**: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave3-P-e2e-full-20260525-232436
**Started**: 2026-05-25T21:30:29.524Z
**Finished**: 2026-05-25T21:36:27.377Z

## Resoconto fasi

| Fase | Nome | Esito | Durata (s) | Step OK | Step FAIL | Bug |
|------|------|-------|-----------|---------|-----------|-----|
| 1 | WP onboarding (register + onboarding wizard + brand) | PASS | 185.0 | 2 | 1 | 1 |
| 2 | WP invites 3 suppliers (foto/cater/fiori) | FAIL | 11.7 | 0 | 0 | 1 |
| 3 | WP creates quote + sends to couple | FAIL | 6.9 | 0 | 0 | 1 |
| 4 | Couple registers and signs the quote | FAIL | 24.6 | 0 | 3 | 1 |
| 5 | WP converts quote to contract + couple signs | FAIL | 59.1 | 1 | 1 | 2 |
| 6 | Full wedding configuration (tables, guests, timeline, mood, playlist, tasks, transport, accommodation) | FAIL | 0.0 | 0 | 0 | 1 |
| 7 | Couple change request | PASS | 33.7 | 0 | 0 | 1 |
| 8 | Supplier payments (foto acconto, catering pending) | PASS | 24.6 | 1 | 0 | 2 |
| 9 | Availability busy + duplicate quote blocked | PASS | 0.5 | 0 | 2 | 1 |
| 10 | Disintermediation conflict alert (LOCATION_MATCH) | PASS | 11.4 | 0 | 3 | 2 |
| 11 | Cleanup all AGENT-P-* users and data | FAIL | 0.5 | 0 | 0 | 1 |

## Dettaglio per fase

### Fase 1: WP onboarding (register + onboarding wizard + brand)

**Esito**: PASS (185.0s)

**Steps**:
- [OK] WP registered & landed onboarding — https://planfully.it/onboarding
- [FAIL] WP onboarding wizard completed — https://planfully.it/onboarding
- [OK] WP user created in auth — 1c5a0d69-93d7-4f5c-a8e6-8c0ab07c03fb

**Bug**:
- [LOW] BRAND_UPLOAD: No file input found on brand page

**Screenshot** (10): phase1-01-register-page.png, phase1-02-register-filled.png, phase1-03-onboarding-step0.png, phase1-04-onboarding-step1.png, phase1-05-onboarding-step2.png, phase1-06-onboarding-step3.png, phase1-07-onboarding-step4.png, phase1-08-wp-home.png

### Fase 2: WP invites 3 suppliers (foto/cater/fiori)

**Esito**: FAIL (11.7s)

**Steps**:

**Bug**:
- [HIGH] PHASE2: locator.click: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('[data-testid="invite-btn"]')


**Screenshot** (2): phase2-01-suppliers-page.png, phase2-99-error.png

### Fase 3: WP creates quote + sends to couple

**Esito**: FAIL (6.9s)

**Steps**:

**Bug**:
- [HIGH] PHASE3: locator.click: Timeout 5000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Nuovo preventivo|Crea preventivo|Nuovo|\+ Preventivo/i }).first()


**Screenshot** (2): phase3-01-quotes-list.png, phase3-99-error.png

### Fase 4: Couple registers and signs the quote

**Esito**: FAIL (24.6s)

**Steps**:
- [FAIL] Wedding entry resolved
- [FAIL] Couple invite token resolved
- [FAIL] Couple dashboard loaded — https://planfully.it/login

**Bug**:
- [HIGH] WEDDING: Could not find the 'guest_count' column of 'calendar_entries' in the schema cache

**Screenshot** (1): phase4-04-couple-dashboard.png

### Fase 5: WP converts quote to contract + couple signs

**Esito**: FAIL (59.1s)

**Steps**:
- [OK] Contract resolved — df0260b3-4b43-4590-b850-97347b6d5ea7
- [FAIL] Contract signed: status=undefined, signed_at=undefined, signature=false

**Bug**:
- [MEDIUM] CONTRACT_BTN: Genera contratto button not found in UI - using DB
- [MEDIUM] CONTRACT_CANVAS: no canvas found in contract sign page

**Screenshot** (5): phase5-01-quote-detail.png, phase5-02-after-contract-gen.png, phase5-03-contract-sign-page.png, phase5-04-contract-form-ready.png, phase5-05-after-contract-sign.png

### Fase 6: Full wedding configuration (tables, guests, timeline, mood, playlist, tasks, transport, accommodation)

**Esito**: FAIL (0.0s)

**Steps**:

**Bug**:
- [HIGH] NO_WEDDING: wedding ID missing - skipping

### Fase 7: Couple change request

**Esito**: PASS (33.7s)

**Steps**:

**Bug**:
- [HIGH] CR_INSERT: Could not find the 'category' column of 'couple_change_requests' in the schema cache

**Screenshot** (2): phase7-01-couple-dashboard.png, phase7-05-wp-sees-cr.png

### Fase 8: Supplier payments (foto acconto, catering pending)

**Esito**: PASS (24.6s)

**Steps**:
- [OK] Foto does NOT see wedding total — body has 15770? false

**Bug**:
- [MEDIUM] PAY_INSERT: Could not find the table 'public.supplier_payments' in the schema cache
- [HIGH] PAY_ALT: Could not find the table 'public.supplier_payments' in the schema cache

**Screenshot** (1): phase8-01-foto-calendar.png

### Fase 9: Availability busy + duplicate quote blocked

**Esito**: PASS (0.5s)

**Steps**:
- [FAIL] Availability rows for 2027-07-04: 0/3
- [FAIL] Quote item blocked by trigger — Could not find the 'basis' column of 'quote_items' in the schema cache

**Bug**:
- [MEDIUM] TRIGGER_NOT_FIRED: Could not find the 'basis' column of 'quote_items' in the schema cache

### Fase 10: Disintermediation conflict alert (LOCATION_MATCH)

**Esito**: PASS (11.4s)

**Steps**:
- [FAIL] Conflict alerts created: undefined
- [FAIL] LOCATION_MATCH alert found — none
- [FAIL] Conflict banner UI: 0 matches

**Bug**:
- [HIGH] SCL: Could not find the 'client_email' column of 'supplier_clients' in the schema cache
- [MEDIUM] LOCATION_ALERT: No LOCATION alert generated

**Screenshot** (1): phase10-01-wp-with-conflict.png

### Fase 11: Cleanup all AGENT-P-* users and data

**Esito**: FAIL (0.5s)

**Steps**:

**Bug**:
- [HIGH] PHASE11: sb.from(...).delete(...).eq(...).catch is not a function


## Final State

```json
{
  "wpUserId": "1c5a0d69-93d7-4f5c-a8e6-8c0ab07c03fb",
  "contractId": "df0260b3-4b43-4590-b850-97347b6d5ea7",
  "fotoTotal": 0,
  "fotoAcconto": 0,
  "caterTotal": 0
}
```
