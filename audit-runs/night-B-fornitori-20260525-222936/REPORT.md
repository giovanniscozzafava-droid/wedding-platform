# AUDIT FORNITORI — Night B

- Data: 2026-05-25T20:59:16.581Z
- Prod: https://planfully.it
- Suppliers: B-FOTO=forn-mini-foto@planfully-demo.it, B-FIORI=forn-mini-fiori@planfully-demo.it, B-CATER=forn-beta-catering@planfully-demo.it

## Riepilogo Bug

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 4 |
| MEDIUM | 1 |
| LOW | 3 |
| INFO | 0 |

## Bug Dettagliati

### [HIGH] [B-FOTO] [brand-pdf] Fornitore Marco Bianchi Photography ha tier=FREE → PDF preventivo userà brand NEUTRO hardcoded (#1A2E4F) invece di brand fornitore
> quote-generate-pdf line 76-80

### [HIGH] [B-FOTO] [cookie-banner-ux] CookieBanner z-100 intercetta i click sui modali z-50 (impossibile chiudere il modale o submitare senza chiudere il banner)
> locator.click: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('button[type="submit"]:has-text("Crea")').first()
    - locator resolved to <button type="submit" class="inline-flex items-cen

### [HIGH] [B-FIORI] [brand-pdf] Fornitore Sofia Fiori e Decorazioni ha tier=FREE → PDF preventivo userà brand NEUTRO hardcoded (#1A2E4F) invece di brand fornitore
> quote-generate-pdf line 76-80

### [HIGH] [B-CATER] [brand-pdf] Fornitore Esposito Banqueting ha tier=FREE → PDF preventivo userà brand NEUTRO hardcoded (#1A2E4F) invece di brand fornitore
> quote-generate-pdf line 76-80

### [MEDIUM] [B-FOTO] [disponibilita] Sezione "Prossime date bloccate" non visibile anche dopo seed BUSY futuro
> date=2027-07-31

### [LOW] [B-FOTO] [catalog] Nessuna UI import Instagram/Pinterest/URL nel form nuovo servizio

### [LOW] [B-FIORI] [catalog] Nessuna UI import Instagram/Pinterest/URL nel form nuovo servizio

### [LOW] [B-CATER] [catalog] Nessuna UI import Instagram/Pinterest/URL nel form nuovo servizio


## Per Fornitore — Sezioni Verificate

### B-FOTO — Marco Bianchi Photography (FOTO) (forn-mini-foto@planfully-demo.it)

| Sezione | Stato | Nota |
|---|---|---|
| Login | PASS | https://planfully.it/ |
| Beta banner | PASS | visibile |
| Beta price | PASS | €29/mese mostrato |
| KPI dashboard | PASS |  |
| Nav forbidden links | PASS | nessuna voce vietata |
| Crea cliente diretto | PASS | id=8837f58c-c7eb-4a33-b83c-ab02f1455134 |
| Preventivo diretto da cliente | PASS | https://planfully.it/quotes/1977cf74-2df3-403e-8ac7-4aea3029fb45 |
| Quote editor: nome cliente prefilled | PASS |  |
| Quote item seed via DB | PASS | item_id=d7da8fe7-e2e6-4566-8eea-4b6fb3beb4a2 |
| PDF preventivo diretto generato | PASS | NEUTRA → /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/night-B-fornitori-20260525-222936/pdfs/B-FOTO-quote-direct.pdf (12858 byte) |
| Catalogo crea servizio | PASS | 7e84029b-c5a3-4457-ad21-a181d9fb7d51 |
| Catalogo isolamento | INFO | own=4 altri esistono nel DB (RLS deve filtrare in UI) |
| Disponibilita page render | PASS |  |
| Disponibilita ciclo click | PASS | 31 celle |
| Calcolatore render | PASS |  |
| Quotes list | PASS |  |
| Contracts page | PASS |  |
| Calendar earnings hook | INFO | nessun testo earnings (potrebbe non avere contratti attivi) |
| Settings brand | PASS |  |
| Profile | PASS |  |
| RLS /weddings/:id non partecipato | PASS | AppShell blocca via roles=WEDDING_PLANNER/LOCATION/ADMIN |
| Trigger block_busy_supplier_on_quote_item | PASS | bloccato: Fornitore non disponibile il 2027-06-11. Verifica calendario disponibilita`. |

### B-FIORI — Sofia Fiori e Decorazioni (FIORI) (forn-mini-fiori@planfully-demo.it)

| Sezione | Stato | Nota |
|---|---|---|
| Login | PASS | https://planfully.it/ |
| Beta banner | PASS | visibile |
| Beta price | PASS | €29/mese mostrato |
| KPI dashboard | PASS |  |
| Nav forbidden links | PASS | nessuna voce vietata |
| Crea cliente diretto | PASS | id=1c28d56a-79f3-4c45-bb1e-70b2cdbb340a |
| Preventivo diretto da cliente | PASS | https://planfully.it/quotes/5eb2c784-a8e6-43c2-b681-f5e6c29f477f |
| Quote editor: nome cliente prefilled | PASS |  |
| Quote item seed via DB | PASS | item_id=eb46b09c-76a6-4cdd-ab86-b5d2fc71f792 |
| PDF preventivo diretto generato | PASS | NEUTRA → /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/night-B-fornitori-20260525-222936/pdfs/B-FIORI-quote-direct.pdf (12898 byte) |
| Catalogo crea servizio | PASS | 68c0cf17-de8a-418b-ac19-f728d775d041 |
| Catalogo isolamento | INFO | own=4 altri esistono nel DB (RLS deve filtrare in UI) |
| Disponibilita page render | PASS |  |
| Sezione prossime date bloccate | PASS |  |
| Disponibilita ciclo click | PASS | 31 celle |
| Calcolatore render | PASS |  |
| Quotes list | PASS |  |
| Contracts page | PASS |  |
| Calendar earnings hook | INFO | nessun testo earnings (potrebbe non avere contratti attivi) |
| Settings brand | PASS |  |
| Profile | PASS |  |
| RLS /weddings/:id non partecipato | PASS | AppShell blocca via roles=WEDDING_PLANNER/LOCATION/ADMIN |
| Trigger block_busy_supplier_on_quote_item | PASS | bloccato: Fornitore non disponibile il 2027-06-11. Verifica calendario disponibilita`. |

### B-CATER — Catering (CATER, fallback) (forn-beta-catering@planfully-demo.it)

| Sezione | Stato | Nota |
|---|---|---|
| Login | PASS | https://planfully.it/ |
| Beta banner | PASS | visibile |
| Beta price | PASS | €29/mese mostrato |
| KPI dashboard | PASS |  |
| Nav forbidden links | PASS | nessuna voce vietata |
| Crea cliente diretto | PASS | id=57b12c26-9334-49fc-a90d-64934317a600 |
| Preventivo diretto da cliente | PASS | https://planfully.it/quotes/a534b680-9fc1-451a-89ed-d85b59e29a3d |
| Quote editor: nome cliente prefilled | PASS |  |
| Quote item seed via DB | PASS | item_id=1f07306f-54fe-46ad-b82c-88ce45f30fd9 |
| PDF preventivo diretto generato | PASS | NEUTRA → /Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/night-B-fornitori-20260525-222936/pdfs/B-CATER-quote-direct.pdf (12840 byte) |
| Catalogo crea servizio | PASS | f6175aac-86db-4dee-b740-33dd3a52b419 |
| Catalogo isolamento | INFO | own=4 altri esistono nel DB (RLS deve filtrare in UI) |
| Disponibilita page render | PASS |  |
| Sezione prossime date bloccate | PASS |  |
| Disponibilita ciclo click | PASS | 31 celle |
| Calcolatore render | PASS |  |
| Quotes list | PASS |  |
| Contracts page | PASS |  |
| Calendar earnings hook | INFO | nessun testo earnings (potrebbe non avere contratti attivi) |
| Settings brand | PASS |  |
| Profile | PASS |  |
| RLS /weddings/:id non partecipato | PASS | AppShell blocca via roles=WEDDING_PLANNER/LOCATION/ADMIN |
| Trigger block_busy_supplier_on_quote_item | PASS | bloccato: Fornitore non disponibile il 2027-06-11. Verifica calendario disponibilita`. |

