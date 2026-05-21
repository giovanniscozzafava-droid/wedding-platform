import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { EntryForm } from '@/components/calendar/EntryForm'
import { useCalendarEntries, useEnsureExportToken, type EntryWithParticipants } from '@/hooks/useCalendar'

const STATUS_COLOR: Record<string, string> = {
  IN_TRATTATIVA: 'bg-amber-100 text-amber-900 border-amber-200',
  OPZIONATA:     'bg-sky-100 text-sky-900 border-sky-200',
  CONFERMATA:    'bg-emerald-100 text-emerald-900 border-emerald-200',
  RIFIUTATA:     'bg-rose-100 text-rose-900 border-rose-200',
  CANCELLATA:    'bg-slate-100 text-slate-700 border-slate-200',
}

function monthRange(d: Date) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1)
  const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const fmt = (x: Date) => x.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

export default function CalendarPage() {
  const { profile } = useAuth()
  const [cursor, setCursor] = useState(() => new Date())
  const range = useMemo(() => monthRange(cursor), [cursor])
  const { data, isLoading, error } = useCalendarEntries(range)
  const ensureToken = useEnsureExportToken()
  const [editing, setEditing] = useState<EntryWithParticipants | null>(null)
  const [creating, setCreating] = useState<{ date?: string } | null>(null)
  const [icsUrl, setIcsUrl] = useState<string | null>(null)

  const canCreate = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION' || profile?.role === 'ADMIN'

  const monthLabel = cursor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  async function genIcs() {
    const t = await ensureToken.mutateAsync()
    setIcsUrl(`http://127.0.0.1:54321/functions/v1/calendar-export-ics?token=${t}`)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link to="/" className="text-sm text-slate-500 hover:underline">← Home</Link>
            <h1 className="text-2xl font-semibold capitalize">Calendario &mdash; {monthLabel}</h1>
          </div>
          <div className="flex gap-2 items-center">
            <Button variant="outline" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>← Mese precedente</Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>Oggi</Button>
            <Button variant="outline" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>Mese successivo →</Button>
            {canCreate && (
              <Button onClick={() => setCreating({})} data-testid="new-entry-btn">+ Nuovo evento</Button>
            )}
            <Button variant="ghost" onClick={genIcs} data-testid="ics-btn">Esporta iCal</Button>
          </div>
        </div>

        {icsUrl && (
          <Card>
            <CardContent className="py-3">
              <p className="text-sm">
                URL feed iCal: <a className="text-slate-900 underline break-all" href={icsUrl} target="_blank" rel="noreferrer" data-testid="ics-url">{icsUrl}</a>
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading && <p className="text-slate-500">Caricamento...</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}

        <div className="space-y-3">
          {(data ?? []).length === 0 && !isLoading && (
            <p className="text-slate-500" data-testid="empty-calendar">Nessun evento questo mese.</p>
          )}
          {(data ?? []).map((e) => (
            <Card key={e.id} data-testid={`entry-${e.id}`} className={`border ${STATUS_COLOR[e.status] ?? ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between items-start">
                  <span>{e.title}</span>
                  <span className="text-xs font-normal px-2 py-1 rounded bg-white">{e.status}</span>
                </CardTitle>
                <p className="text-xs text-slate-600">
                  {e.date_from === e.date_to ? e.date_from : `${e.date_from} → ${e.date_to}`}
                  {e.client_name && ` · cliente ${e.client_name}`}
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {e.value_amount && <p>Valore: € {Number(e.value_amount).toLocaleString('it-IT')}</p>}
                {e.calendar_entry_participants?.length > 0 && (
                  <p>
                    Fornitori:{' '}
                    {e.calendar_entry_participants
                      .map((p) => p.user?.business_name ?? p.user?.full_name)
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(e)} data-testid={`edit-entry-${e.id}`}>Modifica</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {(creating || editing) && (
        <EntryForm entry={editing} defaultDate={creating?.date} onClose={() => { setEditing(null); setCreating(null) }} />
      )}
    </div>
  )
}
