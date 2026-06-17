// Risolutore etichette per le risposte salvate (chiave -> label leggibile) usando le
// definizioni delle domande per categoria (supplierQuestions) e per tipo evento (eventQuestions).
// Serve a mostrare le risposte del cliente a chi crea il preventivo, in modo leggibile.
import { SUPPLIER_SUBROLES } from './supplierSubroles'
import { getQuestionsForSubrole } from './supplierQuestions'
import { getQuestionsFor, type Question, type QuestionnaireSection } from './eventQuestions'
import { EVENT_KINDS } from './eventKind'

let MAP: Record<string, { label: string }> | null = null

function build(): Record<string, { label: string }> {
  if (MAP) return MAP
  const m: Record<string, { label: string }> = {}
  const add = (secs: QuestionnaireSection[]) => { for (const s of secs) for (const q of s.questions as Question[]) if (!m[q.key]) m[q.key] = { label: q.label } }
  for (const s of SUPPLIER_SUBROLES) add(getQuestionsForSubrole(s.v))
  add(getQuestionsForSubrole('altro'))
  for (const k of EVENT_KINDS) add(getQuestionsFor(k))
  MAP = m
  return m
}

const humanize = (s: string) => s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()

export function answerLabel(key: string): string {
  return build()[key]?.label ?? humanize(key)
}

// Valore leggibile: array -> elenco, opzioni snake_case -> "Snake case", testo libero invariato.
export function formatAnswerValue(v: unknown): string {
  if (v == null || v === '') return '—'
  if (Array.isArray(v)) return v.map((x) => formatAnswerValue(x)).join(', ')
  if (typeof v === 'boolean') return v ? 'Sì' : 'No'
  if (typeof v === 'number') return String(v)
  const s = String(v)
  // se è un valore-opzione (snake_case minuscolo, senza spazi) lo umanizziamo
  return /^[a-z0-9]+(_[a-z0-9]+)+$/.test(s) ? humanize(s) : s
}
