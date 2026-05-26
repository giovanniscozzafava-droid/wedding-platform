// Domande del questionario cliente in base a event_kind.
// Compilate dal cliente DOPO il login sulla pagina /p/accept/:token PRIMA
// della firma. Le risposte vengono salvate in quote_questionnaire_answers
// e mostrate al fornitore/WP nel suo dashboard.

import type { EventKind } from './eventKind'

export type QuestionType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect' | 'tags'

export type Question = {
  key: string
  label: string
  type: QuestionType
  required?: boolean
  placeholder?: string
  options?: string[]
  help?: string
}

export type QuestionnaireSection = {
  title: string
  questions: Question[]
}

const COMMON_LOCATION_KINDS = ['villa', 'tenuta', 'castello', 'spiaggia', 'borgo', 'ristorante', 'agriturismo', 'sala_eventi', 'casa_privata', 'chiesa', 'altro']
const COMMON_STYLES = ['classico', 'moderno', 'rustico', 'boho', 'minimal', 'elegante', 'romantico', 'industriale', 'shabby_chic']
const COMMON_DIETS = ['vegetariano', 'vegano', 'celiaco', 'no_lattosio', 'kosher', 'halal']

const QUESTIONS_MATRIMONIO: QuestionnaireSection[] = [
  {
    title: 'Voi due',
    questions: [
      { key: 'partner1_name', label: 'Nome partner 1', type: 'text', required: true, placeholder: 'Es. Giulia' },
      { key: 'partner2_name', label: 'Nome partner 2', type: 'text', required: true, placeholder: 'Es. Marco' },
      { key: 'couple_nickname', label: 'Come vi piace essere chiamati insieme', type: 'text', placeholder: 'Es. Giulia & Marco' },
      { key: 'how_met', label: 'Raccontateci come vi siete conosciuti', type: 'textarea', placeholder: 'Una storia breve aiuta a personalizzare il vostro giorno' },
    ],
  },
  {
    title: 'L\'evento',
    questions: [
      { key: 'event_date_confirmed', label: 'Data confermata', type: 'date' },
      { key: 'ceremony_kind', label: 'Tipo di cerimonia', type: 'select', options: ['religiosa', 'civile', 'simbolica', 'rito_libero'] },
      { key: 'location_kind', label: 'Che tipo di location?', type: 'select', options: COMMON_LOCATION_KINDS },
      { key: 'guests_estimate', label: 'Numero invitati stimato', type: 'number', placeholder: '110' },
      { key: 'styles', label: 'Stili che vi piacciono (max 4)', type: 'multiselect', options: COMMON_STYLES },
    ],
  },
  {
    title: 'Budget e priorità',
    questions: [
      { key: 'budget_total', label: 'Budget totale orientativo €', type: 'number', placeholder: '25000' },
      { key: 'budget_priorities', label: 'Su cosa volete investire di più?', type: 'multiselect', options: ['fotografo', 'video', 'location', 'catering', 'fiori', 'musica', 'abito', 'viaggio_nozze'] },
      { key: 'must_haves', label: 'Le 3 cose che NON possono mancare', type: 'tags', placeholder: 'es. fotografo full-day, open bar, fiori freschi' },
      { key: 'no_thanks', label: 'Le 3 cose che NON volete', type: 'tags', placeholder: 'es. confettata anni 80, lanci di riso, ballerini' },
    ],
  },
  {
    title: 'Allergie e diete invitati',
    questions: [
      { key: 'special_diets', label: 'Diete speciali tra gli invitati', type: 'multiselect', options: COMMON_DIETS },
      { key: 'allergies_notes', label: 'Allergie alimentari note', type: 'textarea', placeholder: 'Es. nonna di Marco — frutta secca; cugino Luca — glutine' },
      { key: 'kids_count', label: 'Bambini presenti', type: 'number', placeholder: '8' },
    ],
  },
]

const QUESTIONS_BATTESIMO: QuestionnaireSection[] = [
  {
    title: 'Il/la battezzando/a',
    questions: [
      { key: 'honoree_name', label: 'Nome del/la battezzando/a', type: 'text', required: true },
      { key: 'birth_date', label: 'Data di nascita', type: 'date' },
      { key: 'parents_names', label: 'Nomi dei genitori', type: 'text', placeholder: 'Es. Anna Rossi e Marco Bianchi' },
      { key: 'godparents', label: 'Padrino e/o madrina', type: 'text', placeholder: 'Nomi' },
    ],
  },
  {
    title: 'L\'evento',
    questions: [
      { key: 'event_date_confirmed', label: 'Data confermata', type: 'date' },
      { key: 'parish', label: 'Parrocchia / luogo della cerimonia', type: 'text' },
      { key: 'reception_kind', label: 'Tipo di ricevimento', type: 'select', options: ['pranzo_seduto', 'pranzo_buffet', 'aperitivo_buffet', 'cena', 'solo_dolce'] },
      { key: 'guests_estimate', label: 'Numero invitati stimato', type: 'number' },
    ],
  },
  {
    title: 'Preferenze',
    questions: [
      { key: 'theme_color', label: 'Colore/tema preferito', type: 'text', placeholder: 'Es. azzurro polvere, rosa cipria' },
      { key: 'special_diets', label: 'Diete speciali tra gli invitati', type: 'multiselect', options: COMMON_DIETS },
      { key: 'kids_count', label: 'Bambini presenti (oltre al/la festeggiato/a)', type: 'number' },
      { key: 'notes', label: 'Note per il fornitore', type: 'textarea' },
    ],
  },
]

const QUESTIONS_COMUNIONE: QuestionnaireSection[] = [
  {
    title: 'Il/la comunicando/a',
    questions: [
      { key: 'honoree_name', label: 'Nome del/la comunicando/a', type: 'text', required: true },
      { key: 'age', label: 'Età', type: 'number', placeholder: '9' },
      { key: 'parents_names', label: 'Nomi dei genitori', type: 'text' },
    ],
  },
  {
    title: 'L\'evento',
    questions: [
      { key: 'event_date_confirmed', label: 'Data confermata', type: 'date' },
      { key: 'parish', label: 'Parrocchia', type: 'text' },
      { key: 'reception_kind', label: 'Tipo di ricevimento', type: 'select', options: ['pranzo_seduto', 'pranzo_buffet', 'aperitivo', 'cena', 'solo_dolce'] },
      { key: 'guests_estimate', label: 'Numero invitati stimato', type: 'number' },
      { key: 'kids_count', label: 'Bambini presenti', type: 'number' },
    ],
  },
  {
    title: 'Preferenze',
    questions: [
      { key: 'theme_color', label: 'Tema/colori preferiti', type: 'text', placeholder: 'Es. bianco e oro' },
      { key: 'favourite_food', label: 'Piatti preferiti del/la festeggiato/a', type: 'textarea' },
      { key: 'special_diets', label: 'Diete speciali tra gli invitati', type: 'multiselect', options: COMMON_DIETS },
      { key: 'allergies_notes', label: 'Allergie note', type: 'textarea' },
      { key: 'animation_yes_no', label: 'Animazione per bambini?', type: 'select', options: ['sì_animatore', 'sì_gonfiabili', 'sì_baby_dance', 'no_grazie'] },
    ],
  },
]

const QUESTIONS_CRESIMA: QuestionnaireSection[] = [
  {
    title: 'Il/la cresimando/a',
    questions: [
      { key: 'honoree_name', label: 'Nome del/la cresimando/a', type: 'text', required: true },
      { key: 'age', label: 'Età', type: 'number' },
      { key: 'sponsor_name', label: 'Nome padrino / madrina', type: 'text' },
    ],
  },
  {
    title: 'L\'evento',
    questions: [
      { key: 'event_date_confirmed', label: 'Data confermata', type: 'date' },
      { key: 'parish', label: 'Parrocchia', type: 'text' },
      { key: 'reception_kind', label: 'Tipo di ricevimento', type: 'select', options: ['pranzo_seduto', 'aperitivo_buffet', 'cena', 'cocktail_party'] },
      { key: 'guests_estimate', label: 'Numero invitati stimato', type: 'number' },
    ],
  },
  {
    title: 'Preferenze',
    questions: [
      { key: 'theme_style', label: 'Stile evento', type: 'select', options: ['classico', 'moderno', 'minimal', 'colorato'] },
      { key: 'music_preference', label: 'Musica preferita (genere)', type: 'text', placeholder: 'Es. pop italiano, hip-hop' },
      { key: 'special_diets', label: 'Diete speciali tra gli invitati', type: 'multiselect', options: COMMON_DIETS },
      { key: 'notes', label: 'Note', type: 'textarea' },
    ],
  },
]

const QUESTIONS_COMPLEANNO: QuestionnaireSection[] = [
  {
    title: 'Il festeggiato / la festeggiata',
    questions: [
      { key: 'honoree_name', label: 'Nome del festeggiato/a', type: 'text', required: true },
      { key: 'age_turning', label: 'Quanti anni compie', type: 'number', placeholder: '18' },
      { key: 'milestone', label: 'È un anniversario importante?', type: 'select', options: ['no', 'maggiore_eta_18', '30_anni', '40_anni', '50_anni', '60_anni', '70_e_oltre'] },
    ],
  },
  {
    title: 'L\'evento',
    questions: [
      { key: 'event_date_confirmed', label: 'Data', type: 'date' },
      { key: 'venue_kind', label: 'Dove', type: 'select', options: ['casa', 'ristorante', 'locale', 'villa', 'spiaggia', 'rooftop', 'altro'] },
      { key: 'event_type', label: 'Che tipo di festa?', type: 'select', options: ['cena_seduta', 'aperitivo_party', 'cocktail_party', 'after_dinner', 'pool_party', 'a_tema'] },
      { key: 'theme', label: 'Tema della festa (se ce n\'è uno)', type: 'text', placeholder: 'Es. anni 80, gatsby, mascherato' },
      { key: 'guests_estimate', label: 'Numero invitati stimato', type: 'number' },
    ],
  },
  {
    title: 'Stile',
    questions: [
      { key: 'music_genre', label: 'Genere musicale preferito', type: 'multiselect', options: ['pop', 'rock', 'house', 'hip-hop', 'reggaeton', 'classico', 'jazz', 'cantautori_italiani', 'anni_80_90'] },
      { key: 'special_drinks', label: 'Drink/cocktail preferiti del festeggiato', type: 'text', placeholder: 'Es. Negroni, Aperol, Moscow Mule' },
      { key: 'favourite_food', label: 'Piatti preferiti', type: 'text' },
      { key: 'special_diets', label: 'Diete speciali tra gli invitati', type: 'multiselect', options: COMMON_DIETS },
      { key: 'surprises', label: 'Sorprese da preparare?', type: 'textarea', placeholder: 'Es. video messaggi famiglia, ballerine, ospite a sorpresa' },
    ],
  },
]

const QUESTIONS_ANNIVERSARIO: QuestionnaireSection[] = [
  {
    title: 'La coppia',
    questions: [
      { key: 'partner1_name', label: 'Nome partner 1', type: 'text', required: true },
      { key: 'partner2_name', label: 'Nome partner 2', type: 'text', required: true },
      { key: 'years_together', label: 'Quanti anni insieme/di matrimonio', type: 'number' },
    ],
  },
  {
    title: 'L\'evento',
    questions: [
      { key: 'event_date_confirmed', label: 'Data', type: 'date' },
      { key: 'venue_kind', label: 'Dove', type: 'select', options: COMMON_LOCATION_KINDS },
      { key: 'guests_estimate', label: 'Numero invitati', type: 'number' },
      { key: 'rinnovo_promesse', label: 'Vuoi un momento di rinnovo delle promesse?', type: 'select', options: ['sì', 'no', 'forse'] },
    ],
  },
  {
    title: 'Stile',
    questions: [
      { key: 'theme', label: 'Tema/colore', type: 'text' },
      { key: 'special_diets', label: 'Diete', type: 'multiselect', options: COMMON_DIETS },
      { key: 'notes', label: 'Note', type: 'textarea' },
    ],
  },
]

const QUESTIONS_LAUREA: QuestionnaireSection[] = [
  {
    title: 'Il/la neolaureato/a',
    questions: [
      { key: 'honoree_name', label: 'Nome', type: 'text', required: true },
      { key: 'degree', label: 'Tipo di laurea', type: 'select', options: ['triennale', 'magistrale', 'specialistica', 'phd', 'master'] },
      { key: 'faculty', label: 'Facoltà / corso', type: 'text' },
      { key: 'final_grade', label: 'Voto finale', type: 'text', placeholder: 'Es. 110, 110 e lode' },
    ],
  },
  {
    title: 'L\'evento',
    questions: [
      { key: 'event_date_confirmed', label: 'Data', type: 'date' },
      { key: 'event_type', label: 'Tipo di festa', type: 'select', options: ['pranzo_familiare', 'aperitivo_amici', 'cena_party', 'after_party_locale'] },
      { key: 'guests_estimate', label: 'Numero invitati', type: 'number' },
    ],
  },
  {
    title: 'Stile',
    questions: [
      { key: 'theme', label: 'Colore della facoltà', type: 'text', placeholder: 'Es. rosso giurisprudenza, nero economia' },
      { key: 'music_genre', label: 'Musica preferita', type: 'text' },
      { key: 'surprises', label: 'Sorprese da preparare?', type: 'textarea' },
    ],
  },
]

const QUESTIONS_CORPORATE: QuestionnaireSection[] = [
  {
    title: 'Azienda',
    questions: [
      { key: 'company_name', label: 'Nome azienda', type: 'text', required: true },
      { key: 'event_purpose', label: 'Scopo dell\'evento', type: 'select', options: ['team_building', 'inaugurazione', 'lancio_prodotto', 'cena_aziendale', 'gala', 'conferenza', 'networking'] },
      { key: 'contact_name', label: 'Referente', type: 'text' },
    ],
  },
  {
    title: 'L\'evento',
    questions: [
      { key: 'event_date_confirmed', label: 'Data', type: 'date' },
      { key: 'guests_estimate', label: 'Partecipanti previsti', type: 'number' },
      { key: 'venue_kind', label: 'Tipo location', type: 'select', options: ['sala_aziendale', 'hotel', 'villa', 'rooftop', 'ristorante', 'museo', 'altro'] },
      { key: 'event_format', label: 'Formato', type: 'select', options: ['pranzo', 'aperitivo', 'cena_gala', 'workshop_giornaliero', 'aperitivo_networking'] },
    ],
  },
  {
    title: 'Branding',
    questions: [
      { key: 'logo_required', label: 'Branding aziendale richiesto?', type: 'select', options: ['sì_minimale', 'sì_visibile', 'no_brand_neutro'] },
      { key: 'special_diets', label: 'Diete speciali / allergie tra i partecipanti', type: 'multiselect', options: COMMON_DIETS },
      { key: 'dress_code', label: 'Dress code', type: 'select', options: ['formal', 'business_casual', 'casual', 'a_tema'] },
      { key: 'notes', label: 'Note speciali', type: 'textarea' },
    ],
  },
]

const QUESTIONS_ALTRO: QuestionnaireSection[] = [
  {
    title: 'Dati base',
    questions: [
      { key: 'honoree_name', label: 'Nome del festeggiato / cliente', type: 'text', required: true },
      { key: 'event_date_confirmed', label: 'Data', type: 'date' },
      { key: 'guests_estimate', label: 'Numero partecipanti', type: 'number' },
      { key: 'venue_kind', label: 'Dove', type: 'text' },
    ],
  },
  {
    title: 'Preferenze',
    questions: [
      { key: 'theme', label: 'Tema / mood', type: 'text' },
      { key: 'special_diets', label: 'Diete speciali', type: 'multiselect', options: COMMON_DIETS },
      { key: 'notes', label: 'Note', type: 'textarea' },
    ],
  },
]

const QUESTIONS_BY_KIND: Record<EventKind, QuestionnaireSection[]> = {
  matrimonio: QUESTIONS_MATRIMONIO,
  battesimo: QUESTIONS_BATTESIMO,
  cresima: QUESTIONS_CRESIMA,
  comunione: QUESTIONS_COMUNIONE,
  compleanno: QUESTIONS_COMPLEANNO,
  anniversario: QUESTIONS_ANNIVERSARIO,
  laurea: QUESTIONS_LAUREA,
  corporate: QUESTIONS_CORPORATE,
  altro: QUESTIONS_ALTRO,
}

export function getQuestionsFor(kind: string | null | undefined): QuestionnaireSection[] {
  const k = (kind ?? 'matrimonio').toLowerCase() as EventKind
  return QUESTIONS_BY_KIND[k] ?? QUESTIONS_ALTRO
}

// ============================================================================
// MOODBOARD — sezioni dedicate per il cliente capostipite (WP/Location)
// Una sezione per categoria. Le risposte vengono salvate sia in
// quote_questionnaire_answers (storico) sia in mood_inspirations (moodboard
// strutturata, riusabile dalle pagine /weddings/:id moodboard).
// ============================================================================

export const MOODBOARD_CATEGORIES = [
  { key: 'fotografo',    label: 'Fotografia' },
  { key: 'videomaker',   label: 'Video' },
  { key: 'fioraio',      label: 'Fiori e bouquet' },
  { key: 'allestimenti', label: 'Allestimenti e decorazioni' },
  { key: 'torta',        label: 'Torta e dolci' },
  { key: 'catering',     label: 'Menù e catering' },
  { key: 'abito_sposa',  label: 'Abito sposa' },
  { key: 'abito_sposo',  label: 'Abito sposo' },
  { key: 'bomboniere',   label: 'Bomboniere' },
  { key: 'stampe',       label: 'Inviti e cartoleria' },
  { key: 'musica',       label: 'Musica e atmosfera' },
  { key: 'make_up',      label: 'Make-up e capelli' },
  { key: 'location',     label: 'Location e ambiente' },
] as const

export type MoodboardCategory = (typeof MOODBOARD_CATEGORIES)[number]['key']

function moodSection(catKey: string, catLabel: string): QuestionnaireSection {
  return {
    title: `Ispirazione · ${catLabel}`,
    questions: [
      { key: `mood_${catKey}_pinterest_url`, label: 'Link board Pinterest', type: 'text', placeholder: 'https://pinterest.com/...' },
      { key: `mood_${catKey}_instagram_refs`, label: 'Profili / post Instagram', type: 'tags', placeholder: '@profilo1, @profilo2' },
      { key: `mood_${catKey}_mood_words`, label: 'Tre parole per descrivere lo stile', type: 'tags', placeholder: 'elegante, naturale, romantico' },
      { key: `mood_${catKey}_free_notes`, label: 'Note libere', type: 'textarea', placeholder: 'Qualsiasi dettaglio, immagine descritta, riferimento.' },
    ],
  }
}

export function getMoodboardSectionsForCapostipite(eventKind: string | null | undefined): QuestionnaireSection[] {
  // Filtra categorie non applicabili agli altri eventi
  const k = (eventKind ?? 'matrimonio').toLowerCase()
  const excluded = new Set<string>()
  if (k !== 'matrimonio') {
    excluded.add('abito_sposa')
    excluded.add('abito_sposo')
    excluded.add('bomboniere')
  }
  return MOODBOARD_CATEGORIES
    .filter((c) => !excluded.has(c.key))
    .map((c) => moodSection(c.key, c.label))
}

// Estrae le ispirazioni strutturate dalle risposte del questionario
// (chiavi mood_<categoria>_<campo>) per il save su mood_inspirations.
export function extractInspirationsFromAnswers(answers: Record<string, unknown>): Record<string, {
  pinterest_url?: string
  instagram_refs?: string[]
  mood_words?: string[]
  free_notes?: string
}> {
  const out: Record<string, {
    pinterest_url?: string
    instagram_refs?: string[]
    mood_words?: string[]
    free_notes?: string
  }> = {}
  for (const cat of MOODBOARD_CATEGORIES) {
    const pinterest = answers[`mood_${cat.key}_pinterest_url`] as string | undefined
    const igRefs = answers[`mood_${cat.key}_instagram_refs`] as string[] | undefined
    const moodW = answers[`mood_${cat.key}_mood_words`] as string[] | undefined
    const notes = answers[`mood_${cat.key}_free_notes`] as string | undefined
    const hasContent =
      (pinterest && pinterest.trim()) ||
      (Array.isArray(igRefs) && igRefs.length > 0) ||
      (Array.isArray(moodW) && moodW.length > 0) ||
      (notes && notes.trim())
    if (hasContent) {
      out[cat.key] = {
        pinterest_url: pinterest?.trim() || undefined,
        instagram_refs: Array.isArray(igRefs) ? igRefs.filter(Boolean) : undefined,
        mood_words: Array.isArray(moodW) ? moodW.filter(Boolean) : undefined,
        free_notes: notes?.trim() || undefined,
      }
    }
  }
  return out
}
