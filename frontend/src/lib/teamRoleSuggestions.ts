// Ruoli di team suggeriti in base alla tipologia di professionista.
// Servono a far costruire la squadra "per come serve" a ciascuno: una band
// pensa agli strumenti, una location con ristorazione interna alla BRIGATA.

const BRIGATA = [
  'Executive chef', 'Sous chef', 'Chef de partie', 'Commis di cucina', 'Pasticcere',
  'Maître', 'Capo sala', 'Cameriere di sala', 'Sommelier', 'Barman', 'Runner', 'Lavapiatti',
]
const LOCATION_NOLEGGIO = [
  'Responsabile location', 'Accoglienza / Hostess', 'Tecnico audio-luci',
  'Allestimento / Manutenzione', 'Sicurezza', 'Parcheggiatore',
]

const BY_SUBROLE: Record<string, string[]> = {
  musica:      ['Voce', 'Chitarra', 'Basso', 'Batteria', 'Tastiere', 'Violino', 'Sax', 'DJ', 'Tecnico audio'],
  catering:    ['Executive chef', 'Sous chef', 'Cuoco', 'Maître', 'Cameriere di sala', 'Barman', 'Runner', 'Lavapiatti'],
  chef:        BRIGATA,
  fotografo:   ['Secondo fotografo', 'Assistente', 'Operatore video', 'Tecnico luci'],
  videomaker:  ['Secondo operatore', 'Assistente', 'Operatore drone', 'Montatore'],
  fioraio:     ['Allestitore', 'Aiuto allestimento', 'Logistica / Trasporti'],
  allestimenti:['Capo allestimento', 'Aiuto allestimento', 'Logistica / Trasporti', 'Tecnico'],
  bartender:   ['Bar manager', 'Barman', 'Aiuto barman', 'Runner'],
  parrucchiere:['Hairstylist', 'Make-up artist', 'Assistente'],
  make_up:     ['Make-up artist', 'Hairstylist', 'Assistente'],
  animazione:  ['Animatore', 'Aiuto animatore', 'Baby sitter'],
  noleggio:    ['Capo squadra montaggio', 'Addetto montaggio', 'Logistica / Trasporti'],
  wedding_planner: ['Coordinatore', 'Assistente coordinamento', 'Hostess accoglienza'],
}

/**
 * Ritorna i ruoli suggeriti per il team, dati role + subrole + se la location
 * offre ristorazione interna.
 */
export function teamRoleSuggestions(opts: {
  role?: string | null
  subrole?: string | null
  offersFullDining?: boolean | null
}): string[] {
  const role = (opts.role ?? '').toUpperCase()
  if (role === 'LOCATION') {
    return opts.offersFullDining ? BRIGATA : LOCATION_NOLEGGIO
  }
  if (role === 'WEDDING_PLANNER') return BY_SUBROLE.wedding_planner ?? []
  const sr = (opts.subrole ?? '').toLowerCase().trim()
  return BY_SUBROLE[sr] ?? []
}
