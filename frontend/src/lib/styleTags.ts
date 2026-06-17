// Tag-categoria pre-impostati per professione, derivati dalle opzioni dei questionari di
// categoria (supplierQuestions). Es. fotografo → "reportage naturale", "posato elegante"…
// Il fornitore li applica con un clic agli asset: così il matching del gioco resta coerente.
import { getQuestionsForSubrole } from './supplierQuestions'

export function suggestedStyleTags(subrole?: string | null): string[] {
  const secs = getQuestionsForSubrole(subrole)
  const out: string[] = []
  for (const s of secs) {
    for (const q of s.questions) {
      // prendiamo le opzioni delle domande "stile/scelta" (select/multiselect)
      if ((q.type === 'select' || q.type === 'multiselect') && q.options) {
        const k = (q.key || '').toLowerCase()
        if (k.includes('avoid') || k.includes('no_') || k.includes('budget')) continue // salta i "no/budget"
        for (const o of q.options) {
          const h = o.replace(/_/g, ' ').trim()
          if (h && !out.includes(h)) out.push(h)
        }
      }
    }
    if (out.length >= 12) break // di solito basta la prima sezione "stile/palette"
  }
  return out.slice(0, 12)
}
