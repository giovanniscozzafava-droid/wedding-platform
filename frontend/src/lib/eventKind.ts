// Helper terminologia event_kind — usato in form, email subject, PDF, public pages
// per disciplinare il linguaggio al tipo di evento scelto.

export const EVENT_KINDS = [
  'matrimonio',
  'battesimo',
  'cresima',
  'comunione',
  'compleanno',
  'anniversario',
  'laurea',
  'corporate',
  'altro',
] as const

export type EventKind = (typeof EVENT_KINDS)[number]

type Term = {
  label: string             // singolare base ("matrimonio")
  Label: string             // singolare capitalized ("Matrimonio")
  article: 'il' | 'la' | "l'" | 'lo'  // articolo determinativo
  articleAposIfNeeded: string   // "il" / "la " / "l'" ecc.
  ofIt: string              // "del matrimonio" / "del battesimo" / "della cresima"
  forIt: string             // "per il matrimonio" / "per il battesimo" / "per la cresima"
  honoreeSingular: string   // "lo sposo" / "il festeggiato" / "il battezzando"
  honoreeFeminine: string   // "la sposa" / "la festeggiata" / "la battezzanda"
  honoreePlural: string     // "gli sposi" / "il festeggiato e i genitori" / ...
  honoreeNeutral: string    // "il festeggiato/la festeggiata" — fallback
  hasCoupleConcept: boolean // se true, mostra campi "sposo" + "sposa"; altrimenti unico festeggiato
}

const TERMS: Record<EventKind, Term> = {
  matrimonio: {
    label: 'matrimonio',
    Label: 'Matrimonio',
    article: 'il',
    articleAposIfNeeded: 'il ',
    ofIt: 'del matrimonio',
    forIt: 'per il matrimonio',
    honoreeSingular: 'lo sposo',
    honoreeFeminine: 'la sposa',
    honoreePlural: 'gli sposi',
    honoreeNeutral: 'gli sposi',
    hasCoupleConcept: true,
  },
  battesimo: {
    label: 'battesimo',
    Label: 'Battesimo',
    article: 'il',
    articleAposIfNeeded: 'il ',
    ofIt: 'del battesimo',
    forIt: 'per il battesimo',
    honoreeSingular: 'il battezzando',
    honoreeFeminine: 'la battezzanda',
    honoreePlural: 'il/la battezzando/a',
    honoreeNeutral: 'il festeggiato / la festeggiata',
    hasCoupleConcept: false,
  },
  cresima: {
    label: 'cresima',
    Label: 'Cresima',
    article: 'la',
    articleAposIfNeeded: 'la ',
    ofIt: 'della cresima',
    forIt: 'per la cresima',
    honoreeSingular: 'il cresimando',
    honoreeFeminine: 'la cresimanda',
    honoreePlural: 'il/la cresimando/a',
    honoreeNeutral: 'il festeggiato / la festeggiata',
    hasCoupleConcept: false,
  },
  comunione: {
    label: 'prima comunione',
    Label: 'Prima Comunione',
    article: 'la',
    articleAposIfNeeded: 'la ',
    ofIt: 'della prima comunione',
    forIt: 'per la prima comunione',
    honoreeSingular: 'il comunicando',
    honoreeFeminine: 'la comunicanda',
    honoreePlural: 'il/la comunicando/a',
    honoreeNeutral: 'il festeggiato / la festeggiata',
    hasCoupleConcept: false,
  },
  compleanno: {
    label: 'compleanno',
    Label: 'Compleanno',
    article: 'il',
    articleAposIfNeeded: 'il ',
    ofIt: 'del compleanno',
    forIt: 'per il compleanno',
    honoreeSingular: 'il festeggiato',
    honoreeFeminine: 'la festeggiata',
    honoreePlural: 'il festeggiato / la festeggiata',
    honoreeNeutral: 'il festeggiato / la festeggiata',
    hasCoupleConcept: false,
  },
  anniversario: {
    label: 'anniversario',
    Label: 'Anniversario',
    article: "l'",
    articleAposIfNeeded: "l'",
    ofIt: "dell'anniversario",
    forIt: "per l'anniversario",
    honoreeSingular: 'il festeggiato',
    honoreeFeminine: 'la festeggiata',
    honoreePlural: 'i festeggiati',
    honoreeNeutral: 'i festeggiati',
    hasCoupleConcept: true,
  },
  laurea: {
    label: 'festa di laurea',
    Label: 'Festa di laurea',
    article: 'la',
    articleAposIfNeeded: 'la ',
    ofIt: 'della festa di laurea',
    forIt: 'per la festa di laurea',
    honoreeSingular: 'il neolaureato',
    honoreeFeminine: 'la neolaureata',
    honoreePlural: 'il/la neolaureato/a',
    honoreeNeutral: 'il festeggiato / la festeggiata',
    hasCoupleConcept: false,
  },
  corporate: {
    label: 'evento aziendale',
    Label: 'Evento aziendale',
    article: "l'",
    articleAposIfNeeded: "l'",
    ofIt: "dell'evento aziendale",
    forIt: "per l'evento aziendale",
    honoreeSingular: 'il committente',
    honoreeFeminine: 'la committente',
    honoreePlural: 'i partecipanti',
    honoreeNeutral: 'i partecipanti',
    hasCoupleConcept: false,
  },
  altro: {
    label: 'evento',
    Label: 'Evento',
    article: "l'",
    articleAposIfNeeded: "l'",
    ofIt: "dell'evento",
    forIt: "per l'evento",
    honoreeSingular: 'il festeggiato',
    honoreeFeminine: 'la festeggiata',
    honoreePlural: 'i festeggiati',
    honoreeNeutral: 'il festeggiato / la festeggiata',
    hasCoupleConcept: false,
  },
}

export function eventTerm(kind: string | null | undefined): Term {
  const k = (kind ?? 'matrimonio').toLowerCase() as EventKind
  return TERMS[k] ?? TERMS.altro
}

export function eventLabel(kind: string | null | undefined): string {
  return eventTerm(kind).label
}

export function eventLabelCapitalized(kind: string | null | undefined): string {
  return eventTerm(kind).Label
}
