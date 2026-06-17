import { MessageSquareText } from 'lucide-react'
import { answerLabel, formatAnswerValue } from '@/lib/answerLabels'

// Pannello SOLA LETTURA delle risposte del cliente (dal questionario di categoria/evento).
// Usato nell'editor preventivo e nella scheda lead del fornitore.
export function AnswersPanel({ answers, title = 'Risposte del cliente', note }: {
  answers: Record<string, unknown> | null | undefined
  title?: string
  note?: string
}) {
  const SKIP = new Set(['liked_style_cards', 'liked_tags', 'callback_pref']) // gestiti in viste dedicate
  const entries = Object.entries(answers ?? {}).filter(([k, v]) => {
    if (SKIP.has(k) || v == null || v === '') return false
    if (Array.isArray(v)) return v.length > 0 && typeof v[0] !== 'object' // niente array di oggetti
    return typeof v !== 'object'
  })
  if (entries.length === 0) return null
  return (
    <div className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] p-4">
      <p className="text-sm font-medium flex items-center gap-1.5 mb-1"><MessageSquareText size={15} className="text-[rgb(var(--gold-600))]" /> {title}</p>
      {note && <p className="text-[11px] text-[rgb(var(--fg-subtle))] mb-2">{note}</p>}
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
        {entries.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{answerLabel(k)}</dt>
            <dd className="text-sm text-[rgb(var(--fg))] break-words">{formatAnswerValue(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
