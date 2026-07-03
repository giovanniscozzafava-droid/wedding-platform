import { Fragment } from 'react'
import { Check } from 'lucide-react'

// Stepper numerato "a funnel": dà un ORDINE di senso agli strumenti (① → ② → ③ …).
// Lo step corrente = il primo non ancora fatto. Ogni step può essere cliccabile (avvia l'azione).
export type FunnelStep = { key: string; label: string; done?: boolean; onClick?: () => void; hint?: string }

export function FunnelSteps({ steps, className }: { steps: FunnelStep[]; className?: string }) {
  const currentIdx = (() => { const i = steps.findIndex((s) => !s.done); return i === -1 ? steps.length - 1 : i })()
  return (
    <div className={`flex items-center gap-1 overflow-x-auto pb-1 ${className ?? ''}`} style={{ scrollbarWidth: 'thin' }}>
      {steps.map((s, i) => {
        const state = s.done ? 'done' : i === currentIdx ? 'current' : 'todo'
        return (
          <Fragment key={s.key}>
            {i > 0 && <div className={`h-px w-3 shrink-0 sm:w-5 ${i <= currentIdx ? 'bg-[rgb(var(--gold-400))]' : 'bg-[rgb(var(--border))]'}`} />}
            <button type="button" onClick={s.onClick} disabled={!s.onClick} title={s.hint}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${state === 'current' ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] font-semibold' : state === 'done' ? 'border-[rgb(var(--emerald-500))]/40 text-[rgb(var(--emerald-700))]' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-muted))]'} ${s.onClick ? 'cursor-pointer hover:border-[rgb(var(--gold-400))]' : 'cursor-default'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${state === 'done' ? 'bg-[rgb(var(--emerald-500))] text-white' : state === 'current' ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]'}`}>{s.done ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
              {s.label}
            </button>
          </Fragment>
        )
      })}
    </div>
  )
}
