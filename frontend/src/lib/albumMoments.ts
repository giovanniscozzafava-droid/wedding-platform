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

// Set ricco e cronologico (dal mattino alla chiusura). Le CHIAVI storiche restano
// invariate (preparativi, famiglia, partecipazione, chiesa, uscita, coppia,
// ricevimento, festa, dettagli) così le foto già taggate non si rompono; le altre
// sono nuove voci più fini per taggare meglio.
export const MOMENTS: Moment[] = [
  { key: 'preparativi',      label: 'Preparativi sposa',     min: 2,  hint: 'Trucco, capelli, abito, dettagli del mattino', color: 'bg-rose-100 text-rose-700' },
  { key: 'preparativi-sposo', label: 'Preparativi sposo',    min: 2,  hint: 'Vestizione e attesa dello sposo', color: 'bg-rose-100 text-rose-700' },
  { key: 'dettagli-sposa',   label: 'Dettagli sposa',        min: 1,  hint: 'Scarpe, gioielli, profumo, abito appeso', color: 'bg-pink-100 text-pink-700' },
  { key: 'primo-sguardo',    label: 'Primo sguardo',         min: 1,  hint: 'First look: il primo incontro degli sposi', color: 'bg-orange-100 text-orange-700' },
  { key: 'arrivo',           label: 'Arrivo in cerimonia',   min: 1,  hint: "Arrivo della sposa/degli sposi, auto, ingresso", color: 'bg-amber-100 text-amber-700' },
  { key: 'partecipazione',   label: 'Partecipazione ospiti', min: 3,  hint: 'Arrivo e attesa degli invitati', color: 'bg-lime-100 text-lime-700' },
  { key: 'chiesa',           label: 'Cerimonia / rito',      min: 3,  hint: 'Chiesa / rito civile / promesse', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'anelli',           label: 'Scambio anelli',        min: 1,  hint: 'Fedi, promesse, firme, emozioni', color: 'bg-emerald-100 text-emerald-700' },
  { key: 'uscita',           label: 'Uscita / lancio riso',  min: 1,  hint: "Uscita dalla cerimonia, lancio del riso/petali", color: 'bg-teal-100 text-teal-700' },
  { key: 'famiglia',         label: 'Famiglia & gruppi',     min: 3,  hint: 'Genitori, parenti, ritratti di gruppo', color: 'bg-amber-100 text-amber-700' },
  { key: 'coppia',           label: 'Coppia (ritratti)',     min: 10, hint: 'Ritratti degli sposi, golden hour', color: 'bg-sky-100 text-sky-700' },
  { key: 'aperitivo',        label: 'Aperitivo',             min: 2,  hint: 'Welcome drink, finger food, mingling', color: 'bg-cyan-100 text-cyan-700' },
  { key: 'tableau',          label: 'Tableau & allestimenti', min: 2,  hint: 'Tableau mariage, mise en place, centrotavola', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'ricevimento',      label: 'Ricevimento / sala',    min: 3,  hint: 'Location, tavoli, ingresso in sala', color: 'bg-indigo-100 text-indigo-700' },
  { key: 'brindisi',         label: 'Brindisi & discorsi',   min: 2,  hint: 'Brindisi, discorsi, dediche', color: 'bg-blue-100 text-blue-700' },
  { key: 'torta',            label: 'Taglio torta',          min: 2,  hint: 'Torta nuziale e taglio', color: 'bg-violet-100 text-violet-700' },
  { key: 'primo-ballo',      label: 'Primo ballo',           min: 2,  hint: 'Apertura delle danze degli sposi', color: 'bg-purple-100 text-purple-700' },
  { key: 'festa',            label: 'Festa / balli',         min: 3,  hint: 'Pista, balli, party', color: 'bg-violet-100 text-violet-700' },
  { key: 'bouquet',          label: 'Lancio bouquet',        min: 1,  hint: 'Lancio del bouquet, giochi', color: 'bg-fuchsia-100 text-fuchsia-700' },
  { key: 'chiusura',         label: 'Chiusura / fuochi',     min: 1,  hint: 'Sparkler, fuochi d’artificio, saluti finali', color: 'bg-slate-100 text-slate-700' },
  { key: 'dettagli',         label: 'Dettagli (oggetti)',    min: 2,  hint: 'Fedi, bouquet, inviti, allestimenti', color: 'bg-fuchsia-100 text-fuchsia-700' },
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
  // Ordine importante: le voci più specifiche PRIMA delle generiche.
  const map: Array<[RegExp, string]> = [
    [/prepar.*spos[oa]\b|sposo.*prepar|groom.*ready|vestizione spos/, 'preparativi-sposo'],
    [/prepar|getting ?ready|trucco|make|capell|hair/, 'preparativi'],
    [/dettagl.*spos|scarp|gioiell|profum|abito appes/, 'dettagli-sposa'],
    [/first ?look|primo sguardo/, 'primo-sguardo'],
    [/arriv|ingresso spos|auto spos/, 'arrivo'],
    [/parteci|ospit|guest/, 'partecipazione'],
    [/anell|fedi|scambio|promess|firme/, 'anelli'],
    [/chiesa|cerimon|church|rito|altare/, 'chiesa'],
    [/uscit|exit|riso|confett|petal/, 'uscita'],
    [/fami|genitor|parent|gruppo|group/, 'famiglia'],
    [/aperitiv|welcome ?drink|finger ?food/, 'aperitivo'],
    [/tableau|allestim|mise.?en.?place|centrotavol|segnapost/, 'tableau'],
    [/brindis|discors|dedica|speech|toast/, 'brindisi'],
    [/torta|cake.?cut|taglio/, 'torta'],
    [/primo ?ballo|first ?dance|apertura.*danz/, 'primo-ballo'],
    [/lancio.*bouquet|bouquet ?toss/, 'bouquet'],
    [/spark|fuoch|fireworks|chiusur|saluti final/, 'chiusura'],
    [/festa|party|ballo|dance|pista/, 'festa'],
    [/coppi|couple|sposi|ritratt|portrait|golden ?hour/, 'coppia'],
    [/ricevim|location|tavol|sala/, 'ricevimento'],
    [/dettagl|detail|fed|bouquet/, 'dettagli'],
  ]
  for (const [re, key] of map) if (re.test(s)) return key
  return null
}
