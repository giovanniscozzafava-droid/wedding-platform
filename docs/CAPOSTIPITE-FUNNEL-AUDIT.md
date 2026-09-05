# Audit funnel Capostipite — Planfully

**Data:** 05/09/2026 (aggiornato lo stesso giorno dopo il giro di fix massivo richiesto da Giovanni: "risolvi davvero TUTTO").
**Metodo:** 5 ricognizioni indipendenti sul codice reale + 2 collaudi dal vivo in produzione (§6) + un giro di fix con verifica mirata sulle voci di sicurezza/logica critica (curl/RPC reali, non solo lettura del diff). Ogni affermazione è ancorata a `file:riga`.
**Perché esiste questo file:** il 05-08/08/2026 era già stato fatto un audit bilaterale (vedi memoria `project_planfully_capostipite_audit_bilaterale`), ma il suo registro dettagliato viveva in `scratchpad/audit-ledger.md`, una cartella mai committata: è andato perso. Questo file lo sostituisce e va **tenuto aggiornato e committato** — non in scratchpad.

Da allora molte cose sono state chiuse (3 pilastri: consenso, denaro, blind — vedi §4), ma sono cambiate anche molte cose intorno (FattureInCloud, `contract_payments` a rate, la decisione "il contratto vale solo l'accettato"), quindi questo è un audit ripartito da zero sul codice attuale, non un aggiornamento cieco del vecchio elenco.

**Stato in breve:** su ~40 voci aperte, **30 sono state chiuse il 05/09/2026** (fix reali, deployati in produzione, i più critici verificati dal vivo). Le 4 decisioni di prodotto (GER-01/03, DEN-01/02) sono state prese da Giovanni e implementate lo stesso giorno (§8). Restano aperte solo le note "by design" non equivocabili per bug (GER-10, PREV-05, CONTR-05) e un piccolo numero di voci a basso rischio/basso beneficio lasciate deliberatamente intoccate per non introdurre regressioni in codice sensibile senza una revisione più ampia (vedi §3 per il dettaglio voce per voce, §7 per l'elenco fix del primo giro, §8 per le 4 decisioni di prodotto).

---

## 1. Cos'è il "capostipite"

Un `WEDDING_PLANNER` o una `LOCATION` (mai un `FORNITORE`) può vendere ai clienti un preventivo "fornitore globale": aggrega voci di catalogo proprie e di fornitori esterni reclutati nella propria rete, applica un ricarico (markup) sulle voci esterne, e sceglie se vendere come:

- **BUNDLE** (pacchetto unico): fornitori nascosti (blind) di default; nel denaro, il capostipite incassa dal cliente e "dovrebbe" pagare il fornitore.
- **ITEMIZED** (voci separate): fornitori visibili di default; nel denaro, il fornitore incassa dal cliente e "dovrebbe" girare il margine al capostipite.

Non esiste un flag `is_capostipite`: è sempre `profiles.role IN ('WEDDING_PLANNER','LOCATION')`, ripetuto inline in ogni RPC (nessuna funzione centralizzata `is_capostipite()` — rischio di disallineamento se una copia viene dimenticata).

Gerarchia: **WP sta sopra LOCATION** — un WP può reclutare una LOCATION nel proprio team, il contrario no.

---

## 2. Il funnel end-to-end (fasi)

1. **Attivazione** — Il professionista imposta `capostipite_sale_mode` (BUNDLE/ITEMIZED) in Profilo (`SaleModeCard`).
2. **Reclutamento fornitori** — 6 percorsi diversi per far entrare un fornitore in rete. La maggioranza crea la collaborazione **attiva senza consenso** (scelta di prodotto confermata, vedi GER-01/03); i bug di contorno (link rotti, notifiche assenti, RLS incompleta) sono stati chiusi il 05/09.
3. **Costruzione preventivo** — L'editor aggiunge voci proprie (`erogatore_e_capostipite`, niente ricarico) e voci esterne (con markup, blind per-voce). Il gate "solo capostipiti impostano markup" è ora **anche** lato server (PREV-01, chiuso).
4. **Invio e visione cliente** — Il cliente vede `/p/preview` → `/p/accept` con blind applicato correttamente su tutte le superfici note (PREV-03 chiuso). Selezione à-la-carte per-voce (`client_decision`).
5. **Accettazione** — Un solo percorso reale ora: `quote-accept-sign` (firma, fiscalità, gate "almeno una voce", check disponibilità fornitore). La RPC legacy che lo bypassava è stata messa in sicurezza (CONTR-01, chiuso).
6. **Contratto** — Generato sul totale delle sole voci accettate (regola "R1"). Un solo contratto, un solo importo, sempre intestato al capostipite: il cliente non vede mai la scomposizione fornitore-per-fornitore nel testo legale (by design, CONTR-05).
7. **Vita dell'evento** — Riprogrammazione e annullamento non lasciano più il fornitore libero sulla data vera dell'evento (CICLO-01/03/04, chiusi).
8. **Denaro** — Tre libri contabili paralleli e mai riconciliati tra loro rimangono tali: è una **decisione di prodotto** esplicitamente non delegata (DEN-01/02).
9. **Notifiche** — Capostipite e coppia ora vengono avvisati sui principali eventi della propria rete (uscita fornitore, dropout) che prima passavano inosservati (chiusi 05/09).

---

## 3. Registro — stato voce per voce

Severità: **CRITICO** (soldi/dati/prenotazioni doppie visibili all'utente) · **ALTO** (funzionalità promessa che non funziona/vicolo cieco reale) · **MEDIO** (inconsistenza o gap che si manifesta in casi non rari) · **BASSO** (rifinitura, codice morto, messaggio grezzo).

### GERARCHIA E RECLUTAMENTO

- **GER-01 [CRITICO] — CHIUSO 05/09, verificato dal vivo.** Decisione presa: "B", serve conferma. `capostipite_add_supplier`/`wp_add_location_to_team` non attivano più subito la collaborazione: la creano PENDING e notificano il fornitore. Migration `20260905330000`. Ciclo completo invito→notifica→accetta/rifiuta→notifica di ritorno testato dal vivo su un fornitore sintetico, ripulito a fine test.
- **GER-02 [ALTO] — CHIUSO 05/09.** Link d'invito email rotto per un fornitore già registrato: puntava a `/suppliers` (riservata al capostipite), ora punta a `/capostipiti` (pagina vera del fornitore). `supabase/functions/invite-supplier/index.ts`.
- **GER-03 [ALTO] — CHIUSO 05/09** (= GER-01, stessa migration). Nuove RPC `fornitore_accept_collaboration`/`fornitore_reject_collaboration` + bottoni "Accetta"/"Rifiuta" in `SupplierCapostipitiPage.tsx` (prima assenti).
- **GER-04 [MEDIO] — CHIUSO 05/09.** `CapostipiteInviteAcceptPage.tsx` ora ha anche il ramo login (email+password) per un WP/LOCATION già registrato che riceve un invito da un collega, chiamando `accept_supplier_invite` (RPC già corretta, prima solo mai invocata).
- **GER-05 [MEDIO] — CHIUSO 05/09.** `approve_candidacy` ora crea la collaboration anche quando un WP approva una LOCATION candidata (prima solo per FORNITORE). Migration `20260905140000`.
- **GER-06 [BASSO] — CHIUSO 05/09.** `supplier_invite_capostipite` e `supplier_leave_collaboration` ora notificano il capostipite (richiesta in arrivo / uscita fornitore). Migration `20260905150000`.
- **GER-07 [ALTO] — CHIUSO 05/09, verificato dal vivo.** RLS `profiles_select_collab_supplier` estesa a `role in ('FORNITORE','LOCATION')`. Verificato con una sessione reale (WP "Elena Bitonte" → LOCATION "Casino Lenza"): il profilo è ora leggibile, prima tornava vuoto. Migration `20260905160000`.
- **GER-08 [MEDIO] — CHIUSO 05/09, verificato dal vivo.** RLS `collab_insert_capo` ora verifica anche il ruolo del *target*, non solo del chiamante. Verificato con una sessione reale (LOCATION che tenta di inserire una collaboration con un WP come target): rifiutato con `42501`. Migration `20260905170000`.
- **GER-09 [MEDIO] — APERTO, lasciato apposta.** Duplicazione architetturale `capostipite_add_supplier`/`wp_add_location_to_team`: non unificate, per non rischiare di rompere chiamanti diversi con un refactor sotto pressione di tempo. Solo il bug concreto (timestamp sporchi alla riattivazione) è stato corretto in entrambe separatamente (vedi NEW-10).
- **GER-10 [nota, by design] — non un bug.** Consenso "tacito" nel gate del contratto (`quote_budget_readiness`): il cliente che accetta una voce vale come pronto anche se il vero fornitore non ha mai confermato. Comportamento consapevole, non toccato.

### PREVENTIVO — BUNDLE/ITEMIZED, BLIND, MARKUP

- **PREV-01 [CRITICO] — CHIUSO 05/09, verificato dal vivo.** Trigger server-side su `quotes`/`quote_items`/`quote_supplier_markups` che rifiuta un ricarico ≠0 se l'owner del preventivo non è WP/LOCATION/ADMIN. Verificato con una sessione FORNITORE reale: tentativo di impostare un ricarico rifiutato con messaggio umano. Migration `20260905180000`.
- **PREV-02 [ALTO] — APERTO, lasciato apposta.** Lock ottimistico `quote_save_guarded` inutilizzato: il vero path di scrittura (`useUpdateQuote`) andrebbe fatto passare da lì, ma è un refactor del percorso di salvataggio più usato dell'editor — troppo rischioso da fare senza un giro di test dedicato, non incluso in questo batch.
- **PREV-03 [ALTO] — CHIUSO 05/09.** `couple_get_quote_detail` ora applica lo stesso blind delle RPC gemelle sulla `photo` del servizio. Migration `20260905190000`.
- **PREV-04 [MEDIO] — CHIUSO 05/09.** CHECK `0..1000` aggiunto anche su `quotes.default_markup_percent` (nessuna riga esistente violava il vincolo). Migration `20260905200000`.
- **PREV-05 [ALTO, by design] — non un bug.** Lo sconto totale che scavalca il guard "non sotto costo" è dichiarato nel codice stesso come scelta consapevole del capostipite (avviso non bloccante). Non toccato.
- **PREV-06 [MEDIO] — CHIUSO 05/09, verificato dal vivo.** Giovanni ha lasciato la scelta a me: `snapshot_price` reso immutabile dopo la creazione della voce (verificato che nessun percorso legittimo lo aggiorna dopo l'insert — è concettualmente una fotografia, non un prezzo corrente). Un tentativo di modifica diretta rifiutato dal vivo con `23514`. Migration `20260905320000`.
- **PREV-07 [MEDIO] — CHIUSO 05/09.** Trigger che vincola `erogatore_e_capostipite=true` a `supplier_id = owner` del preventivo (o nullo). Migration `20260905210000`.
- **PREV-08 [BASSO] — CHIUSO 05/09.** Clamp frontend allineato a `0..100` (era `-1000..100`, promessa di "maggiorazione" mai davvero utilizzabile dal 2026-06-11); aggiunta traduzione dell'errore CHECK. `QuoteEditorPage.tsx`.
- **PREV-09 [BASSO] — CHIUSO 05/09.** Il PDF non-premium mostra ora la categoria vera del servizio (join `services`/`service_categories`) invece della stringa letterale "CATEGORIA". `supabase/functions/quote-generate-pdf/index.ts`.
- **PREV-10 [nota strutturale] — non toccato.** Triplicazione della logica blind su tre RPC parallele: resta un'area strutturalmente incline a disallineamenti futuri, ma unificarla è un refactor, non un fix puntuale.

### DENARO DI RETE

*(Tutte le voci DEN-* sono decisioni di prodotto esplicitamente escluse da questo giro di fix: toccare il modello economico del denaro di rete senza un allineamento con Giovanni sarebbe stato irresponsabile. Nessuna riga di questa sezione è stata modificata il 05/09.)*

- **DEN-01 [CRITICO] — CHIUSO 05/09, verificato dal vivo.** Decisione presa: "A", accendere collegando prima ai libri reali. Per la direzione BUNDLE (capostipite deve al fornitore): il mini-contratto SUPPLIER_WP si collega ora al settlement corrispondente, e un trigger su `contract_payments` lo riconcilia in automatico. Testato dal vivo end-to-end (settlement creato → contratto collegato → 3 rate pagate progressivamente → settlement passato da MATURATO a PARZIALE a SALDATO in automatico), poi ripulito. La direzione ITEMIZED resta a marcatura manuale (nessun contratto/fattura equivalente in quel verso oggi — fuori scope). Migration `20260905340000`.
- **DEN-02 [CRITICO] — CHIUSO 05/09, verificato dal vivo.** Flag `feature_flags.network_finance` acceso in produzione. `network_finance_overview()` verificato dal vivo: torna dati reali invece di `{error:'disabled'}`.
- **DEN-03 [ALTO] — APERTO.** `mark_settlement_paid` non verifica il flag `network_finance`.
- **DEN-04 [ALTO] — APERTO.** `payment-create` resta single-payee.
- **DEN-05 [ALTO] — APERTO.** Il margine ITEMIZED non transita mai in un flusso di cassa reale tracciato.
- **DEN-06 [MEDIO] — APERTO.** Rischio di doppio conteggio in BUNDLE.
- **DEN-07 [MEDIO] — APERTO.** Teardown parziale su preventivo RIFIUTATO.
- **DEN-08 [nota] — APERTO.** Nessuna predisposizione schema per split Stripe futuro.

### CONTRATTO

- **CONTR-01 [CRITICO] — CHIUSO 05/09, verificato dal vivo.** `quote_accept_by_token` ora applica lo stesso gate "almeno una voce accettata" e il check `archived_at` di `quote-accept-sign`. Verificato su un preventivo reale con zero voci selezionate: la RPC torna `false`, nessuna mutazione. Migration `20260905220000`.
- **CONTR-02 [ALTO] — CHIUSO 05/09, verificato dal vivo.** `archived_at` ora onorato in `quote_get_by_token`, `quote_items_decide_by_token` e `quote-accept-sign`. Verificato: un token di un preventivo archiviato torna `null` da `quote_get_by_token`. Migration `20260905220000` + `quote-accept-sign/index.ts`.
- **CONTR-03 [BASSO] — CHIUSO 05/09.** Rimosso il ramo morto `status === 'SCADUTO'` in `quote-accept-sign`.
- **CONTR-04 [MEDIO] — APERTO, lasciato apposta.** Doppio calcolo ridondante per `total_amount`: è un rattoppo storico ma funzionante e innocuo (ridondanza, non contraddizione); non toccato per non introdurre rischio dove oggi non c'è un bug attivo.
- **CONTR-05 [nota strutturale, non un bug] — non toccato.** Contratto unico intestato al capostipite: coerente col modello "fornitore globale".
- **CONTR-06 [BASSO] — CHIUSO 05/09.** Chiuso insieme a CONTR-01 (stesso gate, stessa migration).

### CICLO DI VITA EVENTO E NOTIFICHE

- **CICLO-01 [CRITICO] — CHIUSO 05/09.** `auto_block_availability_from_quote` ora SPOSTA la riga `supplier_appointments` esistente alla nuova data invece di lasciarla ferma. Migration `20260905230000`.
- **CICLO-02 [ALTO] — PARZIALMENTE CHIUSO 05/09.** La causa profonda (disponibilità fornitore non aggiornata) è risolta dallo stesso fix di CICLO-01, che scatta su QUALUNQUE update di `quotes.event_date`, incluso quello di `handleForceEdit`. Aggiunta anche la sincronizzazione di `calendar_entries.date_from` (prima mai toccata da questo percorso). **Resta aperto**: `handleForceEdit` non notifica i fornitori esterni del cambio data (solo la coppia) — non implementato in questo giro, richiederebbe replicare la logica di notifica di `riprogramma_evento` in un secondo percorso, rischio di duplicazione/divergenza futura da valutare a parte.
- **CICLO-03 [ALTO] — CHIUSO 05/09 (mitigazione, non eliminazione teorica della race).** `quote-accept-sign` ora controlla, prima del claim atomico, se un fornitore delle voci scelte risulta già BUSY per un preventivo diverso sulla stessa data: se sì, blocca la firma con un errore chiaro. Riduce drasticamente la finestra della race, non la elimina al 100% senza un lock a livello DB dedicato (non introdotto, per non toccare lo schema di `supplier_availability`).
- **CICLO-04 [ALTO] — CHIUSO 05/09.** `annulla_evento` ora ripulisce anche `supplier_appointments`, non solo `supplier_availability`. Stessa migration che ha corretto anche il crash NEW-01. Migration `20260905240000`.
- **CICLO-05 [MEDIO] — CHIUSO 05/09** (= GER-06, stessa migration).
- **CICLO-06 [MEDIO] — CHIUSO 05/09.** `dropout_fornitore` ora notifica anche la coppia, non solo il WP. Migration `20260905250000`.
- **CICLO-07 [MEDIO] — CHIUSO 05/09.** Rimossa `ACCETTATO → INVIATO` (nessun caller reale la usava); bloccata `CONVERTITO_IN_CONTRATTO → BOZZA` se esiste un contratto FIRMATO collegato; bloccata `RIFIUTATO → BOZZA/INVIATO` se l'evento collegato è ANNULLATO. Migration `20260905260000`.
- **CICLO-08 [MEDIO] — CHIUSO 05/09.** `is_collab_supplier_of_entry` ora nega l'accesso PII se esiste una collaborazione esplicitamente REVOKED tra il fornitore e il capostipite, anche se il preventivo è tornato "vivo". Migration `20260905270000`.
- **CICLO-09 [MEDIO] — CHIUSO 05/09, verificato dal vivo.** Decisione presa: "A", addendum. `riprogramma_evento` genera ora un addendum "cambio data" (riusa `contract_addendums`/il flusso di firma già esistente per gli addendum di importo) per ogni contratto FIRMATO collegato all'evento, e lo invia subito. Testato dal vivo su un contratto reale (demo Tenuta delle Grazie): addendum creato con testo/data corretti, inviato, pagina pubblica verificata; evento poi riportato alla data originale. Migration `20260905310000`.
- **CICLO-10 [BASSO] — APERTO, lasciato apposta.** Due sistemi di notifica paralleli (`notifiche`/`user_notifications`): unificarli è un refactor trasversale, fuori scope per un giro di bugfix.

---

## 4. Cosa regge (già corretto prima di oggi, o confermato dal 05/09 in poi)

- Pilastro "blind unificato" (agosto) + PREV-03 (05/09): tutte le superfici note nascondono correttamente nome/foto/categoria-che-tradisce-il-mestiere sulle voci cieche.
- Pilastro "consenso" incr.1-3: uscita self-service fornitore, `quote-send` blocca l'invio se una voce ha `supplier_presence='NO'`, teardown dell'accesso PII quando il fornitore non ha più una voce viva (ora anche CICLO-08).
- Pilastro "denaro di rete" (calcolo): la logica BUNDLE/ITEMIZED di `_populate_network_settlements` è corretta in entrambi i rami — il problema resta di visibilità/collegamento (DEN-*), non di calcolo.
- Decisione "il contratto vale solo l'accettato" (R1): chiusa end-to-end, inclusa la RPC legacy (CONTR-01).
- `quote-accept-sign` onora token_revoked_at/scadenza/archived_at, gate selezione, e ora anche il controllo doppia prenotazione (CICLO-03).
- Cascade-delete di un preventivo: ripulisce correttamente `supplier_availability`/`supplier_appointments`.
- Ambito "ruolo sugli eventi", isolamento del catalogo dal capostipite, scoping dell'area cliente via JWT: confermati tenuta in tutte le verifiche.
- Mini-contratto SUPPLIER_WP: intestazione corretta (fornitore=owner, dati capostipite come "cliente"), rateizzazione per-fornitore, importo sul costo — verificato dal vivo due volte (creazione + fatturazione test).
- Fatturazione Fatture in Cloud: funzionante end-to-end (prima fattura reale mai emessa con successo, bug sul lordo/netto corretto), riconciliazione giornaliera verificata.

---

## 5. Le 4 decisioni di prodotto — PRESE e implementate il 05/09/2026 (§8)

Le 4 decisioni erano: (1) GER-01/03 consenso reclutamento — presa "B", conferma esplicita; (2) DEN-01/02 finanze rete — presa "A", accendere collegando ai libri reali; (3) PREV-06 floor snapshot_price — lasciata al giudizio di Claude, scelta l'immutabilità; (4) CICLO-09 cambio data post-firma — presa "A", addendum. Dettaglio implementazione e verifica dal vivo in §8.

---

## 6. Verificato dal vivo (collaudo 05/09/2026)

Due collaudi end-to-end in produzione (non solo lettura di codice): un "cliente rompiscatole" contro l'account reale di Elisabetta Citraro (Wedding Planner), e un "fornitore rompicoglioni" reclutato nella sua rete come capostipite. Ogni azione è passata dagli stessi meccanismi di un browser reale (RPC/edge function con la sessione della persona giusta), mai da scritture dirette che bypassano la logica. Tutto ciò che i due collaudi hanno creato è stato rimosso a fine test, verificato per ID; l'account e i dati reali di Elisa risultano intatti.

**Trovati dal collaudo e CHIUSI lo stesso giorno:**

- **NEW-01 [CRITICO, CHIUSO]** — `annulla_evento` crashava SEMPRE, per qualunque evento (colonna `notes` inesistente su `calendar_entries`). Migration `20260905120000` + `20260905240000`.
- **NEW-02 [ALTO, CHIUSO]** — IDOR in `create_supplier_contract`: chiunque poteva auto-crearsi un contratto su un evento altrui dichiarandosi fornitore, leak dati fiscali del capostipite. Migration `20260905130000`.
- **NEW-03 [MEDIO, CHIUSO]** — Testo `QuoteAuthGate.tsx` corretto (prometteva un magic-link, l'accesso reale è email+password).
- **NEW-04 [MEDIO, CHIUSO]** — Trigger che risincronizza la `due_date` della rata "Acconto alla firma" quando il contratto viene firmato. Migration `20260905280000`.
- **NEW-05 [BASSO, CHIUSO]** — `quote-send` ora usa una RPC indicizzata (`email_has_account`) invece di `listUsers({perPage:200})` senza paginazione.
- **NEW-06 [BASSO] — APERTO, non è un bug ma una feature mancante.** Nessun canale per il cliente di scrivere ancora dopo il primo contatto, prima del preventivo: richiederebbe una vera chat/thread pre-preventivo, fuori scope per un fix.
- **NEW-07 [BASSO, CHIUSO]** — `contract-send` ora porta `contracts.status` a `INVIATO` dopo un invio riuscito da `BOZZA`.
- **NEW-08 [BASSO] — APERTO, non è un bug ma una feature mancante.** Nessuna UI per modificare scadenza/importo di una rata non incassata: il dato lo permette, serve solo disegnare l'interfaccia — non fatto in questo giro.
- **NEW-09 [BASSO, CHIUSO]** — `sign_contract_offline` ora autorizza anche il capostipite (owner dell'evento) a firmare di persona un mini-contratto SUPPLIER_WP, non solo il fornitore/owner_id.
- **NEW-10 [BASSO, CHIUSO]** — `accepted_at`/`revoked_at` azzerati correttamente alla riattivazione/riapertura in tutti e tre i punti che la eseguono.

**Confermato dal vivo (non solo per lettura statica)**: il fix di ownership del mini-contratto SUPPLIER_WP tiene end-to-end (owner, dati fiscali, importo, rateizzazione per-fornitore anche dopo un risync); il fix "prezzo sempre visibile" tiene senza regressi.

**Cose verificate dal vivo che tengono senza riserve**: ricalcolo automatico del totale a ogni voce/sconto/selezione; regola "solo l'accettato" end-to-end fino al contratto; blind BUNDLE verificato sulla risposta pubblica reale; guardia server-side su presenza fornitore; notifiche in-app generate correttamente e in tempo reale sui passaggi chiave; gate anti-cancellazione GDPR di un atto firmato.

---

## 7. Verifiche dal vivo del giro di fix del 05/09 (voci di sicurezza/logica critica)

Per ognuna, testata in produzione (non solo letto il diff), con sessioni reali minted via magic-link e chiamate dirette a RPC/PostgREST:

- **PREV-01**: sessione FORNITORE reale → tentativo di impostare un ricarico → rifiutato (`42501`, messaggio umano).
- **GER-07**: sessione WP reale ("Elena Bitonte") → lettura profilo LOCATION reclutata ("Casino Lenza") → riga tornata (prima vuota).
- **GER-08**: sessione LOCATION reale ("Casino Lenza") → tentativo insert `collaborations` con un WP come target → rifiutato da RLS (`42501`).
- **CONTR-01**: `quote_accept_by_token` su un preventivo reale con zero voci selezionate → torna `false`, `status` invariato (prima avrebbe accettato alla cieca).
- **CONTR-02**: `quote_get_by_token` su un preventivo reale con `archived_at` valorizzato → torna `null` (prima avrebbe esposto i dati).

Tutte e 17 le migration del 05/09 applicate in produzione senza errori (`supabase db push`); build frontend pulito; 5 edge function ridistribuite (`invite-supplier`, `quote-accept-sign`, `quote-send`, `contract-send`, `quote-generate-pdf`).

---

## 8. Le 4 decisioni di prodotto — implementate e testate dal vivo (05/09/2026, secondo giro)

Giovanni ha preso le 4 decisioni rimaste aperte (§5) lo stesso giorno. Ognuna è stata implementata, deployata, e testata dal vivo in produzione con dati sintetici creati appositamente e poi rimossi (mai su dati reali di terzi).

**1 — GER-01/03, decisione "B" (serve conferma esplicita).** `capostipite_add_supplier`/`wp_add_location_to_team` non attivano più subito la collaborazione: la creano `PENDING` (`initiated_by='CAPOSTIPITE'`) e notificano il fornitore. Nuove RPC `fornitore_accept_collaboration`/`fornitore_reject_collaboration`; nuovi bottoni "Accetta"/"Rifiuta" in `SupplierCapostipitiPage.tsx` (mancavano, GER-03). Non toccati i percorsi già consensuali (referral al signup, candidatura fornitore→capostipite, invito fornitore→capostipite via `supplier_invite_capostipite`). Migration `20260905330000`.
**Test dal vivo**: capostipite reale (Elena Bitonte) invita un fornitore sintetico → riga `PENDING`, notifica ricevuta dal fornitore → fornitore accetta → `ACTIVE`, notifica di ritorno al capostipite. Ripetuto per il rifiuto: uscita → reinvito (torna `PENDING` pulito, niente `accepted_at` sporco) → rifiuto → `REVOKED`. Fornitore sintetico e collaborazione di test rimossi a fine verifica.

**2 — DEN-01/02, decisione "A" (accendere, prima collegare ai libri reali).** Aggiunta `network_settlements.contract_id`: `create_supplier_contract` collega ora il mini-contratto SUPPLIER_WP al settlement corrispondente (quote_id+supplier_id) alla creazione. Nuovo trigger su `contract_payments` che, a ogni incasso/pagamento di rata registrato (a mano o da riconciliazione Fatture in Cloud), ricalcola `amount_paid`/`status` del settlement collegato con la stessa logica di `mark_settlement_paid`. Flag `feature_flags.network_finance` acceso. La direzione ITEMIZED (fornitore deve il margine) resta a marcatura manuale: non esiste un contratto/fattura equivalente in quel verso nello schema attuale, costruirlo è un pezzo di lavoro a parte, non incluso qui. Migration `20260905340000`.
**Test dal vivo**: creato un preventivo/voce/fornitore sintetico su un capostipite reale (Elena Bitonte), portato ad ACCETTATO (settlement auto-creato, `amount_due=200`), creato il mini-contratto (settlement collegato via `contract_id`), pagate le 3 rate una alla volta: il settlement è passato da solo `MATURATO` → `PARZIALE` (dopo la prima rata) → `SALDATO` (dopo tutte e tre), verificato anche via `network_finance_overview()` (il flag è davvero acceso). Tutto il materiale di test rimosso a fine verifica.

**3 — PREV-06, lasciata al giudizio di Claude.** Scelta l'opzione più semplice e sicura: `quote_items.snapshot_price` reso immutabile dopo la creazione della voce (verificato che nessun percorso applicativo legittimo lo aggiorna dopo l'insert — concettualmente è una fotografia del prezzo al momento, non un prezzo corrente da tenere sincronizzato). Chiude il rischio concreto (un abbassamento non tracciato riduceva silenziosamente quanto risultava dovuto al fornitore nei settlement) senza inseguire un floor legato al listino, che cambierebbe nel tempo. Migration `20260905320000`.
**Test dal vivo**: tentativo diretto di abbassare `snapshot_price` su una voce reale esistente → rifiutato (`23514`), valore invariato.

**4 — CICLO-09, decisione "A" (addendum, con nuova firma).** `riprogramma_evento` genera ora un addendum "cambio data" per ogni contratto FIRMATO collegato all'evento (contratto principale col cliente e/o mini-contratti coi fornitori), riusando la tabella e il flusso di firma già esistenti per gli addendum di importo (`contract_addendums` aveva già una colonna `date_change`, mai popolata prima). L'addendum viene inviato subito per la firma dal frontend (`EventoChangesMenu.tsx`), stesso schema già in uso per gli addendum di importo generati dall'editor preventivo. Migration `20260905310000`.
**Test dal vivo**: riprogrammato un evento reale con contratto FIRMATO (demo Tenuta delle Grazie, matrimonio Greco-Fabiani, 19/09→26/09): addendum creato con testo e `date_change` corretti, inviato (arrivato fino al solo limite dell'email fittizia del cliente demo), pagina pubblica di firma verificata col contenuto giusto. Evento e contratto riportati alla data originale a fine test, nessuna traccia residua.

Tutte e 5 le migration di questo secondo giro applicate in produzione senza errori; build frontend pulito; deploy Vercel live.

---

## 9. Collaudo "vasi comunicanti" 05/09/2026 (terzo giro) — trovati e CHIUSI 10 bug reali

Su richiesta di Giovanni ("come un Capostipite, come con i vasi comunicanti... testala stressandola, anche all'assurdo"), due nuovi collaudi paralleli a tappeto in produzione (non solo lettura codice), ciascuno con identità sintetiche proprie create e rimosse a fine test, mai su dati di terzi: **metà 1** (reclutamento, preventivo, markup, blind) e **metà 2** (contratto, addendum, ciclo vita evento, finanze rete). A differenza dei collaudi precedenti, qui l'obiettivo era colpire ogni fix già chiuso oggi con input assurdi/improbabili per vedere cosa si rompeva sotto pressione — ed è servito: sono uscite 3 regressioni reali su funzionalità già "chiuse" nello stesso giorno, oltre a 7 bug più piccoli mai visti prima. Tutti e 10 chiusi lo stesso giorno, verificati dal vivo uno per uno (§9.2), migration `20260905350000`.

### 9.1 Cosa hanno trovato (prima del fix)

1. **[CRITICO, regressione] D-18 riaperto** — `quotes_recalc_totals` scalava il costo REALE delle voci proprie del capostipite (`erogatore_e_capostipite`) per il fattore dello sconto cliente: uno sconto totale del 50% abbassava anche il "costo" mostrato (2500€→2250€), gonfiando il margine apparente. Esattamente la regola che D-18 (agosto) doveva vietare — mai davvero chiusa su questa funzione, solo sulla parte "voci selezionate".
2. **[CRITICO, regressione] CICLO-09 irraggiungibile dal percorso reale** — `riprogramma_evento` filtrava i contratti solo per `entry_id`, ma `QuoteEditorPage::handleCreateContract` (il percorso con cui un capostipite crea davvero il contratto principale) non lo valorizzava mai: **36 contratti reali in produzione**, in gran parte FIRMATI, erano orfani di `entry_id`. Risultato: su quei contratti un cambio data non aggiornava `event_date`, non generava l'addendum promesso stamattina (CICLO-09), e il fornitore restava doppiamente occupato (vecchia+nuova data) — la stessa classe di bug che CICLO-01 doveva chiudere, riapparsa per questo percorso parallelo mai coperto dai test di stamattina.
3. **[ALTO] Addendum che si cannibalizzano a vicenda** — `_addendum_build` (importo) e `_addendum_build_date_change` (data, introdotto stamattina) riusavano indistintamente "l'ultimo BOZZA/INVIATO" dello stesso contratto: un addendum di importo ancora in bozza veniva azzerato (`amount_delta=0`, token invalidato) da un successivo addendum di cambio data, e viceversa.
4. **[ALTO] `contract_payments.paid_amount` senza controlli** — accettava importi assurdi (999999€ su una rata da 72€) o negativi.
5. **[MEDIO] `mark_settlement_paid` vs riconciliazione automatica (DEN-01, di stamattina) in conflitto** — su un settlement collegato a un mini-contratto, un aggiustamento manuale veniva silenziosamente sovrascritto/perso alla prima rata successiva modificata (il trigger ricalcola sempre da zero).
6. **[MEDIO] `capostipite_add_supplier` con `p_supplier_id` inesistente** — il controllo di ruolo veniva scavalcato (NULL non è mai "IN"/"NOT IN" in PL/pgSQL) e l'insert falliva più sotto con un errore grezzo di foreign key (23503) invece di un errore pulito.
7. **[MEDIO] `capostipite_add_supplier` su una richiesta già avviata dal fornitore** — se il fornitore aveva già chiesto lui di entrare (collaboration PENDING fornitore-iniziata), il capostipite che lo "aggiungeva" resettava la riga a PENDING capostipite-iniziata invece di accettarla, costringendo il fornitore ad accettare di nuovo qualcosa che aveva già chiesto.
8. **[MEDIO] GER-05 (chiuso stamattina) in realtà irraggiungibile** — `approve_candidacy` sa gestire da stamattina una LOCATION candidata a un WP, ma `request_follow` non aveva mai messo in PENDING un follow LOCATION→WP (solo FORNITORE→WP/LOCATION): la candidatura risultava sempre auto-APPROVED, quindi quel ramo non aveva mai una riga da trovare.
9. **[BASSO] PDF: emoji nel nome di una voce corrompeva la riga intera** — `safeText` toglieva solo i caratteri di controllo, non gli emoji: jsPDF (font Latin/WinAnsi) li renderizza come mojibake, spostando anche il resto della riga.
10. **[BASSO] `quotes.guest_count` e `profiles.subrole` senza controlli** — il primo accettava valori negativi o assurdi; il secondo (testo libero) passava intatto — tag HTML inclusi — attraverso `quote_get_by_token`, RPC pubblica anonima (rischio XSS non confermato ma non escludibile su un futuro rendering non protetto).

**Confermato che tiene, anche sotto stress assurdo**: tutti gli altri ~30 fix di stamattina (blind, PREV-01/03/07, CONTR-01/02, CICLO-01/03/04/07/08, DEN-01/02 di base, NEW-01..10), più una ventina di comportamenti mai testati prima (IDOR NEW-02 in due varianti, transizioni di stato, `annulla_evento` doppia chiamata, `dropout_fornitore` verso la coppia, arrotondamento decimali oltre i 2, ecc.).

### 9.2 Fix applicati e verificati dal vivo lo stesso giorno (migration `20260905350000`)

Per ognuno: creata la condizione reale con dati sintetici (3 utenti `giovanni.scozzafava+t2-*`), chiamata reale via RPC/PostgREST con sessione minted, verificato il risultato, poi rimosso tutto (sweep finale senza residui).

- **D-18**: costo reale non più scalato dallo sconto. Verificato: voce propria da 1000€, sconto totale 50% → `total_cost=1000` (invariato), `total_client=500`, `margin_amount=-500` (la perdita reale ora si vede, non viene più nascosta).
- **CICLO-09-bis**: `handleCreateContract` ora valorizza `entry_id` alla creazione; backfillati i 36 contratti reali orfani; `riprogramma_evento` ha anche un fallback via `quote_id` per qualunque altro percorso dimenticato. Verificato dal vivo: contratto creato apposta con `entry_id=NULL` (per riprodurre il bug) → `riprogramma_evento` gli ha comunque aggiornato `event_date` e generato l'addendum di cambio data.
- **Addendum**: aggiunta una colonna `kind` (`AMOUNT`/`DATE`); ogni builder riusa solo un addendum già dello stesso tipo. Verificato dal vivo: generato un addendum di importo (delta +500€) e poi uno di cambio data sullo stesso contratto → entrambi coesistono, l'importo resta 500€ intatto.
- **`contract_payments.paid_amount`**: CHECK `0..amount`. Verificato: 999999€ e -50€ su una rata da 150€ → entrambi rifiutati (`23514`); 150€ (valore pieno) accettato.
- **`mark_settlement_paid`**: rifiuta la marcatura manuale se il settlement ha un `contract_id` collegato (si muove solo dalle rate). Verificato dal vivo: tentativo su un settlement collegato → `{"error":"linked_to_contract"}`. Bottone "Segna pagato/incassato" disabilitato in UI per gli stessi casi (`FinanzeRetePage.tsx`).
- **`capostipite_add_supplier`**: `not_found` pulito su ID inesistente (verificato); su una PENDING fornitore-iniziata ora ACCETTA invece di resettare (verificato dal vivo: fornitore invita → capostipite "aggiunge" → `ACTIVE` con `accepted_existing_request:true`, non una nuova PENDING).
- **GER-05 sbloccato davvero**: `request_follow` mette in PENDING anche LOCATION→WEDDING_PLANNER. Verificato dal vivo end-to-end: LOCATION segue WP → PENDING → WP approva (`approve_candidacy`) → collaboration `ACTIVE` creata per davvero (prima mai, in nessun test).
- **PDF**: `safeText` ora toglie anche emoji/pittogrammi (`\p{Extended_Pictographic}`) e i loro modificatori (ZWJ, variation selector), oltre ai caratteri di controllo.
- **`guest_count`**: CHECK `0..100000` su `quotes` e `calendar_entries`. **`subrole`**: CHECK che vieta `<`/`>` (blocca tag HTML alla radice). **`default_markup_percent`**: il CHECK dichiarava valido fino a 1000, ma la colonna resta `numeric(5,2)` (nota already 20260611030000, fuori scope allargarla) — corretto il limite dichiarato a 999.99, coerente con quanto la colonna può davvero contenere. Tutti verificati dal vivo con valori di confine.

Nessuna riga esistente in produzione violava alcuno dei nuovi CHECK (verificato prima di applicarli). Migration + edge function `quote-generate-pdf` + frontend rideployati; build pulito; deploy Vercel verificato sul bundle realmente servito (non solo sul build locale).

---

## 10. "Ennesimo mega stress test" 06/09/2026 (quarto giro) — 3 collaudi paralleli su terreno nuovo

Su richiesta di Giovanni, terzo giro di stress test nella stessa giornata, questa volta su angoli MAI toccati dai tre giri precedenti: (A) concorrenza reale (richieste davvero simultanee, non sequenziali) + sweep IDOR incrociato tra due capostipiti; (B) audit di sola lettura sull'integrità dei dati finanziari REALI di produzione; (C) la vita dell'evento DOPO la firma del contratto (galleria, PDF "squadra", Filo guida, richiesta recensione) per un evento di capostipite, mai testata nei tre giri precedenti (tutti fermi alla firma).

Prima di lanciare i collaudi, chiusa una coda del fix D-18 di ieri: la formula corretta non si applica da sola ai preventivi già scontati finché nessuno li riapre. Trovati **11 preventivi reali attivi** con margine mostrato a 0€ mentre in realtà erano in perdita (fino a -1440€). **Ricalcolati tutti i 169 preventivi non-test in produzione** con la formula corretta: i numeri ora sono giusti ovunque, non solo nel codice.

### 10.1 Trovato dal collaudo A — concorrenza + IDOR (agente dedicato)

- **CICLO-03-bis [CRITICO, confermato dal vivo] — CHIUSO 06/09.** Due preventivi che assegnano lo stesso fornitore alla stessa data, firmati in **parallelo esatto** (2ms di scarto, `Promise.all` su due POST reali a `quote-accept-sign`), sono risultati **entrambi accettati**: nessun vincolo DB impediva due appuntamenti EVENTO per lo stesso fornitore nello stesso giorno. CICLO-03 (chiuso ieri) mitigava solo la finestra letta-poi-scritta lato applicazione, mai eliminata davvero — qui la race è stata vista fallire dal vivo, non è più solo un rischio teorico dichiarato. Vedi §10.4 per il fix.
- Tutto il resto REGGE, anche sotto vera concorrenza: `mark_settlement_paid` doppio (nessun raddoppio, lock di riga Postgres), `riprogramma_evento` doppio su date diverse (stato finale coerente su tutte le tabelle grazie al `for update`), `capostipite_add_supplier` da due capostipiti sullo stesso fornitore (righe indipendenti, nessun conflitto), `fornitore_accept_collaboration` doppio (idempotente, una sola notifica).
- Sweep IDOR incrociato (due capostipiti sintetici completi, ognuno prova ad accedere ai dati dell'altro): **tutto REGGE** — `network_finance_overview`, `mark_settlement_paid`, `fornitore_accept/reject_collaboration`, `wp_add_location_to_team`, `sign_contract_offline`, accesso addendum senza token, e PATCH diretto via PostgREST su 6 tabelle (verificato il *body* della risposta, non solo l'assenza di errore: 0 righe modificate su tutte).
- Nota collaterale, non richiesta ma trovata per strada: cancellare un contratto/preventivo non ripulisce `supplier_availability`/`supplier_appointments` collegati (`ON DELETE SET NULL`, non cascade) — gap di igiene dati adiacente a CICLO-01/04, annotato per un giro futuro, non chiuso oggi.

### 10.2 Trovato dal collaudo B — integrità dati finanziari reali (agente dedicato, sola lettura)

- **[CRITICO, APERTO — decisione per Giovanni] 28 contratti FIRMATO su 37 non hanno NESSUNA rata** (`contract_payments` vuota). Causa: il trigger che le genera esiste solo dal 01/09, mai un backfill per i contratti firmati prima. Suddivisione trovata: 7 su seed/demo dichiarati (Casino Lenza, Tenuta delle Grazie, La Baronella — non reali), 11 su account dai timestamp sospetti (creati nello stesso secondo, probabili fixture di sviluppo mai marcate `is_test` — **da chiarire con Giovanni**), **10 su clienti VERI confermati (Rosella Elia, Antonio Mancuso, Giangianni Flowers) per €25.660 di esposizione reale**: il professionista non ha modo di sapere cosa/quando incassare. Fix pronto e a basso rischio (`contract_payments_sync()` già esiste, idempotente, non tocca rate già incassate) — non eseguito in attesa della decisione su quali account trattare come reali.
- **[CRITICO, APERTO — decisione per Giovanni] Un terzo varco sulla regola R1** ("il contratto vale solo l'accettato", già chiusa oggi su `quote-accept-sign`/`quote_accept_by_token`): il bottone "Genera contratto" nell'editor (`QuoteEditorPage.tsx::handleCreateContract`) porta il preventivo a CONVERTITO_IN_CONTRATTO **senza controllare se il cliente ha mai accettato online una sola voce** — il gate in UI (`budgetReadiness`) è `null`/inattivo finché il preventivo non è già ACCETTATO, quindi su un preventivo mai aperto dal cliente il controllo è di fatto assente. Trovato un caso reale: preventivo "Roberta e Saverio" (€33.436,15) CONVERTITO_IN_CONTRATTO con zero voci mai decise dal cliente. **Non ancora un danno economico diretto** (l'importo mostrato resta corretto grazie al fallback su `total_client`), ma non è chiaro se sia un bug o il percorso legittimo per accordi chiusi offline (di persona/telefono) senza mai passare dal flusso digitale — per questo è una decisione, non un fix automatico.
- Puliti: rate che non sommano al totale (0 casi), settlement con `amount_paid > amount_due` (0 casi), duplicati di settlement (0 casi), addendum abbandonati (tabella vuota). Confermato (non un bug, un fatto): 0 dei 7 settlement reali sono mai stati collegati a un contratto (nessun mini-contratto SUPPLIER_WP esiste ancora in produzione) — DEN-03/04/05 restano il vero collo di bottiglia, invariato da stamattina.
- **[BASSO-MEDIO, APERTO]** 2 contratti BOZZA (mai firmati) senza `entry_id`/`calendar_entries` collegato — uno dei due preventivi risulta ACCETTATO ma senza che sia mai stato creato un evento: possibile buco nel flusso "cliente suggerito", da approfondire in un giro dedicato.

### 10.3 Trovato dal collaudo C — vita dopo la firma, evento capostipite (agente dedicato)

Tre leak critici confermati dal vivo (non teorici: uno ha comportato l'invio di una vera email), tutti con la stessa causa di fondo — funzionalità scritte pensando "un fornitore gestisce il proprio cliente" che non conoscono il meccanismo blind del capostipite:

- **[CRITICO] Link pubblico della galleria foto** (`gallery_get_by_token`, senza autenticazione) esponeva nome studio ed email REALI del fornitore blind. **CHIUSO 06/09** (§10.4).
- **[CRITICO] "Chiedi una recensione"**: un fornitore blind ha realmente mandato un'email al cliente col proprio nome vero, autorivelandosi (asimmetria: lato coppia il fornitore restava correttamente invisibile, lato professionista poteva scrivergli direttamente). **CHIUSO 06/09**, in due punti (§10.4) — il primo fix applicato copriva solo un percorso di accesso (partecipante al cerchio evento), un secondo percorso indipendente (proprietario della galleria) è stato trovato e chiuso nella verifica dal vivo subito dopo.
- **[ALTO, APERTO, non un leak di sistema] PDF "squadra dedicata"** (`SupplierTeamPage`/`runsheetPdf.ts`): se il capostipite digita a mano il nome del fornitore esterno come "membro del team" (campo libero, nessun collegamento a `collaborations`), il PDF cliente lo stampa. A differenza dei due punti sopra, qui non c'è nessuna fuga automatica: il sistema stampa solo ciò che il capostipite ha scelto lui stesso di scrivere. Non corretto con un blocco automatico (un match sul nome sarebbe inaffidabile, falsi positivi/negativi); da valutare in un giro futuro un avviso in UI prima dell'export ("alcuni fornitori di questo evento sono nascosti nel preventivo cliente").
- **[ALTO, APERTO, gap non leak] Filo guida**: nessun segnale "notizia" per reclutamento-fornitore-accettato o contratto-firmato (esistono per aperture preventivo, rate, cuori foto, ecc.) — scritto pensando al fornitore singolo, ignora i milestone di rete. Non chiuso in questo giro (funzionalità mancante, non bug).
- **[MEDIO] `couple_visits_summary`** non filtrava le sezioni per chi legge: un fornitore periferico (solo galleria) vedeva anche quanto tempo il cliente passa sul tab "contratto" — competenza del solo capostipite. **CHIUSO 06/09** (§10.4).
- Confermato che REGGE: `couple_visits` sull'assunzione richiesta (nessun ruolo hardcoded), teardown corretto lato coppia (`couple_review_targets` non mostrava il fornitore nel test originale — poi confermato che lo avrebbe mostrato in altri scenari, vedi fix §10.4).

### 10.4 Fix applicati e verificati dal vivo (migration `20260906010000` + `20260906020000`)

- **Gallery blind** (`gallery_get_by_token`): quando il fornitore proprietario della galleria è blind sul preventivo collegato, la funzione mostra l'identità del CAPOSTIPITE al suo posto (coerente con BUNDLE — non null/rotto). Verificato dal vivo in entrambe le direzioni: fornitore blind → mostra il capostipite; stesso fornitore reso non-blind → torna a mostrare sé stesso.
- **Review-request blind** (`review_is_pro_of_entry`, usata sia da `review_request_context`/edge function sia — tramite `couple_review_targets`, corretto insieme per lo stesso motivo — dal lato coppia): un fornitore blind non risulta più autorizzato a chiedere una recensione, né a comparire tra i professionisti che la coppia può recensire. **Due percorsi indipendenti chiusi** (partecipante al cerchio evento, proprietario della galleria) con un helper condiviso (`_entry_supplier_is_blind`) per evitare che restasse un terzo varco. Verificato dal vivo in entrambe le direzioni.
- **`couple_visits_summary`**: un professionista che non è owner dell'evento vede solo le sezioni "foto"/"galleria"; l'owner (capostipite o fornitore singolo) continua a vedere tutto. Verificato dal vivo: il fornitore vede la sezione "foto" ma non "contratto".
- **CICLO-03-bis**: consolidate le 23 coppie di righe `supplier_appointments` duplicate già presenti in produzione (non vere doppie prenotazioni: lo stesso evento reale contato due volte, da preventivo-accettato e da contratto-firmato, perché il trigger sul contratto non sapeva controllare l'altro). Aggiunto un vincolo `unique(owner_id, date) where kind='EVENTO'` — un solo appuntamento EVENTO per fornitore per giorno, **enforced dal database, non aggirabile da nessuna finestra di tempo applicativa**. Il trigger sul contratto ora si aggancia all'appuntamento dello stesso evento invece di crearne un secondo; se un vincolo scatta per un evento davvero diverso, la transazione si annulla e `quote-accept-sign` traduce l'errore in `supplier_double_booked` (409) invece di un 500 grezzo. **Verificato dal vivo con vera concorrenza** (due `POST` reali a `quote-accept-sign` sparati in parallelo esatto sullo stesso fornitore/stessa data): un solo `ok:true`, l'altro `409 supplier_double_booked` pulito, una sola riga `supplier_appointments` risultante.

Tutte le verifiche con dati sintetici (`giovanni.scozzafava+t3a/t3b/t3c/t4-*`) creati e rimossi, sweep finale confermato senza residui. Migration applicate senza errori; edge function `quote-accept-sign` rideployata.

### 10.5 Decisioni ancora aperte per Giovanni

1. **Rate mancanti sui 28 contratti FIRMATO**: generare le rate mancanti (via `contract_payments_sync()`, sicuro/idempotente) sui 10 contratti reali confermati (€25.660)? E sugli 11 account dai timestamp sospetti (€443.849) — sono clienti veri o fixture di sviluppo da marcare `is_test`?
2. **`handleCreateContract` senza gate R1**: va bloccato (richiedere almeno una voce accettata online, come già fatto per il cliente) o è il percorso legittimo per accordi chiusi offline che un capostipite deve poter continuare a usare?
