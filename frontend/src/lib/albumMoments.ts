// "Momenti" della giornata: guidano la selezione guidata degli sposi e il motore
// di auto-impaginazione. `min` = minimo di foto consigliato per quel momento.
// L'ordine è quello in cui i momenti compaiono nell'album.
export type Moment = {
  key: string
  label: string
  min: number
  hint: string
  color: string // classe tailwind di accento
}

export const MOMENTS: Moment[] = [
  { key: 'preparativi',   label: 'Preparativi',    min: 2,  hint: 'Trucco, abito, dettagli del mattino', color: 'bg-rose-100 text-rose-700' },
  { key: 'famiglia',      label: 'Famiglia',       min: 3,  hint: 'Genitori, parenti, ritratti di gruppo', color: 'bg-amber-100 text-amber-700' },
  { key: 'partecipazione', label: 'Partecipazione', min: 3,  hint: 'Arrivo e partecipazione degli invitati', color: 'bg-lime-100 text-lime-700' },
  { key: 'chiesa',        label: 'Cerimonia',      min: 3,  hint: 'Chiesa / rito / promesse', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'uscita',        label: 'Uscita',         min: 1,  hint: "Uscita dalla cerimonia, lancio del riso", color: 'bg-teal-100 text-teal-700' },
  { key: 'coppia',        label: 'Coppia',         min: 10, hint: 'Ritratti degli sposi', color: 'bg-sky-100 text-sky-700' },
  { key: 'ricevimento',   label: 'Ricevimento',    min: 3,  hint: 'Location, tavoli, brindisi', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'festa',         label: 'Festa',          min: 3,  hint: 'Taglio torta, balli, party', color: 'bg-violet-100 text-violet-700' },
  { key: 'dettagli',      label: 'Dettagli',       min: 2,  hint: 'Fedi, bouquet, allestimenti', color: 'bg-fuchsia-100 text-fuchsia-700' },
]

export const ALBUM_MIN_PHOTOS = 60
export const ALBUM_MAX_PHOTOS = 110

export function getMoment(key: string | null | undefined): Moment | null {
  if (!key) return null
  return MOMENTS.find((m) => m.key === key) ?? null
}

export function momentOrder(key: string | null | undefined): number {
  const i = MOMENTS.findIndex((m) => m.key === key)
  return i < 0 ? 999 : i
}

// Indovina il momento da nome cartella / tag ospite (best-effort, modificabile).
export function guessMoment(folderName?: string | null, tag?: string | null): string | null {
  const s = `${folderName ?? ''} ${tag ?? ''}`.toLowerCase()
  const map: Array<[RegExp, string]> = [
    [/prepar|getting ?ready|trucco|make/, 'preparativi'],
    [/fami|genitor|parent|gruppo|group/, 'famiglia'],
    [/parteci|ospit|guest|arriv/, 'partecipazione'],
    [/chiesa|cerimon|church|rito|altare/, 'chiesa'],
    [/uscit|exit|riso|confett/, 'uscita'],
    [/coppi|couple|sposi|ritratt|portrait/, 'coppia'],
    [/ricevim|location|tavol|aperitiv/, 'ricevimento'],
    [/festa|party|torta|cake|ballo|dance/, 'festa'],
    [/dettagl|detail|fed|bouquet|anell/, 'dettagli'],
  ]
  for (const [re, key] of map) if (re.test(s)) return key
  return null
}
