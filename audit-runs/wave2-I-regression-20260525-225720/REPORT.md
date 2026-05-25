# Agent I — Regression Test Report (Wave 2)

- Started: 2026-05-25T21:01:00.375Z
- Finished: 2026-05-25T21:01:04.891Z
- Run dir: /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave2-I-regression-20260525-225720

## Context
```json
{
  "sposo_id": "6e61b300-66f5-4ddb-9fc0-b0d3351a63b7",
  "sposo_wedding_id": null,
  "forn_fiori_id": "a0262dd1-f07c-4359-a9c0-1186e98971a3",
  "forn_foto_id": "747707fe-03be-4bb8-95b8-17b43b465526",
  "wp_mini_id": "712baed0-3957-4452-8aab-ab4eeebb2697",
  "andrea_wedding_id": null
}
```

## Verdicts

| Fix | Verdict | Note |
|-----|---------|------|
| HOTFIX-1 couple INSERT couple_change_requests | **SKIP** | missing sposo/wedding |
| HOTFIX-2 is_collab_supplier_of_entry scope tight | **SKIP** | missing fiori or andrea wedding |
| HOTFIX-3a upload-photo v6 200 + photo response | **PASS** |  |
| HOTFIX-3b quote-generate-pdf v8 reachable | **SKIP** | covered indirectly by HOTFIX-4 |
| HOTFIX-4 auto_block_availability cast trigger | **FAIL** |  |
| HOTFIX-5 RLS quotes insert FORNITORE direct quote | **FAIL** |  |
| HOTFIX-6a import-pin-url Pinterest 422 user-friendly | **FAIL** |  |
| HOTFIX-6b import-pin-url Wired 200 + og:image | **PASS** |  |
| HOTFIX-6c import-pin-url generic blog | **PASS** |  |

## Details

### HOTFIX-1 — couple INSERT couple_change_requests
- Verdict: **SKIP**
- Note: missing sposo/wedding
```json
{}
```

### HOTFIX-2 — is_collab_supplier_of_entry scope tight
- Verdict: **SKIP**
- Note: missing fiori or andrea wedding
```json
{}
```

### HOTFIX-3a — upload-photo v6 200 + photo response
- Verdict: **PASS**
```json
{
  "service_id": "1324114d-a900-4219-ac0c-ca69176319c4",
  "status": 200,
  "body": {
    "photo": {
      "id": "9c0d0049-07a8-4b1c-9fab-e69299438807",
      "service_id": "1324114d-a900-4219-ac0c-ca69176319c4",
      "original_url": "https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/public/service-photos/1324114d-a900-4219-ac0c-ca69176319c4/9c0d0049-07a8-4b1c-9fab-e69299438807.png",
      "thumbnail_url": "https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/render/image/public/service-photos/1324114d-a900-4219-ac0c-ca69176319c4/9c0d0049-07a8-4b1c-9fab-e69299438807.png?width=400&height=400&resize=cover&quality=78",
      "sort_order": 4,
      "created_at": "2026-05-25T21:01:02.641585+00:00"
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
- Verdict: **FAIL**
```json
{
  "create_err": "Could not find the 'currency' column of 'quotes' in the schema cache",
  "code": "PGRST204"
}
```

### HOTFIX-5 — RLS quotes insert FORNITORE direct quote
- Verdict: **FAIL**
```json
{
  "client_err": "Could not find the 'owner_id' column of 'supplier_clients' in the schema cache",
  "code": "PGRST204"
}
```

### HOTFIX-6a — import-pin-url Pinterest 422 user-friendly
- Verdict: **FAIL**
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
- PASS: 3
- FAIL: 3
- SKIP: 3

**VERDICT: 3 fix ANCORA ROTTI**