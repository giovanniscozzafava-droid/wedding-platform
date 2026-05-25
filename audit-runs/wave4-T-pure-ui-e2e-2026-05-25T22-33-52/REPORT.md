# Wave 4 — Agent T — PURE UI E2E (NO SHORTCUTS)

**Scenario**: Sofia & Marco — Cosenza 2027-09-12 · Tenuta degli Ulivi
**Run dir**: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave4-T-pure-ui-e2e-2026-05-25T22-33-52
**Started**: 2026-05-25T22:33:53.210Z
**Finished**: 2026-05-25T22:49:25.236Z
**Approccio**: tutto happy-path via UI Playwright; DB usato SOLO per cleanup, lookup token e verifica stato finale.

## Esito UI-only per area

```json
{
  "wpOnboarding": true,
  "brandLogo": true,
  "supplierInvite": true,
  "quoteCreate": true,
  "quoteSend": true,
  "quoteSign": true,
  "bannerAcceptedVisible": true,
  "generateContractBtn": true,
  "contractGenerated": true,
  "contractSign": false,
  "coupleSignup": true,
  "tables": true,
  "guests": false,
  "mood": false,
  "playlist": false,
  "timeline": false
}
```

## Resoconto fasi

| Fase | Nome | Esito | Durata (s) | Step OK | Step FAIL | Bug |
|------|------|-------|-----------|---------|-----------|-----|
| 1 | WP registration (UI register + onboarding wizard + brand upload) | PASS | 143.8 | 5 | 0 | 0 |
| 2 | WP invites foto supplier via UI + supplier accepts via UI | PASS | 578.3 | 4 | 0 | 1 |
| 25 | Foto supplier creates 2 catalog services via UI (preparation for quote items) | FAIL | 23.6 | 1 | 0 | 1 |
| 3 | WP creates quote via UI + adds items from catalog + send to client | PASS | 55.8 | 5 | 2 | 1 |
| 4 | Couple signs quote via /p/accept/:token UI multi-step | PASS | 27.7 | 3 | 0 | 0 |
| 5 | WP clicks "Genera contratto" button (Wave 4 fix) → contract row created | PASS | 21.5 | 4 | 0 | 0 |
| 6 | Couple signs contract via /p/contract/:token UI | FAIL | 16.7 | 1 | 1 | 1 |
| 7 | Couple signs up via /invito-coppia/:token + explores dashboard tabs (mood, programma) | PASS | 16.6 | 3 | 0 | 0 |
| 8 | WP populates wedding tabs (tables, guests, mood, playlist, timeline) via UI clicks | PASS | 46.3 | 1 | 4 | 0 |
| 9 | Cleanup all agent-t-% users + derived data via service-role | PASS | 1.8 | 3 | 0 | 0 |

## Dettaglio per fase

### Fase 1: WP registration (UI register + onboarding wizard + brand upload)

**Esito**: PASS (143.8s)

**Steps**:
- [OK] WP registered via UI → onboarding — https://planfully.it/onboarding
- [OK] Onboarding wizard completato via UI — https://planfully.it/
- [OK] Brand logo uploaded via UI input[type=file]
- [OK] Brand colors set via UI: #C49A5C / #1A2E4F (color inputs found: 2)
- [OK] WP profile in DB — {"onboarding_complete":true,"city":null,"has_logo":true,"primary":"#c49a5c","secondary":"#1a2e4f","subrole":"wedding_planner"}

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

### Fase 2: WP invites foto supplier via UI + supplier accepts via UI

**Esito**: PASS (578.3s)

**Steps**:
- [OK] Invite modal opened via UI
- [OK] Invite link generato via UI — e6be2ed5-4ba
- [OK] Foto supplier registered via /invito-fornitore UI — 2b1e645f-522f-4446-8025-5c3342d9689d
- [OK] Active collaboration foto: 1/1 — ["2b1e645f"]

**Bug**:
- [MEDIUM] FOTO_BRAND_FILE: Nessun input file per logo fornitore

**Screenshot** (9):
- phase2-01-suppliers-page.png
- phase2-02-invite-foto-form.png
- phase2-03-invite-link.png
- phase2-04-foto-invite-page.png
- phase2-04b-foto-invite-filled.png
- phase2-05-foto-after-signup.png
- phase2-06-foto-after-onboarding.png
- phase2-07-foto-brand-saved.png
- phase2-08-wp-suppliers-list.png

### Fase 25: Foto supplier creates 2 catalog services via UI (preparation for quote items)

**Esito**: FAIL (23.6s)

**Steps**:
- [OK] Service created via UI: Servizio fotografico full day — 9b5ecbc4-a301-45d5-b780-6ff17b57a849

**Bug**:
- [HIGH] PHASE25: locator.click: Timeout 4000ms exceeded.
Call log:
  - waiting for locator('[data-testid="new-service-btn"]').first()
    - locator resolved to <button data-testid="new-service-btn" class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] hover:bg-[rgb(var(--gold-600))] active:scale-[.98] shadow-[0_1px_2px_rgba(170,140,60,.18),0_8px_24px_rgba(170,140,60,.18)] h-10 px-4 py-2">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div> from <div role="dialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div> from <div role="dialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    7 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div class="absolute inset-0 bg-black/40 backdrop-blur-sm"></div> from <div role="dialog" class="fixed inset-0 z-50 flex items-center justify-center p-4">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 500ms


**Screenshot** (4):
- phase25-01-catalog-empty.png
- phase25-02-svc-0-filled.png
- phase25-03-svc-0-after-save.png
- phase25-99-error.png

### Fase 3: WP creates quote via UI + adds items from catalog + send to client

**Esito**: PASS (55.8s)

**Steps**:
- [OK] Quote created via UI form (Crea e apri) — fa89746d-c2db-4373-8edd-10cfe63a31bd
- [OK] Catalog cards visible for foto supplier: 1
- [FAIL] Items added via UI from catalog: 1/2
- [FAIL] PDF NEUTRA generato (URL DB): false
- [OK] Quote send-quote-btn clicked
- [OK] Quote DB stato post-send: status=INVIATO, total=2880, markup=20, tables=10
- [OK] Quote items in DB: 1 — ["Servizio fotografico full day"]

**Bug**:
- [MEDIUM] PDF_NO_DOWNLOAD: Download event non scattato e nessun pdf_url in DB

**Screenshot** (7):
- phase3-01-quotes-list.png
- phase3-02-new-quote-modal.png
- phase3-03-quote-form-filled.png
- phase3-04-quote-editor.png
- phase3-05-after-items-added.png
- phase3-06-after-pdf.png
- phase3-07-quote-sent.png

### Fase 4: Couple signs quote via /p/accept/:token UI multi-step

**Esito**: PASS (27.7s)

**Steps**:
- [OK] Canvas firma disegnato via page.mouse.down/move/up
- [OK] Consents checked: 2
- [OK] Quote firma: status=ACCETTATO, accepted_at=2026-05-25T22:47:27.556+00:00, audit_rows=0, pdf=no

**Screenshot** (5):
- phase4-01-accept-step1.png
- phase4-02-accept-step2.png
- phase4-03-accept-step3.png
- phase4-04-signature-drawn.png
- phase4-05-after-accept.png

### Fase 5: WP clicks "Genera contratto" button (Wave 4 fix) → contract row created

**Esito**: PASS (21.5s)

**Steps**:
- [OK] Banner ACCETTATO visibile in editor
- [OK] Pulsante "Genera contratto" presente (Wave 4 fix)
- [OK] Contract creato in DB via UI: id=d5607c2d-2009-496f-b434-b319bdcf42a7, status=BOZZA, token=949fce74
- [OK] Contract dopo send UI: status=BOZZA, token=949fce74

**Notes**:
- Nessuna textarea sezione in /contracts/:id (UI minimale)

**Screenshot** (5):
- phase5-01-quote-detail-after-accept.png
- phase5-02-after-generate-contract-click.png
- phase5-03-contracts-list.png
- phase5-04-contract-detail.png
- phase5-06-contract-after-send.png

### Fase 6: Couple signs contract via /p/contract/:token UI

**Esito**: FAIL (16.7s)

**Steps**:
- [OK] Canvas firma contratto NON presente (UI text-only)
- [FAIL] Contract DB: status=undefined, signed_at=undefined, signature=false, signed_pdf=no

**Bug**:
- [HIGH] CONTRACT_SIGN_UI: Contract NON firmato dopo submit UI

**Screenshot** (3):
- phase6-01-contract-sign-page.png
- phase6-02-contract-form-filled.png
- phase6-04-after-contract-sign.png

### Fase 7: Couple signs up via /invito-coppia/:token + explores dashboard tabs (mood, programma)

**Esito**: PASS (16.6s)

**Steps**:
- [OK] Wedding entry collegata a quote — a532ff22-814b-45c9-987f-940e0a4992d1
- [OK] Couple invite token — 7add8d74-5ff
- [OK] Couple registered via UI — b9e4ab80-8d66-424d-a159-041f3da40e6d

**Notes**:
- Input Pinterest non trovato in Mood tab coppia
- Pulsante change-request non visibile in tab Programma coppia

**Screenshot** (4):
- phase7-01-couple-invite.png
- phase7-02-couple-signup-filled.png
- phase7-03-couple-after-signup.png
- phase7-04-couple-dashboard.png

### Fase 8: WP populates wedding tabs (tables, guests, mood, playlist, timeline) via UI clicks

**Esito**: PASS (46.3s)

**Steps**:
- [OK] Tables created via UI clicks: 10 attempted → DB 10
- [FAIL] Guests created via UI clicks: 30 attempted → DB 0
- [FAIL] Mood images uploaded via UI: 0 attempted → DB 0
- [FAIL] Playlist songs added via UI: 10 attempted → DB 0
- [FAIL] Timeline moments added via UI: 0 attempted → DB 0

**Screenshot** (11):
- phase8-01-wedding-dashboard.png
- phase8-02-tables-tab.png
- phase8-03-tables-added.png
- phase8-04-guests-tab.png
- phase8-05-guests-added.png
- phase8-06-mood-tab.png
- phase8-07-mood-uploaded.png
- phase8-08-playlist-tab.png
- phase8-09-playlist-added.png
- phase8-10-timeline-tab.png
- phase8-11-timeline-added.png

### Fase 9: Cleanup all agent-t-% users + derived data via service-role

**Esito**: PASS (1.8s)

**Steps**:
- [OK] Deleted 3 auth users
- [OK] Quote cleaned
- [OK] Wedding cleaned


## Final State

```json
{
  "uiOnlyOk": {
    "wpOnboarding": true,
    "brandLogo": true,
    "supplierInvite": true,
    "quoteCreate": true,
    "quoteSend": true,
    "quoteSign": true,
    "bannerAcceptedVisible": true,
    "generateContractBtn": true,
    "contractGenerated": true,
    "contractSign": false,
    "coupleSignup": true,
    "tables": true,
    "guests": false,
    "mood": false,
    "playlist": false,
    "timeline": false
  },
  "dbForced": [],
  "wpUserId": "57be1ed0-4506-4e8a-8a6c-efe7deb9eef5",
  "fotoUserId": "2b1e645f-522f-4446-8025-5c3342d9689d",
  "quoteId": "fa89746d-c2db-4373-8edd-10cfe63a31bd",
  "quoteToken": "f5cad93e-05b8-4d8f-ae75-a2759d2c1a25",
  "quoteTotal": 2880,
  "quoteAcceptedAt": "2026-05-25T22:47:27.556+00:00",
  "contractId": "d5607c2d-2009-496f-b434-b319bdcf42a7",
  "contractToken": "949fce74-6c4d-440a-88a4-0f232458c00b",
  "weddingId": "a532ff22-814b-45c9-987f-940e0a4992d1",
  "coupleUserId": "b9e4ab80-8d66-424d-a159-041f3da40e6d"
}
```

## Confronto vs Agent P (wave3-P-e2e-full)

Agent P utilizzava DB writes diretti per:
- quote header (event_date, location, guest_count, table_count, markup)
- quote_items + services (createService + insert quote_items)
- quote totals (total_cost / total_client)
- access_token quote (fallback insert)
- contract (CONTRACT_BTN bug → forced insert)
- contract sign signature_data (CONTRACT_UI_SIGN bug → forced)
- couple_member token (sometimes)
- tables/guests/timeline/mood/playlist (bulk via DB)

Agent T (questo run) ha sostituito tutti questi con UI clicks dove possibile.
Le aree marcate 'true' in uiOnlyOk sopra sono operative SENZA touch DB; quelle 'false' indicano regressioni o feature non ancora UI-complete.
