// Preset musica + checklist per popolare velocemente i tab matrimonio.

export type PlaylistMoment = 'CERIMONIA' | 'APERITIVO' | 'CENA' | 'TAGLIO_TORTA' | 'PRIMA_DANZA' | 'FESTA'

export type PlaylistPreset = {
  moment: PlaylistMoment
  song_title: string
  artist: string
  notes?: string
}

export const PLAYLIST_PRESETS: Record<string, PlaylistPreset[]> = {
  // CERIMONIA — entrata sposa, scambio anelli, uscita sposi
  Cerimonia: [
    { moment: 'CERIMONIA', song_title: 'Canon in D', artist: 'Pachelbel', notes: 'Classico ingresso sposa' },
    { moment: 'CERIMONIA', song_title: 'A Thousand Years', artist: 'Christina Perri' },
    { moment: 'CERIMONIA', song_title: 'Marry Me', artist: 'Train' },
    { moment: 'CERIMONIA', song_title: 'Perfect', artist: 'Ed Sheeran' },
    { moment: 'CERIMONIA', song_title: 'Ave Maria', artist: 'Schubert / Bach-Gounod', notes: 'Per rito religioso' },
    { moment: 'CERIMONIA', song_title: 'La Vie en Rose', artist: 'Edith Piaf', notes: 'Uscita sposi versione strumentale' },
    { moment: 'CERIMONIA', song_title: 'Can\'t Help Falling in Love', artist: 'Elvis Presley', notes: 'Uscita sposi' },
  ],
  // APERITIVO — lounge, easy listening
  Aperitivo: [
    { moment: 'APERITIVO', song_title: 'Fly Me to the Moon', artist: 'Frank Sinatra' },
    { moment: 'APERITIVO', song_title: 'L-O-V-E', artist: 'Nat King Cole' },
    { moment: 'APERITIVO', song_title: 'Cheek to Cheek', artist: 'Ella Fitzgerald' },
    { moment: 'APERITIVO', song_title: 'Quando, Quando, Quando', artist: 'Michael Bublé' },
    { moment: 'APERITIVO', song_title: 'Volare', artist: 'Domenico Modugno' },
    { moment: 'APERITIVO', song_title: 'Beyond the Sea', artist: 'Bobby Darin' },
    { moment: 'APERITIVO', song_title: 'Tu vuò fà l\'americano', artist: 'Renato Carosone' },
  ],
  // CENA — soft, accompagnamento
  Cena: [
    { moment: 'CENA', song_title: 'La Vita è Bella', artist: 'Nicola Piovani' },
    { moment: 'CENA', song_title: 'Cinema Paradiso', artist: 'Ennio Morricone' },
    { moment: 'CENA', song_title: 'Norah Jones - Don\'t Know Why', artist: 'Norah Jones' },
    { moment: 'CENA', song_title: 'Better Together', artist: 'Jack Johnson' },
    { moment: 'CENA', song_title: 'Make You Feel My Love', artist: 'Adele' },
    { moment: 'CENA', song_title: 'Hallelujah', artist: 'Jeff Buckley' },
  ],
  'Taglio torta': [
    { moment: 'TAGLIO_TORTA', song_title: 'Mi Sono Innamorato di Te', artist: 'Luigi Tenco' },
    { moment: 'TAGLIO_TORTA', song_title: 'Sugar', artist: 'Maroon 5', notes: 'Versione pop' },
    { moment: 'TAGLIO_TORTA', song_title: 'L\'Amore Mio', artist: 'Levante' },
    { moment: 'TAGLIO_TORTA', song_title: 'I\'m Yours', artist: 'Jason Mraz' },
    { moment: 'TAGLIO_TORTA', song_title: 'Senza Una Donna', artist: 'Zucchero' },
  ],
  'Prima danza': [
    { moment: 'PRIMA_DANZA', song_title: 'At Last', artist: 'Etta James', notes: 'Slow classico' },
    { moment: 'PRIMA_DANZA', song_title: 'All of Me', artist: 'John Legend' },
    { moment: 'PRIMA_DANZA', song_title: 'Thinking Out Loud', artist: 'Ed Sheeran' },
    { moment: 'PRIMA_DANZA', song_title: 'Tu sei l\'unica donna per me', artist: 'Alan Sorrenti' },
    { moment: 'PRIMA_DANZA', song_title: 'Caruso', artist: 'Lucio Dalla' },
    { moment: 'PRIMA_DANZA', song_title: 'You Are the Best Thing', artist: 'Ray LaMontagne' },
  ],
  Festa: [
    { moment: 'FESTA', song_title: 'I Wanna Dance with Somebody', artist: 'Whitney Houston' },
    { moment: 'FESTA', song_title: 'Dancing Queen', artist: 'ABBA' },
    { moment: 'FESTA', song_title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars' },
    { moment: 'FESTA', song_title: 'Maracaibo', artist: 'Lu Colombo', notes: 'Tormentone italiano' },
    { moment: 'FESTA', song_title: 'Sarà perché ti amo', artist: 'Ricchi e Poveri' },
    { moment: 'FESTA', song_title: 'Vamos a la playa', artist: 'Righeira' },
    { moment: 'FESTA', song_title: 'Macarena', artist: 'Los del Río' },
    { moment: 'FESTA', song_title: 'Mambo italiano', artist: 'Renato Carosone' },
    { moment: 'FESTA', song_title: 'September', artist: 'Earth, Wind & Fire' },
    { moment: 'FESTA', song_title: 'Don\'t Stop Believin\'', artist: 'Journey' },
    { moment: 'FESTA', song_title: 'Sweet Caroline', artist: 'Neil Diamond' },
    { moment: 'FESTA', song_title: 'YMCA', artist: 'Village People' },
    { moment: 'FESTA', song_title: 'I Gotta Feeling', artist: 'Black Eyed Peas' },
  ],
}

// ─────────────────────────────────────────────────────────
// CHECKLIST PRESET
// ─────────────────────────────────────────────────────────

export type ChecklistPhase = '12_MESI' | '6_MESI' | '3_MESI' | '1_MESE' | '1_SETTIMANA' | 'DAY_OF' | 'GENERICA'

export type ChecklistPreset = {
  phase: ChecklistPhase
  title: string
  description?: string
}

export const CHECKLIST_PRESETS: ChecklistPreset[] = [
  // 12 mesi prima
  { phase: '12_MESI', title: 'Definire budget complessivo', description: 'Quadro economico totale + ripartizione per voce' },
  { phase: '12_MESI', title: 'Definire data evento e stagione', description: 'Verificare disponibilità dei familiari chiave' },
  { phase: '12_MESI', title: 'Scegliere location ricevimento', description: 'Sopralluogo + opzione date alternative' },
  { phase: '12_MESI', title: 'Lista invitati preliminare', description: 'Conteggio ospiti per dimensionare location e budget' },
  { phase: '12_MESI', title: 'Ingaggiare wedding planner (se previsto)' },
  { phase: '12_MESI', title: 'Save the date (digital)', description: 'Inviato 9-12 mesi prima' },

  // 6 mesi prima
  { phase: '6_MESI', title: 'Scegliere abito sposa', description: 'Boutique o couture, tempi consegna 3-6 mesi' },
  { phase: '6_MESI', title: 'Scegliere abito sposo' },
  { phase: '6_MESI', title: 'Selezionare fotografo + videomaker' },
  { phase: '6_MESI', title: 'Catering + degustazione menu', description: 'Tipologia menu, opzioni vegetariane, allergeni' },
  { phase: '6_MESI', title: 'Fiorista + concept allestimenti', description: 'Brief mood + budget allestimenti' },
  { phase: '6_MESI', title: 'Cerimonia: chiesa/celebrante civile' },
  { phase: '6_MESI', title: 'Booking hotel ospiti fuori sede', description: 'Convenzioni con strutture' },
  { phase: '6_MESI', title: 'Lista nozze (gift registry)' },

  // 3 mesi prima
  { phase: '3_MESI', title: 'Stampare e spedire partecipazioni' },
  { phase: '3_MESI', title: 'Prima prova abito sposa' },
  { phase: '3_MESI', title: 'Scegliere bomboniere' },
  { phase: '3_MESI', title: 'Prove make-up + acconciatura' },
  { phase: '3_MESI', title: 'Definire wedding cake con pasticcere' },
  { phase: '3_MESI', title: 'Confermare musica: DJ/band/archi' },
  { phase: '3_MESI', title: 'Pratiche civili/religiose', description: 'Pubblicazioni, documenti, corso prematrimoniale' },
  { phase: '3_MESI', title: 'Auto sposi + trasporti ospiti' },

  // 1 mese prima
  { phase: '1_MESE', title: 'Raccogliere RSVP definitivi' },
  { phase: '1_MESE', title: 'Disposizione tavoli + tableau de mariage' },
  { phase: '1_MESE', title: 'Briefing fornitori + timeline giorno-X' },
  { phase: '1_MESE', title: 'Ultima prova abito' },
  { phase: '1_MESE', title: 'Pagamenti acconti finali' },
  { phase: '1_MESE', title: 'Preparare regalo per genitori/testimoni' },
  { phase: '1_MESE', title: 'Playlist definitiva consegnata a DJ' },

  // 1 settimana prima
  { phase: '1_SETTIMANA', title: 'Manicure + pedicure + ultimi trattamenti' },
  { phase: '1_SETTIMANA', title: 'Preparare valigia luna di miele' },
  { phase: '1_SETTIMANA', title: 'Riconferma fornitori + verifica meteo' },
  { phase: '1_SETTIMANA', title: 'Stilare scaletta dettagliata giorno-X' },
  { phase: '1_SETTIMANA', title: 'Distribuire compiti a testimoni' },
  { phase: '1_SETTIMANA', title: 'Sigillo buste con bomboniere + segnaposto' },

  // Day-of
  { phase: 'DAY_OF', title: 'Colazione abbondante + idratazione' },
  { phase: 'DAY_OF', title: 'Make-up + acconciatura sposa' },
  { phase: 'DAY_OF', title: 'Controllare consegna fiori e allestimenti' },
  { phase: 'DAY_OF', title: 'Wedding planner coordina arrivo fornitori' },
  { phase: 'DAY_OF', title: 'Cerimonia' },
  { phase: 'DAY_OF', title: 'Foto sposi + foto famiglia' },
  { phase: 'DAY_OF', title: 'Ricevimento → festa → saluto ospiti' },
]

// Checklist per eventi NON matrimonio (compleanni, feste, lauree, eventi): il tipo evento comanda.
export const CHECKLIST_EVENTO: ChecklistPreset[] = [
  { phase: '3_MESI', title: 'Definire budget e numero invitati', description: 'Quadro economico + stima ospiti per dimensionare tutto' },
  { phase: '3_MESI', title: 'Scegliere data e location / sala', description: 'Sopralluogo + date alternative' },
  { phase: '3_MESI', title: 'Decidere tema e stile della festa' },
  { phase: '3_MESI', title: 'Lista invitati preliminare' },
  { phase: '1_MESE', title: 'Inviti / save the date' },
  { phase: '1_MESE', title: 'Torta e catering / buffet', description: 'Menù, torta, opzioni per allergie e bambini' },
  { phase: '1_MESE', title: 'Intrattenimento e animazione', description: 'DJ, musica, mago, animatore, giochi' },
  { phase: '1_MESE', title: 'Allestimenti e decorazioni', description: 'Palloncini, centrotavola, backdrop, luci' },
  { phase: '1_MESE', title: 'Fotografo / photo booth (se previsto)' },
  { phase: '1_SETTIMANA', title: 'Raccogliere le conferme (RSVP)' },
  { phase: '1_SETTIMANA', title: 'Confermare i fornitori (torta, catering, animazione)' },
  { phase: '1_SETTIMANA', title: 'Comprare candeline, accessori, piatti e bicchieri' },
  { phase: '1_SETTIMANA', title: 'Preparare la playlist' },
  { phase: 'DAY_OF', title: 'Ritiro torta e ultimi acquisti' },
  { phase: 'DAY_OF', title: 'Allestire la sala' },
  { phase: 'DAY_OF', title: 'Accoglienza ospiti' },
  { phase: 'DAY_OF', title: 'Taglio torta, brindisi e foto' },
  { phase: 'GENERICA', title: 'Regalini / bomboniere per gli ospiti' },
  { phase: 'GENERICA', title: 'Angolo foto / photo booth' },
  { phase: 'GENERICA', title: 'Lista regali (se prevista)' },
]

// Checklist adatta al tipo evento: matrimonio → set matrimonio; ogni altro evento
// (compleanno, festa, laurea, corporate…) → set evento generico.
export function checklistPresetsFor(kind: string | null | undefined): ChecklistPreset[] {
  return (kind ?? 'matrimonio').toLowerCase() === 'matrimonio' ? CHECKLIST_PRESETS : CHECKLIST_EVENTO
}

export const PHASE_LABEL: Record<ChecklistPhase, string> = {
  '12_MESI': '12 mesi prima',
  '6_MESI': '6 mesi prima',
  '3_MESI': '3 mesi prima',
  '1_MESE': '1 mese prima',
  '1_SETTIMANA': '1 settimana prima',
  'DAY_OF': 'Giorno-X',
  'GENERICA': 'Generale',
}
