# Wave 4 — Agent R — Quote Editor Deep — REPORT

**Quote ID**: `f080797f-47cb-462e-9aea-17fba76b2b5e`

**Run dir**: `/Users/giovanniscozzafava/Repository/wedding-platform/audit-runs/wave4-R-quote-editor-deep-20260526-002224`

**Phases**: 9/9 OK

**Bugs**: 4 totali — CRITICAL 0 · HIGH 0 · MEDIUM 3 · LOW 1

## Phases

### p1: Setup quote + voci miste — OK (10.2s)

- [OK] cleanup quote AGENT-R-% — `nessun residuo`
- [OK] cleanup supplier_availability su date di test — `2027-08-15,2027-09-20,2027-10-10,2027-11-22`
- [OK] quote creato via UI — `f080797f-47cb-462e-9aea-17fba76b2b5e`
- [OK] header completato via DB
- [OK] 8 voci inserite — `8/8`
- [OK] total_cost ok — `€19680`
- [OK] total_client ok (25% markup) — `€24600`

### p2: Calcoli automatici — OK (2.2s)

- [OK] PER_GUEST ricalcolato a 150 — `[150,150,150]`
- [OK] PER_TABLE ricalcolato a 15 — `[15]`
- [OK] markup default 25→18 propagato a tutte le voci
- [OK] Override markup 50% applicato solo a "Menu cena" — `€21375`
- [OK] Altre voci mantengono default 18% (no leak override)
- [OK] snapshot_price negativo rifiutato dal DB (check constraint) — `new row for relation "quote_items" violates check constraint "quote_items_snapshot_price_check"`

### p3: Quote items edge cases — OK (0.9s)

- [OK] quantity=0 rifiutato (check quantity > 0) — `new row for relation "quote_items" violates check constraint "quote_items_quantity_check"`
- [OK] quantity=999999 accettato — `line_cost=999999`
- [OK] voci duplicate accettate (atteso per UX)
- [OK] sort_order modificabile (riordino voci)
- [OK] basis FLAT→PER_GUEST con quantity auto-pop applicato (DB richiede quantity esplicita)
- [OK] quote vuoto ammesso (totals=0)

**Bugs in phase**:
- **AGENT-R-001** LOW · validation.qty-max: Nessun upper bound su quantity (999999 accettato). Suggerito guard a livello applicativo (no DB constraint).
- **AGENT-R-002** MEDIUM · validation.empty-label: name_snapshot='' accettato → UI mostrerà voce senza titolo. Aggiungi NOT EMPTY constraint o validation lato app.

### p4: Supplier reassignment + RLS — OK (0.9s)

- [OK] Voce "AGENT-R Servizio Foto Full Day" riassegnata a Fiori
- [OK] RLS: fornitore Foto NON vede più la voce riassegnata
- [OK] RLS: fornitore Fiori vede la voce riassegnata — `AGENT-R Servizio Foto Full Day`
- [OK] supplier_id → null (in-house WP) accettato
- [OK] RLS: dopo null, Fiori non vede più

### p5: Status transitions — OK (14.9s)

- [OK] quote-send invocato — `pdf_url=https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/s`
- [OK] status BOZZA→INVIATO
- [OK] access_token generato — `43f4202d`
- [OK] quote-accept-sign invocato — `{"ok":true,"acceptance_id":"f4fad04b-3945-4200-9507-ff9a6263d942","acceptance_pdf_url":"https://zfwlkvqxfzvubmfyxofs.sup`
- [OK] status INVIATO→ACCETTATO — `accepted_at=2026-05-25T22:32:35.048+00:00`
- [OK] Banner "Preventivo accettato" visibile
- [OK] Campi header in lock (isLocked) — 11 input disabled
- [OK] Bottone "Genera contratto" visibile
- [OK] Navigazione /contracts post-click
- [OK] status ACCETTATO→CONVERTITO_IN_CONTRATTO
- [OK] Contratto inserito (BOZZA, €32331.3) — `afd0630e-9467-4f5e-8da2-b05df38a8418`
- [OK] INVIATO→RIFIUTATO via token funziona

**Bugs in phase**:
- **AGENT-R-003** MEDIUM · status.transitions: WP può tornare INVIATO→BOZZA senza vincoli DB. Le state-machine sono solo client-side (no DB trigger). Cliente potrebbe avere link "scaduto" senza saperlo.
- **AGENT-R-004** MEDIUM · status.transitions: Transition ACCETTATO→RIFIUTATO consentita da DB (nessun trigger di validazione state-machine). Solo UI/RPC la limita.

### p6: PDF generation — OK (4.1s)

- [OK] PDF NEUTRA generato — `https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/sign/quote-pdfs/f0807`
- [OK] PDF NEUTRA scaricato — `18114 bytes`
- [OK] PDF PREMIUM generato (premium_applied=true) — `https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/sign/quote-pdfs/f0807`
- [OK] PDF PREMIUM scaricato — `18193 bytes`
- [OK] PDF i18n+simboli generato — `https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/s`
- [OK] PDF 55 voci generato (paginazione) — `https://zfwlkvqxfzvubmfyxofs.supabase.co/storage/v1/object/s`
- [OK] PDF 55 voci scaricato — `43956 bytes`

### p7: Send + accept (token public route) — OK (3.7s)

- [OK] quote-send eseguito su q3 — `8051e0e8`
- [OK] access_token presente
- [OK] sent_email_log popolato (1 entry)
- [OK] Public preview mostra titolo quote

### p8: Revisioni + forza unlock — OK (0.3s)

- [OK] q4 portato ad ACCETTATO
- [OK] revision incrementato a 2
- [OK] modifica salvata su quote ACCETTATO
- [OK] sent_email_log preservato dopo modifica — `0 entry`

### p9: Cleanup AGENT-R-% — OK (0.2s)

- [OK] cleanup 1 quote AGENT-R%
- [OK] cleanup 1 contract AGENT-R%

## Bug list

### AGENT-R-001 · LOW · validation.qty-max

Nessun upper bound su quantity (999999 accettato). Suggerito guard a livello applicativo (no DB constraint).

### AGENT-R-002 · MEDIUM · validation.empty-label

name_snapshot='' accettato → UI mostrerà voce senza titolo. Aggiungi NOT EMPTY constraint o validation lato app.

### AGENT-R-003 · MEDIUM · status.transitions

WP può tornare INVIATO→BOZZA senza vincoli DB. Le state-machine sono solo client-side (no DB trigger). Cliente potrebbe avere link "scaduto" senza saperlo.

Repro: `UPDATE quotes SET status='BOZZA' WHERE id='f080797f-47cb-462e-9aea-17fba76b2b5e' AND owner_id=auth.uid()`

### AGENT-R-004 · MEDIUM · status.transitions

Transition ACCETTATO→RIFIUTATO consentita da DB (nessun trigger di validazione state-machine). Solo UI/RPC la limita.

