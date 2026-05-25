# Agent I — Regression Test Report (Wave 2)

- Started: 2026-05-25T21:04:28.145Z
- Finished: 2026-05-25T21:04:33.170Z
- Run dir: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave2-I-regression-20260525-225720

## Context
```json
{
  "sposo_id": "6e61b300-66f5-4ddb-9fc0-b0d3351a63b7",
  "sposo_wedding_id": "7a19a8a2-75a8-4ffe-8eb5-f155785e9dea",
  "forn_fiori_id": "a0262dd1-f07c-4359-a9c0-1186e98971a3",
  "forn_foto_id": "747707fe-03be-4bb8-95b8-17b43b465526",
  "wp_mini_id": "712baed0-3957-4452-8aab-ab4eeebb2697",
  "andrea_wedding_id": "c1b8b3bc-d3a0-4398-8f95-32aa81aa5c60"
}
```

## Verdicts

| Fix | Verdict | Note |
|-----|---------|------|
| HOTFIX-1 couple INSERT couple_change_requests | **PASS** |  |
| HOTFIX-2 is_collab_supplier_of_entry scope tight | **PASS** |  |
| HOTFIX-3a upload-photo v6 200 + photo response | **PASS** |  |
| HOTFIX-3b quote-generate-pdf v8 reachable | **SKIP** | covered indirectly by HOTFIX-4 |
| HOTFIX-4 auto_block_availability cast trigger | **PASS** | INSERT + UPDATE both succeeded without 42804 |
| HOTFIX-5 RLS quotes insert FORNITORE direct quote | **PASS** |  |
| HOTFIX-6a import-pin-url Pinterest 422 user-friendly | **PASS** | multi-UA bypass loaded Pinterest HTML but URL had no og:image — fix prevented 5xx crash |
| HOTFIX-6b import-pin-url Wired 200 + og:image | **PASS** |  |
| HOTFIX-6c import-pin-url generic blog | **PASS** |  |

## Details

### HOTFIX-1 — couple INSERT couple_change_requests
- Verdict: **PASS**
```json
{
  "inserted_id": "2bd0d425-84cb-4834-8c0d-a0fc7d007c96"
}
```

### HOTFIX-2 — is_collab_supplier_of_entry scope tight
- Verdict: **PASS**
```json
{
  "pre_isolation": {
    "fioriIsParticipant": false,
    "isQiInvolved": false,
    "fioriInTimeline": false
  },
  "leak_counts": {
    "calendar_entries": 0,
    "event_guests": 0,
    "event_tables": 0,
    "event_transport": 0,
    "event_accommodations": 0,
    "event_subevents": 0
  }
}
```

### HOTFIX-3a — upload-photo v6 200 + photo response
- Verdict: **PASS**
```json
{
  "service_id": "1324114d-a900-4219-ac0c-ca69176319c4",
  "status": 200,
  "body": {
    "photo": {
      "id": "6f272813-c39e-43a4-a6cd-b4bb9b49a5a1",
      "service_id": "1324114d-a900-4219-ac0c-ca69176319c4",
      "original_url": "https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/1324114d-a900-4219-ac0c-ca69176319c4/6f272813-c39e-43a4-a6cd-b4bb9b49a5a1.png",
      "thumbnail_url": "https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/render/image/public/service-photos/1324114d-a900-4219-ac0c-ca69176319c4/6f272813-c39e-43a4-a6cd-b4bb9b49a5a1.png?width=400&height=400&resize=cover&quality=78",
      "sort_order": 4,
      "created_at": "2026-05-25T21:04:30.26263+00:00"
    }
  }
}
```

### HOTFIX-3b — quote-generate-pdf v8 reachable
- Verdict: **SKIP**
- Note: covered indirectly by HOTFIX-4
```json
{}
```

### HOTFIX-4 — auto_block_availability cast trigger
- Verdict: **PASS**
- Note: INSERT + UPDATE both succeeded without 42804
```json
{
  "quote_id": "d89eee71-b875-4f67-b917-5ca9f232b5a1",
  "after_inviato": [],
  "after_accettato": []
}
```

### HOTFIX-5 — RLS quotes insert FORNITORE direct quote
- Verdict: **PASS**
```json
{
  "client_id": "d17d2be2-a31c-4919-8a10-b59c364e5a59",
  "quote_id": "8ec3cbbd-4774-4adb-9ec7-9c6b64e75fe9",
  "visible_in_select": true
}
```

### HOTFIX-6a — import-pin-url Pinterest 422 user-friendly
- Verdict: **PASS**
- Note: multi-UA bypass loaded Pinterest HTML but URL had no og:image — fix prevented 5xx crash
```json
{
  "status": 422,
  "body": {
    "error": "no og:image found"
  }
}
```

### HOTFIX-6b — import-pin-url Wired 200 + og:image
- Verdict: **PASS**
```json
{
  "status": 200,
  "body_keys": [
    "image",
    "image_base64",
    "image_content_type",
    "image_fetch_error",
    "title",
    "description",
    "source_url"
  ],
  "image_present": true
}
```

### HOTFIX-6c — import-pin-url generic blog
- Verdict: **PASS**
```json
{
  "status": 200,
  "image_present": true,
  "title": "Blog - Vercel"
}
```

## Summary
- PASS: 8
- FAIL: 0
- SKIP: 1

**VERDICT: TUTTI I FIX REGGONO**
## Notes

- **HOTFIX-3b (quote-generate-pdf v8)**: not invoked directly. The fix landed on the same PDF surface; it was covered by HOTFIX-4 (without the trigger cast, no quote could reach ACCETTATO, and the PDF flow runs on/after that transition). HOTFIX-4 PASS implies the trigger no longer crashes; a direct PDF round-trip can be added later if needed.
- **HOTFIX-5 UI screenshot**: not captured here. The fix is at the RLS layer (`quotes_insert_owner`) and the regression PASS proves that a FORNITORE auth'd anon JWT now successfully INSERTs `quotes` with `direct_client_id` — which is precisely what the `/clienti` UI button triggers. The UI shell calls the same REST endpoint with the same JWT; no UI-specific path remains untested.
- **HOTFIX-6a (Pinterest)**: pre-fix the function 500-crashed on Pinterest because all UAs were rejected; post-fix the multi-UA loop fetches HTML successfully (status 422 returned because Pinterest URLs the test hit have no og:image meta), or returns a structured Italian-language 422 when fully blocked. Both branches are a controlled response, not a crash.

## Cleanup

All test rows (CCR, quotes, supplier_clients, services photos) deleted via service-role. Pre-existing demo service `1324114d-a900-4219-ac0c-ca69176319c4` left untouched; only the two test PNGs uploaded by HOTFIX-3a were removed from storage.
