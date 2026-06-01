# Planfully — Specifica completa delle regole di business

_Documento di analisi. Stato: produzione al 1 giugno 2026._
_Scopo: descrivere TUTTE le regole della piattaforma, così che possano essere verificate per coerenza e correttezza._

Planfully è un SaaS che mette in connessione **professionisti dell'event/wedding** (wedding planner, location, fornitori) e i loro **clienti** (coppie di sposi o clienti diretti), per gestire in un unico posto: lead, preventivi, contratti con firma elettronica, pianificazione evento, e relazione col cliente.

---

## 1. Ruoli (chi è chi)

| Ruolo | Descrizione | Dashboard |
|---|---|---|
| `WEDDING_PLANNER` | Capostipite: coordina l'intero evento. | App professionista |
| `LOCATION` | Capostipite alternativo (la location fa da regista). | App professionista |
| `FORNITORE` | Eroga un servizio specifico (foto, fiori, catering, musica…). Ha un **subrole** (es. `fotografo`, `catering`, `musica`). | App professionista |
| `COUPLE` | Coppia di sposi, cliente di un capostipite, con un evento/matrimonio. | `/couple` |
| `CLIENT` | Cliente diretto di uno o più fornitori (anche non connessi tra loro). | `/area-cliente` |
| `ADMIN` | Super-utente. | Tutto |

**Regola — "capostipite":** WEDDING_PLANNER, LOCATION e ADMIN sono trattati come *capostipiti* (chi può coordinare un intero evento, raccogliere preventivi di terzi, gestire il budget totale). FORNITORE non è capostipite.

**Regola — creazione profilo:** alla registrazione il ruolo arriva dai metadati. Default `WEDDING_PLANNER` se assente. Un invito fornitore valido forza `FORNITORE`. Il ruolo `CLIENT` nasce già "onboardato" (nessun wizard professionista).

---

## 2. Modello commerciale capostipite ↔ fornitori

Due modelli (decisi a inizio progetto, influenzano chi firma cosa):

- **GLOBAL**: il capostipite contratta l'**intero** matrimonio col cliente; poi i singoli fornitori contrattano **con il capostipite** (mark-up del capostipite nascosto al fornitore).
- **BROKER**: il capostipite è organizzatore, ma la coppia firma **direttamente con ogni fornitore**; il capostipite prende una fee separata.

### 2.1 Ambito dell'incarico del capostipite (`ambito_capostipite`)
Definito per evento. Determina dinamicamente il workflow e **chi firma il contratto**:

| Ambito | Significato | Effetto |
|---|---|---|
| `COMPLETO` | Gestisce l'intero budget end-to-end. | Flusso classico: preventivi → preventivo firmato → contratto col cliente → pianificazione. **Il contratto col cliente si firma solo a budget completo approvato.** |
| `SOLO_COORDINAMENTO` | Coordina ma **non** gestisce l'intero budget. | Salta preventivi/contratto del capostipite. **I fornitori firmano il contratto direttamente col cliente; il capostipite supervisiona.** |
| `SOLO_PROPRI_SERVIZI` | Eroga solo servizi propri. | In fase preventivi compone menu/servizi propri, non raccoglie preventivi esterni. |
| `NULL` | Non ancora deciso. | Default operativo `COMPLETO`; il front-end propone la scelta a `INCARICO_FIRMATO`. |

**Regola chiave (budget):** il concetto di "budget totale" è **esclusivo dei capostipiti**. Un fornitore che fa un preventivo al proprio cliente **non** ha alcuna nozione di budget da approvare.

**Regola — gate contratto (server-side):** un contratto `CLIENT_WP` (capostipite↔cliente) in ambito `COMPLETO` può essere creato **solo** se `quote_budget_readiness` è pronto (tutti i fornitori terzi confermati). In ambito ristretto il gate passa (il fornitore contratta col cliente). Questo è imposto nel database, non solo nell'interfaccia.

**Regola — supervisione:** in ambito ristretto il capostipite (owner dell'evento) può vedere i contratti che i fornitori firmano col cliente per quel suo evento (`capostipite_event_supplier_contracts`).

---

## 3. Macchina a stati dell'evento (`evento_stato`)

```
LEAD → INCARICO_FIRMATO → PREVENTIVI → PREVENTIVO_FIRMATO →
CONTRATTO → PIANIFICAZIONE → CHECKLIST → SVOLTO        (+ ANNULLATO)
```

- **LEAD**: il capostipite propone l'incarico; la coppia lo firma dalla sua area.
- **INCARICO_FIRMATO**: si sceglie l'ambito; poi si raccolgono preventivi (o si va dritti in pianificazione se `SOLO_COORDINAMENTO`).
- **PREVENTIVI → PREVENTIVO_FIRMATO**: si compone e si invia il preventivo totale; la coppia firma.
- **CONTRATTO**: generazione contratto dalle clausole standard; la coppia firma.
- **PIANIFICAZIONE → CHECKLIST → SVOLTO**: timeline, tavoli, invitati, checklist operativa, evento.

Ogni stato genera una **"prossima mossa"** (notifica) per il capostipite e una per la coppia, adattata all'ambito.

---

## 4. Preventivi (quotes)

### 4.1 Stati del preventivo (`quote_status`)
```
BOZZA → INVIATO → ACCETTATO → CONVERTITO_IN_CONTRATTO
                → RIFIUTATO
```

**Regole di integrità (vincoli DB):**
- `ACCETTATO` richiede `accepted_at` valorizzato (vincolo `quotes_accettato_requires_accepted_at`).
- Doppia firma impedita: `unique(quote_id, quote_revision)` sull'accettazione.
- Importi non negativi su voci/preventivo (vincoli check dedicati).
- Le transizioni di stato sono protette da trigger; regressioni illegali bloccate.

### 4.2 Due tipi di preventivo
- **Capostipite → cliente (wedding)**: preventivo totale dell'evento, con voci proprie e di fornitori terzi; mark-up; budget.
- **Fornitore → cliente diretto** (`quotes.direct_client_id` valorizzato, riferito a `supplier_clients`): preventivo autonomo col **brand del fornitore**, **senza budget**.

### 4.3 Mark-up (solo capostipite)
- Per ogni voce: **costo** (quanto il capostipite paga al fornitore) e **prezzo cliente** (quanto il cliente paga). Differenza = margine.
- Mark-up globale (es. 20%) applicato a tutte le voci, sovrascrivibile voce per voce.
- **Il fornitore non vede mai il prezzo cliente, solo il proprio costo concordato.**

### 4.4 Conferma fornitori e prontezza budget (`quote_budget_readiness`)
- **Fornitore diretto** (`direct_client_id`): ambito `FORNITORE_DIRETTO`. Pronto = stato in (`ACCETTATO`, `CONVERTITO_IN_CONTRATTO`). Nessuna logica di budget. _"Il contratto si firma all'accettazione."_
- **Capostipite COMPLETO**: pronto solo quando **tutti** i fornitori terzi non-capostipite hanno confermato la propria voce; altrimenti "In attesa di conferma del budget totale: X di Y".
- **Capostipite ambito ristretto**: pronto all'accettazione (il contratto col cliente non passa dal capostipite).

### 4.5 Modifica forzata
- Un preventivo già firmato (`ACCETTATO`) è in sola lettura. Con "Modifica forzata" + motivo obbligatorio si crea una nuova revisione: il cliente riceve email, deve ri-firmare; lo storico firme resta intatto.

### 4.6 event_kind (tipo evento) e questionario
- Ogni preventivo ha un `event_kind` (matrimonio, battesimo, comunione, cresima, compleanno, anniversario, laurea, corporate, altro).
- **Regola (corretta in questa sessione):** il questionario/profilatore mostrato al cliente fa riferimento **a quel** tipo di evento (es. una cresima non mostra domande da matrimonio). Vale anche per il profilatore della landing pubblica (stili e priorità event-aware).

---

## 5. Contratti

### 5.1 Stati (`contract_status`)
```
BOZZA → INVIATO → FIRMATO        (+ ANNULLATO)
```
- `FIRMATO` richiede `signed_at`.
- Possibile firma **offline** (caricamento PDF controfirmato + dati firmatario).

### 5.2 Tipi di contratto (`party_kind`)
- `CLIENT_WP`: capostipite ↔ cliente.
- `SUPPLIER_WP`: fornitore ↔ capostipite (modello GLOBAL).
- `SUPPLIER_CLIENT`: fornitore ↔ cliente diretto (modello BROKER / ambito ristretto / fornitore standalone).

### 5.3 Generazione
- Da preventivo `ACCETTATO` → bottone "Genera contratto" → contratto in `BOZZA` con **15 articoli legali** pre-compilati (premesse, oggetto, corrispettivo rateizzato 30/40/30, recesso, forza maggiore, GDPR, diritti immagine, clausole vessatorie, foro). Editabili prima dell'invio.
- **Catena (enforced):** un contratto `CLIENT_WP` richiede il preventivo collegato in stato `ACCETTATO` (trigger).

---

## 6. Firma elettronica (FES)

- Firma Elettronica Semplice ex art. 20 CAD (D.lgs. 82/2005), valida tra privati.
- Alla firma si registrano: nome, **tipo e numero documento**, IP, dispositivo, data/ora, **hash crittografico** del documento. Questi dati costituiscono la prova legale.
- Idempotenza: la firma è protetta da race (no doppia firma); audit trail immutabile.

### 6.1 Accesso via token
- Il cliente apre preventivo/contratto via **link con token** (UUID), senza login: `/p/preview/:token`, `/p/accept/:token`, `/p/reject/:token`, `/p/contract/:token`.
- `quote_get_by_token` espone solo i campi necessari + branding del fornitore + subrole/event_kind per il questionario dinamico.
- **Da migliorare (noto):** i token preventivo/contratto **non scadono** effettivamente; valutare scadenza/monouso.

---

## 7. Disponibilità del fornitore

- Ogni fornitore ha un calendario "Disponibilità": verde=libero, giallo=forse, rosso=occupato.
- **Blocco automatico:** quando un preventivo che coinvolge il fornitore passa a `ACCETTATO` (o un contratto a `FIRMATO`), la data si blocca in rosso con motivazione.
- **Auto-conflitto escluso:** un preventivo non blocca il fornitore contro sé stesso.
- **Sblocco:** sezione "Prossime date bloccate"; lo sblocco da contratto avverte che NON annulla il contratto; lo sblocco da preventivo chiede se la trattativa è saltata.
- **Note aperte:** una regressione di stato (`ACCETTATO`→`BOZZA`) dovrebbe liberare la data BUSY; per eventi multi-giorno il rilascio dovrebbe coprire tutti i giorni (oggi solo `date_from`).

---

## 8. Alert di disintermediazione e conflitti

- Se un fornitore della rete di un capostipite crea un preventivo **diretto** con la stessa coppia (match per email, nome, o data+location), il sistema **segnala** al capostipite l'alert di disintermediazione in tutte le pagine.
- Conflitti di disponibilità (BUSY/TENTATIVE) mostrati in fase di preventivo.

---

## 9. Rete fornitori, inviti, collaborazioni

- Un capostipite invita un fornitore via email; il fornitore si registra gratis e accetta la collaborazione (`PENDING` → `ACCEPTED` **solo a conferma email**, non al semplice insert).
- Un fornitore può aggiungere capostipiti; `capostipite_add_supplier` crea sempre una collaborazione `PENDING` (consenso).
- Esiste un sistema di **referral/candidature** tra professionisti (con stati e ricompense/rewards).

---

## 10. Lead generation

### 10.1 Form pubblico e profilazione
- Ogni professionista ha una **landing pubblica** (`/p/wp/:slug`, `/p/fornitore/:slug`, o URL pulito `/:slug`).
- Form di richiesta preventivo con **profilazione event-aware**: dati cliente, tipo evento, data, invitati, budget orientativo, **stile** e **priorità** (che cambiano in base al tipo evento), storia, must-have, no-thanks. Anti-bot via honeypot.
- Le risposte di profilazione si propagano nel **questionario** del preventivo/matrimonio (la coppia potrà rivederle).

### 10.2 Instradamento del lead (`submit_public_lead`, anon)
- Slug di **capostipite** (WP/LOCATION/ADMIN) → riga in `lead_requests` (flusso wedding) + notifica email.
- Slug di **FORNITORE** → riga in `supplier_clients` (cliente diretto), stato `LEAD`.
- Honeypot pieno → finto successo, nessuna scrittura.

### 10.3 Form embeddabile (Wix & co.)
- Pagina `/embed/lead/:slug` self-contained per `<iframe>`: stili inline, event-aware, **auto-resize** via `postMessage`, parametri `?primary`, `?bg=transparent`, `?compact`.
- Pagina **"Integrazione sito"** per il professionista: genera lo snippet `<iframe>` (universale + variante auto-resize), anteprima live, istruzioni Wix/Squarespace/WordPress/Webflow/Shopify, link diretto. Disponibile per **tutti** i professionisti (capostipiti e fornitori).

### 10.4 Conversione del lead
- Il capostipite trasforma un lead in evento+preventivo (`create_event_from_lead`): nasce un `calendar_entry` (stato `LEAD`) + `quote` (`BOZZA`) con la profilazione già nel questionario. Riusa l'evento se esiste già stesso cliente+data.

### 10.5 Funnel e percentuali (motivazionali)
- Metriche per professionista (`professional_funnel_metrics`): lead → inviati → accettati → contratti, con **percentuali di passaggio**: tasso di invio (inviati/lead), **tasso di accettazione** (accettati/inviati), tasso di contratto (firmati/accettati); valore vinto, valore medio, momentum ultimi 30 giorni.
- Presentate in dashboard con microcopy **adattiva** e stimolante (incoraggia il professionista a restare attivo).

---

## 11. Cliente diretto e Area cliente

### 11.1 Anagrafica
- Un fornitore gestisce i clienti diretti in `supplier_clients` (anagrafica + stato LEAD/TRATTATIVA/CLIENTE/ARCHIVIATO).

### 11.2 Area cliente aggregata (`/area-cliente`)
- Il cliente accede con **link magico** (OTP via email; nessuna password) all'email a cui ha ricevuto il preventivo; al primo accesso nasce un profilo `CLIENT`.
- `client_portal_overview` aggrega, **per email verificata del JWT**, tutti i preventivi/contratti ricevuti, **raggruppati e distinti per professionista** — anche fornitori **non connessi tra loro**.
- **Regola chiave:** ogni relazione col singolo fornitore è mostrata separatamente e in modo ordinato (fotografo a sé, band a sé, ecc.). Sono **sempre** presenti preventivi e contratti.

### 11.3 Brief di competenza (fornitore → cliente)
- Per ogni preventivo, il fornitore compila un **brief** (`supplier_client_briefs`) con ciò che riguarda la **sua** competenza: etichetta+data di consegna (es. "Consegna foto"), una lista `[{label, value}]` (scaletta del fotografo, setlist/brani della band, menu del catering…), una nota.
- Quando lo **condivide**, il cliente lo vede nella sua area accanto a preventivo e contratto.
- **Regola:** il cliente vede **solo** informazioni di competenza del singolo fornitore (a differenza del capostipite che vede tutto), ma **sempre** anche contratti e preventivi.

---

## 12. Team / sotto-fornitori del fornitore

- Ogni fornitore costruisce il proprio **team** (`supplier_team_members`): band → musicisti, fotografo → secondo shooter/aiutanti. Campi: nome, ruolo (es. "Chitarra"), telefono, attivo/inattivo.
- Per ogni **turno/evento** (`supplier_team_events`: titolo, data, ritrovo, luogo) il fornitore segna la **presenza** di ciascun membro: `PRESENTE` / `FORSE` / `ASSENTE` (come turni di lavoro).
- **Export PDF** del foglio presenze, da condividere (es. nel gruppo della band).
- Tutto è privato del fornitore (RLS `supplier_id = auth.uid()`).

---

## 13. Pianificazione evento (lato capostipite/coppia)

- Suite: invitati (con età/accessibilità/allergie), tavoli, sotto-eventi, timeline/scaletta, cerimonia, menu/stazioni, mood board, playlist, logistica (trasporti/alloggi), gadget, sito ospiti con RSVP.
- **Regola coppia:** i dati operativi sono in **sola lettura** per la coppia; può **suggerire** modifiche ("Suggerisci/Richiedi sblocco"); il capostipite riceve la richiesta, viene notificato e può lavorare "a quattro mani". Le richieste di modifica della **data** seguono un flusso dedicato.
- **Regola dati:** una data dichiarata nel preventivo è la stessa ovunque venga mostrata; si può solo "richiedere modifica data".
- **Sito ospiti:** link pubblico `/w/:slug`; gli ospiti confermano presenza (RSVP idempotente) con allergie/accompagnatori; i dati rientrano automaticamente in "Invitati".

---

## 14. Notifiche e "prossima mossa"

- Per ogni evento attivo si rigenera la "prossima mossa" del capostipite e della coppia in base a stato + ambito.
- Notifiche per scadenzario, promemoria, riconciliazione pagamenti, eventi di cambiamento, digest email.
- **Note aperte:** alcune coppie/eventi non ricevono tutte le notifiche per disallineamento tra due fonti di membership (`calendar_entry_participants` vs `wedding_couple_members`).

---

## 15. Pagamenti / finanza / prodotti collegati

- Corrispettivo rateizzato (default 30/40/30); scadenzario; riconciliazione incassi; statistiche margine per il capostipite.
- Il fornitore vede solo i propri importi (concordato, incassato, residuo), **mai** i totali del matrimonio.
- Prodotti "presto": Finanziamento, Assicurazione (badge SOON).

---

## 16. Social / community

- Feed di network tra professionisti (post, articoli, like, commenti, trending), follow/follower con richieste, recensioni e "stelle" pubbliche.
- **Regole di visibilità:** le coppie/sposi non hanno il feed da professionista; un visitatore pubblico anonimo non può navigare dentro l'app (solo contenuti pubblici + richiesta preventivo); niente leak cross-tenant nei reels/feed.

---

## 17. Pricing / beta

- Stato beta e prezzi pianificati per ruolo (`beta_status`): fornitore gratis fino al 30/09/2026, poi €29/mese; WP partner fondatori gratis; coppie mai a pagamento.

---

## 18. Sicurezza e multi-tenancy (RLS)

- Ogni WP/coppia/fornitore/cliente **vede solo i propri dati** (RLS testata impersonando i ruoli reali).
- ~90 funzioni `SECURITY DEFINER` con `search_path` pinnato (no injection).
- Le funzioni pubbliche (anon) espongono solo campi filtrati via RPC dedicate.
- **Fix critico (questa sessione):** tre tabelle audit/interne (`quote_acceptances_audit`, `contracts_legacy_audit`, `lead_submit_attempts`) erano senza RLS e con `GRANT ALL` ad anon → esponevano PII (incl. numero documento), token d'accesso e audit firme. Ora: RLS attiva + `REVOKE ALL` da anon/authenticated. **Da valutare:** rotazione dei token già esposti.
- **Note aperte (hardening):** scadenza token; `profiles_select_public` ritorna troppe colonne se un profilo diventasse PUBLIC (oggi nessuno); constraint anti-valori assurdi (prezzi negativi, date invertite) pronti ma non applicati; spostare interamente lato server il gating di business.

---

## 19. Regole introdotte/risolte in questa sessione (delta)

1. **Bug A — fornitore senza budget:** un preventivo `direct_client_id` non passa più dal gating budget; `FORNITORE_DIRETTO`, pronto all'accettazione.
2. **Bug B — questionario per tipo evento:** selettore `event_kind` nell'editor preventivo; il questionario al cliente fa riferimento a quel tipo evento.
3. **Bug B-bis — profilatore landing event-aware:** stili e priorità non più fissi su matrimonio.
4. **Form lead embeddabile** per Wix e quasi tutti i builder (iframe universale + auto-resize), per tutti i professionisti.
5. **Ruolo CLIENT + Area cliente aggregata** per professionista (più fornitori distinti), con **brief di competenza** fornitore→cliente, sempre preventivi+contratti.
6. **Gate contratto ambito lato server** + supervisione capostipite dei contratti fornitore→cliente.
7. **Percentuali funnel** motivazionali in dashboard.
8. **Team/sotto-fornitori** con presenze per turno + export PDF.
9. **FAQ:** pulsante "Torna alla mia dashboard" per la coppia; le coppie non entrano in viste da professionista.

---

## 20. Punti aperti da validare (per l'analisi)

- Scadenza/monouso dei token preventivo/contratto.
- Rilascio disponibilità su regressione di stato e su eventi multi-giorno.
- Allineamento delle due fonti di membership coppia (notifiche mancanti).
- Applicazione dei constraint anti-valori assurdi su dati di produzione esistenti.
- Provisioning account `CLIENT`: oggi via magic link su email del preventivo; valutare invito esplicito dal professionista + inclusione del link area-cliente nelle email transazionali.
- Coerenza GLOBAL/BROKER ↔ `party_kind` del contratto in tutti i percorsi.
```
_Fine specifica._
