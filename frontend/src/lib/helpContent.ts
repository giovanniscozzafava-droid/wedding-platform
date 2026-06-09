// Contenuti dell'aiuto contestuale (modalità Aiuto "?").
// Tono: caldo, incoraggiante, niente gergo. Diamo del "tu", rassicuriamo
// ("non sbagli niente, si può cambiare"), spieghiamo a COSA serve e COSA farci.
// Una voce per ogni elemento/sezione; <HelpDot id="..."/> la pesca da qui.

export type HelpEntry = { title: string; body: string }

export const HELP_CONTENT: Record<string, HelpEntry> = {
  // ── Sezioni (titolo pagina) ───────────────────────────────────────────────
  'page.dashboard': {
    title: 'La tua casa',
    body: 'Il colpo d\'occhio sulla tua attività: cosa sta succedendo oggi, le cose che ti aspettano, i prossimi passi. Parti sempre da qui quando non sai da dove cominciare.',
  },
  'page.richieste': {
    title: 'Le tue richieste',
    body: 'Qui atterrano i clienti che ti cercano. Ogni richiesta è una porta che si apre: rispondi con calma, trasformala in un preventivo quando te la senti.',
  },
  'page.capostipiti': {
    title: 'I tuoi capostipiti',
    body: 'I wedding planner e le location che ti coinvolgono nei loro eventi. Più rapporti curi qui, più lavoro ti arriva senza doverlo cercare.',
  },
  'page.clienti': {
    title: 'La tua rubrica',
    body: 'Tutti i clienti che ti contattano direttamente. Da qui crei preventivi e contratti in due clic, e tieni traccia di chi ha firmato. Quando un cliente accetta un preventivo, finisce qui da solo.',
  },
  'page.preventivi': {
    title: 'Le tue offerte',
    body: 'Il cuore del tuo lavoro: crea, invia e segui i preventivi. Vedi in tempo reale se il cliente li ha aperti e a che punto è la trattativa. Niente va perso.',
  },
  'page.daconfermare': {
    title: 'Lavori da confermare',
    body: 'Un capostipite ti ha inserito in un suo evento. Devi solo dire se ci sei: "Ci sono", "Forse" o "Non ci sono". Tutto qui — la tua risposta gli serve per chiudere il budget.',
  },
  'page.contratti': {
    title: 'I tuoi contratti',
    body: 'I contratti generati dai preventivi accettati. Li invii al cliente per la firma online (come il preventivo) e li ritrovi sempre qui, al sicuro.',
  },
  'page.eventi': {
    title: 'I tuoi eventi',
    body: 'Ogni evento confermato ha la sua area di lavoro: scaletta, tavoli, invitati, mood, contratto. È lo spazio dove dai vita al lavoro dopo che il cliente ha detto sì.',
  },
  'page.catalogo': {
    title: 'Il tuo catalogo',
    body: 'I tuoi servizi con prezzi, descrizioni e foto. È la tua vetrina: più è curato, più i preventivi si costruiscono in fretta e i clienti si fidano. Bastano anche poche belle foto per iniziare.',
  },
  'page.team': {
    title: 'Il tuo team',
    body: 'Le persone con cui lavori e i turni di ogni evento. Costruiscilo con calma: ti servirà per sapere chi c\'è quando, ed esportare tutto in un PDF da condividere.',
  },
  'page.calcolatore': {
    title: 'Calcolatore',
    body: 'Uno strumento veloce per fare due conti prima di proporre un prezzo. Sperimenta liberamente: qui non salvi nulla che il cliente possa vedere.',
  },
  'page.feed': {
    title: 'Il feed del network',
    body: 'La piazza dei professionisti italiani degli eventi. Condividi i tuoi lavori, scopri quelli degli altri, fatti notare. Più condividi e interagisci, più diventi visibile.',
  },
  'page.scopri': {
    title: 'Scopri fornitori',
    body: 'Esplora gli altri professionisti, guarda le loro vetrine e segui chi ti piace. Seguire un collega ti permette poi di suggerirlo ai tuoi clienti — e di guadagnare 39€ se firmano con lui.',
  },
  'page.crediti': {
    title: 'Crediti rete',
    body: 'Qui vedi i crediti che maturi grazie alla rete: quando suggerisci un collega e il cliente firma con lui. Una mano lava l\'altra, e ci guadagni davvero.',
  },
  'page.calendario': {
    title: 'La tua agenda',
    body: 'Le tue date in un colpo d\'occhio. Segna quando sei occupato/a così i capostipiti ti propongono solo nei giorni liberi. Tieni l\'agenda aggiornata: lavora per te anche mentre dormi.',
  },
  'page.bilancio': {
    title: 'Il tuo bilancio',
    body: 'Quanto stai incassando, in modo chiaro e senza fogli Excel. Un quadro onesto del tuo lavoro, aggiornato man mano che i preventivi diventano contratti.',
  },
  'page.brand': {
    title: 'Il tuo brand',
    body: 'Logo e colori della tua attività. Caricali una volta: appariranno in automatico sui preventivi e i contratti PDF che mandi ai clienti. Piccola cura, grande impressione.',
  },
  'page.profilo': {
    title: 'Il tuo profilo',
    body: 'I tuoi dati e quelli fiscali, riusati su ogni documento che generi. Compilalo una volta con calma: ti risparmierà tempo ad ogni contratto.',
  },
  'page.integrazione': {
    title: 'Integrazione sito',
    body: 'Collega Planfully al tuo sito web: i clienti possono contattarti e ricevere preventivi direttamente da lì. Un ponte tra la tua vetrina e il tuo lavoro quotidiano.',
  },
  'page.leads': {
    title: 'I tuoi lead',
    body: 'I potenziali clienti che hanno mostrato interesse. Coltivali: un lead seguito con attenzione oggi è un evento confermato domani.',
  },
  'page.rewards': {
    title: 'Premi della rete',
    body: 'I riconoscimenti che ottieni facendo crescere la rete. Più professionisti porti, più la community cresce — e tu con lei.',
  },
  'page.recruiting': {
    title: 'Recruiting',
    body: 'La tua agenda per costruire la rete: aggiungi i professionisti da contattare, chiamali o scrivigli, programma richiami e appuntamenti, e falli iscrivere con il tuo link. Quando si registrano col tuo codice, entrano nella tua rete.',
  },
  'page.assistenza': {
    title: 'Siamo qui per te',
    body: 'Hai un dubbio o un problema? Apri una richiesta e ti rispondiamo via email. Trovi anche le FAQ e il contatto diretto. Nessuna domanda è troppo piccola.',
  },

  // ── Lista preventivi ─────────────────────────────────────────────────────
  'quotes.nuovo': {
    title: 'Crea un preventivo',
    body: 'Da qui parte tutto. Aggiungi i tuoi servizi o quelli dei colleghi, regola prezzi e sconti, poi invialo o trasformalo in un bel PDF. Prenditi il tuo tempo: si modifica sempre.',
  },
  'quotes.stato': {
    title: 'A che punto siamo',
    body: 'Lo stato ti dice dove sta l\'offerta: Bozza → Inviato → Accettato → Convertito in contratto. E ti dice anche se il cliente l\'ha aperto: così sai quando farti vivo.',
  },
  'quotes.margine': {
    title: 'Il tuo guadagno',
    body: 'È quanto resta a te: la differenza tra ciò che paga il cliente e i costi dei servizi di terzi. Sui tuoi servizi (senza ricarico) è 0, ed è giusto così — lì il guadagno è già nel prezzo.',
  },

  // ── Editor preventivo ────────────────────────────────────────────────────
  'quote.invia': {
    title: 'Invia al cliente',
    body: 'Quando ti senti pronto/a, manda il preventivo: al cliente arriva una mail curata, col tuo brand e un link sicuro. Da quel momento vedrai se l\'ha aperto. Respira — si può sempre rimandare aggiornato.',
  },
  'quote.questionario': {
    title: 'Invia il questionario',
    body: 'Le domande giuste per il tipo di evento, già pronte. Le risposte del cliente ti tornano in automatico e ti aiutano a costruire un\'offerta su misura, senza dimenticare niente.',
  },
  'quote.pdf': {
    title: 'Genera il PDF',
    body: '"Neutra" è sobria e pulita; "Premium" indossa il tuo brand (logo e colori). Scaricalo o allegalo dove vuoi: è il tuo biglietto da visita.',
  },
  'quote.tipo_evento': {
    title: 'Che tipo di evento è',
    body: 'Cambia tutto in base a questo: le domande del questionario e le parole che vede il cliente. Se non è un matrimonio (battesimo, compleanno, aziendale…), scegli qui — il resto si adatta da solo.',
  },
  'quote.suggerisci': {
    title: 'Suggerisci un collega',
    body: 'Consiglia al cliente un professionista di cui ti fidi. Se firma con lui, ricevi 39€ di credito. Compaiono qui solo i colleghi che segui: passa dalle loro vetrine e seguili.',
  },

  // ── Agenda / Calendario ──────────────────────────────────────────────────
  'calendar.disponibilita': {
    title: 'Blocca una data',
    body: 'Un tocco e dici come stai quel giorno: Libero (verde), Forse (giallo), Occupato (rosso). Così i capostipiti ti propongono solo quando ci sei davvero. Tienila viva: lavora per te.',
  },
  'calendar.evento': {
    title: 'Un evento in agenda',
    body: 'Ogni preventivo accettato diventa un evento qui. Cliccalo per aprire la sua area di lavoro: scaletta, tavoli, invitati, mood, contratto.',
  },

  // ── Contratti ────────────────────────────────────────────────────────────
  'contract.nuovo': {
    title: 'Crea la bozza',
    body: 'Il contratto nasce dal preventivo, con le clausole legali già scritte per te. Poi lo invii per la firma online — niente stampe, niente code. Tutto resta tracciato.',
  },
  'contract.invia': {
    title: 'Invia per la firma',
    body: 'Al cliente arriva il link per firmare online: dati, documento, consensi e firma grafica. Tu ricevi una notifica appena ha firmato. Comodo per entrambi.',
  },
  'contract.whatsapp': {
    title: 'Manda su WhatsApp',
    body: 'Apre WhatsApp con il messaggio già pronto e il link al contratto. Perfetto quando col cliente vi sentite lì invece che per email.',
  },
}
