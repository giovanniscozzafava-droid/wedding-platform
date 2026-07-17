# PLANFULLY — BUSINESS PLAN
## Modulo Maestranze + Sistema "In Pancia"
### Pricing, posizionamento, architettura legale, proiezioni

**Versione 1.1 — 17 luglio 2026** (corregge la 1.0 del 16/07: vedi §0.1)
**Documento interno — Fuyue Srl**

> STATO: **CONGELATO / GATED** — documento di strategia, non un ordine di build.
> Non costruire nulla prima dei gate: Maestranze = parere giuslavorista (bloccante,
> §5.1); In Pancia = decisione prezzi post-interviste settembre + struttura incasso
> (§11.5). Vedi [PRP-Maestranze-v3.md](PRP-Maestranze-v3.md) per lo scope tecnico.

---

## 0. NOTA DI METODO E CORREZIONI

Questo documento sostituisce la bozza discussa in chat. Prima di tutto, tre correzioni rispetto a quella bozza — perché un business plan con numeri sbagliati è peggio di nessun business plan:

**Correzione 1 — Province italiane.** Nella bozza avevo scritto "600 province". L'Italia ha **107 province** (incluse le città metropolitane). Questo cambia radicalmente l'analisi: 173.272 matrimoni / 107 province ≈ **1.620 matrimoni/anno per provincia media** (non 290). La conseguenza è positiva: il valore del tier Provinciale è molto più alto di quanto stimato, perché la "pancia" di una provincia copre un volume d'eventi 5-6 volte superiore.

**Correzione 2 — Densità capostipiti.** Con 1.620 matrimoni/provincia, i capostipiti attivi per provincia non sono 5-7 ma realisticamente **30-80** (tra location con più di 10 eventi/anno e wedding planner strutturati). Questo rafforza la value proposition del tier Provinciale e giustifica il prezzo.

**Correzione 3 — Fonte del limite "10 per categoria".** Il massimale di 10 fornitori in pancia per categoria per capostipite è una **decisione di prodotto**, non un dato di mercato. Va dichiarato come tale: è il meccanismo che crea scarsità artificiale (vedi §6.3). Se lo cambi, cambia il pricing.

Tutti i numeri di mercato citati hanno fonte esplicita. Tutte le assunzioni sono marcate **[ASSUNZIONE]**. Tutte le decisioni ancora aperte sono marcate **[DECISIONE]**.

### 0.1 Correzioni della v1.1 (17/07/2026)

La v1.0 è stata sottoposta a verifica aritmetica riga per riga. **Reggono**: tutti i dati di mercato (§2.1), gli MRR di scenario (1.115 / 3.993 / 7.110), il mix paganti 70/24/6, il test del mezzo evento (0,25 e 0,64), il 468€ = 1,56%, i 300-800 posti provinciali, gli scenari MRR a M12 (4.266 / 11.376). Quattro cose no:

**Correzione 4 — Revenue Year 1: ~46.200€, non ~64.000€.** Integrando la rampa MRR dichiarata dal documento stesso (0 → 1.115 a M3 → 3.993 a M6 → 7.110 a M12), la cumulata per competenza del primo anno è **46.149€**. La v1.0 dichiarava 64.000€: **+39% di scarto**, cioè 17.851€ che non esistono. L'errore è concettuale, non di calcolo: un anno di ramp-up rende **circa metà** del run-rate d'uscita (7.110 × 12 = 85.320€ → ~46k), non tre quarti. Corretto in §1 e §7, con la tabella mese per mese che prima mancava — ed è proprio la sua assenza ad aver reso l'errore invisibile.

**Correzione 5 — Break-even operativo: mese 1, non "mese 8-10".** La v1.0 si contraddiceva: §1 diceva "mese 8-10", §7 diceva "praticamente immediato". Ha ragione §7. Con costi <200€/mese, il MRR di break-even (250€) è superato **al primo mese** (332€ già a ottobre). Il numero sbagliato stava nell'executive summary, cioè nell'unica pagina che un lettore esterno legge davvero.

**Correzione 6 — La conversione free→paid al 50% ora è marcata [ASSUNZIONE].** 150 paganti su 300 registrati = **50%**, che la v1.0 presentava come dato di piano senza marcarlo. È l'assunzione più fragile del documento — più della densità capostipiti — e §10 stessa elenca "nessuno converte" tra i rischi Media/Alto. Ora è dichiarata e sottoposta a sensitivity (§7.4).

**Correzione 7 — Lo scenario conservativo ha un meccanismo, non un -40% arbitrario.** Scoperto durante la verifica: una conversione al **30%** invece che al 50% produce un MRR M12 di **4.266€** — cioè *esattamente* lo scenario conservativo della v1.0. Il "-40%" non era una sensitivity generica: era, senza saperlo, l'ipotesi "la conversione è 30%". Riscritto in §7.3 come tale, così lo scenario diventa falsificabile invece che decorativo.

---

## 1. EXECUTIVE SUMMARY

**Cosa vendiamo.** Due prodotti distinti sulla stessa infrastruttura:

1. **In Pancia** — abbonamento per fornitori che garantisce presenza automatica nel catalogo preventivi dei capostipiti di un'area geografica. Non è pubblicità: è distribuzione. Il fornitore non compra visibilità generica, compra l'ingresso nel flusso di lavoro di chi decide.
2. **Maestranze** — bacheca chiusa di professionisti operativi (camerieri, assistenti fotografo, musicisti extra, coordinatori) consultabile da capostipiti e fornitori. Gratuita al lancio, monetizzata in fase 2.

**Perché ora.** Il mercato wedding italiano vale ~173.000 matrimoni/anno con un costo medio di ~23.800€ per evento: un mercato da **~4,1 miliardi €/anno**. La filiera lavora con strumenti scollegati (Excel, WhatsApp, agende cartacee). Il problema del reperimento di manodopera operativa qualificata è il più citato dai professionisti del settore — ed è esattamente ciò che il Rapporto sul lavoro invisibile (novembre) documenterà con dati nostri.

**Modello di ricavo.** SaaS B2B a tier geografici per i fornitori (39/59/99€ mese), upgrade opzionale per capostipiti (fase 2), Maestranze free-to-paid (fase 2). Nessuna commissione sulle transazioni: questo è il pilastro del posizionamento anti-marketplace e anche il pilastro della difesa legale (§5).

**Numeri chiave Year 1 (scenario base):** ~300 fornitori registrati, ~150 paganti **[ASSUNZIONE: conversione 50%, §7.4]**, revenue per competenza **~46.000€**, MRR d'uscita 7.110€ (run-rate ~85.000€/anno). Break-even operativo **al primo mese** (costi <200€/mese, MRR di pareggio 250€): la struttura costi rende il break-even un non-problema. Il vincolo vero non è la cassa, è il tempo (§7.5).

**Il vero asset non è il revenue Year 1.** È il network effect: ogni capostipite firmato porta 15-40 fornitori, ogni fornitore in pancia ha uno switching cost crescente (perdere la pancia = perdere il flusso preventivi). Il moat è la rete firmata, non il codice.

---

## 2. IL MERCATO

### 2.1 Dimensione e trend

| Dato | Valore | Fonte |
|---|---|---|
| Matrimoni Italia 2024 | 173.272 | ISTAT |
| Trend vs 2023 | -5,9% | ISTAT |
| Calo al Sud | -8,3% | ISTAT |
| Costo medio matrimonio | ~23.800€ | Matrimonio.com / osservatori settore |
| Valore mercato stimato | ~4,1 mld €/anno | Calcolo: 173.272 × 23.800€ |
| Matrimoni per provincia (media) | ~1.620/anno | Calcolo: 173.272 / 107 |

**Lettura onesta del trend:** il mercato è in **contrazione strutturale** (-5,9% anno su anno, peggio al Sud, che è il nostro territorio di partenza). Questo non è un dettaglio da nascondere in appendice: è il contesto in cui vendiamo. La conseguenza strategica è che **il nostro pitch non può essere "più matrimoni"** — nessuno strumento porta più matrimoni in un mercato che si contrae. Il pitch corretto è: **in un mercato che si restringe, vince chi ha accesso garantito al flusso di lavoro residuo**. La contrazione è un argomento *a favore* dell'In Pancia, non contro: quando la torta si riduce, il posto a tavola diventa più prezioso.

### 2.2 Economia dei fornitori (chi paga)

| Categoria | Tariffa/evento | Eventi/anno tipici | Ricavo annuo lordo |
|---|---|---|---|
| Fotografo | 1.500–3.000€ (media 1.850€) | 15–25 | 22.000–46.000€ |
| Fiorista | 1.000–3.000€ | 10–15 | 15.000–30.000€ |
| Catering | ~125€/persona (~12.500€/evento da 100) | 8–15 | margine 15-25% |
| Musicista/Band | 500–6.000€ | 15–30 | 15.000–40.000€ |
| Wedding Planner | 2.000–4.000€ | 10–20 | 20.000–60.000€ |
| Location | 2.000–6.000€/giorno | 25–40 | 75.000–150.000€ |

**Il numero che conta per il pricing:** un fornitore medio incassa **1.000–3.000€ per singolo evento acquisito**. Quindi un abbonamento annuale da 468€ (tier Provinciale) si ripaga con **meno di mezzo evento**. Questo è il fondamento matematico di tutta la struttura prezzi: il costo dell'abbonamento deve stare sotto la soglia psicologica di "un pezzo di un lavoro" (§6.2).

### 2.3 Densità capostipiti per provincia

**[ASSUNZIONE]** Con 1.620 matrimoni/provincia media e considerando che una location media gestisce 25-40 eventi/anno e un planner strutturato 10-20:

- Location attive per provincia: 20–50
- Wedding planner strutturati per provincia: 10–30
- **Totale capostipiti indirizzabili per provincia: 30–80**

Questa assunzione va **validata con le 50 interviste di settembre**. Se il numero reale è più basso (es. 15-25), il tier Provinciale va riprezzato al ribasso o il valore va comunicato diversamente. È il singolo dato più importante da verificare prima di finalizzare i prezzi — **secondo solo alla conversione free→paid (§7.4)**, che è però verificabile solo sul campo, non in intervista.

---

## 3. I DUE PRODOTTI

### 3.1 In Pancia — cosa compra davvero il fornitore

Il fornitore in pancia appare **automaticamente** nel catalogo preventivi di tutti i capostipiti dell'area scelta. Quando Rosella costruisce un preventivo per un matrimonio, i fotografi in pancia sono già lì, con listino aggiornato, selezionabili con una spunta.

Tre proprietà che nessun competitor offre:

1. **La pancia segue il capostipite, non il territorio dell'evento.** Un fotografo in pancia ai capostipiti di Catanzaro appare nei loro preventivi anche quando organizzano un evento a Milano. Il fornitore compra la *relazione*, non la geografia dell'evento.
2. **Irremovibilità.** Una volta in pancia, il fornitore non può essere rimosso dal capostipite (salvo violazione dei termini). Questo è controintuitivo — e va gestito con attenzione (§3.2) — ma è ciò che rende l'abbonamento un *asset* e non una spesa.
3. **Massimale 10 per categoria.** Ogni capostipite ha al massimo 10 fornitori in pancia per categoria. Chi entra, occupa un posto finito.

### 3.2 Il conflitto strutturale da gestire subito

C'è una tensione che il business plan deve nominare, perché emergerà alla prima demo: **l'irremovibilità è un valore per il fornitore ma un costo per il capostipite.** Il capostipite si trova nel proprio catalogo preventivi fornitori che non ha scelto e non può togliere. Se il capostipite percepisce la pancia come spam nel suo strumento di lavoro, abbandona la piattaforma — e senza capostipiti la pancia non vale niente. Il prodotto muore dal lato demand.

**Mitigazioni obbligatorie (da PRP):**

- Il capostipite può **ordinare e nascondere visivamente** i fornitori in pancia dal proprio editor preventivi (non rimuoverli dalla pancia: non vederli nel flusso quotidiano). Il fornitore resta tecnicamente "in pancia" — presente nel catalogo, ricercabile, incluso nei suggerimenti — ma il capostipite controlla la propria vista.
- La pancia **non genera notifiche** al capostipite. Zero interruzioni.
- Cap rigido a 10 per categoria: il catalogo non diventa mai una discarica.

**[DECISIONE]** Va deciso se "nascosto visivamente" è compatibile con ciò che vendiamo al fornitore. La mia raccomandazione: sì, ed è da dichiarare nei termini del fornitore ("presenza garantita nel catalogo, non posizionamento garantito"). Vendere di più sarebbe vendere una bugia che esplode alla prima lamentela.

### 3.3 Maestranze — cosa è e cosa non è

Bacheca chiusa (visibile solo a utenti registrati) dove professionisti operativi del settore eventi pubblicano un profilo: nome, foto, zona, competenze, esperienza dichiarata, disponibilità, fascia prezzo opzionale. Capostipiti e fornitori cercano per filtri **informativi** (zona, competenza, esperienza) e contattano via chat interna.

**Cosa Maestranze non fa, per progetto:**
- Non processa pagamenti tra le parti
- Non fa matching algoritmico né ranking
- Non verifica credenziali
- Non mostra rating pubblici
- Non prende commissioni

Ognuna di queste assenze è una **scelta legale deliberata** (§5). Il prodotto è volutamente "stupido": una bacheca. La sofisticazione sta nella rete, non nella feature.

---

## 4. POSIZIONAMENTO E PSICOLOGIA DI MERCATO

### 4.1 Il posizionamento in una frase

> **Matrimonio.com vende visibilità a chiunque paghi. Planfully vende un posto finito nella filiera di chi decide.**

Il marketplace tradizionale vende *impression*: il fornitore paga per essere visto da sposi che confrontano 40 profili. Planfully vende *distribuzione*: il fornitore entra nello strumento con cui il professionista costruisce il preventivo. La differenza non è di grado, è di natura — ed è la stessa differenza che c'è tra fare pubblicità a un ristorante e stare nel menu.

### 4.2 I meccanismi psicologici — dichiarati, non nascosti

Uso questi termini perché li hai chiesti, ma con una premessa: questi meccanismi funzionano solo se il valore sottostante è reale. Applicati a un prodotto vuoto, accelerano solo il churn.

**Scarsità reale (non artificiale nel senso deteriore).** Il cap di 10 per categoria crea posti finiti. "Nella tua provincia restano 3 posti per fotografi" è una frase vera, verificabile dal fornitore, e attiva l'avversione alla perdita: il costo percepito non è 39€/mese, è *il collega che prende il tuo posto*. La ricerca sulla loss aversion (Kahneman-Tversky) è consistente: le perdite pesano circa il doppio dei guadagni equivalenti. Il messaggio di vendita corretto non è "guadagna visibilità" ma "non restare fuori".

**Ancoraggio.** Il confronto di riferimento non è con altri SaaS ma con ciò che il fornitore già paga: Matrimonio.com costa ai fornitori centinaia di euro l'anno per stare in una vetrina affollata. Il nostro pitch ancora lì: "quello che paghi per essere uno tra quaranta, qui ti compra uno tra dieci — dentro lo strumento di lavoro, non in vetrina".

**Effetto dotazione (endowment).** L'irremovibilità trasforma l'abbonamento in proprietà percepita. Dopo 6 mesi in pancia, disdire non è "smettere di comprare un servizio" ma "rinunciare a un posto che è mio". Questo è il motore della retention prevista al 85-90%: non la soddisfazione, la proprietà.

**Prova sociale gerarchica.** Nel wedding la reputazione scende dall'alto: se La Baronella usa Planfully, i suoi fornitori si fidano. Per questo il GTM parte dai capostipiti e non dai fornitori — il fornitore non compra una piattaforma, compra l'accesso a un capostipite che rispetta. Ogni capostipite firmato è un argomento di vendita verso 15-40 fornitori.

**Decoy pricing (effetto esca).** Nella struttura 39/59/99, il tier Regionale a 59€ fa da ponte: rende il Provinciale "l'opzione prudente" e il Nazionale "l'opzione ambiziosa". La distribuzione attesa (70% provinciale, 24% regionale, 6% nazionale tra i paganti) è coerente con i pattern classici good-better-best. Nota: ho portato il Nazionale da 109€ a **99€** — sotto la soglia psicologica delle tre cifre "piene", e la perdita di 10€ su un tier che peserà il 6% dei paganti è irrilevante rispetto al beneficio di conversione.

### 4.3 Perché "nessuna commissione" è il messaggio, non un dettaglio

Ogni euro di commissione ci renderebbe: (a) un intermediario agli occhi della legge (§5), (b) un marketplace agli occhi del mercato, (c) un parassita agli occhi del fornitore. L'abbonamento flat è l'unico modello coerente con tutti e tre i piani — legale, posizionamento, psicologico. Il fornitore che chiude un matrimonio da 2.000€ trovato via Planfully non ci deve niente: questa frase, in un settore abituato alle commissioni dei portali, è il singolo argomento di vendita più potente che abbiamo.

---

## 5. ARCHITETTURA LEGALE

**Premessa obbligatoria: io non sono un avvocato e questo non è un parere legale.** Questa sezione struttura il problema e le difese progettate, ma la validazione spetta al giuslavorista — la domanda è già formulata e va inviata **prima del lancio di Maestranze**, non dopo. Considera questa sezione il brief per quel parere.

### 5.1 Il rischio principale: intermediazione di lavoro

Il D.Lgs. 276/2003 riserva l'attività di intermediazione tra domanda e offerta di lavoro a soggetti autorizzati (agenzie iscritte all'albo) o a regimi particolari (art. 6, incluse le piattaforme in certi casi). Esercitare intermediazione senza autorizzazione comporta sanzioni penali e amministrative. La domanda legale è: **Maestranze è intermediazione?**

**La nostra tesi: no, è una bacheca informativa.** Gli elementi distintivi che la sostengono, tutti implementati by design:

| Elemento tipico dell'intermediario | Maestranze |
|---|---|
| Compenso legato alla transazione di lavoro | **Nessuna commissione, mai.** Eventuale abbonamento fase 2 = accesso alla bacheca, non fee su ingaggio |
| Selezione/matching attivo dei candidati | **Nessun matching.** Filtri informativi impostati dall'utente; risultati in ordine casuale o cronologico, mai per ranking |
| Valutazione delle credenziali | **Nessuna verifica.** Tutto è autodichiarato, e dichiarato come tale |
| Partecipazione alla contrattazione | **Zero.** Contratto, compenso e regolarizzazione sono affare esclusivo delle parti |
| Rating pubblici che orientano la scelta | **Feedback privato** tra le due parti, non pubblico, non influenza visibilità |

**Punto di attenzione che il giuslavorista deve sciogliere:** il tier premium fase 2 per le maestranze (abbonamento per *restare* in bacheca) e il tier capostipiti per *vedere il telefono*. Monetizzare l'accesso al contatto avvicina pericolosamente la fattispecie all'intermediazione onerosa. La mia raccomandazione conservativa: **la fase 2 non si attiva senza parere scritto favorevole.** Se il parere è negativo, la monetizzazione resta tutta sul lato In Pancia (fornitori), che non ha questo problema perché non riguarda rapporti di lavoro ma fornitura di servizi tra imprese.

### 5.2 Il secondo rischio: favoreggiamento del lavoro nero

Una bacheca dove camerieri si offrono per matrimoni è, realisticamente, un luogo dove qualcuno cercherà lavoro non regolarizzato. Non possiamo impedirlo; possiamo dimostrare di non favorirlo. I **6 strati di protezione** (decisi in sessione, qui formalizzati):

1. **Disclaimer strutturale** — visibile in ogni pagina del modulo, non solo nei T&C: "Planfully è una bacheca informativa. Non siamo un'agenzia per il lavoro, non intermediamo, non verifichiamo. La regolarizzazione del rapporto è responsabilità esclusiva delle parti."
2. **Dichiarazione consapevole al signup** — checkbox obbligatoria con autodichiarazione del regime: P.IVA / lavoro subordinato disponibile / cerco esclusivamente contratti regolari / non dichiaro. Il valore non è informativo, è probatorio: sposta la responsabilità dichiarativa sull'utente.
3. **Linee Guida PDF per chi ingaggia** — come regolarizzare una prestazione occasionale, quando serve la P.IVA, cos'è il contratto a chiamata nel settore eventi. Documento che dimostra condotta attiva di promozione della legalità.
4. **Email automatica post-contatto** — a entrambe le parti, promemoria degli obblighi di regolarizzazione. Traccia documentale sistematica.
5. **T&C sezione dedicata** — responsabilità fiscale delle parti + diritto di Planfully di sospendere profili con pattern riconducibili a lavoro irregolare.
6. **Monitoraggio backend** — metadati dei contatti (chi contatta chi, quando — non il contenuto) + flag automatici su keyword esplicite nella chat. **Attenzione GDPR:** il flagging automatico del contenuto chat è trattamento di dati che richiede informativa specifica, base giuridica solida (legittimo interesse documentato con LIA) e va dichiarato. Non è un dettaglio tecnico, è un punto per il DPO/legale.

### 5.3 GDPR e dati delle maestranze

Il profilo maestranza contiene dati personali (nome, foto, zona, competenze) esposti a una platea di utenti business. Punti obbligati:

- **Base giuridica:** consenso esplicito alla pubblicazione del profilo, revocabile con effetto immediato (il profilo scompare).
- **Minimizzazione:** la fascia prezzo è opzionale by design — corretto. La zona è a livello provincia, mai indirizzo.
- **Chat interna:** conservazione dei metadati va dichiarata con retention definita (raccomando 24 mesi). Il contenuto resta privato; il flag automatico va in informativa.
- **Diritto all'oblio:** cancellazione profilo = rimozione da ogni ricerca entro 24h, dai backup entro 30 giorni (standard già a Dossier).
- **Registro trattamenti:** il modulo Maestranze è un trattamento nuovo, va aggiunto al registro di Fuyue Srl.

### 5.4 Lato In Pancia: il rischio è contrattuale, non regolatorio

L'In Pancia è B2B puro (fornitura di servizi tra imprese): niente intermediazione di lavoro, niente problema. I rischi sono contrattuali:

- **Cosa garantiamo esattamente?** "Presenza nel catalogo preventivi" — non lead, non contratti, non fatturato. Il contratto di abbonamento deve escludere esplicitamente ogni garanzia di risultato commerciale, altrimenti il primo fornitore che non chiude un lavoro in 6 mesi chiede il rimborso citando pubblicità ingannevole.
- **L'irremovibilità va scritta in entrambi i contratti:** in quello del fornitore come diritto (finché paga), in quello del capostipite come condizione d'uso della piattaforma. Il capostipite deve accettarla al signup, non scoprirla dopo.
- **Clausola di rimozione per violazione:** serve una procedura definita (segnalazione → verifica → contraddittorio → rimozione), non discrezionalità pura, o il primo fornitore rimosso fa causa.

### 5.5 Cosa serve, in ordine, prima del lancio

1. Parere giuslavorista su Maestranze v1 (bacheca gratuita) — **bloccante per il lancio del modulo**
2. Parere sulla fase 2 (monetizzazione maestranze + telefono) — bloccante per la fase 2, non per il lancio
3. T&C: sezione Maestranze + contratto abbonamento In Pancia (con esclusione garanzia di risultato)
4. Aggiornamento informativa privacy + registro trattamenti + LIA per il monitoraggio chat
5. Linee Guida PDF (posso produrle io come bozza, valida il legale)

---

## 6. PRICING — RAZIONALE COMPLETO

### 6.1 Struttura definitiva proposta

**Fornitori (In Pancia):**

| Tier | €/mese | €/anno | Cosa compra |
|---|---|---|---|
| Candidato (Free) | 0 | 0 | Profilo visibile e ricercabile manualmente |
| **In Pancia Provinciale** | **39** | 468 | Pancia automatica di tutti i capostipiti della provincia |
| **In Pancia Regionale** | **59** | 708 | Idem, tutta la regione |
| **In Pancia Nazionale** | **99** | 1.188 | Idem, tutta Italia |

**Nota v1.1 — i prezzi annuali sono 12× il mensile esatto, cioè sconto zero.** Così com'è, il piano annuale non ha alcuna ragione di essere scelto da nessuno: è il mensile con un vincolo in più. O si toglie la colonna, o si decide uno sconto annuale — che è una **[DECISIONE]** aperta, non un dettaglio di listino, perché è l'unica leva di cassa disponibile a un bootstrap (§7.6, §11.6).

**Maestranze:** free al lancio. Fase 2 (6-12 mesi): 5-10€/mese, **solo con parere legale favorevole** (§5.1).

**Capostipiti:** free per sempre sul core (coerente col GTM: sono loro il moat). Upgrade fase 2 per telefono diretto maestranze: 19-29€/mese, stessa condizione legale.

### 6.2 Perché questi numeri e non altri

**Il vincolo dal basso:** sotto i 30€/mese il prezzo comunica "tool", non "canale commerciale". Un fornitore che valuta 19€/mese lo confronta con Canva; a 39€ lo confronta con quanto spende per procurarsi lavoro. Il frame di confronto è parte del prodotto.

**Il vincolo dall'alto:** il tier d'ingresso deve stare sotto l'1,5-2% del ricavo annuo del fornitore mediano (~30.000€). 468€/anno = 1,56%. Sopra il 2,5% l'abbonamento entra nella lista delle spese "da tagliare a gennaio", che è esattamente quando si rinnovano gli abbonamenti nel settore (le decisioni si prendono nov-feb, come da strategia Rapporto).

**Il test del mezzo evento:** ogni tier deve ripagarsi con meno di un evento acquisito. Provinciale: 468€ / 1.850€ (fotografo medio) = 0,25 eventi. Nazionale: 1.188€ = 0,64 eventi. Tutti passano. Questo è l'argomento che il commerciale usa in chiusura: "se in dodici mesi da qui esce *mezzo* matrimonio, sei in pari".

**Perché 99 e non 109:** soglia delle tre cifre. Il salto percepito 59→99 è "40 euro"; 59→109 è "il doppio e passa". Sul 6% dei paganti, i 10€ persi valgono ~90€/mese a regime: irrilevanti contro l'attrito di conversione.

**[DECISIONE] Quando finalizzare:** i numeri restano provvisori fino alle interviste di settembre. La domanda da fare in intervista non è "pagheresti 39€?" (risposta inutile, tutti dicono forse) ma, alla Mom Test: "quanto hai speso l'anno scorso per procurarti clienti, e su quali canali?". Il prezzo si posiziona rispetto a quella risposta.

### 6.3 La scarsità come motore del pricing power

Con 30-80 capostipiti/provincia e cap di 10 per categoria, i posti provinciali per categoria sono 300-800. Sembrano tanti, ma i posti *nei capostipiti che contano* (quelli con 30+ eventi/anno) sono molti meno — e il fornitore lo sa. La dinamica prevista: i primi entrano a 39€, e quando le pance dei capostipiti migliori si riempiono, il prezzo per i nuovi ingressi può salire **senza toccare chi è dentro** (grandfathering). Il pricing power cresce col riempimento: è il contrario della pubblicità, dove più inserzionisti = meno valore per ciascuno.

**Implicazione per il futuro posizionamento prezzo (orizzonte 18-36 mesi):**

- Anno 1: 39/59/99 — prezzo di penetrazione, obiettivo riempire le pance
- Anno 2: nuovi ingressi a 49/79/129 nelle province mature; chi è dentro resta al prezzo d'ingresso (l'endowment diventa anche economico: il posto vale più di quanto lo paghi)
- Anno 3: possibile tier "Pancia Prioritaria" (posizionamento in alto nella vista capostipite) — **solo se** compatibile col patto di non-ranking di Maestranze; per l'In Pancia B2B non c'è vincolo legale, ma c'è un vincolo di coerenza di prodotto da valutare allora

Il grandfathering va **annunciato dal giorno uno**: "il prezzo a cui entri è il tuo per sempre" è contemporaneamente un acceleratore di conversione (urgenza vera, non da countdown finto) e il fondamento della retention.

---

## 7. PROIEZIONI REVENUE — TRE SCENARI

**[ASSUNZIONE]** Tutte le proiezioni assumono: lancio commerciale ottobre 2026 (post-interviste), 5 capostipiti attivi entro dicembre (da GTM esistente), conversione free→paid guidata dal riempimento pance, churn trascurabile nel primo anno (l'endowment regge — se non regge, vedi §9 KPI churn).

### 7.1 Scenario Base — la rampa mese per mese

La v1.0 dichiarava solo tre punti (M3, M6, M12) e una cumulata. Era proprio l'assenza della tabella mensile a nascondere l'errore dei 64.000€. Qui la rampa completa, con interpolazione lineare tra i punti dichiarati:

| M | Mese | Prov. | Reg. | Naz. | MRR | Cumulata |
|---|---|---|---|---|---|---|
| 1 | ott 26 | 7 | 1 | 0 | 332€ | 332€ |
| 2 | nov 26 | 13 | 3 | 1 | 783€ | 1.115€ |
| 3 | **dic 26** | **20** | **4** | **1** | **1.115€** | 2.230€ |
| 4 | gen 27 | 35 | 9 | 2 | 2.094€ | 4.324€ |
| 5 | feb 27 | 50 | 13 | 3 | 3.014€ | 7.338€ |
| 6 | **mar 27** | **65** | **18** | **4** | **3.993€** | 11.331€ |
| 7 | apr 27 | 72 | 21 | 5 | 4.542€ | 15.873€ |
| 8 | mag 27 | 78 | 24 | 6 | 5.052€ | 20.925€ |
| 9 | giu 27 | 85 | 27 | 6 | 5.502€ | 26.427€ |
| 10 | lug 27 | 92 | 30 | 7 | 6.051€ | 32.478€ |
| 11 | ago 27 | 98 | 33 | 8 | 6.561€ | 39.039€ |
| 12 | **set 27** | **105** | **36** | **9** | **7.110€** | **46.149€** |

**Revenue Year 1 per competenza: ~46.100€.** (La v1.0 diceva 64.000€: sbagliato di +39%, vedi §0.1 Correzione 4.) **MRR d'uscita 7.110€ = run-rate annuo ~85.300€**: è questo il numero che descrive l'azienda a settembre 2027, non la cumulata. La cumulata dice quanto hai incassato *mentre* costruivi; il run-rate dice cosa hai costruito.

### 7.2 I tre scenari, corretti

| Scenario | Ipotesi sottostante | MRR M12 | Run-rate | **Revenue Y1** | (v1.0 diceva) |
|---|---|---|---|---|---|
| **Conservativo** | conversione 30% (§7.3) | 4.266€ | 51.200€ | **~27.700€** | ~38.000€ |
| **Base** | conversione 50% | 7.110€ | 85.300€ | **~46.100€** | ~64.000€ |
| **Ottimistico** | Rapporto genera traction, 2-3 province piene | 11.376€ | 136.500€ | **~73.800€** | ~102.000€ |

Gli MRR erano giusti; erano le cumulate a essere gonfiate, tutte e tre dallo stesso errore di integrazione.

### 7.3 Lo scenario conservativo non è un "-40%": è un'ipotesi precisa

Scoperta della verifica v1.1: **una conversione free→paid al 30% (invece del 50% del base) produce un MRR M12 di 4.266€ — cioè esattamente lo scenario conservativo della v1.0.** Il "-40%" non era una sensitivity a caso: era, senza dichiararlo, l'ipotesi "la conversione è 30% e non 50%".

Questo è un miglioramento sostanziale del piano, non un dettaglio: uno scenario con un meccanismo dichiarato è **falsificabile in corso d'opera** (a M6 guardi la conversione e sai in quale scenario sei), mentre un "-40% generico" si può solo constatare a fine anno.

### 7.4 [ASSUNZIONE] Conversione free→paid al 50% — il numero più fragile del piano

La v1.0 dava per scontati 150 paganti su 300 registrati senza marcarlo. Va marcato, perché **50% è un valore fuori scala per un freemium** (il benchmark tipico è 2-5%) e perché la rampa lo assume già alta fin da subito (31% a M3, 48% a M6).

La difesa dell'assunzione esiste ed è seria: il nostro free **non è un freemium classico**. Il fornitore non arriva da un annuncio ma dall'invito del capostipite con cui già lavora (§8.1, conversione attesa su quel canale 30-50%), e il free **non dà la pancia**, cioè non dà la cosa per cui uno si iscrive. Non stiamo convertendo curiosi: stiamo convertendo persone mandate dal proprio cliente principale.

Ma la difesa vale solo se **quasi tutti i registrati arrivano dal canale caldo** e convertono **al massimo** del range dichiarato. Basta che una delle due condizioni si allenti perché il 50% diventi 30%. Il 50% va quindi trattato come **tetto dello scenario base, non come base**:

| Conversione (su 300 registrati) | Paganti | MRR M12 | Run-rate |
|---|---|---|---|
| 10% | 30 | 1.422€ | 17.100€ |
| 20% | 60 | 2.844€ | 34.100€ |
| **30%** (= scenario conservativo) | 90 | 4.266€ | 51.200€ |
| **50%** (= scenario base) | 150 | 7.110€ | 85.300€ |

Sotto il 20% il piano non regge come progetto full-time e va ripensato prima di settembre 2027, non dopo. Nota che §10 elenca già "Free è abbastanza, nessuno converte" tra i rischi **Media/Alto**: il piano base assume il 50% e il registro rischi dice che potrebbe non convertire nessuno. Le due cose convivono solo se il 50% è dichiarato come tetto — è quello che fa questa versione.

### 7.5 Break-even

Con costi correnti (~200€/mese infra + tooling) il break-even operativo è al MRR ~250€, superato **al primo mese** (332€ già a ottobre). La v1.0 diceva "mese 8-10" nell'executive summary contraddicendo il proprio §7: era sbagliata. Con questa struttura costi, il break-even non è un evento — è un non-problema, e va tolto dai numeri che presentiamo come traguardi.

**Il break-even vero è sul tuo tempo.** Il piano ha senso se a M12 il MRR (~7.000€) giustifica un anno di lavoro full-time. Nello scenario conservativo (4.266€ MRR) siamo al limite: quel numero è la soglia sotto la quale a settembre 2027 va riaperta la discussione strategica, non prolungata l'agonia. **La soglia resta valida ed è invariata** rispetto alla v1.0, perché è definita sull'MRR — che era corretto. Cambia però il contesto di cassa: nel conservativo il primo anno porta **~27.700€**, non 38.000. Sono ~10.000€ in meno di ossigeno per una decisione che va presa comunque.

### 7.6 Competenza vs cassa — e l'unica leva disponibile

I 46.100€ sono **competenza**. La cassa dipende da come fatturi:

| Quota che paga annuale anticipato | Cassa incassata in Y1 |
|---|---|
| 0% (tutti mensili) | 46.198€ |
| 25% | 55.979€ |
| 50% | 65.759€ |
| 100% | 85.320€ |

Va detto per onestà: **i 64.000€ della v1.0 sarebbero raggiungibili come cassa se ~46% dei paganti pagasse annuale anticipato.** Ma (a) la v1.0 non lo dichiarava da nessuna parte, quindi non era quello il calcolo; (b) il listino annuale è 12× esatto, sconto zero — nessuno sceglie l'annuale a queste condizioni; (c) sarebbe comunque cassa, non ricavo, e presentarla come "revenue" in un piano è esattamente il tipo di scivolone che rende un business plan inattendibile.

**Ma la leva è reale ed è l'unica che abbiamo** (niente investitori, niente debito): un annuale scontato porta cassa avanti di mesi. E ha una coerenza col resto del modello che il mensile non ha — l'annuale **è** l'endowment (§4.2) tradotto in contratto, e si sposa col grandfathering ("blocchi il prezzo per sempre, paghi 12 mesi"). Da qui la **[DECISIONE] §11.6**.

### 7.7 Cosa NON è in questi numeri

- Ricavi Maestranze fase 2 (condizionati al parere legale)
- Ricavi upgrade capostipiti (idem)
- Il tier premium capostipiti esistente da Dossier (preventivi illimitati, PDF brandizzati) — che è un ricavo separato, non lo mischio qui per non gonfiare il piano
- Qualsiasi churn (assunto trascurabile in Y1 — se l'endowment non regge, la rampa va rifatta)

---

## 8. GO-TO-MARKET

### 8.1 La sequenza (integrata col GTM esistente)

Il GTM di Maestranze/In Pancia **non è un GTM nuovo**: si aggancia alla sequenza già decisa (gate → interviste → Rapporto → 250 contatti → 10 founders → 5 capostipiti). L'ordine è vincolante:

**Fase 0 — Riempire le pance dei capostipiti firmati (ott-nov 2026).** Nessuna vendita fredda ai fornitori. Ogni capostipite firmato porta la lista dei suoi 15-40 fornitori abituali: sono loro i primi invitati, con un messaggio che non è "prova Planfully" ma "*[La Baronella]* usa Planfully per i preventivi: entra nel suo catalogo". Conversione attesa su questo canale: 30-50% (contro il 2-5% del cold outreach), perché la prova sociale è gerarchica (§4.2). **È questo canale a reggere l'intera assunzione di conversione del piano (§7.4): se i registrati smettono di arrivare da qui, la conversione crolla verso i benchmark di mercato.**

**Fase 1 — Il Rapporto come artiglieria (nov 2026-gen 2027).** Il Rapporto sul lavoro invisibile documenta esattamente il problema che Maestranze risolve. Ogni uscita stampa/social del Rapporto termina con la stessa CTA: la bacheca esiste, è gratuita, iscriviti. Le maestranze si acquisiscono qui, a costo zero, nel momento dell'anno (nov-feb) in cui il settore pianifica la stagione. **Attenzione al lato B:** il Rapporto porta registrati *freddi*, che convertono come il mercato (2-5%), non come gli invitati. Ottimo per le maestranze (che sono free), ma diluisce la conversione media dei fornitori — cioè il KPI di §7.4 va letto **segmentato per canale**, o il successo del Rapporto sembrerà un peggioramento.

**Fase 2 — Scarsità comunicata (feb-mag 2027).** Quando le prime pance si riempiono, la comunicazione cambia da "entra" a "restano N posti". Solo numeri veri, verificabili in piattaforma. Prima campagna paid solo qui (500€/mese test), quando c'è un meccanismo di urgenza reale da amplificare.

### 8.2 Il messaggio, per segmento

| Segmento | Leva | Messaggio tipo |
|---|---|---|
| Fornitore (via capostipite) | Prova sociale + FOMO | "Sei tra i fornitori di [nome]? Il suo catalogo preventivi ora è su Planfully. I primi 10 per categoria entrano in pancia." |
| Fornitore (freddo, fase 2) | Scarsità + ancoraggio | "Nella tua provincia restano N posti per [categoria]. Nessuna commissione: 39€/mese, il prezzo d'ingresso è per sempre." |
| Maestranza | Dignità professionale | "Il tuo mestiere ha un nome. Fatti trovare da chi organizza gli eventi della tua zona. Gratis." (registro coerente col Rapporto) |
| Capostipite | Zero costo, zero rumore | "I tuoi fornitori, i loro listini, le maestranze della tua zona: dentro lo strumento con cui fai i preventivi. Per te è gratis." |

### 8.3 Cosa non fare

- **Non vendere In Pancia prima di avere 5 capostipiti attivi.** Un fornitore che paga 39€ per una pancia vuota churna in 60 giorni e brucia il passaparola nella provincia — che è piccola e parla.
- **Non fare sconti** (sul prezzo di listino). Il grandfathering È lo sconto. Aggiungere -20% promozionali distrugge sia l'ancoraggio sia la credibilità della scarsità. *Nota: lo sconto annuale di §7.6 non è uno sconto sul prezzo, è un prezzo diverso per un impegno diverso — non tocca l'ancoraggio del mensile.*
- **Non promettere lead.** Mai, in nessun materiale. Vendiamo presenza nel flusso di lavoro, non risultati (coerenza legale §5.4 e di posizionamento).

---

## 9. KPI

| KPI | M3 | M6 | M12 | Perché questo KPI |
|---|---|---|---|---|
| Capostipiti attivi (≥1 preventivo/mese) | 5 | 8 | 15 | Il moat. Tutto il resto deriva da qui |
| Fornitori per capostipite (media in pancia) | 4 | 7 | 9 | Misura il riempimento → pricing power |
| **Conversione free→paid, per canale** | **31%** | **48%** | **50%** | **L'assunzione su cui poggia il piano (§7.4). Da leggere segmentata: invitati vs freddi** |
| % pance piene (10/10) per categoria top | 0% | 15% | 40% | Trigger della revisione prezzi |
| MRR | 1.115€ | 3.993€ | 7.110€ | |
| Cumulata (competenza) | 2.230€ | 11.331€ | 46.149€ | Corretta in v1.1 (era 64k) |
| Churn mensile paganti | <5% | <3% | <2% | L'endowment funziona? Si vede qui |
| Maestranze registrate | 50 | 200 | 500 | Densità minima utile: ~30/provincia attiva |
| Contatti maestranze/mese | 20 | 80 | 250 | La bacheca vive o è un cimitero di profili? |

Il KPI-guida resta il **secondo** (fornitori per capostipite): se a M6 la media è sotto 5, il problema non è il marketing, è la value proposition — e va capito prima di spendere in acquisizione.

Il KPI-**sentinella** è il terzo (conversione). È nuovo in v1.1 e serve a sapere *in corso d'opera* in quale scenario sei: a M6, conversione ≥45% = scenario base, ~30% = conservativo, <20% = il modello va ripensato. Senza questo KPI la differenza tra gli scenari si scopre a settembre 2027, cioè troppo tardi per farci qualcosa.

---

## 10. RISCHI

| Rischio | Prob. | Impatto | Mitigazione |
|---|---|---|---|
| Parere giuslavorista negativo su Maestranze | Bassa | Alto | Design già conservativo; se negativo, lancio solo In Pancia (B2B, nessun problema) e Maestranze si ridisegna col legale |
| Capostipiti rifiutano l'irremovibilità | Media | Alto | Controllo vista (§3.2) + accettazione esplicita al signup + niente notifiche. Da testare nelle interviste di settembre |
| **Free è abbastanza, nessuno converte** | Media | Alto | Il free NON dà la pancia. La conversione è guidata dal riempimento, non da feature gating artificiale. **v1.1: quantificato in §7.4 — il piano base assume 50%, il conservativo è il 30%. KPI sentinella a M6 (§9): sotto il 20% si ripensa il modello, non si insiste** |
| Densità capostipiti/provincia sotto stima | Media | Alto | Validazione a settembre (§2.3). Piano B: tier Provinciale→"Territoriale" multi-provincia allo stesso prezzo |
| Matrimonio.com copia il modello | Bassa | Medio | Il loro modello di ricavo (commissioni+ads) è incompatibile con "nessuna commissione". Copiarci = cannibalizzarsi. E il moat è la rete firmata, non la feature |
| Mercato in contrazione accelera (-8%+/anno) | Media | Medio | Rafforza paradossalmente il pitch (§2.1); ma comprime i budget: monitorare il churn di gennaio come segnale |
| Lavoro nero passa dalla bacheca e diventa caso stampa | Bassa | Alto | 6 strati (§5.2) + risposta preparata: siamo l'unico attore del settore che documenta e promuove attivamente la regolarizzazione (il Rapporto è la prova) |
| **Il piano viene usato con numeri gonfiati** | — | Alto | **v1.1: l'errore dei 64k è stato trovato dopo un giorno solo perché mancava la tabella mensile. Regola: ogni cifra cumulata in questo documento deve avere sotto la rampa che la genera (§7.1), o non entra** |

---

## 11. DECISIONI APERTE — COSA DEVI CHIUDERE TU

1. **[DECISIONE] Prezzi definitivi** — dopo le interviste di settembre, con il dato "quanto spendi oggi per procurarti clienti". Fino ad allora 39/59/99 sono l'ipotesi di lavoro.
2. **[DECISIONE] "Nascosto visivamente" vs pancia piena** (§3.2) — raccomando sì, dichiarato nei termini fornitore.
3. **[DECISIONE] Invio domanda al giuslavorista** — la domanda è formulata, va inviata ora. Bloccante per il lancio Maestranze, non per In Pancia.
4. **[DECISIONE] Grandfathering annunciato dal giorno uno** — raccomando sì, è il motore di urgenza e retention.
5. **[DECISIONE] D-8 (Stripe Connect vs netto)** — irrilevante per questo modulo (niente flussi di denaro tra parti), ma la scelta della struttura societaria che lo risolve va fatta prima di attivare gli abbonamenti: chi incassa i 39€, Fuyue Srl con che regime IVA, fatturazione automatica da Stripe Billing.
6. **[DECISIONE — nuova in v1.1] Piano annuale: toglierlo o scontarlo?** (§6.1, §7.6) Oggi il listino annuale è 12× il mensile, cioè un piano che nessuno ha motivo di scegliere: va deciso, non lasciato lì. Raccomando **annuale a 10 mesi di prezzo** (390/590/990€, ~17% di sconto): porta la cassa avanti di mesi in un progetto senza investitori né debito, è coerente con l'endowment e col grandfathering ("blocchi il prezzo per sempre, paghi 12 mesi"), e non intacca l'ancoraggio del mensile perché non è uno sconto sul prezzo ma un prezzo per un impegno diverso. Costo: ~17% di ricavo per chi lo sceglie. **Da decidere insieme ai prezzi (§11.1), non prima** — con la stessa domanda in intervista: "i tuoi abbonamenti di lavoro li paghi a mese o ad anno?".
7. **[DECISIONE — nuova in v1.1] Il numero da usare fuori da qui.** Se il piano serve a te per decidere, il numero è il **run-rate a M12 (85.300€)** più la conversione osservata. Se dovesse mai servire a un terzo (banca, bando, socio), il numero è la **cumulata per competenza (46.100€)** — e la differenza tra i due va spiegata, non scelta a convenienza. Il modo più veloce per perdere credibilità con questo documento è citare 85k dove serve 46k.

---

## APPENDICE — FONTI

- ISTAT, Report matrimoni e unioni civili 2024 (173.272 matrimoni, -5,9%)
- Matrimonio.com / osservatori di settore: costo medio matrimonio ~23.800€
- Tariffe fornitori: aggregazione web search luglio 2026 (range indicativi, da validare con interviste)
- Kahneman & Tversky, Prospect Theory (loss aversion ~2:1)
- D.Lgs. 276/2003 (regime intermediazione) — **da validare con giuslavorista, non è parere legale**
- Densità capostipiti/provincia: **[ASSUNZIONE INTERNA]** da validare a settembre
- Conversione free→paid 50%: **[ASSUNZIONE INTERNA]** (§7.4), non validabile in intervista — solo sul campo, KPI sentinella a M6
- Proiezioni §7: rampa ricalcolata in v1.1 per interpolazione lineare tra i punti M3/M6/M12 dichiarati in v1.0. Script di verifica riproducibili (`python3 <file>`): [business-plan-verifica/rampa-mrr.py](business-plan-verifica/rampa-mrr.py) (tabella §7.1, cumulate §7.2, sensitivity §7.4) e [business-plan-verifica/cassa-vs-competenza.py](business-plan-verifica/cassa-vs-competenza.py) (tabella §7.6). Se cambi un'ipotesi, cambia lo script e rigenera le tabelle — non correggere i numeri a mano.

---

*Documento interno Fuyue Srl — non distribuire. Versione 1.1, 17/07/2026 (v1.0: 16/07/2026). Le sezioni legali richiedono validazione professionale prima di qualsiasi implementazione.*
