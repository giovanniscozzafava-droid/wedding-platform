# Planfully — Audit Notturno E2E
**Data**: 2026-05-25
**Versione piattaforma**: main @ d5a24ac
**Esecutore**: Claude Opus 4.7 (autonomous mode)

---

## TL;DR

**84 check passati / 0 bug aperti.**

- DB+API audit: **40/0** (`scripts/e2e-audit.mjs`)
- UI audit (Playwright, 3 ruoli): **44/0** (`scripts/e2e-ui-audit.mjs`)
- 2 bug reali trovati durante esecuzione + fixati in-flight
- 1 issue residuo non-bloccante (PDF cover centering) identificato ma non fixato

La piattaforma regge una simulazione realistica completa di matrimonio: 3 fornitori, 110 invitati, 9 tavoli, 8 voci di preventivo, firma elettronica, contratto, 10 mood images, 10 brani playlist, 9 momenti scaletta, 3 trasporti con 120 assegnazioni, 2 alloggi con 40 assegnazioni, mix pagamenti SALDATO/ACCONTO/NON_PAGATO.

---

## 1. Cosa è stato simulato

### Attori
| Ruolo | Email | Note |
|---|---|---|
| WP | wp-mini@planfully-demo.it | Sara De Luca |
| Sposi | giovanni.scozzafava+sposo@gmail.com | Andrea & Sofia |
| Fornitore foto | forn-mini-foto@planfully-demo.it | Luca Marchetti |
| Fornitore fiori | forn-mini-fiori@planfully-demo.it | Chiara Bellini |
| Fornitore catering | forn-mini-cater@planfully-demo.it | Marco Ricci |

### Pipeline coperta (11 fasi)
1. Reset stato → cleanup utenti+wedding test
2. Signup 3 fornitori + collaborazioni ACTIVE con WP
3. Catalogo servizi (3 foto, 3 fiori, 2 catering) + disponibilità 2026
4. Wedding "Andrea e Sofia" — 2026-09-15, location Calabria, budget 38k
5. Preventivo con 8 voci, totale **€ 21.585,50**, PDF brandato generato
6. Invio preventivo, firma elettronica (FES art. 20 CAD) coppia, accept token
7. Contratto generato firmato, immutabile
8. 9 tavoli, 110 invitati, mood 10 foto, playlist 10 brani, checklist 10 task
9. Scaletta giornata 9 momenti, 2 alloggi, 3 trasporti, 120 assegnazioni transport, 40 alloggio
10. Mix pagamenti (SALDATO/ACCONTO/NON_PAGATO) per testare earnings fornitore
11. Verifica RLS multi-ruolo (sposi vede solo i suoi dati, fornitore solo le sue voci)

### UI (Playwright headless, 3 contesti separati)
- **WP**: sidebar 11 voci nav, lista 4 matrimoni, dettaglio wedding (Tavoli/Invitati/Contratto), 8 fornitori in rete, 6 preventivi, finanziamento+assicurazione COMING SOON
- **Sposi**: dashboard, footer, logo Planfully SVG, 8 tab (Overview/Documenti/Programma/Invitati/Tavoli/Mood/Playlist/Sito ospiti)
- **Fornitore**: nav Disponibilità/Calcolatore/Catalogo, niente Finanziamento, pagine calendar/disponibilita/calcolatore/catalogo caricano

---

## 2. Bug trovati + fixati durante l'audit

### Bug #1 — RLS gap: fornitore non vedeva le proprie voci di preventivo
**Severità**: HIGH (silenzioso, blocca earnings tracking)

**Scoperta**: alla fase di verifica RLS multi-ruolo, query `quote_items where supplier_id = auth.uid()` restituiva 0 righe per il fornitore, anche se in DB esistevano 3 voci a lui assegnate.

**Causa**: l'unica policy SELECT su `quote_items` era `qitems_select_via_quote`, che filtrava per `quote.owner_id = auth.uid()` → solo il WP owner del preventivo poteva leggere. Il fornitore era escluso.

**Fix**: nuova migration `20260525090000_fix_qitems_supplier_select.sql`
```sql
create policy "qitems_select_supplier"
  on quote_items for select
  using (supplier_id = auth.uid());
```
Applicato su cloud DB. Test di re-verifica: fornitore foto vede esattamente 3 voci proprie ✅.

**Impatto se non fixato**: il calendario fornitore mostrava € 0 di earnings invece del proprio fatturato → componente `useSupplierEarnings` sarebbe stato funzionalmente rotto in produzione.

---

### Bug #2 — Enum case sensitivity su `couple_preferences.styles`
**Severità**: LOW (solo audit harness, mai esposto a utente)

**Scoperta**: insert in `couple_preferences` falliva con `invalid input value for enum couple_style: "Classic elegance"`.

**Causa**: l'enum DB ha valori uppercase italiano (`CLASSICO`, `ROMANTICO`, ecc.). Lo script di test usava label inglese in formato libero.

**Fix**: corretto nell'audit script — `styles: ['CLASSICO']`. Nessuna modifica al codice prod (UI usa il select corretto).

**Lezione**: l'enum dovrebbe avere un commento `comment on type couple_style is '...'` con la lista valori per evitare confusione futura.

---

## 3. Issue residui (non bloccanti)

### Issue #1 — PDF preventivo: centratura titolo cover
**Severità**: COSMETIC

Il titolo sul PDF di copertina non è perfettamente centrato — bug noto di jsPDF quando si combinano `charSpace` (letter-spacing) + `align: 'center'`: la funzione di centratura non compensa lo spazio extra introdotto da `charSpace`.

**Soluzione proposta**:
```typescript
// In supabase/functions/pdf-generate/cover.ts (o equivalente)
// Calcolo manuale larghezza con charSpace:
const text = 'PREVENTIVO MATRIMONIO'
const charSpace = 0.8
const baseWidth = doc.getTextWidth(text)
const realWidth = baseWidth + (text.length - 1) * charSpace
const x = (pageWidth - realWidth) / 2
doc.text(text, x, y, { charSpace })  // NO align:'center'
```

Non fixato in questo audit per evitare regressioni sul PDF in produzione senza una verifica visuale completa. Da affrontare in PR dedicata.

### Issue #2 — Storage assets temp
Cartella `tmp-atrio-preview/` e altri artefatti `.temp/` cambiati in repo skorpio-v3 (sister repo). Non impattano Planfully.

---

## 4. Cosa funziona molto bene

- **RLS multi-ruolo**: dopo il fix #1, l'isolamento è solido — sposi vedono solo i loro dati, fornitori solo le loro voci/wedding partecipati, WP tutto
- **Pipeline preventivo → firma → contratto**: end-to-end senza intoppi, PDF generato e firmato in <8s
- **Email branding**: Resend + dominio verificato, mai bounce nelle 6 run di audit
- **Moodboard PDF editoriale**: 5 capitoli narrativi su 10 immagini, layout grid 4-col, centratura corretta
- **Footer + logo Planfully**: presenti su tutti i ruoli post-fix
- **COMING SOON gating**: finanziamento+assicurazione mostrano placeholder, niente leak di feature non pronte
- **Fornitore non vede "Finanziamento" in sidebar**: corretto a livello menu
- **Instagram CDN proxy**: la chain facebookexternalhit → Chrome UA → wsrv.nl regge i carosello IG

---

## 5. Raccomandazioni operative

### Priorità immediata
1. **Re-run audit dopo ogni deploy main**: aggiungere `scripts/e2e-audit.mjs` + `scripts/e2e-ui-audit.mjs` in un workflow Vercel post-deploy (anche nightly cron va bene)
2. **Monitorare la nuova policy supplier RLS** in produzione: se compare `permission denied` su `quote_items` per fornitori, verificare che `supplier_id` sia popolato correttamente sull'insert
3. **PR per fix PDF cover centering** prima del lancio beta pubblico

### Debito tecnico minore
- `comment on type couple_style` per documentare enum values
- Hardening: `tmp-atrio-preview/` e `supabase/.temp/*` aggiungere a `.gitignore` per evitare drift
- Considerare audit logging strutturato (json) per le pipeline edge-functions (oggi solo console.log)

### Sicurezza
- ✅ Service key non leakate in client
- ✅ FES su quote signature (art. 20 CAD + art. 1326 c.c.)
- ✅ Contratto immutabile post-firma (vista prosa, no form disabled forzabile)
- ⚠️ Verificare: il bucket `quote-signatures` ha policy strict? Una firma è un atto giuridico, l'accesso pubblico anche solo via signed URL prolungata è un rischio
- ⚠️ Verificare: `audit-runs/` non deve essere mai pushato in produzione (aggiungere a gitignore o tenerlo solo localmente)

---

## 6. Numeri raw

```
DB+API audit:
  durata: ~45s
  pass: 40
  bug: 0 (dopo fix #1 e #2)
  wedding creato: c1b8b3bc-d3a0-4398-8f95-32aa81aa5c60
  quote: b40a663c-4de8-4db2-8a49-a27ddbc81c3c (€ 21.585,50, 8 voci, firmato)
  contratto: d631d35d-c0a7-49e0-843c-fdb0ddd536e0
  pagamenti aggiornati: mix SALDATO/ACCONTO/NON_PAGATO

UI audit (Playwright):
  durata: ~90s
  pass: 44
  bug: 0
  screenshots: audit-runs/ui-2026-05-25T07-56-01/*.png (34 frame)
  contesti: 3 (WP, sposi, fornitore foto)
```

---

## 7. Verdetto

**La piattaforma è pronta per la fase beta privata.** Le funzionalità core (preventivo→firma→contratto, gestione invitati, tavoli, mood, playlist, scaletta, trasporti, alloggi, earnings fornitore) sono solide a livello di flusso e RLS.

Le aree da presidiare prima di un eventuale **lancio pubblico**:
1. Fix centratura PDF copertina (cosmetic ma visibile su ogni preventivo)
2. Monitoring strutturato su edge functions
3. Test di carico (l'audit non copre concorrenza, solo correttezza sequenziale)
4. Onboarding flow nuovo utente WP/fornitore (qui simulato via DB, non via signup UI)

Nessun blocker critico. Nessun bug aperto.

---

*Audit condotto in autonomia overnight, 2026-05-24 → 2026-05-25, su istruzione esplicita dell'utente di procedere senza chiedere conferme.*
