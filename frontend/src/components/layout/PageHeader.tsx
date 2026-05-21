import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div className="space-y-1">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: 'rgb(var(--gold-600))' }}>
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight" style={{ color: 'rgb(var(--fg))' }}>
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm sm:text-base" style={{ color: 'rgb(var(--fg-muted))' }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
