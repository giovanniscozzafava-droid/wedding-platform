// Momenti tipici della giornata, pre-impostati per pianificare in pochi click.
// Orari indicativi (ricevimento serale classico). L'utente li rifinisce.

export type TimelineSeed = { start_time: string; title: string; duration_min?: number }

const MATRIMONIO: TimelineSeed[] = [
  { start_time: '14:00', title: 'Preparativi sposa', duration_min: 90 },
  { start_time: '14:30', title: 'Preparativi sposo', duration_min: 60 },
  { start_time: '15:30', title: 'Uscita di casa della sposa' },
  { start_time: '16:00', title: 'Arrivo in chiesa / comune' },
  { start_time: '16:15', title: 'Cerimonia', duration_min: 60 },
  { start_time: '17:15', title: 'Uscita e lancio del riso' },
  { start_time: '17:30', title: 'Servizio fotografico di coppia', duration_min: 60 },
  { start_time: '18:30', title: 'Arrivo in location' },
  { start_time: '19:00', title: 'Aperitivo di benvenuto', duration_min: 60 },
  { start_time: '20:30', title: 'Ingresso degli sposi' },
  { start_time: '21:00', title: 'Cena', duration_min: 120 },
  { start_time: '23:00', title: 'Taglio della torta' },
  { start_time: '23:30', title: 'Primo ballo' },
  { start_time: '23:45', title: 'Apertura balli / open bar' },
  { start_time: '00:30', title: 'Lancio del bouquet' },
  { start_time: '01:30', title: 'Saluti finali' },
]

const BATTESIMO_COMUNIONE: TimelineSeed[] = [
  { start_time: '10:00', title: 'Preparativi del festeggiato' },
  { start_time: '10:45', title: 'Arrivo in chiesa' },
  { start_time: '11:00', title: 'Cerimonia religiosa', duration_min: 60 },
  { start_time: '12:15', title: 'Foto di gruppo' },
  { start_time: '13:00', title: 'Arrivo in location' },
  { start_time: '13:30', title: 'Pranzo', duration_min: 120 },
  { start_time: '16:00', title: 'Taglio della torta' },
  { start_time: '17:00', title: 'Saluti finali' },
]

const COMPLEANNO: TimelineSeed[] = [
  { start_time: '19:30', title: 'Accoglienza ospiti' },
  { start_time: '20:00', title: 'Aperitivo' },
  { start_time: '21:00', title: 'Cena / buffet' },
  { start_time: '22:30', title: 'Taglio della torta' },
  { start_time: '23:00', title: 'Musica e balli' },
]

const DEFAULT: TimelineSeed[] = [
  { start_time: '18:00', title: 'Accoglienza ospiti' },
  { start_time: '19:00', title: 'Inizio evento' },
  { start_time: '22:30', title: 'Momento clou' },
  { start_time: '00:00', title: 'Chiusura' },
]

const BY_KIND: Record<string, TimelineSeed[]> = {
  matrimonio: MATRIMONIO,
  battesimo: BATTESIMO_COMUNIONE,
  comunione: BATTESIMO_COMUNIONE,
  cresima: BATTESIMO_COMUNIONE,
  compleanno: COMPLEANNO,
}

export function timelinePreset(eventKind?: string | null): TimelineSeed[] {
  return BY_KIND[(eventKind ?? '').toLowerCase().trim()] ?? DEFAULT
}
