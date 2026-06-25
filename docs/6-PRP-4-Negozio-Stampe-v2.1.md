# PRP · Negozio Stampe (Print Shop)
**Product Requirements Prompt · v2.1 Supabase**

> **Aggiornamento v2.1 — modello di fulfillment.** Cade l'ipotesi "automazione verso il lab". Il flusso reale: il cliente sceglie e paga → il sistema genera una **copia commissione (PDF)** → arriva al **fotografo**, che **gestisce in autonomia come stampare** (con fotocolordigital o chi vuole). Conseguenze: niente integrazione API col lab, niente generazione del file di stampa lato piattaforma in v1, `[D-1]` e `[D-6]` chiusi (vedi §10). Aggiunto in modo esplicito il **ricarico del fotografo** nella catena di prezzo (§6).

---

> ## ⛔ STATO: CONCEPT CONGELATO
> Questo modulo **non si costruisce adesso**. È bloccato dietro il gate strategico:
> 1. Chiusura dei 5 branch di sicurezza (`fix/1–5`) — **FIRMATO terminale in testa**.
> 2. **Stripe collegato** (questo intero modulo vive dietro il feature flag pagamenti, esattamente come `contabilità`).
> 3. Cinque capostipiti veri onboardati.
>
> Questo documento esiste per la disciplina *documenta-prima-di-costruire*. Gli item `[DECISIONE]` vanno chiusi **prima** che Claude Code tocchi una riga. Una volta passato il gate, questa è probabilmente la prima feature sensata da costruire: è già mezza disegnata nel sistema foto/video (cerchio-evento) ed è la prima che fa entrare cassa dal cerchio invece di limitarsi a farla girare.

---

## 0. Posizionamento e tesi

Questo **non è scope nuovo**. È lo **strato commerciale** del sistema foto/video già speccato in roadmap (cerchio-evento, Drive OAuth `drive.file`, vendita granulare per-file dietro feature flag). La "vendita per-file" già prevista *è* questo modulo, qui realizzata.

La tesi vasi comunicanti applicata alle stampe:
- il **fotografo** è un fornitore;
- il **lab** (fotocolordigital, default) è un fornitore;
- la **foto** scorre nel cerchio-evento verso cliente e ospiti;
- l'**ordine** è la monetizzazione di quel flusso;
- il **margine** si spalma tra lab / fotografo / capostipite con la stessa logica di markup dei preventivi.

On-thesis. Al contrario del motore AI di post-produzione (scartato: è un'altra azienda).

---

## 1. Principi non negoziabili (decisioni già prese)

Questi sono **fissati**, non sono `[DECISIONE]`. Non vanno rinegoziati in fase di build.

1. **Preview ≠ originale.** Il cliente mette like e ritaglia su una **preview a bassa risoluzione** (Supabase Storage). L'originale full-res resta sul **Drive del fotografo** e **non transita dalla piattaforma**. In v1 il sistema **non genera il file di stampa**: produce le *istruzioni* (vedi §7).

2. **Viaggiano le coordinate, non il file.** Il crop è salvato come rettangolo **normalizzato** (`x,y,w,h` in 0..1 relativo all'originale) + ratio target + rotazione. Risoluzione-indipendente: si calcola sulla preview e finisce nella **copia commissione**, dove il fotografo lo applica sul proprio originale. Il file pesante non si muove mai.

3. **Guard DPI obbligatorio.** Al momento del crop si calcola il DPI effettivo del ritaglio per il formato scelto. Se non bastano i pixel → **blocco o warning forte prima dell'acquisto**. Non si spediscono stampe sgranate a clienti premium. (Le soglie esatte sono `[DECISIONE D-2]`.)

4. **Like → preferiti, non pop-up sul picco.** Il like alimenta una **raccolta privata "preferiti"**. L'azione "ordina una stampa" è **sempre presente ma silenziosa** (su ogni foto e nella vista preferiti). Niente prompt di vendita che scatta sul picco emotivo del like — quello è il riflesso da marketplace che stiamo evitando. Il desiderio di comprare parte dal cliente quando è pronto. *Il default conta più dell'interruttore.*

5. **Ospiti = ricavo a basso rischio-brand.** Nel cerchio-evento ci sono anche gli ospiti. L'ospite che compra la stampa di sé stesso è ricavo normale e atteso, molto meno a rischio-brand dell'upselling alla coppia. Il modulo deve trattare l'ospite-acquirente come cittadino di prima classe, non come caso limite.

6. **Tutto dietro Stripe.** Senza pagamenti non c'è auto-acquisto. L'intero modulo è dietro feature flag (riuso del pattern `contabilità`).

7. **RLS prima di tutto.** Nessuna riga accessibile senza policy esplicita. Le lezioni dello stress audit valgono qui come altrove (no fail-open, no RPC anon che espone PII, test di impersonazione obbligatori in DoD).

---

## 2. Il fornitore di default e la tassonomia prodotti

Fornitore di default: **fotocolordigital** (`servizioclienti@fotocolordigital.it`, `digitale@fotocolordigital.it`). Modellato come `supplier` nella rete, **non** hardcoded. Domani si aggancia un secondo lab senza toccare il codice.

> ### ✅ Modello di fulfillment (deciso in v2.1)
> Il lab fotocolordigital è un **lab tradizionale, non API-first** (*"ordini solo online"* dal loro software, contrassegno, trasporto a carico del fotografo, responsabili al cellulare). Quindi **non** si tenta l'automazione verso il lab.
>
> Il flusso è: **cliente sceglie e paga (Stripe) → il sistema genera la copia commissione (PDF) → la consegna al fotografo → il fotografo stampa come preferisce** (fotocolordigital o altro) e gestisce spedizione/ritiro.
>
> La piattaforma orchestra la **transazione** e produce il **documento di lavorazione**; il fotografo è il **produttore**. On-thesis: noi siamo la rete e la cassa, non il reparto stampa. Un lab API-first (Prodigi/Gelato) resta opzionale e futuro, se un giorno si vuole lo zero-touch.

Tassonomia (dai listini reali). Quattro categorie, ciascuna con varianti e formati:

| Categoria | Varianti | Asse prezzo | Note dai listini |
|---|---|---|---|
| **Stampa Fine Art** | 6 carte: Hahnemühle Baritata 325, Hahnemühle Photorag 308, Canson Platine Fibre Rag 310, Digitink Satinata 255, Piramid 255, HP Litho Matte 269 | per carta × formato | Plotter HP, gamut +10% scuri, inchiostri ISO 9 garantiti 100+ anni. Consegna 5/6 gg. |
| **Tela Canvas** (cotone) | Solo Tela · Tela con Telaio (2,0/3,7 cm) · **Tela Gallery** (cornice a vista; colori: Laccato Bianco/Nero, Noce, Legno Naturale) | per variante × formato | Inchiostri Epson. Consegna 24/48 h. Gallery solo 6 formati. Demo Gallery 30×45 a 20€. |
| **Cornice in legno** | Profili: Piatta Satinata · Piatta Rigata · Bomberino — da Muro / da Tavolo | per profilo × posizione × formato | Protezione Crilex (no vetro). Colori sul software "Accessori". No urgenze. Consegna 5/6 gg. |
| **Pannello** | Montata: Forex 5mm / Piuma 10mm · Diretta UV: Forex / Piuma / Alluminio (Bianco/Argento) / Plexi (con/senza cornice) · Laminazioni | per tipo × formato | Trasporto a carico fotografo, contrassegno. Max diretta 1,50×3,0 m. |

I prezzi dei listini sono **prezzi LAB (B2B verso il fotografo)** → vedi Appendice A per i numeri seed. Il prezzo al cliente finale = `prezzo_lab × markup` (sezione 6).

---

## 3. Modello dati

Tabelle nuove con prefisso `print_`. Le foto e i preferiti **non si duplicano**: si referenzia il sistema cerchio-evento esistente.

```
print_suppliers          -- lab (riga default: fotocolordigital). Listino = costo per il fotografo.
print_products           -- categoria/prodotto (Fine Art, Tela, Cornice, Pannello)
print_product_variants   -- carta/materiale/profilo/colore (es. "Hahnemühle Baritata", "Tela Gallery Noce")
print_product_formats    -- formato (es. 30x45) → ratio, lato_lungo_cm, lato_corto_cm,
                         --   min_px_lato_lungo (derivato da min_dpi), costo_lab, lead_time_giorni
print_pricing_rules      -- catena prezzo: costo_lab → ricarico_fotografo → [commissione_capostipite]
                         --   → [fee_piattaforma] (sezione 6). Per fotografo, con override per prodotto.
print_orders             -- ordine. buyer_type ENUM(COPPIA, OSPITE, ALTRO), buyer_email,
                         --   event_id (cerchio-evento), photographer_id (chi evade),
                         --   status, stripe_payment_intent, commission_pdf_url, totali snapshot
print_order_items        -- riga: photo_ref (id foto cerchio-evento), variant_id, format_id,
                         --   crop_rect jsonb {x,y,w,h,rot} normalizzato 0..1,
                         --   effective_dpi (snapshot), qty,
                         --   costo_lab_snapshot, ricarico_fotografo_snapshot, price_client_snapshot
print_favorites          -- like del cliente/ospite → raccolta privata. (photo_ref, viewer_id/email, event_id)
                         --   [DECISIONE D-5]: riusare la tabella like esistente del cerchio-evento se già c'è?
```

Convenzioni: UUID `gen_random_uuid()`, snake_case, `created_at/updated_at` con trigger, FK `on delete restrict`, ENUM Postgres.

**Snapshot di prezzo obbligatorio** su `print_order_items`: costo lab, ricarico fotografo, eventuale commissione capostipite e prezzo cliente vengono congelati al checkout. Se un listino cambia dopo, l'ordine resta com'era (stesso principio snapshot+riferimento dei preventivi).

---

## 4. Flusso utente (cliente / ospite)

```
Galleria evento (cerchio-evento esistente)
   │
   ├─ like ──► aggiunge ai PREFERITI (privati). NESSUN pop-up. (like stoppabile dall'utente: già previsto)
   │
   └─ "Ordina una stampa" (sempre visibile, silenzioso, su ogni foto e in vista preferiti)
          │
          ▼
   1. Scegli prodotto  → categoria → variante → formato (dal catalogo lab)
   2. Ritaglia         → crop vincolato al RATIO del formato (il cliente vede esattamente cosa si stampa)
                         → GUARD DPI live: badge verde/giallo/rosso. Rosso = blocco/avviso forte.
   3. Mockup           → anteprima foto nel prodotto: cornice, colore, "dove appendere" (template statici)
   4. Carrello         → più righe, più formati, più foto
   5. Checkout Stripe  → pagamento (cliente/ospite)
          │
          ▼
   6. (post-pagamento) genera la copia commissione (PDF) → al fotografo, che stampa come preferisce
   7. Email conferma al cliente (Resend); stato ordine "In preparazione → Spedito → Consegnato"
```

Note:
- AR "appendi a casa con la fotocamera" = **v2**, vezzo. v1 = mockup statici su template.
- Il selettore colore cornice/Gallery prende i valori dal catalogo (es. Gallery: Bianco/Nero/Noce/Naturale).

---

## 5. Copia commissione (PDF) & guard DPI

### Guard DPI (frontend, live, in fase di crop)
```
crop_px_lato_lungo = originale_px_lato_lungo × crop_rect.w (o .h, lato lungo)
effective_dpi      = crop_px_lato_lungo / (formato_lato_lungo_cm / 2.54)
```
Soglie `[DECISIONE D-2]`. Bozza di partenza: ≥240 ottimo (verde), 150–240 accettabile (giallo, warning), <150 rosso (blocco o conferma esplicita). Le dimensioni in pixel dell'originale vanno lette **senza scaricare il file pesante** (metadati EXIF/Drive). `[DECISIONE D-3]`: come otteniamo width/height dell'originale dal Drive a costo zero.

### Generazione copia commissione (post-checkout — Edge Function `print-commission-pdf`)
Niente file di stampa lato piattaforma in v1. Si genera un **PDF "copia commissione"** (stesso pattern del `quote-generate-pdf` dei preventivi: Handlebars + Puppeteer) destinato al **fotografo**. Contiene tutto ciò che gli serve per produrre senza ambiguità:
1. **Foto sorgente**: nome/ID + miniatura, così sa esattamente quale file aprire sul suo Drive.
2. **Anteprima del ritaglio**: la preview con il riquadro di crop disegnato sopra.
3. **Coordinate crop** (`x,y,w,h,rot` normalizzate) → il fotografo applica il taglio sul proprio originale.
4. **Specifica prodotto**: categoria, variante (carta/profilo/supporto), **colore cornice**, formato in cm, orientamento.
5. **Dati ordine**: acquirente (coppia/ospite), evento, data, numero commissione, indirizzo di spedizione.
6. **Economia (privata al fotografo)**: costo lab, ricarico, prezzo cliente, eventuale commissione capostipite (vedi §6). *Mai* visibile al cliente.

Leggero: nessun pull di file pesanti, nessun processing GPU, nessun ICC. Gira in una Edge Function come gli altri PDF. (Se un domani si vuole zero-touch verso un lab API-first, lì sì servirà la generazione del file di stampa — fuori scope v1.)

---

## 6. Pricing & ricarico (vasi comunicanti)

La catena di prezzo, dal costo al prezzo che vede il cliente:

```
costo_lab (dal listino fotocolordigital — è il COSTO del fotografo, non un prezzo cliente)
  + ricarico_fotografo        ← il margine del fotografo. È LUI a fissarlo. Cuore di questo modulo.
  [+ commissione_capostipite] ← quota del WP/location che porta l'evento (opzionale, override)
  [+ fee_piattaforma]         ← quota Planfully sulla transazione
  = prezzo_cliente_finale
```

**Il ricarico del fotografo è il fulcro.** Il fotografo configura il proprio ricarico (percentuale o importo fisso), con **override per prodotto** se vuole (es. ricarico più alto sulle tele, più basso sulle stampe piccole). Default sensato a livello fotografo, derogabile per `print_product` / `print_product_variant`. Tutto in `print_pricing_rules`.

- `print_pricing_rules` è **tabella dedicata** (non riuso dei preventivi): qui si vende al cliente/ospite finale, contesto diverso. `[DECISIONE D-7]`.
- **Chi incassa e chi paga il lab** `[DECISIONE D-8]`: nel modello v2.1 **il fotografo è il produttore e paga il lab di tasca sua**. Quindi due strade per il denaro: (a) il cliente paga in piattaforma (Stripe) e Planfully gira al fotografo il netto (prezzo − fee − commissione capostipite), oppure (b) split automatico con Stripe Connect. Dipende dalla struttura legale Fuyue — da chiudere prima del build.
- **Spedizione**: a carico del fotografo verso il lab; verso il cliente la gestisce il fotografo. Se si vuole ribaltare un costo di spedizione sul cliente nel prezzo, va modellato. `[DECISIONE D-9]`.
- **IVA**: nei totali snapshot. `[DECISIONE D-10]`.

---

## 7. Fulfillment — il fotografo produce

Modello v2.1, deciso:

1. Ordine pagato (Stripe) → stato `PAGATO`.
2. Edge Function genera la **copia commissione (PDF)** (§5) → stato `COMMISSIONE_PRONTA`.
3. La commissione arriva al **fotografo** (email Resend + in piattaforma) → stato `INVIATA_AL_FOTOGRAFO`.
4. Il **fotografo stampa come preferisce** (fotocolordigital o altro lab), applicando crop e specifiche dalla commissione sul proprio originale.
5. Il fotografo aggiorna lo stato man mano: `IN_PRODUZIONE → SPEDITO → CONSEGNATO`.

`print_orders.status` modella questa sequenza. Niente `print_fulfillment_jobs` né integrazione lab: la produzione è umana, il fotografo è l'attore. Il cliente vede uno stato pulito e non tecnico ("In preparazione → Spedito → Consegnato"); i tempi indicativi vengono dai listini (5/6 gg fine art, 24/48 h tele) ma li conferma il fotografo.

---

## 8. Stripe & feature flag

- Intero modulo dietro flag `feature.print_shop` (pattern identico a `contabilità` frozen).
- Stripe: `PaymentIntent` per ordine. Connect/split → `[DECISIONE D-8]`.
- Webhook Stripe → transizione `print_orders.status` a `PAGATO` + trigger generazione copia commissione. **Attenzione fail-open** (lezione `fix/1`): la verifica firma webhook non deve mai saltare se manca una env var.

---

## 9. Work items (post-gate)

| WI | Descrizione | Stima |
|---|---|---|
| WI-1 | Migrazione schema catalogo (`print_suppliers`, `print_products`, `print_product_variants`, `print_product_formats` con ratio + `min_px` + `base_price_lab` + lead time) | 4 h |
| WI-2 | Seed catalogo dai listini fotocolordigital (Appendice A) | 4 h |
| WI-3 | Migrazione schema ordini (`print_orders`, `print_order_items` con `crop_rect` jsonb + snapshot prezzi/DPI) | 3 h |
| WI-4 | `print_pricing_rules` + funzione calcolo prezzo cliente (lab → markup fotografo → override capostipite) | 4 h |
| WI-5 | RLS completa su tutte le tabelle `print_` (proprietà fotografo, visibilità capostipite, accesso buyer via evento/token, admin) + commenti IT | 6 h |
| WI-6 | Feature flag `print_shop` (riuso pattern contabilità) | 1 h |
| WI-7 | Frontend: componente crop vincolato al ratio (Cropper.js) + **guard DPI live** con badge | 8 h |
| WI-8 | Frontend: mockup compositing su template per prodotto/colore (cornice, ambiente) | 8 h |
| WI-9 | Frontend: flusso preferiti (like→raccolta privata) + entry point "Ordina stampa" silenzioso | 5 h |
| WI-10 | Frontend: carrello + checkout Stripe | 8 h |
| WI-11 | Edge Function `print-commission-pdf`: copia commissione (Handlebars+Puppeteer) con foto, anteprima crop, coordinate, specifiche, dati ordine, economia privata fotografo | 6 h |
| WI-12 | Consegna commissione al fotografo (email Resend + vista in piattaforma) + macchina a stati ordine (`PAGATO → … → CONSEGNATO`) aggiornabile dal fotografo | 5 h |
| WI-13 | Notifiche ordine via Resend (conferma, stati) | 3 h |
| WI-14 | Test: RLS impersonazione, guard DPI, crop coords applicate sull'originale, e2e checkout, test negativo file sgranato | 8 h |

**Totale ≈ 73 h ≈ 9 giornate** — stima a gate chiuso e `[DECISIONE]` risolte. Il modello v2.1 (fotografo produttore) ha già tolto la parte più pesante e rischiosa (D-1 e D-6 chiusi). La decisione che ancora può spostare il numero è D-8 (flusso del denaro).

---

## 10. `[DECISIONE]` aperte — chiudere PRIMA del build

| ID | Decisione | Impatto |
|---|---|---|
| ~~D-1~~ | ~~fotocolordigital ha API / FTP / hot-folder?~~ → **CHIUSO (v2.1):** il fotografo produce, nessuna integrazione lab. | — |
| D-2 | Soglie DPI (verde/giallo/rosso) | UX guard + reso |
| D-3 | Come leggere width/height originale dal Drive senza scaricarlo (per il guard DPI) | Performance guard |
| ~~D-4~~ | ~~Profilo colore / ICC del lab, soft-proof~~ → **CHIUSO (v2.1):** la gestione colore è del fotografo. | — |
| D-5 | Riusare la tabella like esistente del cerchio-evento o `print_favorites` nuova | Modello dati |
| ~~D-6~~ | ~~Dove gira la generazione del file di stampa~~ → **CHIUSO (v2.1):** niente file di stampa lato piattaforma, solo PDF commissione. | — |
| D-7 | `print_pricing_rules` dedicata vs riuso markup preventivi | Modello dati |
| **D-8** | **Flusso del denaro:** incasso piattaforma + giro al fotografo vs Stripe Connect split. Il fotografo paga il lab. + ripartizione fee/commissione capostipite | Legale + pagamenti. **Ora la più importante.** |
| D-9 | Spedizione: chi paga, calcolo, eventuale ribalto sul cliente | Pricing |
| D-10 | IVA nei totali | Pricing/fiscale |

---

## 11. Definition of Done

- [ ] RLS su ogni tabella `print_`, testata con impersonazione (fotografo non vede ordini altrui; buyer vede solo i propri; capostipite vede solo le proprie stampe).
- [ ] Nessun RPC `anon` espone PII o originali.
- [ ] Webhook Stripe **fail-closed** (no skip auth se manca env var).
- [ ] Coordinate crop esportate correttamente nella copia commissione (numeri + anteprima coerenti con ciò che il cliente ha scelto).
- [ ] Guard DPI blocca/avvisa correttamente sotto soglia (test negativo).
- [ ] Prezzi snapshot congelati al checkout, immuni a variazioni listino successive.
- [ ] Originali full-res **non transitano mai** dalla piattaforma (restano sul Drive del fotografo): verificato.
- [ ] Like → preferiti senza pop-up sul picco (verifica UX).

---

## Appendice A — Dati seed (estratti dai listini fotocolordigital)

> Prezzi **LAB / B2B** in €. Sono il `base_price_lab`. Il prezzo al cliente = base × markup.

### A.1 Stampa Fine Art — €/formato per carta
Carte: Hahnemühle Baritata 325 · Hahnemühle Photorag 308 · Canson Platine 310 · Digitink Satinata 255 · Piramid 255 · HP Litho Matte 269. (Baritata = Photorag = Platine, stessa colonna prezzo.)

| Formato | Baritata/Photorag/Platine | Digitink | Piramid | HP Litho Matte |
|---|---|---|---|---|
| 10x15 | 2,08 | 0,70 | 0,83 | 1,25 |
| 13x19,5 | 2,60 | 0,80 | 1,04 | 1,56 |
| 15x22,5 | 3,13 | 1,00 | 1,46 | 1,88 |
| 16x24 | 3,65 | 1,20 | 1,56 | 2,08 |
| 20x30 | 5,21 | 2,00 | 2,29 | 3,13 |
| 24x30 | 6,77 | 2,20 | 2,60 | 3,65 |
| 24x36 | 7,92 | 2,50 | 3,65 | 5,21 |
| 25x35 | 7,81 | 2,50 | 3,65 | 4,69 |
| 30x40 | 11,46 | 3,50 | 4,69 | 6,25 |
| 30x45 | 12,50 | 4,00 | 5,21 | 6,77 |
| 30x60 | 16,67 | 5,00 | 8,33 | 9,38 |
| 30x70 | 18,75 | 6,00 | 8,85 | 10,94 |
| 30x80 | 21,88 | 7,00 | 10,42 | 12,50 |
| 30x90 | 23,96 | 8,00 | 10,94 | 13,54 |
| 35x50 | 15,63 | 5,00 | 7,29 | 8,85 |
| 40x60 | 21,88 | 7,00 | 9,90 | 12,50 |
| 50x50/60 | 26,56 | 9,00 | 12,50 | 15,63 |
| 50x70 | 31,25 | 10,00 | 14,58 | 17,71 |
| 50x75 | 33,33 | 11,00 | 15,63 | 18,75 |
| 60x80 | 42,71 | 14,00 | 19,79 | 25,00 |
| 60x90 | 47,92 | 16,00 | 21,88 | 28,13 |
| 60x100 | 53,13 | 18,00 | 25,00 | 31,25 |

### A.2 Tela Canvas — €/formato per variante
Telaio a metro 10,00 · Tela a mq 52,85 (fuori misura).

| Formato | Solo Tela | Con Telaio | Gallery |
|---|---|---|---|
| 20x30 | 4,68 | 11,65 | 14,40 |
| 24x30 | 4,68 | 13,13 | — |
| 24x36 | 4,68 | 15,37 | — |
| 30x30 | 5,92 | 13,13 | 17,20 |
| 30x40 | 7,81 | 16,57 | — |
| 30x45 | 8,38 | 16,57 | 24,40 |
| 30x60 | 10,71 | 21,50 | — |
| 30x70 | 13,04 | 23,85 | — |
| 30x90 | 15,99 | 31,61 | — |
| 30x100 | 15,99 | 41,76 | — |
| 40x40 | 10,45 | 19,10 | — |
| 40x50 | 12,30 | 22,70 | — |
| 40x60 | 14,40 | 24,96 | 33,00 |
| 40x70 | 17,67 | 30,94 | — |
| 40x80 | 18,87 | 32,26 | — |
| 40x100 | 21,14 | 48,89 | — |
| 50x60 | 16,79 | 29,95 | — |
| 50x70 | 20,15 | 33,03 | 37,60 |
| 50x80 | 21,27 | 35,97 | — |
| 50x100 | 31,11 | 46,72 | — |
| 60x70 | 26,90 | 41,79 | — |
| 60x90 | 29,50 | 45,04 | — |
| 60x100 | 37,65 | 52,41 | — |
| 70x80 | 37,65 | 52,41 | — |
| 70x90 | 37,65 | 52,41 | — |
| 70x100 | 37,65 | 52,41 | 57,60 |
| 80x100 | 42,27 | 77,94 | — |
| 90x100 | 47,57 | 85,23 | — |

Gallery: colori Laccato Bianco / Laccato Nero / Noce / Legno Naturale. Solo 6 formati (sopra). Demo 30x45 a 20,00€.

### A.3 Cornice in legno — €/formato (da Muro; da Tavolo solo fino a 20x30)
Profili Piatta Satinata / Piatta Rigata / Bomberino. Da Muro: stesso prezzo per i 3 profili. Protezione Crilex. Colori sul software "Accessori".

| Formato | Da Muro (tutti i profili) | Da Tavolo (P.Sat / P.Rig / Bomb) |
|---|---|---|
| 10x15 | 1,65 | 2,30 / 2,30 / 2,30 |
| 13x18 | 1,90 | 2,55 / 2,55 / 2,55 |
| 15x20 | 2,30 | 3,00 / 3,00 / 3,00 |
| 18x24 | 2,65 | 3,15 / 3,15 / 3,15 |
| 20x25 | 2,85 | 3,65 / 3,65 / 3,65 |
| 20x30 | 3,30 | 4,25 / 4,25 / 4,25 |
| 21x29,7 (A4) | 3,30 | n.d. |
| 24x30 | 3,55 | n.d. |
| 30x40 | 5,10 | n.d. |
| 30x45 | 5,40 | n.d. |
| 35x50 | 6,10 | n.d. |
| 40x60 | 8,15 | n.d. |
| 50x70 | 10,10 | n.d. |

(Kit Vetrina 15x20 esiste — set di cornici colori misti — modellabile come prodotto a parte se serve.)

### A.4 Pannelli — €/formato (estratto; tabella completa nei PDF)
Stampa montata (copia inclusa): Forex 5mm / Piuma 10mm. Stampa diretta UV: Forex / Piuma / Alluminio Bianco / Alluminio Argento / Plexi 5mm / Plexi con cornice. Laminazioni a parte.

| Formato | Montata Forex 5 | Montata Piuma 10 | UV Forex 5 | UV Piuma 10 | UV Alu Bianco | UV Alu Argento |
|---|---|---|---|---|---|---|
| 20x30 | 6,81 | 8,40 | 3,99 | 5,01 | 8,17 | 9,83 |
| 30x40 | 8,66 | 11,61 | 5,80 | 8,25 | 13,17 | 14,83 |
| 40x60 | 17,59 | 20,99 | 11,01 | 15,41 | 26,50 | 29,83 |
| 50x70 | 25,64 | 30,08 | 14,02 | 19,82 | 34,83 | 39,83 |
| 70x100 | 56,84 | 63,46 | 25,82 | 41,04 | 51,50 | 65,00 |
| 80x100 | 79,74 | 87,77 | 32,02 | 47,87 | n.d. | n.d. |
| 90x100 | 89,71 | 98,74 | 36,02 | 53,86 | n.d. | n.d. |
| Metro q. | 99,67 | 109,71 | 40,03 | 59,84 | n.d. | n.d. |

Max montata 1,27 m × 2,0 m · Max diretta 1,50 × 3,0 m · Piuma bordabile bianco/nero · Plexi con cornice legno selezionabile a software. Trasporto a carico fotografo, contrassegno.

---
*Fine PRP. Documento in stato congelato — nessun build prima del gate.*
