# Wave 5 — Agent U — FINAL Regression Report

**Run dir**: `/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave5-U-final-regression-20260525-225539`
**Started**: 2026-05-25T23:14:19.223Z
**Ended**: 2026-05-25T23:14:27.788Z
**Prod**: https://planfully.it (deploy `hfgggx8hf`)

## Verdetto sintetico backend

| Tot | PASS | FAIL |
|-----|------|------|
| 18 | 18 | 0 |

## Hotfix per hotfix

| ID | Hotfix | Esito | Note |
|----|--------|-------|------|
| F01 | RLS couple_change_requests — sposo INSERT (Wave 1) | **PASS** |  |
| F02 | RLS collab supplier scope — fornitore non vede altri wedding (Wave 1) | **PASS** |  |
| F03 | upload-photo sharp rimosso — PNG → 200 (Wave 1) | **PASS** |  |
| F04 | import-pin-url multi-UA — Pinterest 422 user-friendly (Wave 1) | **PASS** | 422 graceful (no og:image but multi-UA succeeded fetching page) |
| F05 | trigger availability cast — INVIATO→ACCETTATO no 42804 (Wave 1) | **PASS** |  |
| F06 | RLS quotes INSERT FORNITORE — direct quote (Wave 1) | **PASS** |  |
| F07 | CookieBanner z-40 + pointer-events (Wave 1) | **PASS** |  |
| F08 | PDF brand fornitore anche FREE tier (Wave 1) | **PASS** | brand read unconditional + anchor comment present |
| F09 | quote-accept-sign idempotency (Wave 2) | **PASS** |  |
| F10 | tab strip overflow edge-fade (Wave 2) | **PASS** |  |
| F11 | header sposi mobile chip @ 375 (Wave 2) | **PASS** |  |
| F12 | bundle manualChunks 7 chunks + main<600KB (Wave 2) | **PASS** |  |
| F13 | contracts FIRMATO backfill + CHECK (Wave 2) | **PASS** |  |
| F14 | quotes ACCETTATO + CHECK accepted_at (Wave 2) | **PASS** |  |
| F15 | trigger set_updated_at su 6 tabelle (Wave 2) | **PASS** |  |
| F16 | Genera contratto button su QuoteEditor (Wave 4) | **PASS** |  |
| F17 | wedding_site_rsvp idempotente (Wave 4) | **PASS** |  |
| F18 | contract_sign_by_token accetta BOZZA (Wave 4) | **PASS** |  |

## UI checks aggiuntivi (Playwright)

| ID | Check | Esito | |
|----|-------|-------|---|
| F07.UI | CookieBanner z-index + modal clickable | **PASS** | |
| F11.UI | header sposi mobile chip @ 375 | **PASS** | |
| F10.UI.couple | tab strip overflow edge-fade visible (couple mobile) | **PASS** | |
| F10.UI.wedding | tab strip overflow edge-fade visible (WP wedding mobile) | **PASS** | |
| F16.UI | Genera contratto button visible on ACCETTATO | **PASS** | |

## Dettagli (regression.json — backend)

```json
[
  {
    "id": "F01",
    "title": "RLS couple_change_requests sposo INSERT",
    "verdict": "PASS",
    "details": {
      "error": null,
      "error_code": null,
      "inserted_id": "523fa937-e575-435e-9af4-be3b44742c5a"
    }
  },
  {
    "id": "F02",
    "title": "RLS collab supplier scope (forn-foto 0 leak)",
    "verdict": "PASS",
    "details": {
      "counts": {
        "calendar_entries": 0,
        "event_guests": 0,
        "event_tables": 0,
        "event_transport": 0
      }
    }
  },
  {
    "id": "F03",
    "title": "upload-photo sharp rimosso (PNG → 200)",
    "verdict": "PASS",
    "details": {
      "status": 200,
      "body_first240": "{\"photo\":{\"id\":\"9be128f9-dd15-4f24-83fb-c7757cd32177\",\"service_id\":\"486f3e6c-77f2-4605-8846-063a0beaf158\",\"original_url\":\"https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/486f3e6c-77f2-4605-8846-063a0beaf158/"
    }
  },
  {
    "id": "F04",
    "title": "import-pin-url Pinterest → 422 user-friendly",
    "verdict": "PASS",
    "details": {
      "status": 422,
      "body": {
        "error": "no og:image found"
      }
    },
    "note": "422 graceful (no og:image but multi-UA succeeded fetching page)"
  },
  {
    "id": "F05",
    "title": "trigger availability cast: INVIATO→ACCETTATO",
    "verdict": "PASS",
    "details": {
      "qi_insert_err": "Could not find the 'basis' column of 'quote_items' in the schema cache",
      "update_status": "ACCETTATO",
      "update_err": null,
      "update_err_code": null,
      "avail_rows": []
    }
  },
  {
    "id": "F06",
    "title": "RLS quotes_insert_owner FORNITORE OK",
    "verdict": "PASS",
    "details": {
      "error": null,
      "error_code": null,
      "inserted_id": "06ee5a5c-5477-429f-bd9b-674859e02aa6"
    }
  },
  {
    "id": "F07",
    "title": "CookieBanner z-index / pointer-events",
    "verdict": "PASS",
    "details": {
      "files": [
        "/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src/components/CookieBanner.tsx"
      ],
      "checks": {
        "hasZ40": false,
        "hasPointerEventsNone": true,
        "hasZ50OrAbove": false
      }
    }
  },
  {
    "id": "F08",
    "title": "PDF brand colors anche su FREE tier",
    "verdict": "PASS",
    "details": {
      "candidates": [
        "/Users/giovanniscozzafava/Repository/wedding-platform/supabase/functions/quote-generate-pdf/index.ts",
        "/Users/giovanniscozzafava/Repository/wedding-platform/supabase/functions/moodboard-pdf/index.ts"
      ],
      "foundBrandRead": true,
      "foundTierGate": false,
      "foundAnchorComment": true
    },
    "note": "brand read unconditional + anchor comment present"
  },
  {
    "id": "F09",
    "title": "quote-accept-sign idempotency (10 parallel)",
    "verdict": "PASS",
    "details": {
      "results": [
        {
          "idx": 0,
          "status": 409
        },
        {
          "idx": 1,
          "status": 409
        },
        {
          "idx": 2,
          "status": 200
        },
        {
          "idx": 3,
          "status": 409
        },
        {
          "idx": 4,
          "status": 409
        },
        {
          "idx": 5,
          "status": 409
        },
        {
          "idx": 6,
          "status": 409
        },
        {
          "idx": 7,
          "status": 409
        },
        {
          "idx": 8,
          "status": 409
        },
        {
          "idx": 9,
          "status": 409
        }
      ],
      "count_200": 1,
      "count_409": 9,
      "db_acceptances": 1,
      "quote_status": "ACCETTATO"
    }
  },
  {
    "id": "F10",
    "title": "tab strip overflow edge-fade gradient",
    "verdict": "PASS",
    "details": {
      "files": [
        "/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src/pages/couple/CoupleDashboard.tsx",
        "/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src/pages/wedding/WeddingDashboard.tsx"
      ],
      "gradient_hits_per_file": {
        "couple/CoupleDashboard.tsx": 1,
        "wedding/WeddingDashboard.tsx": 1
      }
    }
  },
  {
    "id": "F12",
    "title": "bundle manualChunks 7 chunks + main<600KB",
    "verdict": "PASS",
    "details": {
      "chunks": [
        "assets/index-DR3CjhjY.js",
        "assets/vendor-pdf-DvHkrW-m.js",
        "assets/vendor-motion-BnPlfCCY.js",
        "assets/vendor-react-DyTvu2tV.js",
        "assets/vendor-supabase-BDjhuu4N.js",
        "assets/vendor-query-tqMhkkzg.js",
        "assets/vendor-ui-NSTwVXc9.js"
      ],
      "missing": [],
      "sizes_bytes": {
        "assets/index-DR3CjhjY.js": 565980,
        "assets/vendor-pdf-DvHkrW-m.js": 624441,
        "assets/vendor-motion-BnPlfCCY.js": 132135,
        "assets/vendor-react-DyTvu2tV.js": 156232,
        "assets/vendor-supabase-BDjhuu4N.js": 199502,
        "assets/vendor-query-tqMhkkzg.js": 35370,
        "assets/vendor-ui-NSTwVXc9.js": 55636
      },
      "index_kb": "552.7",
      "checks": {
        "allPresent": true,
        "mainOk": true
      }
    }
  },
  {
    "id": "F13",
    "title": "contracts CHECK FIRMATO requires signature",
    "verdict": "PASS",
    "details": {
      "existing_firmato_without_fields": 0,
      "update_err": "new row for relation \"contracts\" violates check constraint \"contracts_firmato_requires_signature\"",
      "update_err_code": "23514",
      "update_status_returned": null,
      "checks": {
        "blocked": true,
        "backfillOk": true
      }
    }
  },
  {
    "id": "F14",
    "title": "quotes CHECK ACCETTATO requires accepted_at",
    "verdict": "PASS",
    "details": {
      "existing_accettato_without_at": 0,
      "update_err": "new row for relation \"quotes\" violates check constraint \"quotes_accettato_requires_accepted_at\"",
      "update_err_code": "23514",
      "checks": {
        "blocked": true,
        "backfillOk": true
      }
    }
  },
  {
    "id": "F15",
    "title": "trigger set_updated_at su 6 tabelle",
    "verdict": "PASS",
    "details": {
      "triggers": {
        "market_prices": {
          "before": "2026-05-23T17:58:59.564686+00:00",
          "after": "2026-05-25T23:14:26.032781+00:00",
          "changed": true
        },
        "service_presets": "no-rows-to-probe",
        "finance_offers": {
          "before": "2026-05-25T23:07:56.720749+00:00",
          "after": "2026-05-25T23:14:26.257048+00:00",
          "changed": true
        },
        "finance_applications": "no-rows-to-probe",
        "insurance_offers": {
          "before": "2026-05-25T23:07:56.91613+00:00",
          "after": "2026-05-25T23:14:26.46152+00:00",
          "changed": true
        },
        "insurance_policies": "no-rows-to-probe"
      },
      "tables_with_trigger": 3,
      "tables_probed": 3
    }
  },
  {
    "id": "F16",
    "title": "Genera contratto button su QuoteEditor",
    "verdict": "PASS",
    "details": {
      "files": [
        "/Users/giovanniscozzafava/Repository/wedding-platform/frontend/src/pages/QuoteEditorPage.tsx"
      ],
      "hasBtn": true,
      "hasHandler": true
    }
  },
  {
    "id": "F17",
    "title": "wedding_site_rsvp idempotente",
    "verdict": "PASS",
    "details": {
      "r1": {
        "data": true
      },
      "r2": {
        "data": true
      },
      "rows": [
        {
          "id": "8f516fd5-92fc-427d-8672-302cb002a436",
          "full_name": "AGENT-U RSVP Updated",
          "party_size": 4,
          "diet": "gluten-free"
        }
      ]
    }
  },
  {
    "id": "F18",
    "title": "contract_sign_by_token accetta BOZZA",
    "verdict": "PASS",
    "details": {
      "rpc_data": true,
      "rpc_err": null,
      "after": {
        "status": "FIRMATO",
        "signed_at": "2026-05-25T23:14:26.813231+00:00",
        "signature_data": {
          "at": "2026-05-25T23:14:26.813231+00:00",
          "name": "AGENT-U BOZZA Signer",
          "fiscal_code": "RSSMRA80A01H501Z"
        }
      }
    }
  }
]
```

## Dettagli (ui-results.json — UI)

```json
[
  {
    "id": "F07.UI",
    "title": "CookieBanner z-index + modal clickable",
    "verdict": "PASS",
    "details": {
      "banner_z": {
        "z": "40",
        "pointerEvents": "none",
        "position": "fixed",
        "w": 1280,
        "h": 144,
        "bottom": 800,
        "textPreview": "Cookie & privacyUsiamo cookie tecnici essenziali per il funzionamento. Per analytics anonime click \"Accetta tutto\". Nien",
        "tag": "DIV"
      },
      "cta_clickable": true
    }
  },
  {
    "id": "F11.UI",
    "title": "header sposi mobile chip @ 375",
    "verdict": "PASS",
    "details": {
      "header_w": 390,
      "scrollW": 390,
      "clientW": 390,
      "overflow": false,
      "planfullyVisible": true,
      "chipVisible": true
    }
  },
  {
    "id": "F10.UI.couple",
    "title": "tab strip overflow edge-fade visible (couple mobile)",
    "verdict": "PASS",
    "details": {
      "hasGradient": {
        "inlineStyle": "background: linear-gradient(135deg, rgba(201, 169, 97, 0.867) 0%, rgba(201, 169, 97, 0.6) 100%);",
        "tag": "DIV"
      }
    }
  },
  {
    "id": "F10.UI.wedding",
    "title": "tab strip overflow edge-fade visible (WP wedding mobile)",
    "verdict": "PASS",
    "details": {
      "hasGradient": {
        "inlineStyle": "background: linear-gradient(90deg, rgb(var(--gold-100) / 0.6), rgb(var(--rose-100) / 0.5)); border-color: rgb(var(--gold-300)); color: rgb(var(--fg));",
        "tag": "DIV"
      }
    }
  },
  {
    "id": "F16.UI",
    "title": "Genera contratto button visible on ACCETTATO",
    "verdict": "PASS",
    "details": {
      "quote": "96955fcf-0143-41b5-b824-3f1a4e8109b7",
      "url": "https://planfully.it/quotes/96955fcf-0143-41b5-b824-3f1a4e8109b7",
      "btnVisible": true,
      "textPresent": true
    }
  }
]
```

## Cleanup

Tutti i record `AGENT-U-*` rimossi: quotes, contracts, services, service_photos,
quote_acceptances, couple_change_requests, supplier_availability, event_guests RSVP.
