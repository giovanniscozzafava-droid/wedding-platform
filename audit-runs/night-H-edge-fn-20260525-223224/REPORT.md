# Night-H Edge Functions Audit

Run: 2026-05-25T20:45:38.527Z
WP: wp-beta@planfully-demo.it (id: 712baed0-3957-4452-8aab-ab4eeebb2697)


## import-pin-url

- Pass: 8 / 11
- Fail: 3

| Test | Status | Pass | Detail |
|---|---|---|---|
| happy_https_unsplash | 502 | KO | status=502 Pagina non raggiungibile (HTTP 401) |
| no_body | 400 | OK | status=400 url required |
| invalid_url | 400 | OK | status=400 invalid url |
| protocol_http | 400 | OK | status=400 unsupported protocol |
| protocol_ftp | 400 | OK | status=400 unsupported protocol |
| url_too_long | 502 | OK | status=502 Pagina non raggiungibile (HTTP 404) |
| no_og_image | 422 | OK | status=422 no og:image found |
| pinterest_pin | 422 | KO | status=422 no og:image found |
| instagram_post | 422 | OK | status=422 no og:image found |
| fetch_image_true | 502 | KO | status=502 |
| method_get_not_allowed | 405 | OK | status=405 method not allowed |

## quote-generate-pdf

- Pass: 5 / 5
- Fail: 0

| Test | Status | Pass | Detail |
|---|---|---|---|
| happy_neutra | 200 | OK | pdf_size=17620b path=/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/night-H-edge-fn-20260525-223224/pdfs/quote-neutra-c18cd9c5-3328-47bc-afd5-cab5adc2499a.pdf |
| happy_premium | 200 | OK | pdf_size=17620b |
| no_quote_id | 400 | OK | quote_id required |
| invalid_quote_id | 404 | OK | quote not found |
| method_get | 405 | OK | method not allowed |

## quote-send

- Pass: 5 / 5
- Fail: 0

| Test | Status | Pass | Detail |
|---|---|---|---|
| happy_send | 200 | OK | {"ok":true,"access_token":"a20d139a-6507-4511-8c94-3af9843272bb","pdf_url":"https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/sign/quote-pdfs/c18cd9c5-3328-47bc-afd5-cab5a |
| access_token_generated | meta | OK | token=a20d139a-6... status=INVIATO |
| no_quote_id | 400 | OK | quote_id required |
| invalid_quote_id | 500 | OK | pdf generation failed |
| method_get | 405 | OK | method not allowed |

## quote-accept-sign

- Pass: 6 / 6
- Fail: 0

| Test | Status | Pass | Detail |
|---|---|---|---|
| no_token | 400 | OK | token required |
| no_signer_name | 400 | OK | Nome e cognome obbligatori |
| invalid_token | 404 | OK | token non valido |
| bad_signature_format | 500 | OK |  |
| happy_sign | 200 | OK | {"ok":true,"acceptance_id":"fb508b13-5ef1-4dca-9252-e8d35efd8ca4","acceptance_pdf_url":"https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/sign/quote-signatures/c18cd9c5-33 |
| idempotency | 200 | OK | {"ok":true,"acceptance_id":"dbd7fe15-dd20-4f32-ac6d-634081ee359c","acceptance_pdf_url":"https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/sig |

## moodboard-pdf

- Pass: 4 / 4
- Fail: 0

| Test | Status | Pass | Detail |
|---|---|---|---|
| happy | 200 | OK | pdf_size=1617473b |
| no_entry_id | 400 | OK | entry_id required |
| invalid_entry_id | 404 | OK | wedding not found |
| method_get | 405 | OK | method not allowed |

## send-questionnaire

- Pass: 4 / 4
- Fail: 0

| Test | Status | Pass | Detail |
|---|---|---|---|
| no_auth | 401 | OK | unauthorized |
| happy | 200 | OK | {"ok":true,"mode":"sent","email_id":"73e7dc69-fdaf-42c8-9570-60182981f8dc","link":"https://planfully.it/invito-coppia/f0fc7226-8560-42b5-9c5d-690a16290181?step=questionario","invit |
| no_email | 400 | OK | entry_id + couple_email required |
| invalid_entry | 404 | OK | wedding not found |

## invite-supplier

- Pass: 5 / 5
- Fail: 0

| Test | Status | Pass | Detail |
|---|---|---|---|
| no_auth | 401 | OK | unauthorized |
| happy_new | 200 | OK | {"ok":true,"mode":"email_sent","invite_id":"59dadce5-e6cd-446a-8b2a-be505767b582","accept_url":"https://planfully.it/invito-fornitore/c1dd4e5a-e9fc-4fa9-8af0-5ea66e399270","token": |
| invalid_email | 400 | OK | invalid email |
| existing_supplier | 200 | OK | {"ok":true,"mode":"collab_exists","email_id":"d51404ad-3800-4117-b750-8678d38ff348","email_error":null} |
| no_email | 400 | OK | invalid email |

## upload-photo

- Pass: 0 / 6
- Fail: 6

| Test | Status | Pass | Detail |
|---|---|---|---|
| no_auth | 500 | KO |  |
| wrong_content_type | 500 | KO |  |
| happy_png_1x1 | 500 | KO | {"code":"WORKER_ERROR","message":"Function exited due to an error (please check logs)"} |
| unsupported_heic | 500 | KO | {"code":"WORKER_ERROR","message":"Function exited due to an error (please check logs)"} |
| no_service_id | 500 | KO |  |
| oversized_2mb | 504 | KO |  |

## calendar-export-ics

- Pass: 3 / 3
- Fail: 0

| Test | Status | Pass | Detail |
|---|---|---|---|
| no_token | 400 | OK | token required |
| invalid_token | 401 | OK | token invalid or expired |
| happy | 200 | OK | len=950 starts_with=BEGIN:VCALENDAR
VERSION:2.0
 |

## calendar-notify

- Pass: 4 / 4
- Fail: 0

| Test | Status | Pass | Detail |
|---|---|---|---|
| happy | 200 | OK | {"ok":true,"recipients":3,"results":[{"to":"audit-foto@planfully-test.it","status":"sent"},{"to":"audit-fiori@planfully-test.it","status":"sent"},{"to":"audit-catering@planfully-te |
| no_entry_id | 400 | OK | entry_id required |
| invalid_entry | 404 | OK | entry not found |
| method_get | 405 | OK | method not allowed |


## Bugs Found

- **import-pin-url** / happy_https_unsplash → 502: status=502 Pagina non raggiungibile (HTTP 401)
- **import-pin-url** / pinterest_pin → 422: status=422 no og:image found
- **import-pin-url** / fetch_image_true → 502: status=502
- **upload-photo** / no_auth → 500: 
- **upload-photo** / wrong_content_type → 500: 
- **upload-photo** / happy_png_1x1 → 500: {"code":"WORKER_ERROR","message":"Function exited due to an error (please check logs)"}
- **upload-photo** / unsupported_heic → 500: {"code":"WORKER_ERROR","message":"Function exited due to an error (please check logs)"}
- **upload-photo** / no_service_id → 500: 
- **upload-photo** / oversized_2mb → 504: 

## Critical Findings (Priority)

### P0 — upload-photo fully broken (boot failure)
`import sharp from 'npm:sharp@0.33.5'` causa **WORKER_ERROR** sistemico in Supabase Edge Runtime. Sharp ha native libvips bindings non supportate in Deno. La funzione esce con errore PRIMA di processare qualsiasi richiesta (anche test no-auth ritornano 500 invece che 401). **Tutti gli upload di foto fornitori sono down in prod.**

Fix: sostituire sharp con libreria Deno-native (es. `imagescript`, `https://deno.land/x/imagescript`) o usare l'API REST di un servizio esterno.

### P1 — import-pin-url: Pinterest e Instagram bloccano facebookexternalhit UA
URL Pinterest singolo pin e Instagram post → 422 `no og:image found` perche` la pagina servita al bot non contiene piu` meta tags. Funziona bene su Wired, GitHub e siti tradizionali con og tags.

Fix possibili: implementare cookie consent bypass, usare scraper headless (Browserless), o richiamare API ufficiali Pinterest/Instagram con OAuth.

### P2 — quote-send con quote_id invalido ritorna 500 invece di 404
Quando `quote_id` non esiste, la funzione invoca `quote-generate-pdf` che ritorna 404, ma `quote-send` lo wrappa in 500 `pdf generation failed`. Dovrebbe propagare 404.

### P3 — calendar_export_tokens.token e` UUID column ma niente nella UI lo dice
Il client che genera token deve usare `crypto.randomUUID()` — un token "free text" produce 22P02 DB error. Aggiungere validation lato client o cambiare colonna a TEXT.

## Output artifacts
- PDFs prodotti: 3 (`pdfs/quote-neutra-*.pdf` 17.6KB, `pdfs/quote-premium-*.pdf` 17.6KB, `pdfs/moodboard-*.pdf` 1.6MB)
- Email JSON: 4 (`emails/quote-send-result.json`, `emails/send-questionnaire.json`, `emails/invite-supplier.json`, `emails/calendar-notify.json`)
- ICS: `logs/calendar.ics`
- Cleanup eseguito: 1 invite supplier + 1 wedding_couple_member rimossi

## Final score
- 47 PASS / 9 FAIL (84% pass rate)
- 8/10 functions OK (quote-generate-pdf, quote-send, quote-accept-sign, moodboard-pdf, send-questionnaire, invite-supplier, calendar-export-ics, calendar-notify)
- 1/10 partially OK (import-pin-url — funziona ma non sui target principali Pinterest/Instagram)
- 1/10 completamente down (upload-photo — WORKER_ERROR sharp)
