import { Fragment, useState } from 'react'
import { Check } from 'lucide-react'

// Stepper numerato "a funnel": dà un ORDINE di senso agli strumenti (① → ② → ③ …).
// Lo step corrente = il primo non ancora fatto. Ogni step può essere cliccabile (avvia l'azione).
// Accanto a ogni voce con `hint` compare un "?" che apre una spiegazione (help self-contained,
// perché l'impaginatore è a pagina piena e non ha il toggle "Aiuto" globale).
export type FunnelStep = { key: string; label: string; done?: boolean; onClick?: () => void; hint?: string }

export function FunnelSteps({ steps, className }: { steps: FunnelStep[]; className?: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const currentIdx = (() => { const i = steps.findIndex((s) => !s.done); return i === -1 ? steps.length - 1 : i })()
  return (
    <div className={`flex items-center gap-1 overflow-x-auto pb-1 ${className ?? ''}`} style={{ scrollbarWidth: 'thin' }}>
      {steps.map((s, i) => {
        const state = s.done ? 'done' : i === currentIdx ? 'current' : 'todo'
        const open = openKey === s.key
        return (
          <Fragment key={s.key}>
            {i > 0 && <div className={`h-px w-3 shrink-0 sm:w-5 ${i <= currentIdx ? 'bg-[rgb(var(--gold-400))]' : 'bg-[rgb(var(--border))]'}`} />}
            <div className="relative flex shrink-0 items-center gap-1">
              <button type="button" onClick={s.onClick} disabled={!s.onClick} title={s.hint}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${state === 'current' ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] font-semibold' : state === 'done' ? 'border-[rgb(var(--emerald-500))]/40 text-[rgb(var(--emerald-700))]' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-muted))]'} ${s.onClick ? 'cursor-pointer hover:border-[rgb(var(--gold-400))]' : 'cursor-default'}`}>
                <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${state === 'done' ? 'bg-[rgb(var(--emerald-500))] text-white' : state === 'current' ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]'}`}>{s.done ? <Check size={10} strokeWidth={3} /> : i + 1}</span>
                {s.label}
              </button>
              {s.hint && (
                <button type="button" aria-label={`Aiuto: ${s.label}`} title={s.hint}
                  onClick={(e) => { e.stopPropagation(); setOpenKey(open ? null : s.key) }}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${open ? 'border-transparent bg-[rgb(var(--gold-500))] text-white' : 'border-[rgb(var(--border-strong))] text-[rgb(var(--fg-subtle))] hover:border-[rgb(var(--gold-400))] hover:text-[rgb(var(--gold-600))]'}`}>?</button>
              )}
              {open && s.hint && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenKey(null)} />
                  <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-60 rounded-lg border bg-[rgb(var(--bg))] p-2.5 text-[11px] leading-snug text-[rgb(var(--fg-muted))] shadow-lg"
                    style={{ borderColor: 'rgb(var(--border-strong))' }} role="tooltip">
                    <span className="mb-0.5 block font-semibold text-[rgb(var(--fg))]">{s.label}</span>
                    {s.hint}
                  </div>
                </>
              )}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
