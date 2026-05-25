# Planfully — RLS Audit (Night G)

_Run: 2026-05-25T20:39:19.480Z_  Cells: 77 • Pass: 74 • Fail: 3 • Critical leaks: 2

## Test users
- **WP_A** = `wp-mini@planfully-demo.it` (`712baed0-3957-4452-8aab-ab4eeebb2697`)
- **WP_B** = `wp.speranza.carrozzo@planfully-demo.it` (`ebae0f18-4cc8-40fe-ae40-f6a5757f1726`)
- **FORN_A** = `forn-mini-foto@planfully-demo.it` (`747707fe-03be-4bb8-95b8-17b43b465526`)
- **FORN_B** = `forn-mini-fiori@planfully-demo.it` (`a0262dd1-f07c-4359-a9c0-1186e98971a3`)
- **COUPLE_C** = `giovanni.scozzafava+sposo@gmail.com` (`6e61b300-66f5-4ddb-9fc0-b0d3351a63b7`)

## Matrix

| Actor | Op | Table | Target | Expected | Actual | Pass | Severity | Err |
|---|---|---|---|---|---|---|---|---|
| WP_A | SELECT | quotes | 6f28202a-846 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | UPDATE | quotes | 6f28202a-846 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | DELETE | quotes | 6f28202a-846 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | quote_items | 202ca349-115 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | UPDATE | quote_items | 202ca349-115 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | calendar_entries | 0d7678d2-30d | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | UPDATE | calendar_entries | 0d7678d2-30d | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | DELETE | calendar_entries | 0d7678d2-30d | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | event_timeline | b46d3605-4f1 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | event_guests | b82a38b7-5ff | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | event_tables | 08a2eefe-6d0 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | mood_images | 6974d189-387 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | event_playlist | c7625635-2ed | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | wedding_tasks | aca7a31b-582 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | event_transport | 86add26a-4cd | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | event_accommodations | cc6d44ff-854 | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | couple_preferences | 079409b6-55d | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | contracts | f9a9361b-72e | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | UPDATE | contracts | f9a9361b-72e | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | wedding_couple_members | aa15d933-6ee | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | DELETE | wedding_couple_members | aa15d933-6ee | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | SELECT | supplier_availability | b589c2c2-b8d | block | leaked | **FAIL** | STANDARD |  |
| FORN_A | SELECT | supplier_availability | f2a203d9-678 | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | UPDATE | supplier_availability | f2a203d9-678 | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | DELETE | supplier_availability | f2a203d9-678 | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | SELECT | services | df90b1a4-45c | block | blocked-silent | PASS | STANDARD |  |
| FORN_A | UPDATE | services | df90b1a4-45c | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | SELECT | quote_items | 19c0213f-85b | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | UPDATE | quote_items | 19c0213f-85b | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | SELECT | quotes | 6f28202a-846 | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | SELECT | calendar_entries | 0d7678d2-30d | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | SELECT | event_guests | b82a38b7-5ff | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | SELECT | mood_images | 6974d189-387 | block | blocked-silent | PASS | CRITICAL |  |
| FORN_A | SELECT | couple_preferences | 079409b6-55d | block | blocked-silent | PASS | CRITICAL |  |
| FORN_B | SELECT | quote_items | 19c0213f-85b | allow | allowed(1) | PASS | STANDARD |  |
| FORN_B | SELECT | quotes | de516480-2a4 | info | 0 rows | PASS | INFO |  |
| FORN_B | SELECT | quote_items | e4913fce-2f9 | block | blocked-silent | PASS | CRITICAL |  |
| FORN_B | SELECT | calendar_entries | 1c55dd47-e31 | block | leaked | **FAIL** | CRITICAL |  |
| FORN_B | SELECT | couple_preferences | ae5d0114-6c5 | block | blocked-silent | PASS | CRITICAL |  |
| FORN_B | SELECT | event_playlist | eb2f216d-ced | block | leaked | **FAIL** | CRITICAL |  |
| COUPLE_C | SELECT | calendar_entries | 0d7678d2-30d | block | blocked-silent | PASS | CRITICAL |  |
| COUPLE_C | UPDATE | calendar_entries | 0d7678d2-30d | block | blocked-silent | PASS | CRITICAL |  |
| COUPLE_C | DELETE | calendar_entries | 0d7678d2-30d | block | blocked-silent | PASS | CRITICAL |  |
| COUPLE_C | SELECT | quotes | 6f28202a-846 | block | blocked-silent | PASS | CRITICAL |  |
| COUPLE_C | SELECT | quotes | c18cd9c5-332 | block | blocked-silent | PASS | CRITICAL |  |
| COUPLE_C | SELECT | calendar_entries | 7a19a8a2-75a | allow | allowed(1) | PASS | STANDARD |  |
| ANON | SELECT | quotes | c18cd9c5-332 | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | quote_items | 19c0213f-85b | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | calendar_entries | 242e454f-c3c | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | profiles | 712baed0-395 | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | supplier_availability | b589c2c2-b8d | block | blocked-silent | PASS | STANDARD |  |
| ANON | SELECT | wedding_couple_members | 00000000-000 | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | collaborations | 00000000-000 | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | supplier_invites | 00000000-000 | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | couple_preferences | 079409b6-55d | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | event_guests | b82a38b7-5ff | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | mood_images | 6974d189-387 | block | blocked-silent | PASS | CRITICAL |  |
| ANON | SELECT | beta_status | supplier | allow | allowed(1) | PASS | STANDARD |  |
| ANON | UPDATE | beta_status | supplier | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | UPDATE | beta_status | supplier | block | blocked-silent | PASS | CRITICAL |  |
| WP_A | INSERT | quotes | {"owner_id": | block | blocked-silent | PASS | CRITICAL | new row violates row-level security policy for table "quotes" |
| FORN_A | INSERT | supplier_availability | {"fornitore_ | block | blocked-silent | PASS | CRITICAL | new row violates row-level security policy for table "supplier_availability" |
| COUPLE_C | INSERT | quotes | {"owner_id": | block | blocked-silent | PASS | CRITICAL | new row violates row-level security policy for table "quotes" |
| ANON | INSERT | quotes | {"owner_id": | block | blocked-silent | PASS | CRITICAL | new row violates row-level security policy for table "quotes" |
| ANON | INSERT | profiles | {"id":"00000 | block | blocked-silent | PASS | CRITICAL | new row violates row-level security policy for table "profiles" |
| WP_A | INSERT | event_guests | {"entry_id": | block | blocked-silent | PASS | CRITICAL | new row violates row-level security policy for table "event_guests" |
| COUPLE_C | INSERT | event_guests | {"entry_id": | block | blocked-silent | PASS | CRITICAL | new row violates row-level security policy for table "event_guests" |
| COUPLE_C | INSERT | mood_images | {"entry_id": | block | blocked-silent | PASS | CRITICAL | new row violates row-level security policy for table "mood_images" |
| WP_A | RPC | my_quote_conflict_alerts | - | own-only | 0 rows | PASS | INFO |  |
| WP_B | RPC | my_quote_conflict_alerts | - | own-only | 0 rows | PASS | INFO |  |
| FORN_A | RPC | my_quote_conflict_alerts | - | own-only | 0 rows | PASS | INFO |  |
| FORN_B | RPC | my_quote_conflict_alerts | - | own-only | 0 rows | PASS | INFO |  |
| COUPLE_C | RPC | my_quote_conflict_alerts | - | own-only | 0 rows | PASS | INFO |  |
| ANON | RPC | my_quote_conflict_alerts | - | block | leaked(0) | PASS | CRITICAL |  |
| ANON | RPC | contract_get_by_token(bogus) | - | block | blocked | PASS | CRITICAL |  |
| FORN_A | RPC | contract_get_by_token(bogus) | - | block | blocked | PASS | CRITICAL |  |
| COUPLE_C | RPC | contract_get_by_token(bogus) | - | block | blocked | PASS | CRITICAL |  |
| FORN_A | STORAGE_UPLOAD | service-photos | a0262dd1-f07 | block | denied(new row violates row-level security policy) | PASS | CRITICAL | new row violates row-level security policy |
| COUPLE_C | STORAGE_UPLOAD | service-photos | a0262dd1-f07 | block | denied(new row violates row-level security policy) | PASS | CRITICAL | new row violates row-level security policy |
| ANON | STORAGE_UPLOAD | service-photos | a0262dd1-f07 | block | denied(new row violates row-level security policy) | PASS | CRITICAL | new row violates row-level security policy |
| ANON | STORAGE_LIST | quote-pdfs | - | block | blocked | PASS | CRITICAL |  |
| ANON | STORAGE_LIST | quote-signatures | - | block | blocked | PASS | CRITICAL |  |
| ANON | STORAGE_LIST | event-documents | - | block | blocked | PASS | CRITICAL |  |

## CRITICAL leaks

- FORN_B/SELECT/calendar_entries/1c55dd47-e31f-4caa-a0d1-bc94d6c9a3bf: actual=leaked err=
- FORN_B/SELECT/event_playlist/eb2f216d-ced9-4406-884d-2056a5cbd901: actual=leaked err=