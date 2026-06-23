// Evento "solo ricordi": già passato e MAI gestito col dashboard (nessun preventivo
// = nessun servizio di pianificazione usato). Per questi eventi teniamo attive SOLO
// Foto e Video, tutto il resto si oscura: di fatto è solo una consegna di foto/video.
export function isPhotoOnlyEvent(
  w: { date_from?: string | null; date_to?: string | null; quote?: unknown } | null | undefined,
): boolean {
  if (!w) return false
  const end = w.date_to || w.date_from
  if (!end) return false
  const past = new Date(end).getTime() < Date.now()
  return past && !w.quote
}

// Le uniche tab che restano attive su un evento "solo ricordi".
export const PHOTO_ONLY_KEYS = new Set(['foto', 'video'])
