# Audit funnel Capostipite — Planfully

**Data:** 05/09/2026 (aggiornato lo stesso giorno dopo il giro di fix massivo richiesto da Giovanni: "risolvi davvero TUTTO").
**Metodo:** 5 ricognizioni indipendenti sul codice reale + 2 collaudi dal vivo in produzione (§6) + un giro di fix con verifica mirata sulle voci di sicurezza/logica critica (curl/RPC reali, non solo lettura del diff). Ogni affermazione è ancorata a `file:riga`.
**Perché esiste questo file:** il 05-08/08/2026 era già stato fatto un audit bilaterale (vedi memoria `project_planfully_capostipite_audit_bilaterale`), ma il suo registro dettagliato viveva in `scratchpad/audit-ledger.md`, una cartella mai committata: è andato perso. Questo file lo sostituisce e va **tenuto aggiornato e committato** — non in scratchpad.

Da allora molte cose sono state chiuse (3 pilastri: consenso, denaro, blind — vedi §4), ma sono cambiate anche molte cose intorno (FattureInCloud, `contract_payments` a rate, la decisione "il contratto vale solo l'accettato"), quindi questo è un audit ripartito da zero sul codice attuale, non un aggiornamento cieco del vecchio elenco.

**Stato in breve:** su ~40 voci aperte, **26 sono state chiuse il 05/09/2026** (fix reali, deployati in produzione, i più critici verificati dal vivo). Restano aperte per scelta esplicita: 4 voci che sono **decisioni di prodotto** non delegabili (GER-01/03, DEN-01/02), alcune note "by design" non equivocabili per bug (GER-10, PREV-05, CONTR-05), e un piccolo numero di voci a basso rischio/basso beneficio lasciate deliberatamente intoccate per non introdurre regressioni in codice sensibile senza una revisione più ampia (vedi §3 per il dettaglio voce per voce, e §7 per l'elenco fix del 05/09).

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

- **GER-01 [CRITICO] — APERTO, decisione di prodotto.** Consenso fornitore assente, pattern sistemico: 4 percorsi creano una `collaboration` `ACTIVE` senza conferma del target. Prima di toccare codice serve decidere se il modello resta "avvisato, può togliersi" o deve diventare un vero flusso di accettazione bilaterale — non è stato deciso, quindi non è stato implementato nulla che cambi il comportamento di fondo.
- **GER-02 [ALTO] — CHIUSO 05/09.** Link d'invito email rotto per un fornitore già registrato: puntava a `/suppliers` (riservata al capostipite), ora punta a `/capostipiti` (pagina vera del fornitore). `supabase/functions/invite-supplier/index.ts`.
- **GER-03 [ALTO] — APERTO, decisione di prodotto** (legata a GER-01: senza decidere il modello di consenso, costruire l'UI di accettazione sarebbe costruire la cosa sbagliata).
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
- **PREV-06 [MEDIO] — APERTO, richiede una decisione di prodotto.** `snapshot_price` senza legame al prezzo di catalogo: un CHECK rigido romperebbe lo scopo dello "snapshot" (il prezzo può cambiare dopo). Serve decidere la semantica esatta del floor (solo su update dopo l'insert? quale tolleranza?) prima di scrivere un trigger.
- **PREV-07 [MEDIO] — CHIUSO 05/09.** Trigger che vincola `erogatore_e_capostipite=true` a `supplier_id = owner` del preventivo (o nullo). Migration `20260905210000`.
- **PREV-08 [BASSO] — CHIUSO 05/09.** Clamp frontend allineato a `0..100` (era `-1000..100`, promessa di "maggiorazione" mai davvero utilizzabile dal 2026-06-11); aggiunta traduzione dell'errore CHECK. `QuoteEditorPage.tsx`.
- **PREV-09 [BASSO] — CHIUSO 05/09.** Il PDF non-premium mostra ora la categoria vera del servizio (join `services`/`service_categories`) invece della stringa letterale "CATEGORIA". `supabase/functions/quote-generate-pdf/index.ts`.
- **PREV-10 [nota strutturale] — non toccato.** Triplicazione della logica blind su tre RPC parallele: resta un'area strutturalmente incline a disallineamenti futuri, ma unificarla è un refactor, non un fix puntuale.

### DENARO DI RETE

*(Tutte le voci DEN-* sono decisioni di prodotto esplicitamente escluse da questo giro di fix: toccare il modello economico del denaro di rete senza un allineamento con Giovanni sarebbe stato irresponsabile. Nessuna riga di questa sezione è stata modificata il 05/09.)*

- **DEN-01 [CRITICO] — APERTO, decisione di prodotto.** Tre libri contabili paralleli, mai riconciliati.
- **DEN-02 [CRITICO] — APERTO, decisione di prodotto.** Il cruscotto `/finanze-rete` resta spento; i trigger di calcolo continuano a girare in background.
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
- **CICLO-09 [MEDIO] — APERTO, richiede una decisione legale/prodotto.** `contracts_block_firmato_edit` non protegge `event_date` — ma bloccarla romperebbe `riprogramma_evento`, che legittimamente deve poter aggiornare la data anche su un contratto FIRMATO. La soluzione corretta (generare un addendum quando la data cambia post-firma) è una scelta di prodotto/legale, non un fix meccanico: non implementata.
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

## 5. Le 4 decisioni di prodotto ancora da prendere (bloccano il resto)

1. **GER-01/GER-03** — il reclutamento fornitori resta senza consenso reale o va costruito un vero flusso di accettazione bilaterale?
2. **DEN-01/DEN-02** — il cruscotto "Finanze rete" va acceso (e prima collegato agli altri due libri contabili), o il calcolo silenzioso va disattivato del tutto finché non si decide?
3. **PREV-06** — quale semantica di floor per `snapshot_price` rispetto al prezzo di catalogo?
4. **CICLO-09** — un cambio data post-firma su un contratto genera un addendum, o resta un aggiornamento silenzioso del solo campo `event_date`?

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
