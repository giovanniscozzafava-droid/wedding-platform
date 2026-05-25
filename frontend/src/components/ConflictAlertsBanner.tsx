import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react'
import { useConflictAlerts, type ConflictAlert } from '@/hooks/useConflictAlerts'

const SEVERITY_BG: Record<string, string> = {
  HIGH: 'rgb(var(--rose-100))',
  MEDIUM: 'rgb(var(--gold-100))',
  LOW: 'rgb(var(--bg-sunken))',
}

const SEVERITY_FG: Record<string, string> = {
  HIGH: 'rgb(var(--rose-500))',
  MEDIUM: 'rgb(var(--gold-700))',
  LOW: 'rgb(var(--fg-muted))',
}

const ROLE_LABEL: Record<string, string> = {
  WEDDING_PLANNER: 'Wedding Planner',
  LOCATION: 'Location',
  FORNITORE: 'Fornitore',
  COUPLE: 'Coppia',
  ADMIN: 'Admin',
}

function describe(a: ConflictAlert): { title: string; sub: string } {
  if (a.my_role === 'FORNITORE_DIRETTO') {
    return {
      title: `Conflitto: questa coppia è già nel preventivo di ${a.other_owner_name ?? 'un wedding planner'}`,
      sub: `${ROLE_LABEL[a.other_owner_role] ?? a.other_owner_role} · totale € ${Number(a.other_quote_total).toLocaleString('it-IT', { maximumFractionDigits: 0 })} · stato ${a.other_quote_status}. Coordina con il/la collega per evitare disintermediazione.`,
    }
  }
  return {
    title: `Conflitto: il fornitore ${a.other_owner_name ?? ''} ha un preventivo diretto per questa coppia`,
    sub: `Stesso evento, stessa coppia · totale € ${Number(a.other_quote_total).toLocaleString('it-IT', { maximumFractionDigits: 0 })} · stato ${a.other_quote_status}. Verifica la trattativa per evitare doppio canale.`,
  }
}

export function ConflictAlertsBanner() {
  const { data } = useConflictAlerts()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(true)

  const alerts = (data ?? []).filter((a) => !dismissed.has(a.my_quote_id + a.other_quote_id))
  if (alerts.length === 0) return null

  function dismiss(a: ConflictAlert) {
    setDismissed((prev) => new Set(prev).add(a.my_quote_id + a.other_quote_id))
  }

  const highCount = alerts.filter((a) => a.conflict_severity === 'HIGH').length

  return (
    <div className="border-y" style={{ borderColor: 'rgb(var(--rose-100))', background: 'rgb(var(--rose-100) / 0.35)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-3 text-left"
        >
          <span className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full" style={{ background: 'rgb(var(--rose-500))', color: 'white' }}>
            <AlertTriangle size={14} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'rgb(var(--fg))' }}>
              {alerts.length} alert {alerts.length === 1 ? 'di sovrapposizione' : 'di sovrapposizione'} preventivi
              {highCount > 0 && <span className="ml-2 text-xs font-semibold" style={{ color: 'rgb(var(--rose-500))' }}>· {highCount} HIGH</span>}
            </p>
            <p className="text-xs" style={{ color: 'rgb(var(--fg-muted))' }}>
              Stessa coppia + stessa data tra preventivo diretto fornitore e preventivo WP. Possibile disintermediazione.
            </p>
          </div>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expanded && (
          <div className="mt-3 space-y-2">
            {alerts.map((a, idx) => {
              const d = describe(a)
              const key = a.my_quote_id + a.other_quote_id
              return (
                <div
                  key={key + idx}
                  className="flex items-start gap-3 p-3 rounded-lg border"
                  style={{
                    background: 'rgb(var(--bg-elev))',
                    borderColor: 'rgb(var(--border))',
                  }}
                >
                  <span
                    className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: SEVERITY_BG[a.conflict_severity], color: SEVERITY_FG[a.conflict_severity] }}
                  >
                    {a.conflict_severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--fg))' }}>{d.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'rgb(var(--fg-muted))' }}>{d.sub}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: 'rgb(var(--fg-subtle))' }}>
                      <span>Segnali: {a.match_signals.join(', ') || '—'}</span>
                      <span>· Data evento: {new Date(a.other_quote_event_date).toLocaleDateString('it-IT')}</span>
                      <Link to={`/quotes/${a.my_quote_id}`} className="underline underline-offset-2 hover:opacity-80" style={{ color: 'rgb(var(--gold-700))' }}>
                        Apri mio preventivo →
                      </Link>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(a)}
                    aria-label="Ignora"
                    className="shrink-0 rounded p-1 hover:bg-black/5"
                    style={{ color: 'rgb(var(--fg-muted))' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
