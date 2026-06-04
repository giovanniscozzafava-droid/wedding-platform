// Contenuti dell'aiuto contestuale. Una voce per ogni elemento-chiave.
// Chiave stabile (es. "quote.invia") → { title, body }.
// Aggiungere qui le spiegazioni; <HelpDot id="..."/> le pesca da questa mappa.

export type HelpEntry = { title: string; body: string }

export const HELP_CONTENT: Record<string, HelpEntry> = {
  // ── Editor preventivo ────────────────────────────────────────────────────
  'quote.invia': {
    title: 'Invia al cliente',
    body: 'Manda il preventivo via email al cliente con un link sicuro. Il cliente lo apre, lo legge e può accettarlo online. Da qui parte anche il monitoraggio: vedrai in "Preventivi" se l\'ha aperto e quante volte.',
  },
  'quote.questionario': {
    title: 'Invia questionario',
    body: 'Manda al cliente le domande giuste per il tipo di evento. Le risposte ti arrivano in automatico e ti aiutano a personalizzare servizi e preventivo.',
  },
  'quote.pdf': {
    title: 'Genera PDF',
    body: 'Crea il PDF del preventivo. "Neutra" è sobria; "Premium" usa il tuo brand (logo e colori). Puoi scaricarlo o allegarlo dove vuoi.',
  },
  'quote.tipo_evento': {
    title: 'Tipo di evento',
    body: 'Definisce le domande del questionario e il linguaggio mostrato al cliente. Cambialo se non è un matrimonio (battesimo, compleanno, corporate…).',
  },
  'quote.sconto_voce': {
    title: 'Sconto sulla voce',
    body: 'Sconto percentuale sul prezzo cliente di questa voce. Negativo = maggiorazione. Per i tuoi servizi (no ricarico) lo sconto non genera margine negativo.',
  },
  'quote.suggerisci': {
    title: 'Suggerisci colleghi',
    body: 'Consiglia al cliente fornitori che segui. Se il cliente firma con uno di loro, ricevi 39€ di credito. Compaiono qui solo i colleghi che segui dalle loro vetrine.',
  },

  // ── Lista preventivi ─────────────────────────────────────────────────────
  'quotes.nuovo': {
    title: 'Nuovo preventivo',
    body: 'Crea una nuova offerta per un cliente. Aggiungi voci dal catalogo o servizi tuoi, applica sconti, poi invialo via email o genera il PDF.',
  },
  'quotes.stato': {
    title: 'Stato del preventivo',
    body: 'Dove sta l\'offerta: Bozza (la stai preparando) → Inviato → Accettato dal cliente → Convertito in contratto. Vedi anche se il cliente l\'ha aperto.',
  },
  'quotes.margine': {
    title: 'Margine',
    body: 'Il tuo guadagno: differenza tra quanto paga il cliente e i costi (servizi di terzi). Per i tuoi servizi senza ricarico il margine è 0, è normale.',
  },

  // ── Agenda / Calendario ──────────────────────────────────────────────────
  'calendar.disponibilita': {
    title: 'Blocca la data',
    body: 'Con un tocco segni il giorno come Libero (verde), Forse (giallo) o Occupato (rosso). I capostipiti vedono la tua disponibilità prima di proporti.',
  },
  'calendar.evento': {
    title: 'Evento in agenda',
    body: 'Ogni preventivo accettato diventa un evento. Cliccalo per aprire il workspace: scaletta, tavoli, invitati, mood, contratto.',
  },

  // ── Contratti ────────────────────────────────────────────────────────────
  'contract.nuovo': {
    title: 'Nuova bozza',
    body: 'Crea il contratto dal preventivo, con clausole legali precompilate. Poi lo invii via email per la firma online (stesso flusso del preventivo).',
  },
  'contract.invia': {
    title: 'Invia per firma',
    body: 'Manda al cliente il link per firmare online: dati, documento d\'identità, consensi GDPR e firma grafica. Ricevi notifica appena firma.',
  },
  'contract.whatsapp': {
    title: 'Condividi su WhatsApp',
    body: 'Apre WhatsApp con un messaggio pronto e il link al contratto. Comodo quando col cliente usi WhatsApp invece dell\'email.',
  },
}
