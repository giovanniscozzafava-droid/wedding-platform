// Evento "solo ricordi": già passato e MAI gestito col dashboard (nessun preventivo
// = nessun servizio di pianificazione usato). Per questi eventi teniamo attive SOLO
// Foto e Video, tutto il resto si oscura: di fatto è solo una consegna di foto/video.
export function isPhotoOnlyEvent(
  w: { date_from?: string | null; date_to?: string | null; quote?: unknown; quote_id?: string | null } | null | undefined,
): boolean {
  if (!w) return false
  const end = w.date_to || w.date_from
  if (!end) return false
  const past = new Date(end).getTime() < Date.now()
  // "Gestito col dashboard" = ha un preventivo collegato. Alcune query (es. dashboard
  // coppia, useMyWeddings) NON caricano la relazione `quote` ma hanno sempre la colonna
  // `quote_id`: affidarsi solo a `w.quote` faceva diventare "solo ricordi" OGNI evento
  // passato, nascondendo RSVP/Invitati/pianificazione nella dashboard condivisa col cliente.
  const managed = !!w.quote || !!w.quote_id
  return past && !managed
}

// Le uniche tab che restano attive su un evento "solo ricordi".
export const PHOTO_ONLY_KEYS = new Set(['foto', 'video'])
