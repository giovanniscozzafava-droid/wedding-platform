# Audit funnel Capostipite — Planfully

**Data:** 05/09/2026
**Metodo:** 5 ricognizioni indipendenti sul codice reale (grep sistematico + lettura di tutte le migration Supabase, sempre nella versione più recente quando una funzione è stata riscritta più volte, ordinando per timestamp nel nome file). Ogni affermazione è ancorata a `file:riga`.
**Perché esiste questo file:** il 05-08/08/2026 era già stato fatto un audit bilaterale (vedi memoria `project_planfully_capostipite_audit_bilaterale`), ma il suo registro dettagliato viveva in `scratchpad/audit-ledger.md`, una cartella mai committata: è andato perso. Questo file lo sostituisce e va **tenuto aggiornato e committato** — non in scratchpad.

Da allora molte cose sono state chiuse (3 pilastri: consenso, denaro, blind — vedi §4), ma sono cambiate anche molte cose intorno (FattureInCloud, `contract_payments` a rate, la decisione "il contratto vale solo l'accettato"), quindi questo è un audit ripartito da zero sul codice attuale, non un aggiornamento cieco del vecchio elenco.

---

## 1. Cos'è il "capostipite"

Un `WEDDING_PLANNER` o una `LOCATION` (mai un `FORNITORE`) può vendere ai clienti un preventivo "fornitore globale": aggrega voci di catalogo proprie e di fornitori esterni reclutati nella propria rete, applica un ricarico (markup) sulle voci esterne, e sceglie se vendere come:

- **BUNDLE** (pacchetto unico): fornitori nascosti (blind) di default; nel denaro, il capostipite incassa dal cliente e "dovrebbe" pagare il fornitore.
- **ITEMIZED** (voci separate): fornitori visibili di default; nel denaro, il fornitore incassa dal cliente e "dovrebbe" girare il margine al capostipite.

Non esiste un flag `is_capostipite`: è sempre `profiles.role IN ('WEDDING_PLANNER','LOCATION')`, ripetuto inline in ogni RPC (nessuna funzione centralizzata `is_capostipite()` — rischio di disallineamento se una copia viene dimenticata, vedi GER-07).

Gerarchia: **WP sta sopra LOCATION** — un WP può reclutare una LOCATION nel proprio team, il contrario no.

---

## 2. Il funnel end-to-end (fasi)

1. **Attivazione** — Il professionista imposta `capostipite_sale_mode` (BUNDLE/ITEMIZED) in Profilo (`SaleModeCard`). Nessun controllo di ruolo a livello DB (solo UI) → nota in PREV-*.
2. **Reclutamento fornitori** — 6 percorsi diversi e non uniformi per far entrare un fornitore in rete (§ GER-01÷GER-09): aggiunta diretta da "Scopri", invito email, referral, candidatura, invito peer capostipite↔capostipite. La maggioranza crea la collaborazione **attiva senza consenso**; le poche che chiedono consenso non hanno UI per accettarlo.
3. **Costruzione preventivo** — L'editor aggiunge voci proprie (`erogatore_e_capostipite`, niente ricarico) e voci esterne (con markup, blind per-voce). Il gate "solo capostipiti impostano markup" è solo in UI (§ PREV-01).
4. **Invio e visione cliente** — Il cliente vede `/p/preview` → `/p/accept` con blind applicato correttamente sulla maggior parte delle superfici, tranne una (§ PREV-03). Selezione à-la-carte per-voce (`client_decision`).
5. **Accettazione** — Due percorsi paralleli: quello nuovo/corretto (`quote-accept-sign`, con firma, fiscalità, gate "almeno una voce") e una RPC legacy ancora viva e ancora chiamata dal frontend che li bypassa tutti (§ CONTR-01).
6. **Contratto** — Generato automaticamente sul totale delle sole voci accettate (regola "R1", chiusa ad agosto — § CONTR, sezione "risolto"). Un solo contratto, un solo importo, sempre intestato al capostipite: il cliente non vede mai la scomposizione fornitore-per-fornitore nel testo legale.
7. **Vita dell'evento** — Riprogrammazione e annullamento hanno gap concreti sulla disponibilità dei fornitori esterni (§ CICLO-01÷04): il fornitore può risultare libero sulla data vera dell'evento dopo uno spostamento.
8. **Denaro** — Tre libri contabili paralleli e mai riconciliati tra loro: Stripe cliente→capostipite, rate contratto/FattureInCloud, e i "settlement di rete" capostipite↔fornitore (§ DEN-01÷08). Il cruscotto che dovrebbe mostrare quest'ultimo è spento in produzione dal giorno del suo deploy.
9. **Notifiche** — Capostipite e coppia restano spesso all'oscuro di eventi rilevanti della propria stessa rete (§ CICLO-05, CICLO-06).

---

## 3. Registro APERTO — strade morte, illogicità, bug da correggere

Severità: **CRITICO** (soldi/dati/prenotazioni doppie visibili all'utente) · **ALTO** (funzionalità promessa che non funziona/vicolo cieco reale) · **MEDIO** (inconsistenza o gap che si manifesta in casi non rari) · **BASSO** (rifinitura, codice morto, messaggio grezzo).

### GERARCHIA E RECLUTAMENTO

- **GER-01 [CRITICO] — Consenso fornitore assente, pattern sistemico.** Quattro percorsi diversi creano una `collaboration` `ACTIVE` senza alcuna conferma del fornitore/location target: `capostipite_add_supplier` (`20260606160000...sql:51-64`), `wp_add_location_to_team` (`20260621190000...sql:19-22`), trigger `referral_to_collaboration` alla registrazione con referral (`20260526430000...sql:11-32`), `approve_candidacy` quando il candidato è FORNITORE (`20260528270000...sql:73-79`). L'unico contrappeso è l'uscita self-service (`supplier_leave_collaboration`).
- **GER-02 [ALTO] — Link d'invito email rotto per un fornitore già registrato.** `invite-supplier/index.ts:437` genera `${APP_BASE}/suppliers?invite_from=${callerId}`, ma `/suppliers` è riservata a WP/LOCATION/ADMIN (`App.tsx:209-215`): un FORNITORE che clicca viene rimbalzato a `/`, perdendo il parametro (mai letto in **nessun** punto del frontend — verificato).
- **GER-03 [ALTO] — Nessuna UI di accettazione/rifiuto per una collaborazione `PENDING`, in nessuna delle due direzioni.** Capostipite→fornitore: `/capostipiti` mostra solo un badge, "Prezziario"/"Esci" sono `disabled` su tutto ciò che non è già `ACTIVE` (`SupplierCapostipitiPage.tsx:268,271`). Fornitore→capostipite: `/suppliers` mostra solo "Revoca" (solo su `ACTIVE`) — nessun bottone di approvazione, benché il commento SQL di `supplier_invite_capostipite` (`20260526100000...sql:137`) dichiari "il capostipite la accetta dalla sua pagina /suppliers" (falso/obsoleto).
- **GER-04 [MEDIO] — Invito capostipite↔capostipite: RPC morta + asimmetria signup/login.** `accept_supplier_invite` (`20260529100000...sql:184-215`) non è mai chiamata dal frontend. `CapostipiteInviteAcceptPage.tsx` gestisce solo il caso "nuovo utente" (`signUp`), a differenza del suo gemello per fornitori (`SupplierInviteAcceptPage.tsx`, che gestisce sia `signUp` che `signInWithPassword`). Un WP/LOCATION già iscritto che riceve un invito da un collega si vede proporre solo un form di registrazione, destinato a fallire (email già in uso), senza via di recupero.
- **GER-05 [MEDIO] — Candidatura LOCATION→WP silenziosamente inefficace.** `approve_candidacy` crea la collaboration solo se `v_other_role='FORNITORE'` (`20260528270000...sql:73`): una LOCATION che si candida e viene approvata resta "seguita" ma non entra mai nel team, senza errore visibile.
- **GER-06 [BASSO] — Notifiche assenti in due punti chiave.** `supplier_invite_capostipite` non avvisa il capostipite di una richiesta in arrivo; `supplier_leave_collaboration` non avvisa il capostipite quando un fornitore esce dalla rete.
- **GER-07 [ALTO] — Bug RLS: una LOCATION reclutata come "fornitore" diventa invisibile al capostipite.** `profiles_select_collab_supplier` (`20260521150200_rls.sql:66-70`) è hard-coded a `role='FORNITORE'`: non esiste l'equivalente per `role='LOCATION'`. Effetto verificato: `useSuppliers()`/`useSupplier()` scartano la riga (embed `profiles` = null), quindi la LOCATION reclutata **non compare mai** in `/suppliers`, la sua scheda dettaglio è vuota, e in `CatalogPage.tsx` (riga 311-322) le sue voci di catalogo restano visibili ma etichettate genericamente "Fornitore" con avatar rotto — perché la RLS su `services` (`services_select_collab`) **non** ha lo stesso filtro di ruolo. `profiles.profile_visibility`, unica via alternativa, è un campo morto (mai esposto in nessuna UI, resta sempre `PRIVATE`).
- **GER-08 [MEDIO] — La gerarchia WP>LOCATION è enforced solo in due RPC applicative, non in RLS.** `collab_insert_capo` (`20260521150200_rls.sql:120-130`) verifica solo il ruolo del *chiamante*, mai quello del *target*: un insert diretto in `collaborations` da una LOCATION con `fornitore_id` = un WP a piacere non verrebbe bloccato da RLS.
- **GER-09 [MEDIO] — Duplicazione architetturale.** `capostipite_add_supplier` e `wp_add_location_to_team` fanno la stessa identica cosa con due RPC separate — rischio di disallineamento se una viene corretta e l'altra no.
- **GER-10 [BASSO/nota] — Consenso "tacito" nel gate del contratto.** `quote_budget_readiness` (`20260808350000...sql:55-63`) considera una voce fornitore pronta se il **cliente** l'accetta OPPURE il fornitore la conferma: basta l'accettazione del cliente, il silenzio del vero fornitore assegnato equivale ad assenso implicito ai fini della firma del contratto.

### PREVENTIVO — BUNDLE/ITEMIZED, BLIND, MARKUP

- **PREV-01 [CRITICO] — Il gate "solo il capostipite imposta il markup" è solo in UI.** Nessuna RLS/trigger su `quotes`/`quote_items` controlla il ruolo di chi scrive (`quotes_update_owner`, `qitems_modify_owner`: solo `owner_id=auth.uid()`). `useSetSupplierMarkup` esiste ma non è mai invocato da nessun componente (feature morta).
- **PREV-02 [ALTO] — Lock ottimistico inutilizzato.** `quote_save_guarded` (con colonna `version` anti-concorrenza) esiste ma il vero percorso di scrittura (`useUpdateQuote`) fa un `.update()` diretto via PostgREST senza mai passare da lì: due editor sullo stesso preventivo in contemporanea si sovrascrivono a vicenda senza protezione.
- **PREV-03 [ALTO] — Leak blind residuo.** `couple_get_quote_detail` (usata quando la coppia guarda un preventivo diverso da quello principale) espone sempre la `photo` del servizio senza alcun controllo blind — a differenza delle due RPC gemelle (`client_portal_overview`, `couple_get_quote_for_entry`) già corrette con la fix N8. Una foto di servizio (spesso con watermark) può identificare il fornitore su una voce che dovrebbe restare cieca.
- **PREV-04 [MEDIO] — `quotes.default_markup_percent` è l'unico campo di markup senza floor/CHECK** (gli altri due, `item_markup_percent` e `quote_supplier_markups.markup_percent`, sono vincolati `0..1000`). Un valore molto negativo può spingere `line_client` sotto costo; l'unico argine è indiretto (`item_below_cost`, sollevato a cascata su un update bulk del trigger di default) e mostra un errore Postgres grezzo, non tradotto.
- **PREV-05 [ALTO] — Sconto totale del preventivo scavalca deliberatamente il guard "non sotto costo".** `handleTotalDiscount` lo dichiara nel proprio commento ("BUG2"): solo un avviso non bloccante se il margine finale è negativo — resta una scelta del capostipite, mai impedita.
- **PREV-06 [MEDIO] — `snapshot_price` modificabile liberamente sotto il prezzo di catalogo**, senza alcun legame a `services.base_price`. Poiché `line_cost` deriva da `snapshot_price`, questo riduce silenziosamente quanto il sistema calcola essere dovuto al fornitore esterno nei settlement di rete.
- **PREV-07 [MEDIO] — `erogatore_e_capostipite` non è vincolato a `supplier_id = owner_id`** da nessun CHECK/trigger. Se impostato per errore su una voce di un vero fornitore esterno, azzera il margine su quella voce **e** la esclude dal calcolo di quanto è dovuto al fornitore — nessuna barriera server-side.
- **PREV-08 [BASSO] — Discrepanza clamp UI/DB sugli sconti.** L'interfaccia promette "maggiorazione" (valori negativi, clamp `[-1000,100]`), ma i CHECK DB attuali accettano solo `0..100`: un valore negativo fallisce con un errore Postgres grezzo, non tradotto (specie in `handleTotalDiscount`, che non traduce nulla).
- **PREV-09 [BASSO] — PDF preventivo non-premium mostra la stringa letterale `"CATEGORIA"`** al posto del nome vero della categoria, perché quel ramo non fa join con `services`/`service_categories`.
- **PREV-10 [nota strutturale] — Triplicazione della logica blind** su tre RPC parallele (`quote_get_by_token`, `couple_get_quote_for_entry`, `client_portal_overview`), già causa di due leak storici distinti (N6, N8) corretti separatamente in migration diverse — area strutturalmente incline a disallineamenti futuri.

### DENARO DI RETE

- **DEN-01 [CRITICO] — Tre libri contabili paralleli, mai riconciliati.** `payments` (Stripe cliente→capostipite), `contract_payments` (rate contratto + fatture FattureInCloud), `network_settlements` (debiti/crediti capostipite↔fornitore). Nessuna FK/trigger/vista li unisce, pur condividendo `quote_id` come chiave potenziale — nessun codice fa quel join.
- **DEN-02 [CRITICO] — Il cruscotto `/finanze-rete` è spento in produzione da quando è stato creato** (flag `feature_flags.network_finance = false`, mai riacceso in nessuna migration successiva). **Ma i trigger che calcolano i settlement girano comunque sempre**, flag o non flag: il "denaro di rete" viene accumulato silenziosamente in DB da agosto 2026 senza che nessun capostipite possa vederlo o riconciliarlo.
- **DEN-03 [ALTO] — `mark_settlement_paid` non verifica il flag `network_finance`** (a differenza di `network_finance_overview`) — incoerenza tra le due RPC dello stesso sottosistema; è chiamabile via RPC diretta anche a feature "spenta".
- **DEN-04 [ALTO] — `payment-create` paga sempre e solo `owner_id`** (il capostipite), `application_fee=0`: nessuno split reale verso i fornitori di rete avviene o è possibile con lo schema attuale di `payments` (single-payee).
- **DEN-05 [ALTO] — Il margine in modalità ITEMIZED non transita mai in un flusso di cassa reale tracciato.** L'unico modo di "chiuderlo" è un click manuale su una dashboard oggi irraggiungibile (DEN-02): resta una scrittura contabile puramente interna.
- **DEN-06 [MEDIO] — Rischio di doppio conteggio in BUNDLE.** Il capostipite fattura (via FattureInCloud) l'intero importo, costo fornitore incluso; `network_settlements` registra separatamente lo stesso importo come debito verso il fornitore. Nessuna riconciliazione garantisce che, una volta incassato, il capostipite saldi davvero il fornitore.
- **DEN-07 [MEDIO] — Teardown parziale su preventivo `RIFIUTATO`.** I settlement con pagamenti già parzialmente registrati vengono congelati a `status='SALDATO'` azzerando il residuo dovuto, senza un flag esplicito tipo "annullato" che lo distingua da un vero saldo integrale.
- **DEN-08 [nota] — Nessuna predisposizione schema per un futuro split Stripe capostipite↔fornitore** (dichiarato "un domani" nei commenti, ma `payments` resta single-payee oggi).

### CONTRATTO

*(Nota: la vecchia decisione "il contratto vale il totale pieno" — R1 — è stata chiusa ad agosto sul percorso principale: `build_contract_sections`, `create_contract_from_clauses` e `contract_payments` usano oggi correttamente la somma delle sole voci accettate, con fallback al pieno solo se il cliente non ha ancora selezionato nulla per-voce. `quote-accept-sign` onora anche revoca/scadenza del token, contrariamente al vecchio audit di agosto.)*

- **CONTR-01 [CRITICO] — Una RPC legacy bypassa tutto e resta viva.** `quote_accept_by_token`, grantata a `anon`/`authenticated`, porta `quotes.status='ACCETTATO'` **senza** controllare `client_decision` per-voce, senza raccogliere firma/fiscalità, e senza il gate "almeno una voce accettata" introdotto in `quote-accept-sign`. È tuttora richiamata dal frontend (`useQuotes.ts` → `publicQuoteAccept()`), anche se non risultano altri chiamanti UI di quell'hook — resta comunque un endpoint DB vivo, invocabile direttamente da chiunque abbia un token preventivo valido, che riaprirebbe esattamente lo scenario "contratto sul totale pieno" che R1 doveva chiudere.
- **CONTR-02 [ALTO] — Un preventivo "accantonato" (`archived_at`) resta firmabile.** Né `quote-accept-sign`, né `quote_items_decide_by_token`, né `quote_get_by_token` controllano `archived_at`: un lead abbandonato/accantonato dal professionista resta apribile e firmabile via token finché il link non scade o viene revocato esplicitamente.
- **CONTR-03 [BASSO] — Codice morto:** il check `status === 'SCADUTO'` in `quote-accept-sign` è irraggiungibile (`SCADUTO` non è mai stato aggiunto all'enum Postgres `quote_status`).
- **CONTR-04 [MEDIO] — Doppio calcolo ridondante per `total_amount`** (sia nell'insert esplicito che nel trigger `contracts_sync_total`): è un rattoppo storico nato da un bug reale (un path di creazione contratto — "Compila con AI" — dimenticava la regola), non un design unificato. Se un futuro terzo path di creazione la dimentica di nuovo e cade fuori dal trigger (che esclude esplicitamente i contratti `SUPPLIER_WP`), il bug si riproduce.
- **CONTR-05 [nota strutturale, non un bug] — Nel modello capostipite il cliente firma un unico contratto/unico importo**, sempre intestato al capostipite: nessuna distinzione fornitore/blind nel testo legale. La contabilità interna capostipite↔fornitori (`network_settlements`, contratti `SUPPLIER_WP`) resta un livello completamente separato, mai esposto al cliente — coerente col modello "fornitore globale", ma va tenuto a mente come particolarità strutturale, non equivocarlo per un bug.
- **CONTR-06 [BASSO] — La formula "solo l'accettato" non distingue da sola "nessuna selezione ancora fatta" da "tutte le voci rifiutate esplicitamente".** Il guard che previene il secondo caso vive solo dentro `quote-accept-sign`: qualunque altro percorso che non lo replichi (inclusa la RPC legacy di CONTR-01) può produrre un contratto sul totale pieno anche a fronte di un rifiuto totale esplicito.

### CICLO DI VITA EVENTO E NOTIFICHE

- **CICLO-01 [CRITICO] — Dopo una riprogrammazione data, il fornitore esterno risulta libero sulla data vera dell'evento.** `riprogramma_evento` cancella il BUSY sulla vecchia data e aggiorna `quotes.event_date`, ma il trigger che tiene traccia della capacità reale (`auto_block_availability_from_quote`) non sposta la riga di `supplier_appointments` già esistente per quel `source_quote_id` (inserisce solo se non esiste già una riga) — il ricalcolo sulla nuova data trova zero appuntamenti e marca il fornitore **AVAILABLE** sulla data vera del matrimonio, che può quindi essere booking-ata da un terzo. La riga fantasma resta agganciata alla vecchia data, pronta a ridiventare BUSY per errore in futuro.
- **CICLO-02 [ALTO] — La "modifica forzata" data da editor bypassa completamente `riprogramma_evento`.** `handleForceEdit` non tocca `calendar_entries` (calendario disallineato), non libera nulla sulla vecchia data, non notifica i fornitori esterni, e le notifiche verso la coppia (email + in-app) sono chiamate separate **dopo** il salvataggio, ciascuna in try/catch che ingoia l'errore: se la rete cade nel mezzo, il cambio resta salvato ma nessuna notifica parte, né alla coppia né ai fornitori.
- **CICLO-03 [ALTO] — Nessun controllo di disponibilità al momento dell'accettazione finale.** `quote-accept-sign` non interroga mai `supplier_availability` prima di marcare `ACCETTATO`: due preventivi paralleli con lo stesso fornitore/stessa data possono essere entrambi accettati (doppia prenotazione reale); l'unica traccia è che la seconda UPSERT sovrascrive silenziosamente il riferimento del primo.
- **CICLO-04 [ALTO] — `annulla_evento` libera solo `supplier_availability`, mai `supplier_appointments`** (il modello di capacità che conta davvero): la riga resta orfana per sempre e può ridiventare BUSY se un futuro trigger ricalcola quella data per lo stesso fornitore.
- **CICLO-05 [MEDIO] — Il capostipite non è mai notificato quando un fornitore della sua rete esce dalla collaborazione** (`supplier_leave_collaboration` non scrive in `notifiche`, nessun trigger su `collaborations`).
- **CICLO-06 [MEDIO] — La coppia non è mai notificata quando un fornitore si ritira**, né quando ne viene assegnato un sostituto (`dropout_fornitore` notifica solo il WP).
- **CICLO-07 [MEDIO] — Transizioni di stato preventivo ancora illogiche e permesse**: `CONVERTITO_IN_CONTRATTO → BOZZA` (nessun guardrail legato all'esistenza di un contratto `FIRMATO` collegato: le colonne monetarie si "scongelano" anche così), `RIFIUTATO → BOZZA/INVIATO` senza distinguere se il rifiuto veniva da un `annulla_evento`, `ACCETTATO → INVIATO`.
- **CICLO-08 [MEDIO] — Un fornitore torna ad avere accesso PII/lista invitati/chat non appena il suo preventivo torna a `BOZZA` dopo un `RIFIUTATO`** (`is_collab_supplier_of_entry` si basa solo su `status <> 'RIFIUTATO'`), senza una nuova verifica esplicita di collaborazione attiva.
- **CICLO-09 [MEDIO] — `contracts_block_firmato_edit` non protegge `event_date`.** `quotes` e `contracts` possono divergere silenziosamente su stato/data anche a contratto `FIRMATO`, senza alcun vincolo di coerenza reciproca a livello DB.
- **CICLO-10 [BASSO] — Due sistemi di notifica paralleli e mai sincronizzati**: `notifiche` (letta da `NotificationBell`) e `user_notifications` (`push_user_notification`) — badge e contatori indipendenti.

---

## 4. Cosa invece regge (già corretto, non ri-aprire senza nuova evidenza)

- Pilastro "blind unificato" (agosto): `client_portal_overview`/`couple_get_quote_for_entry` nascondono correttamente nome e categoria-che-tradisce-il-mestiere sulle voci cieche (fix N6, N8) — resta solo il buco puntuale di PREV-03.
- Pilastro "consenso" incr.1-3: uscita self-service fornitore, `quote-send` blocca l'invio se una voce ha `supplier_presence='NO'`, teardown dell'accesso PII quando il fornitore non ha più una voce viva.
- Pilastro "denaro di rete" (calcolo): la logica BUNDLE/ITEMIZED di `_populate_network_settlements` è corretta in entrambi i rami — il problema non è il calcolo, è che nessuno lo vede e non è collegato al resto (§ DEN).
- Decisione "il contratto vale solo l'accettato" (R1): chiusa sul percorso principale (non sulla RPC legacy, CONTR-01).
- `quote-accept-sign` onora oggi `token_revoked_at`/scadenza (il vecchio audit diceva il contrario: era vero ad agosto, non più oggi).
- Cascade-delete di un preventivo: oggi ripulisce correttamente `supplier_availability`/`supplier_appointments` (trigger `_tg_quote_cleanup_before_delete`).
- Ambito "ruolo sugli eventi", isolamento del catalogo dal capostipite, scoping dell'area cliente via JWT: confermati tenuta in tutte le verifiche.

---

## 5. Le 6 cose più urgenti, se si deve scegliere da dove iniziare

1. **CONTR-01** — chiudere/droppare la RPC legacy `quote_accept_by_token` o farla passare dagli stessi gate di `quote-accept-sign`: è l'unico varco rimasto per un contratto sul totale pieno indesiderato.
2. **CICLO-01 + CICLO-03** — doppia prenotazione reale (su riprogrammazione e su accettazione concorrente): tocca la fiducia dei fornitori nella rete, non solo un dato sbagliato.
3. **GER-01 + GER-03** — decisione di prodotto: si vuole *davvero* il reclutamento senza consenso (modello "avvisato, può togliersi"), o serve un vero flusso di accettazione? Oggi è un ibrido che non funziona in nessuna delle due letture (crea PENDING che poi non si possono accettare da nessuna parte).
4. **DEN-01 + DEN-02** — decisione di prodotto sul denaro di rete: accendere il cruscotto (e prima collegarlo agli altri due libri contabili), o disattivare del tutto il calcolo silenzioso finché non si decide?
5. **GER-07** — bug RLS concreto e riproducibile (LOCATION invisibile come fornitore reclutato): fix piccolo e isolato, alto valore.
6. **PREV-01** — gate markup lato server: oggi chiunque scriva sulla riga del preventivo può impostare un ricarico, il controllo di ruolo esiste solo perché l'interfaccia lo nasconde.
