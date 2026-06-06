// Modelli di run-sheet (piano operativo) per tipo di fornitore. Servono a
// "partire già organizzati": un modello pronto che il fornitore poi rifinisce.
// Gli orari sono indicativi e relativi a un classico ricevimento serale.

export type RunsheetSeed = { start_time: string; title: string; role_label?: string }

const BAND: RunsheetSeed[] = [
  { start_time: '16:30', title: 'Ritrovo e scarico strumenti', role_label: 'Tutta la band' },
  { start_time: '17:00', title: 'Montaggio palco e service audio', role_label: 'Tecnico audio' },
  { start_time: '18:00', title: 'Soundcheck', role_label: 'Tutta la band' },
  { start_time: '19:30', title: 'Sottofondo aperitivo (set acustico)', role_label: 'Chitarra + Voce' },
  { start_time: '21:00', title: 'Ingresso sposi', role_label: 'Voce' },
  { start_time: '22:30', title: 'Taglio della torta', role_label: 'Band' },
  { start_time: '23:00', title: 'Primo ballo', role_label: 'Band' },
  { start_time: '23:15', title: 'Set live ballabile', role_label: 'Tutta la band' },
  { start_time: '01:00', title: 'DJ set finale', role_label: 'DJ' },
]

const LOCATION_DINING: RunsheetSeed[] = [
  { start_time: '15:00', title: 'Mise en place sala e tavoli', role_label: 'Capo sala + camerieri' },
  { start_time: '16:00', title: 'Briefing brigata di cucina', role_label: 'Executive chef' },
  { start_time: '18:30', title: 'Aperitivo di benvenuto', role_label: 'Maître + camerieri' },
  { start_time: '20:30', title: 'Servizio antipasti', role_label: 'Brigata di sala' },
  { start_time: '21:15', title: 'Primo piatto', role_label: 'Brigata di sala' },
  { start_time: '22:00', title: 'Secondo piatto', role_label: 'Brigata di sala' },
  { start_time: '22:30', title: 'Taglio torta e dessert', role_label: 'Pasticcere + maître' },
  { start_time: '23:00', title: 'Open bar', role_label: 'Barman' },
]

const LOCATION_VENUE: RunsheetSeed[] = [
  { start_time: '14:00', title: 'Apertura location e allestimento', role_label: 'Responsabile location' },
  { start_time: '15:00', title: 'Coordinamento fornitori esterni', role_label: 'Responsabile location' },
  { start_time: '17:30', title: 'Check tecnico audio-luci', role_label: 'Tecnico audio-luci' },
  { start_time: '18:00', title: 'Accoglienza ospiti', role_label: 'Hostess' },
  { start_time: '00:30', title: 'Riconsegna spazi e chiusura', role_label: 'Responsabile location' },
]

const FUOCHI: RunsheetSeed[] = [
  { start_time: '16:00', title: 'Sopralluogo e allestimento postazioni', role_label: 'Capo squadra' },
  { start_time: '17:00', title: 'Verifica distanze di sicurezza e permessi', role_label: 'Responsabile sicurezza' },
  { start_time: '22:45', title: 'Briefing pre-spettacolo', role_label: 'Tutta la squadra' },
  { start_time: '23:00', title: 'Spettacolo piromusicale', role_label: 'Capo squadra' },
  { start_time: '23:20', title: 'Bonifica area e messa in sicurezza', role_label: 'Squadra' },
]

const FOTO: RunsheetSeed[] = [
  { start_time: '15:00', title: 'Preparativi sposi (getting ready)', role_label: 'Primo fotografo' },
  { start_time: '17:00', title: 'Cerimonia', role_label: 'Foto + video' },
  { start_time: '19:00', title: 'Servizio di coppia', role_label: 'Primo fotografo' },
  { start_time: '20:00', title: 'Foto di gruppo', role_label: 'Secondo fotografo' },
  { start_time: '22:30', title: 'Taglio torta e momenti clou', role_label: 'Foto + video' },
]

const FIORI: RunsheetSeed[] = [
  { start_time: '08:00', title: 'Composizione bouquet e centrotavola', role_label: 'Allestitore' },
  { start_time: '11:00', title: 'Allestimento chiesa / cerimonia', role_label: 'Squadra allestimento' },
  { start_time: '14:00', title: 'Allestimento sala ricevimento', role_label: 'Squadra allestimento' },
  { start_time: '17:00', title: 'Ritocchi finali e controllo', role_label: 'Allestitore' },
]

const DEFAULT: RunsheetSeed[] = [
  { start_time: '16:00', title: 'Ritrovo e preparazione', role_label: 'Team' },
  { start_time: '18:00', title: 'Inizio servizio', role_label: 'Team' },
  { start_time: '23:00', title: 'Momento clou', role_label: 'Team' },
  { start_time: '00:30', title: 'Chiusura e riordino', role_label: 'Team' },
]

const BY_SUBROLE: Record<string, RunsheetSeed[]> = {
  musica: BAND, dj: BAND, band: BAND,
  catering: LOCATION_DINING, chef: LOCATION_DINING, food_truck: LOCATION_DINING,
  pasticcere: LOCATION_DINING, sweet_table: LOCATION_DINING, bartender: LOCATION_DINING, sommelier: LOCATION_DINING,
  fuochi: FUOCHI, pirotecnica: FUOCHI, effetti: FUOCHI,
  fotografo: FOTO, videomaker: FOTO,
  fioraio: FIORI, allestimenti: FIORI,
}

export function runsheetTemplate(opts: { role?: string | null; subrole?: string | null; offersFullDining?: boolean | null }): RunsheetSeed[] {
  const role = (opts.role ?? '').toUpperCase()
  if (role === 'LOCATION') return opts.offersFullDining ? LOCATION_DINING : LOCATION_VENUE
  const sr = (opts.subrole ?? '').toLowerCase().trim()
  return BY_SUBROLE[sr] ?? DEFAULT
}
