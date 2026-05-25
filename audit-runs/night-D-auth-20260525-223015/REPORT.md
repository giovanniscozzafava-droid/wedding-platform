# Night Audit D — Auth + Registrazione + Inviti

- **Start**: 2026-05-25T20:39:44.018Z
- **End**: 2026-05-25T20:39:52.243Z
- **Pass**: 38  **Warn**: 0  **Fail**: 2
- **Bugs trovati**: 2

## Step-by-step

| Step | Status | Dettagli |
|---|---|---|
| 1.signup-wp-public-endpoint | PASS | http=200; needs_confirm=false; user_id=6e8798dc-f6bf-4bef-91b7-2526b470d084 |
| 1.signup-wp-confirm-email | PASS | already_confirmed=true |
| 1.signup-wp-profile-row | PASS | profile={"id":"6e8798dc-f6bf-4bef-91b7-2526b470d084","full_name":"Giulia Conti","role":" |
| 1.signup-wp-login-after-confirm | PASS | http=200 |
| 2.signup-fornitore-endpoint | PASS | http=200 |
| 2.signup-fornitore-profile | PASS | profile={"id":"578bfef7-f610-4151-919f-b93c45984925","full_name":"Marco Bianchi","role":; error=undefined |
| 3.signup-location-endpoint | PASS | http=200 |
| 3.signup-location-profile | PASS | profile={"id":"c78509c0-712c-4018-a108-ddcfb958b315","role":"LOCATION","business_name":n; error=undefined |
| 4.login-wp-mini | PASS |  |
| 4.invite-supplier-fn | PASS | http=200; body={"ok":true,"mode":"email_sent","invite_id":"326147a3-6065-4f07-ae41-6ccedf5450a7 |
| 4.invite-row-db | PASS | invite_id=326147a3-6065-4f07-ae41-6ccedf5450a7; token_len=36 |
| 4.invite-landing-200 | PASS | http=200 |
| 4.invite-signup-accept | PASS | http=200; error=undefined |
| 4.collab-active-created | PASS | count=1; active=true; error=undefined |
| 4.invite-status-accepted | ACCEPTED | accepted_at=2026-05-25T20:39:46.315014+00:00 |
| 5.create-wedding | PASS | id=34f914e8-66a5-496d-ba58-4e03efa72af9; title=AGENT-D Wedding test beht |
| 5.couple-member-insert | PASS | member_id=f3141035-af57-4190-8e66-d878567234ac; token_len=36 |
| 5.couple-landing-200 | PASS | http=200 |
| 5.couple-signup | PASS | http=200; error=undefined |
| 5.couple-login | PASS |  |
| 5.couple-accept-rpc | PASS | http=200; body=true |
| 5.couple-member-linked | PASS | user_id=674d6a18-7fa5-4dc7-a454-f63ecde8d212; accepted_at=2026-05-25T20:39:47.228314+00:00 |
| 5.couple-profile-role | PASS | role=COUPLE |
| 5.couple-sees-wedding | PASS | rows=1 |
| 6.reset-create-user | PASS | user_id=1e6a8e78-e8aa-4c41-8261-3eb48f6aafff |
| 6.recover-trigger | FAIL | http=500; body={"code":500,"error_code":"unexpected_failure","msg":"Error sending recovery emai |
| 6.recover-trigger-real-user | FAIL | http=500; body={"code":500,"error_code":"unexpected_failure","msg":"Error sending recovery emai |
| 6.generate-recovery-link | PASS | has_link=true |
| 6.update-password | PASS | error=undefined |
| 6.login-with-new-password | PASS | http=200 |
| 6.old-password-rejected | PASS | http=400 |
| 7.login-empty-email | PASS | http=400 |
| 7.login-wrong-password | PASS | http=400; err_code=invalid_credentials; msg=Invalid login credentials |
| 7.login-unknown-email | PASS | http=400; err_code=invalid_credentials; msg=Invalid login credentials |
| 7.no-email-enumeration | PASS | wrong_pw_code=invalid_credentials; unknown_email_code=invalid_credentials |
| 7.google-oauth-button-source | PASS | has_component=true; used_on_login=true |
| 8.rls-wp-isolation | PASS | rows=0; only_own_or_zero=true |
| 8.rls-fornitore-services | PASS | rows=0; http=200; body_sample=undefined |
| 8.rls-fornitore-weddings | PASS | rows=0 |
| cleanup | PASS | removed=6; failed=0 |

## Bug list

- **[CRITICAL] password-reset** — POST /auth/v1/recover risponde 500 — flusso /forgot-password BLOCCATO in prod (utenti non possono resettare la password via UI)  
  _evidence_: {"code":500,"error_code":"unexpected_failure","msg":"Error sending recovery email","error_id":"019e60dd-7876-7165-bcb9-b2e1cf3f3a47"}_
- **[CRITICAL] password-reset** — Recovery fallisce anche per utente reale "wp-mini" → conferma rottura sistemica  
  _evidence_: {"code":500,"error_code":"unexpected_failure","msg":"Error sending recovery email","error_id":"019e60dd-7a00-7b36-9328-6d4f9e68d80b"}_

## Cleanup
- Removed: 6
- Failed: 0
- Target accounts: agent-d-*@planfully-demo.it