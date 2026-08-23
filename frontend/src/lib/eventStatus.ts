// Regola "un evento è tale solo se il preventivo (o contratto) è CONFERMATO".
// Negli elenchi/agenda/calendario/conteggi lato professionista vanno SOLO gli
// eventi confermati: preventivo accettato/firmato (OPZIONATA) o già confermato
// (CONFERMATA). Gli IN_TRATTATIVA (preventivo inviato ma non accettato) restano
// solo nella lista Preventivi, NON sono eventi. CANCELLATA/ANNULLATO esclusi.
// Unica fonte di verità: usare questa costante ovunque si listino "eventi".
export const CONFIRMED_EVENT_STATUSES = ['OPZIONATA', 'CONFERMATA'] as const

export function isConfirmedEvent(status?: string | null): boolean {
  return status === 'OPZIONATA' || status === 'CONFERMATA'
}
