// I Mondi di Planfully — una landing di categoria per ogni mestiere della filiera.
// Ognuno vive su planfully.it/<slug> (rotta risolta da PublicSlugResolver: il set è
// noto, quindi intercettato prima dell'RPC di risoluzione slug pubblico).
//
// Registro FISSO (handoff "I Mondi"): mestiere, dato, filiera. Mai emozione nuziale.
//   - firma     = nome scritto a mano sotto il wordmark (Caveat, minuscolo)
//   - kicker    = "IL GESTIONALE DEI/DELLE <MESTIERE> DI EVENTO"
//   - claim     = titolo hero, Jost 400, una frase secca
//   - testo     = beneficio operativo (catalogo/preventivo/calendario, un dato una volta)
//   - strumenti = cosa fa lo strumento per QUEL mestiere (spiega tutti gli attrezzi)
//   - filiera   = come il suo dato si connette a TUTTO il resto dell'evento

export type Strumento = { nome: string; p: string }

export type Mondo = {
  slug: string
  nome: string
  firma: string
  kicker: string
  claim: string
  testo: string
  strumenti: Strumento[]
  filiera: string
}

// Attrezzi condivisi (è UN gestionale): stessa descrizione ovunque, così la promessa
// è coerente da un mondo all'altro. La specializzazione vive nell'ultimo strumento e
// nel paragrafo `filiera`, dove ogni mestiere spiega il proprio innesto nell'evento.
const S = {
  catalogo: {
    nome: 'Catalogo & listino',
    p: 'I tuoi servizi e i tuoi prezzi inseriti una volta sola. Ogni preventivo li rilegge: li aggiorni qui, cambiano ovunque.',
  },
  calendario: {
    nome: 'Calendario condiviso',
    p: 'La tua disponibilità è una sola, visibile a location e planner della filiera. La data si blocca una volta, senza doppie prenotazioni.',
  },
  preventivi: {
    nome: 'Preventivi & margini',
    p: 'Costruiti dal catalogo, con il margine sempre in vista. Li mandi brandizzati e sai quando il cliente li apre.',
  },
  contratti: {
    nome: 'Contratti, acconti & firma',
    p: 'Dal preventivo accettato al contratto firmato senza cambiare strumento. Acconti e scadenze tracciati, promemoria inclusi.',
  },
  clienti: {
    nome: 'Clienti & richieste',
    p: 'Ogni contatto, richiesta e lavoro in un posto solo, con lo storico. Niente si perde tra mail, messaggi e fogli.',
  },
} satisfies Record<string, Strumento>

export const MONDI: Mondo[] = [
  {
    slug: 'location', nome: 'Location', firma: 'location',
    kicker: 'IL GESTIONALE DELLE LOCATION DI EVENTO',
    claim: 'La disponibilità è una sola. La vedono tutti.',
    testo: 'Calendario condiviso con planner e fornitori, preventivi che leggono i tuoi listini, menù e coperti che tornano nei conti. La sala si prenota una volta, senza doppioni.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Sale, coperti & menù', p: 'Capienza, allestimenti e menù con i coperti che tornano nei conti dell’evento, non su un foglio a parte.' },
    ],
    filiera: 'La data che blocchi in calendario chiude l’agenda di planner e fornitori collegati. Menù e coperti risalgono nei preventivi della filiera, e al cliente arriva una proposta sola, coerente, dalla sala al servizio.',
  },
  {
    slug: 'weddingplanner', nome: 'Wedding planner', firma: 'wedding planner',
    kicker: 'IL GESTIONALE DEI WEDDING PLANNER',
    claim: 'Ogni fornitore, ogni data, un solo tavolo di regia.',
    testo: 'Coordini location, fornitori e preventivi dallo stesso posto. Il dato inserito una volta risale al cliente pulito: niente fogli paralleli, niente versioni che litigano.',
    strumenti: [
      S.clienti, S.calendario, S.preventivi, S.contratti,
      { nome: 'Regia della filiera', p: 'Fornitori, scadenze e budget dell’intero evento in un unico quadro: sai a che punto è ogni tassello, senza rincorrere nessuno.' },
    ],
    filiera: 'Ogni fornitore che ingaggi entra nello stesso quadro: la sua disponibilità, il suo preventivo, la sua consegna. Tu coordini un dato solo, e al cliente arriva un evento che parla con una voce sola.',
  },
  {
    slug: 'eventplanner', nome: 'Event planner', firma: 'event planner',
    kicker: 'IL GESTIONALE DEGLI EVENT PLANNER',
    claim: 'Tutta la filiera in un solo quadro di regia.',
    testo: 'Cataloghi dei fornitori, disponibilità delle location e preventivi al cliente nello stesso strumento. Nessuna ricopiatura, nessuna versione divergente.',
    strumenti: [
      S.clienti, S.calendario, S.preventivi, S.contratti,
      { nome: 'Quadro di regia', p: 'Fornitori, location e scadenze dell’evento in un solo posto: muovi una data e si aggiorna per tutti.' },
    ],
    filiera: 'Cataloghi dei fornitori, disponibilità delle location e preventivi al cliente convergono nello stesso strumento. Muovi una data e cambia per tutti: la regia è una, non una rincorsa di email.',
  },
  {
    slug: 'fotografi', nome: 'Fotografi', firma: 'fotografi',
    kicker: 'IL GESTIONALE DEI FOTOGRAFI DI EVENTO',
    claim: 'La data si blocca una volta. Il resto è luce.',
    testo: 'Calendario condiviso con location e planner, preventivi collegati alla filiera, acconti e consegne tracciati. Tu pensi allo scatto, il dato viaggia da solo.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Consegna foto & album', p: 'Gallerie, selezione degli sposi e impaginazione dell’album, con lo stato di consegna sempre aggiornato.' },
    ],
    filiera: 'La data che blocchi è la stessa che vedono location e planner: nessuno la promette due volte. E la consegna — galleria, selezione, album — arriva al cliente nello stesso posto in cui vive il resto dell’evento.',
  },
  {
    slug: 'videomaker', nome: 'Videomaker', firma: 'videomaker',
    kicker: 'IL GESTIONALE DEI VIDEOMAKER DI EVENTO',
    claim: 'La data si blocca. La consegna si traccia.',
    testo: 'Calendario condiviso con la filiera, preventivi collegati, acconti e consegne del montato sotto controllo. Tu giri e monti, lo stato del lavoro si aggiorna da solo.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Consegna & revisione video', p: 'Montato caricato, note temporizzate del cliente e stato di consegna in un posto solo.' },
    ],
    filiera: 'La tua disponibilità chiude l’agenda della filiera, e il montato consegnato vive accanto a foto e documenti dell’evento. Il cliente trova tutto in un punto solo, senza rincorrere link e trasferimenti.',
  },
  {
    slug: 'fioristi', nome: 'Fioristi', firma: 'fioristi',
    kicker: 'IL GESTIONALE DEI FIORISTI DI EVENTO',
    claim: 'Aggiorni il listino. Ogni preventivo ricalcola.',
    testo: 'Il catalogo entra una volta e alimenta le location collegate: quando il fresco cambia prezzo, i margini si aggiornano ovunque, prima di firmare.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Distinta fiori & fresco', p: 'Composizioni e fabbisogno di fresco per evento, con il costo che segue il mercato.' },
    ],
    filiera: 'Il tuo catalogo alimenta il preventivo della location collegata: quando il fresco cambia prezzo, il margine si aggiorna anche a valle. Un dato, e tutta la filiera lo legge aggiornato.',
  },
  {
    slug: 'catering', nome: 'Catering', firma: 'catering',
    kicker: 'IL GESTIONALE DEI CATERING DI EVENTO',
    claim: 'Il food cost si muove con il listino.',
    testo: 'Menù, coperti e materie prime entrano una volta e alimentano ogni preventivo. Quando cambia il costo di una portata, il margine si ricalcola prima che tu firmi.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Food cost A/B/C', p: 'Menù, materie prime e rese: il costo per coperto calcolato e sempre aggiornato sul listino reale.' },
    ],
    filiera: 'Il food cost che calcoli qui alimenta il preventivo della location e torna al cliente come una proposta sola. Cambi una materia prima e il numero si muove ovunque, prima della firma.',
  },
  {
    slug: 'banqueting', nome: 'Banqueting', firma: 'banqueting',
    kicker: 'IL GESTIONALE DEL BANQUETING DI EVENTO',
    claim: 'Coperti, sale, personale: un solo conto.',
    testo: 'Allestimento sala, coperti e squadra nello stesso strumento della location collegata. Il preventivo legge i numeri veri, senza ricopiare da altri fogli.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Sale, coperti & squadra', p: 'Allestimento, coperti e personale di servizio dimensionati sull’evento, con i numeri che tornano nel preventivo.' },
    ],
    filiera: 'Sale, coperti e squadra parlano con la location e con il planner collegati: il preventivo legge i numeri veri dell’evento, non una copia. Il cliente vede un conto solo, coerente.',
  },
  {
    slug: 'pasticceri', nome: 'Pasticceri', firma: 'pasticceri',
    kicker: 'IL GESTIONALE DEI PASTICCERI DI EVENTO',
    claim: 'Ogni torta ha il suo costo, sempre aggiornato.',
    testo: 'Ricette, porzioni e ingredienti entrano una volta. Il preventivo al cliente e il margine seguono il listino: se cambia il prezzo delle materie, lo sai subito.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Ricette & porzioni', p: 'Distinta ingredienti e porzioni per ogni torta, con il costo che segue il listino delle materie.' },
    ],
    filiera: 'La tua distinta entra nel preventivo dell’evento e segue il listino: se cambia il costo delle materie, il prezzo al cliente lo sa. Un dato, letto aggiornato da tutta la filiera.',
  },
  {
    slug: 'musica', nome: 'Musica', firma: 'musica',
    kicker: 'IL GESTIONALE DELLA MUSICA DI EVENTO',
    claim: 'La data si blocca una volta per tutti.',
    testo: 'Calendario condiviso con location e planner, preventivi collegati, scaletta e tempi nel posto giusto. Nessuna doppia prenotazione, nessun malinteso sulla serata.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Scaletta & tempi', p: 'Programma della serata e tempi tecnici condivisi con chi coordina l’evento.' },
    ],
    filiera: 'La data che blocchi chiude l’agenda di location e planner, e la scaletta vive accanto ai tempi degli altri fornitori. La serata la costruite insieme, sullo stesso quadro.',
  },
  {
    slug: 'dj', nome: 'DJ', firma: 'dj',
    kicker: 'IL GESTIONALE DEI DJ DI EVENTO',
    claim: 'Una data, un impianto, nessun doppione.',
    testo: 'Disponibilità condivisa con la filiera, preventivi che leggono service e ore reali, acconti tracciati. Tu pensi al set, la data resta bloccata per chi deve saperlo.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Service & ore', p: 'Impianto, ore reali e set list, con la disponibilità bloccata per la filiera.' },
    ],
    filiera: 'La tua disponibilità è la stessa che vede chi coordina l’evento: nessun impianto promesso due volte. Ore e service risalgono nel preventivo della filiera, senza ricopiare.',
  },
  {
    slug: 'allestimenti', nome: 'Allestimenti', firma: 'allestimenti',
    kicker: 'IL GESTIONALE DEGLI ALLESTIMENTI DI EVENTO',
    claim: 'Il magazzino entra nel preventivo da solo.',
    testo: 'Materiali, strutture e ore di montaggio in catalogo una volta sola. Ogni preventivo li rilegge, e quando un costo cambia il margine si aggiorna prima della firma.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Magazzino & montaggio', p: 'Materiali, strutture e ore di montaggio: cosa è libero, cosa è già impegnato, in tempo reale.' },
    ],
    filiera: 'Il magazzino che impegni esce dal libero per tutti, e le ore di montaggio entrano nel preventivo dell’evento. La location collegata sa cosa arriva e quando, senza telefonate.',
  },
  {
    slug: 'noleggio', nome: 'Noleggio', firma: 'noleggio',
    kicker: 'IL GESTIONALE DEL NOLEGGIO DI EVENTO',
    claim: 'Cosa è libero, cosa è già fuori: lo sai subito.',
    testo: 'Parco attrezzature e disponibilità nello stesso posto dei preventivi. Il pezzo prenotato sparisce dal listino libero: niente doppie uscite, niente sorprese.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Parco attrezzature', p: 'Cosa è libero e cosa è già fuori, in tempo reale: il pezzo prenotato esce dal listino disponibile.' },
    ],
    filiera: 'Il pezzo che esce sparisce dal libero per l’intera filiera: chi coordina l’evento sa cosa è disponibile in tempo reale. Un solo parco, letto da tutti aggiornato.',
  },
  {
    slug: 'lucieaudio', nome: 'Luci e audio', firma: 'luci e audio',
    kicker: 'IL GESTIONALE DI LUCI E AUDIO DI EVENTO',
    claim: 'Service e date, un solo quadro.',
    testo: 'Impianti, squadra e ore in catalogo una volta. Il preventivo legge i numeri veri e il calendario blocca la data per la filiera: nessun impianto promesso due volte.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Impianti & squadra', p: 'Service, tecnici e ore in catalogo, con la data bloccata per la filiera.' },
    ],
    filiera: 'Impianti e squadra si bloccano a calendario per la filiera, e le ore risalgono nel preventivo dell’evento. Nessun service promesso due volte, nessun numero ricopiato.',
  },
  {
    slug: 'beauty', nome: 'Beauty', firma: 'beauty',
    kicker: 'IL GESTIONALE DEL BEAUTY DI EVENTO',
    claim: 'Prove e date nello stesso calendario.',
    testo: 'Appuntamenti, prove e servizi condivisi con la filiera, preventivi collegati ai tuoi listini. Il tempo della persona si blocca una volta, senza sovrapposizioni.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Prove & appuntamenti', p: 'Prove trucco e acconciatura e agenda dei servizi, senza sovrapposizioni.' },
    ],
    filiera: 'Prove e servizi si incastrano nell’agenda dell’evento senza sovrapporsi ai tempi degli altri. Location e planner vedono quando sei impegnata, e il cliente una proposta sola.',
  },
  {
    slug: 'abiti', nome: 'Abiti', firma: 'abiti',
    kicker: 'IL GESTIONALE DEGLI ABITI DI EVENTO',
    claim: 'Prove, misure, consegne: tutto tracciato.',
    testo: 'Modelli, taglie e appuntamenti in un posto solo, preventivi che leggono il listino. Ogni prova e ogni consegna hanno una data che la filiera vede.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Prove, misure & consegne', p: 'Modelli, taglie e appuntamenti, con ogni prova e consegna a calendario.' },
    ],
    filiera: 'Prove, misure e consegne entrano nel calendario dell’evento: chi coordina sa a che punto sei. Il preventivo segue il listino, senza fogli paralleli.',
  },
  {
    slug: 'bomboniere', nome: 'Bomboniere', firma: 'bomboniere',
    kicker: 'IL GESTIONALE DELLE BOMBONIERE DI EVENTO',
    claim: 'Quantità e costo, sempre in linea.',
    testo: 'Catalogo e prezzi entrano una volta e alimentano il preventivo. Cambi il fornitore o la quantità, il totale e il margine si aggiornano prima di confermare.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Catalogo & quantità', p: 'Modelli e quantità con il costo che segue il fornitore, prima di confermare.' },
    ],
    filiera: 'Il tuo catalogo entra nel preventivo dell’evento e segue il fornitore: quantità e costo restano allineati fino alla consegna. Un dato, letto aggiornato da tutta la filiera.',
  },
  {
    slug: 'inviti', nome: 'Inviti e grafica', firma: 'inviti e grafica',
    kicker: 'IL GESTIONALE DI INVITI E GRAFICA DI EVENTO',
    claim: 'Bozze, tirature, consegne: un solo filo.',
    testo: 'Progetti, tirature e costi di stampa in catalogo una volta. Il preventivo li rilegge e le consegne hanno date che la filiera conosce, senza ricopiare nulla.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Bozze & tirature', p: 'Progetti, tirature e costi di stampa, con le consegne a calendario.' },
    ],
    filiera: 'Bozze, tirature e consegne vivono a calendario accanto al resto dell’evento: il planner sa quando arriva la stampa. Il preventivo segue i costi reali, senza ricopiare.',
  },
  {
    slug: 'transfer', nome: 'Transfer e auto', firma: 'transfer e auto',
    kicker: 'IL GESTIONALE DI TRANSFER E AUTO DI EVENTO',
    claim: 'Ogni mezzo, un solo calendario.',
    testo: 'Flotta e disponibilità nello stesso posto dei preventivi. L’auto prenotata esce dal libero, gli orari li vede chi coordina: niente doppie corse, niente attese.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Flotta & corse', p: 'Mezzi e disponibilità: l’auto prenotata esce dal libero, gli orari li vede chi coordina.' },
    ],
    filiera: 'Il mezzo che prenoti esce dal libero per la filiera, e gli orari li vede chi coordina l’evento. Nessuna doppia corsa, nessuna attesa: un solo calendario per tutti.',
  },
  {
    slug: 'animazione', nome: 'Animazione', firma: 'animazione',
    kicker: 'IL GESTIONALE DELL’ANIMAZIONE DI EVENTO',
    claim: 'La squadra si blocca una volta sola.',
    testo: 'Disponibilità di artisti e operatori condivisa con la filiera, preventivi collegati alle ore reali. La data resta ferma per chi deve saperlo, senza sovrapposizioni.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Artisti & turni', p: 'Disponibilità di artisti e operatori e ore reali, bloccate per la filiera.' },
    ],
    filiera: 'La disponibilità di artisti e operatori si blocca per la filiera, e le ore risalgono nel preventivo dell’evento. Chi coordina sa chi c’è e quando, senza sovrapposizioni.',
  },
  {
    slug: 'spettacoli', nome: 'Fuochi e spettacoli', firma: 'fuochi e spettacoli',
    kicker: 'IL GESTIONALE DI FUOCHI E SPETTACOLI DI EVENTO',
    claim: 'Permessi, date, squadra: un solo posto.',
    testo: 'Servizi, tempi e costi in catalogo una volta. Il preventivo li rilegge e il calendario blocca la serata per la filiera: nessuno spettacolo promesso due volte.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Permessi & squadra', p: 'Servizi, tempi e squadra per la serata, con la data bloccata per tutti.' },
    ],
    filiera: 'Servizi, tempi e squadra si incastrano nel programma dell’evento, e la data si blocca per tutta la filiera. Nessuno spettacolo promesso due volte, nessun numero ricopiato.',
  },
  {
    slug: 'celebranti', nome: 'Celebranti', firma: 'celebranti',
    kicker: 'IL GESTIONALE DEI CELEBRANTI DI EVENTO',
    claim: 'La data della cerimonia è una sola.',
    testo: 'Disponibilità e appuntamenti condivisi con location e planner, preventivi collegati. Il tuo tempo si blocca una volta, e chi coordina l’evento lo vede.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Agenda cerimonie', p: 'Disponibilità e appuntamenti condivisi con location e planner dell’evento.' },
    ],
    filiera: 'La data della cerimonia che blocchi chiude l’agenda di location e planner: nessuna sovrapposizione. Il tuo tempo entra nel quadro dell’evento come ogni altro tassello.',
  },
  {
    slug: 'hostess', nome: 'Sicurezza e hostess', firma: 'sicurezza e hostess',
    kicker: 'IL GESTIONALE DI SICUREZZA E HOSTESS DI EVENTO',
    claim: 'Turni e persone, un solo quadro.',
    testo: 'Squadre, turni e ore in un posto solo, preventivi che leggono i numeri veri. La data del servizio si blocca per la filiera, senza doppie assegnazioni.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Squadre & turni', p: 'Persone, turni e ore dimensionati sul servizio, senza doppie assegnazioni.' },
    ],
    filiera: 'Squadre e turni si dimensionano sul servizio e risalgono nel preventivo dell’evento. La location e il planner sanno chi c’è e quando, senza doppie assegnazioni.',
  },
  {
    slug: 'tecnici', nome: 'Fornitori tecnici', firma: 'fornitori tecnici',
    kicker: 'IL GESTIONALE DEI FORNITORI TECNICI DI EVENTO',
    claim: 'Attrezzatura e date, sempre allineate.',
    testo: 'Materiali, squadra e ore in catalogo una volta. Il preventivo li rilegge e il calendario condiviso blocca l’impegno: niente risorse promesse due volte.',
    strumenti: [
      S.catalogo, S.calendario, S.preventivi, S.contratti,
      { nome: 'Attrezzatura & squadra', p: 'Materiali, tecnici e ore in catalogo, con l’impegno bloccato a calendario.' },
    ],
    filiera: 'Attrezzatura e squadra si bloccano a calendario per la filiera, e le ore entrano nel preventivo dell’evento. Nessuna risorsa promessa due volte, nessun dato ricopiato.',
  },
]

export const MONDI_BY_SLUG: Record<string, Mondo> = Object.fromEntries(
  MONDI.map((m) => [m.slug, m]),
)

// Numerale a due cifre per l'indice (01…24).
export const mondoNum = (i: number) => String(i + 1).padStart(2, '0')
