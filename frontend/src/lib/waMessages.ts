// ============================================================================
// Messaggi WhatsApp/email centralizzati. Regola: mai frasi a metà — ogni
// messaggio ha saluto, contesto (cosa è e perché), call to action chiara e
// firma del brand. Il link viene aggiunto in coda dal chiamante
// (shareWhatsAppLink fa `${text}\n${url}`), quindi i testi qui NON includono
// l'URL: si chiudono con la firma e l'URL compare subito sotto.
// ============================================================================

const SIGN = '— inviato con Planfully'

/** Saluto col nome se presente, altrimenti generico. */
function hello(name?: string | null) {
  const n = (name ?? '').trim()
  return n ? `Ciao ${n}` : 'Ciao'
}

/** Preventivo inviato al cliente — raccomanda WhatsApp perché la mail può finire in spam. */
export function waQuoteToClient(opts: { clientName?: string | null; title?: string | null }) {
  const t = opts.title ? ` "${opts.title}"` : ''
  return [
    hello(opts.clientName),
    `ti mando qui il preventivo${t}, così sei sicuro di riceverlo: a volte via email finisce nello spam.`,
    'Aprilo dal link qui sotto: lo leggi con calma, lo controlli e lo accetti direttamente online.',
    'Per qualsiasi dubbio rispondi pure a questo messaggio.',
    SIGN,
  ].join('\n')
}

/** Contratto inviato al cliente perché lo apra e lo firmi online. */
export function waContractToClient(opts: { clientName?: string | null; title?: string | null }) {
  const t = opts.title ? ` per "${opts.title}"` : ''
  return [
    hello(opts.clientName),
    `ecco il contratto${t} pronto per la firma.`,
    'Aprilo dal link qui sotto: lo leggi con calma e lo firmi direttamente online, senza stampare né scansionare nulla.',
    'Per qualsiasi dubbio rispondi pure a questo messaggio.',
    SIGN,
  ].join('\n')
}

/** Invito a un fornitore a creare il proprio account in rete. */
export function waSupplierInvite(opts?: { fromName?: string | null }) {
  const from = (opts?.fromName ?? '').trim()
  return [
    'Ciao',
    from
      ? `sono ${from}: ti ho aggiunto come fornitore su Planfully, lo strumento con cui gestisco preventivi, contratti e team dei miei eventi.`
      : 'ti ho aggiunto come fornitore su Planfully, lo strumento con cui gestisco preventivi, contratti e team dei miei eventi.',
    'Crea il tuo account dal link qui sotto: ti bastano due minuti e poi riceverai da me richieste e materiali sempre in ordine.',
    SIGN,
  ].join('\n')
}

/** Invito a un membro (sposi/familiari) a seguire l'evento. */
export function waMemberInvite(opts: { memberName?: string | null }) {
  return [
    hello(opts.memberName),
    'ti invito a seguire il vostro evento su Planfully: lì trovate programma, fornitori, documenti e aggiornamenti sempre allineati, senza chat sparse.',
    'Apri il link qui sotto e crea il tuo account: bastano due minuti.',
    SIGN,
  ].join('\n')
}

/** Caption per la condivisione del foglio presenze / turni del team. */
export function waTeamSheet(opts: { eventTitle: string; eventDate?: string | null }) {
  const date = opts.eventDate
    ? new Date(opts.eventDate).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
    : null
  return [
    `Foglio presenze · ${opts.eventTitle}${date ? ` · ${date}` : ''}`,
    'In allegato trovi i turni e le presenze del team per questo evento.',
    'Controlla il tuo nominativo, l\'orario e conferma la tua disponibilità rispondendo a questo messaggio.',
    SIGN,
  ].join('\n')
}
