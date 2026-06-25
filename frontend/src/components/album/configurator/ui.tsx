import type { ReactNode } from 'react'

// Primitive condivise del configuratore — stile premium coerente col design system.
export const ringOn = 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] ring-2 ring-[rgb(var(--gold-300))] ring-offset-1 ring-offset-[rgb(var(--bg))]'
export const ringOff = 'border-[rgb(var(--border))] hover:border-[rgb(var(--gold-300))] bg-[rgb(var(--bg-elev))]'

export function Chip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`px-3.5 py-2 rounded-full text-sm border transition-all duration-150 ${active ? ringOn : ringOff}`}>
      {children}
    </button>
  )
}

export function SectionLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-[0.14em] text-[rgb(var(--fg-subtle))] mb-2.5 font-medium">
      {children}{hint && <span className="normal-case tracking-normal text-[rgb(var(--fg-muted))]"> · {hint}</span>}
    </p>
  )
}
