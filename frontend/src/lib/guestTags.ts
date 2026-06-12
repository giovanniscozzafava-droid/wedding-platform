// Tag con cui gli ospiti catalogano le foto che caricano: servono ai professionisti
// per ritrovare velocemente il materiale (es. "capelli sposa", "fuochi d'artificio").
export type GuestTagGroup = { group: string; emoji: string; options: { key: string; label: string }[] }

export const GUEST_TAG_GROUPS: GuestTagGroup[] = [
  {
    group: 'Momento', emoji: '🕰️', options: [
      { key: 'preparativi', label: 'Preparativi' },
      { key: 'cerimonia', label: 'Cerimonia' },
      { key: 'uscita_chiesa', label: 'Uscita chiesa' },
      { key: 'ricevimento', label: 'Ricevimento' },
      { key: 'taglio_torta', label: 'Taglio torta' },
      { key: 'primo_ballo', label: 'Primo ballo' },
      { key: 'festa', label: 'Festa / balli' },
      { key: 'fuochi', label: "Fuochi d'artificio" },
    ],
  },
  {
    group: 'Persone', emoji: '👥', options: [
      { key: 'sposa', label: 'Sposa' },
      { key: 'sposo', label: 'Sposo' },
      { key: 'coppia', label: 'Coppia' },
      { key: 'famiglia', label: 'Famiglia' },
      { key: 'amici', label: 'Amici' },
      { key: 'invitati', label: 'Invitati' },
    ],
  },
  {
    group: 'Dettagli', emoji: '💍', options: [
      { key: 'fiori', label: 'Fiori / bouquet' },
      { key: 'abito_sposa', label: 'Abito sposa' },
      { key: 'abito_sposo', label: 'Abito sposo' },
      { key: 'capelli_sposa', label: 'Capelli sposa' },
      { key: 'trucco_sposa', label: 'Trucco sposa' },
      { key: 'fedi', label: 'Fedi / anelli' },
      { key: 'allestimento', label: 'Allestimento' },
      { key: 'torta', label: 'Torta' },
      { key: 'auto', label: 'Auto' },
      { key: 'location', label: 'Location' },
    ],
  },
]

const LABELS: Record<string, string> = Object.fromEntries(
  GUEST_TAG_GROUPS.flatMap((g) => g.options.map((o) => [o.key, o.label])),
)
export function guestTagLabel(key: string): string {
  return LABELS[key] ?? key
}

// Tutte le opzioni piatte (per filtri/catalogo lato professionista).
export const ALL_GUEST_TAGS = GUEST_TAG_GROUPS.flatMap((g) => g.options)
