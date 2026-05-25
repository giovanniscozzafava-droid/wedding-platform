# E2E Conflict / Standalone / Beta Banner — REPORT

**Run:** 2026-05-25T20-06-23
**Target:** https://planfully.it
**DB:** https://zfwlkvqxfzvubmfyxofs.supabase.co

## Sintesi
- **Scenario A:** 8/10 step pass
- **Scenario B:** 4/6 step pass
- **Scenario C:** 3/4 step pass
- **Scenario D:** 5/9 step pass
- **BUG totali:** 6 (CRITICAL: 4, HIGH: 2, MEDIUM: 0)

## Scenario A
- PASS — 1 WP crea preventivo (quote 45983996-fb49-4098-86d7-e70cd7177245)
- PASS — 2 voce fornitore aggiunta
- PASS — 3 nessun alert prima del quote diretto (alerts=0)
- PASS — 4a cliente diretto fornitore creato
- PASS — 4b quote diretto fornitore creato (quote 239e8003-5389-4602-9ff6-ef472e72329f)
- FAIL — 5 WP vede alert HIGH
- FAIL — 5 Fornitore vede alert HIGH
- PASS — 6 availability TENTATIVE su INVIATO (status=TENTATIVE)
- PASS — 7 availability BUSY su ACCETTATO (status=BUSY)
- PASS — 8 block_busy_supplier_on_quote_item rifiuta voce (Fornitore non disponibile il 2027-04-17. Verifica calendario disponibilita`.)

## Scenario B
- PASS — 1 WP crea preventivo (quote 4d4cf7b8-dc36-4c59-b41b-d690a8dc644f)
- PASS — 2 voce fornitore
- PASS — 3 cliente diretto creato
- PASS — 4 quote diretto fornitore creato
- FAIL — 5 WP vede alert con LOCATION_MATCH (no email/name) (severity=undefined signals=undefined)
- FAIL — 5b Fornitore vede alert (severity=undefined signals=undefined)

## Scenario C
- PASS — 1 profilo fornitore con brand ({"business_name":"Marco Bianchi Photography","brand_logo_url":"https://api.dicebear.com/9.x/initials/svg?seed=Marco%20Bianchi%20Photography&backgroundColor=1A2E4F&fontWeight=700&fontSize=42&textColor=ffffff","brand_primary_color":"#1A2E4F","role":"FORNITORE","subrole":"fotografo","full_name":"Marco Bianchi"})
- PASS — 2 quote diretto creato (quote f57ce843-6c5c-412b-b8f6-4cc79ce93f77)
- PASS — 3 edge function risponde ({"ok":true,"url":"https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/sign/quote-pdfs/f57ce843-6c5c-412b-b8f6-4cc79ce93f77/v1.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9kZmM5YzFhZC01Y)
- FAIL — 4 PDF response shape (keys=ok,url,key,variant,premium_applied)

## Scenario D
- PASS — 0 tabella beta_status accessibile (rows=2)
- PASS — 1 banner Beta visibile per WP ("beta" trovato in pagina)
- PASS — 1b testo specifico WP (partner fondatori/gratis fino al) (OK)
- FAIL — WP login flow (locator.count: Unexpected token "=" while parsing css selector "button:has-text("scopri di"), text=/scopri di pi/i". Did you mean to CSS.escape it?)
- PASS — 4 banner Beta visibile per Fornitore (OK)
- PASS — 4b testo "€29/mese" o "ottobre 2026" per fornitore (OK)
- FAIL — 5 banner ConflictAlerts visibile per fornitore (Scenari A/B attivi) (NON visibile)
- FAIL — 6 bottone Sblocca presente in /disponibilita (non trovato)
- FAIL — 7 ConflictAlertsBanner visibile in dashboard WP (NON visibile (Scenari A+B dovrebbero produrre alert))

## BUG
### [CRITICAL] WP non vede alert HIGH EMAIL_MATCH
**Repro:** WP crea quote con email X + voce supplier S; S crea quote diretto stessa email stessa data; chiamare my_quote_conflict_alerts come WP
**Expected:** Riga con conflict_severity=HIGH, match_signals contiene EMAIL_MATCH + DATE_MATCH
**Actual:** alerts=[]

### [CRITICAL] Fornitore non vede alert HIGH EMAIL_MATCH
**Repro:** Setup come sopra; chiamare RPC come fornitore
**Expected:** Riga HIGH
**Actual:** alerts=[]

### [CRITICAL] Disintermediazione mascherata non rilevata da WP (LOCATION_MATCH)
**Repro:** WP crea quote con location L + voce fornitore F; F crea quote diretto stessa data, stessa location, nome+email DIVERSI; chiamare my_quote_conflict_alerts come WP
**Expected:** Riga con conflict_severity=MEDIUM, match_signals=[LOCATION_MATCH, DATE_MATCH]
**Actual:** alerts=[]

### [CRITICAL] Fornitore non vede alert disintermediazione mascherata
**Repro:** Vedi B
**Expected:** Alert con LOCATION_MATCH
**Actual:** alerts=[]

### [HIGH] ConflictAlertsBanner non si renderizza in dashboard fornitore nonostante alert RPC
**Repro:** Fornitore con quote diretto in conflitto, apre dashboard
**Expected:** Banner visibile con conteggio alert HIGH
**Actual:** Nessun testo "conflitto/alert/disintermediazione" trovato nel body della home

### [HIGH] ConflictAlertsBanner non visibile lato WP
**Repro:** WP ha 2 quote con alert HIGH+MEDIUM via RPC. Apre dashboard.
**Expected:** Banner rosa con n. conflitti
**Actual:** banner assente

## NOTES
- beta_status rows: [{"role":"supplier","is_beta":true,"free_until":"2026-09-30","planned_price":29,"planned_currency":"EUR","planned_period":"mensile","message_short":"Sei in Beta gratuita. Da ottobre 2026: €29/mese.","message_long":"Stai usando Planfully durante la fase beta privata. L'utilizzo è gratuito fino al 30 settembre 2026. A partire da ottobre 2026 sarà attivo il piano Pro a €29/mese (illimitato). I dati che inserisci ora rimarranno tuoi e migreranno automaticamente sul piano a pagamento.","updated_at":"2026-05-25T19:01:49.521564+00:00"},{"role":"wedding_planner","is_beta":true,"free_until":null,"planned_price":null,"planned_currency":"EUR","planned_period":null,"message_short":"Sei in Beta. Il servizio resterà gratuito per i partner fondatori.","message_long":"Come WP partner fondatrice, l'utilizzo di Planfully resterà gratuito anche dopo la fase beta. Ti ringraziamo per il prezioso feedback.","updated_at":"2026-05-25T19:01:49.521564+00:00"}]

## File
- /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/conflict-test-2026-05-25T20-06-23/scenario-C-quote.pdf
- Screenshot in /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/conflict-test-2026-05-25T20-06-23
- /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/conflict-test-2026-05-25T20-06-23/results.json