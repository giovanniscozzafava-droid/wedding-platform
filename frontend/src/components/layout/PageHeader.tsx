import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { HelpDot } from '@/components/help/HelpDot'
import { HELP_CONTENT } from '@/lib/helpContent'

type Props = {
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** id spiegazione contestuale (modalità Aiuto): mostra un "?" accanto al titolo.
   *  Se omesso, viene dedotto dalla rotta corrente (ROUTE_HELP). */
  helpId?: string
}

// Mappa rotta → spiegazione di sezione. Così ogni pagina che usa PageHeader
// eredita il "?" in modalità Aiuto senza doverla modificare una a una.
const ROUTE_HELP: Record<string, string> = {
  '/': 'page.dashboard',
  '/richieste': 'page.richieste',
  '/leads': 'page.leads',
  '/capostipiti': 'page.capostipiti',
  '/clienti': 'page.clienti',
  '/quotes': 'page.preventivi',
  '/lavori-da-confermare': 'page.daconfermare',
  '/contracts': 'page.contratti',
  '/my-contracts': 'page.contratti',
  '/weddings': 'page.eventi',
  '/catalog': 'page.catalogo',
  '/team': 'page.team',
  '/calcolatore': 'page.calcolatore',
  '/feed': 'page.feed',
  '/scopri': 'page.scopri',
  '/suppliers': 'page.scopri',
  '/crediti': 'page.crediti',
  '/rewards': 'page.rewards',
  '/calendar': 'page.calendario',
  '/bilancio': 'page.bilancio',
  '/settings/brand': 'page.brand',
  '/profile': 'page.profilo',
  '/integrazione-sito': 'page.integrazione',
  '/assistenza': 'page.assistenza',
}

export function PageHeader({ eyebrow, title, description, actions, helpId }: Props) {
  const { pathname } = useLocation()
  const resolvedHelp = helpId ?? (ROUTE_HELP[pathname] && HELP_CONTENT[ROUTE_HELP[pathname]!] ? ROUTE_HELP[pathname] : undefined)
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
      <div className="space-y-1">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: 'rgb(var(--gold-600))' }}>
            {eyebrow}
          </p>
        )}
        <h1 className="font-display text-3xl sm:text-4xl tracking-tight inline-flex items-center gap-2" style={{ color: 'rgb(var(--fg))' }}>
          {title}{resolvedHelp && <HelpDot id={resolvedHelp} />}
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
