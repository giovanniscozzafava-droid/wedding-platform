import type { LucideIcon } from 'lucide-react'
import { Check } from 'lucide-react'

export type StepDef = { key: string; label: string; icon: LucideIcon; summary?: string }

// Header dei passi: progress chiaro, salto diretto toccando lo step.
export function StepNav({ steps, current, onJump }: { steps: StepDef[]; current: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
      {steps.map((s, i) => {
        const Icon = s.icon
        const active = i === current
        const done = i < current
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onJump(i)}
            className={`flex-1 min-w-[64px] rounded-xl border px-2 py-2 text-center transition-all duration-150
              ${active ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]'
                : done ? 'border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))]'
                  : 'border-[rgb(var(--border))] bg-transparent opacity-70 hover:opacity-100'}`}
          >
            <span className={`mx-auto mb-1 grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold
              ${active ? 'bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))]'
                : done ? 'bg-[rgb(var(--gold-600))] text-[rgb(var(--bg))]'
                  : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))]'}`}>
              {done ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}
            </span>
            <span className={`block text-[10.5px] leading-tight font-medium ${active ? 'text-[rgb(var(--fg))]' : 'text-[rgb(var(--fg-muted))]'}`}>{s.label}</span>
          </button>
        )
      })}
    </div>
  )
}
