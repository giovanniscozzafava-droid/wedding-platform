import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { EntryForm } from '@/components/calendar/EntryForm'
import { useCalendarEntries, useEnsureExportToken, type EntryWithParticipants } from '@/hooks/useCalendar'
import { useSupplierEarnings } from '@/hooks/useSupplierEarnings'
import { PageHeader } from '@/components/layout/PageHeader'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

function monthRange(d: Date) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1)
  const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const fmt = (x: Date) => x.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}
function fmtDay(d: Date) { return d.toISOString().slice(0, 10) }
function monthGrid(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const offset = (first.getDay() + 6) % 7 // lun=0
  const cells: Array<{ date: Date; out: boolean }> = []
  for (let i = 0; i < offset; i++) {
    const x = new Date(first); x.setDate(first.getDate() - (offset - i))
    cells.push({ date: x, out: true })
  }
  for (let day = 1; day <= last.getDate(); day++) {
    cells.push({ date: new Date(d.getFullYear(), d.getMonth(), day), out: false })
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const lastCell = cells[cells.length - 1]!.date
    const x = new Date(lastCell); x.setDate(lastCell.getDate() + 1)
    cells.push({ date: x, out: true })
  }
  return cells
}

export default function CalendarPage() {
  const { profile } = useAuth()
  const [cursor, setCursor] = useState(() => new Date())
  const range = useMemo(() => monthRange(cursor), [cursor])
  const { data, isLoading, error } = useCalendarEntries(range)
  const ensureToken = useEnsureExportToken()
  const [editing, setEditing] = useState<EntryWithParticipants | null>(null)
  const [creating, setCreating] = useState<{ date?: string } | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const canCreate = profile?.role === 'WEDDING_PLANNER' || profile?.role === 'LOCATION' || profile?.role === 'ADMIN'
  const isSupplier = profile?.role === 'FORNITORE'
  const entryIds = useMemo(() => (data ?? []).map((e: any) => e.id), [data])
  const { data: earnings } = useSupplierEarnings(entryIds)
  const monthLabel = cursor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  const grid = useMemo(() => monthGrid(cursor), [cursor])
  const entriesByDay = useMemo(() => {
    const map = new Map<string, EntryWithParticipants[]>()
    for (const e of data ?? []) {
      const start = new Date(e.date_from)
      const end = new Date(e.date_to)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const k = fmtDay(d)
        const arr = map.get(k) ?? []
        arr.push(e)
        map.set(k, arr)
      }
    }
    return map
  }, [data])

  const selectedEntries = selectedDay ? entriesByDay.get(selectedDay) ?? [] : []

  async function genIcs() {
    try {
      const t = await ensureToken.mutateAsync()
      const url = `http://127.0.0.1:54321/functions/v1/calendar-export-ics?token=${t}`
      await navigator.clipboard.writeText(url).catch(() => {})
      toast.success('URL iCal copiato negli appunti', { description: url })
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader
          eyebrow="Calendario"
          title={<span className="capitalize">{monthLabel}</span>}
          description="Vista mese con eventi per data. Clicca un giorno per vedere i dettagli o creare un nuovo evento."
          actions={
            <>
              <div className="inline-flex rounded-lg border" style={{ borderColor: 'rgb(var(--border-strong))' }}>
                <Button variant="ghost" size="icon" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                  <ChevronLeft />
                </Button>
                <Button variant="ghost" onClick={() => setCursor(new Date())} className="px-3">Oggi</Button>
                <Button variant="ghost" size="icon" onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                  <ChevronRight />
                </Button>
              </div>
              <Button variant="outline" onClick={genIcs} data-testid="ics-btn">
                <Download /> iCal
              </Button>
              {canCreate && (
                <Button variant="gold" onClick={() => setCreating({})} data-testid="new-entry-btn">
                  <Plus /> Nuovo evento
                </Button>
              )}
            </>
          }
        />

        {isLoading && <p className="text-[rgb(var(--fg-subtle))]">Caricamento...</p>}
        {error && <p className="text-[rgb(var(--rose-500))]">{(error as Error).message}</p>}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="xl:col-span-2 overflow-hidden">
            <div className="grid grid-cols-7 border-b text-xs font-medium uppercase tracking-wider" style={{ borderColor: 'rgb(var(--border))' }}>
              {WEEKDAYS.map((w, i) => (
                <div key={i} className="text-center py-3" style={{ color: 'rgb(var(--fg-subtle))' }}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {grid.map((cell, i) => {
                const k = fmtDay(cell.date)
                const dayEvents = entriesByDay.get(k) ?? []
                const isToday = k === fmtDay(new Date())
                const isSelected = k === selectedDay
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(k)}
                    onDoubleClick={() => canCreate && setCreating({ date: k })}
                    className={`relative min-h-24 p-2 text-left border-t border-r last:border-r-0 transition-colors ${cell.out ? 'opacity-40' : ''} ${isSelected ? 'bg-[rgb(var(--bg-sunken))]' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}
                    style={{ borderColor: 'rgb(var(--border))' }}
                  >
                    <span className={`inline-flex items-center justify-center text-xs ${isToday ? 'h-6 w-6 rounded-full bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))]' : ''}`}>
                      {cell.date.getDate()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((e) => (
                        <div key={e.id} className="text-[10px] truncate rounded px-1 py-0.5"
                          style={{ background: `rgb(var(--status-${e.status.toLowerCase()}-bg))`, color: `rgb(var(--status-${e.status.toLowerCase()}-fg))` }}>
                          {e.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-[rgb(var(--fg-subtle))]">+{dayEvents.length - 3} altri</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <h2 className="font-display text-lg">
                {selectedDay
                  ? new Date(selectedDay).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Dettagli giorno'}
              </h2>
              {!selectedDay && <p className="text-xs text-[rgb(var(--fg-subtle))]">Seleziona un giorno nella griglia</p>}
            </div>
            <CardContent className="p-0">
              <AnimatePresence mode="popLayout">
                {selectedEntries.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="px-6 py-10 text-center">
                    <p className="text-sm text-[rgb(var(--fg-subtle))]" data-testid="empty-day">
                      {selectedDay ? 'Nessun evento questo giorno.' : '—'}
                    </p>
                    {selectedDay && canCreate && (
                      <Button className="mt-4" variant="outline" onClick={() => setCreating({ date: selectedDay })}>
                        <Plus size={14} /> Aggiungi evento
                      </Button>
                    )}
                  </motion.div>
                ) : (
                  <ul>
                    {selectedEntries.map((e) => (
                      <motion.li key={e.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                        className="px-5 py-4 border-b last:border-0 hover:bg-[rgb(var(--bg-sunken))] cursor-pointer transition-colors"
                        style={{ borderColor: 'rgb(var(--border))' }}
                        onClick={() => setEditing(e)}
                        data-testid={`entry-${e.id}`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-1">
                          <p className="font-medium truncate flex-1">{e.title}</p>
                          <Badge status={e.status} />
                        </div>
                        {e.client_name && (
                          <p className="text-xs text-[rgb(var(--fg-subtle))]">Cliente: {e.client_name}</p>
                        )}
                        {isSupplier ? (
                          (() => {
                            const ag = earnings?.get(e.id)
                            if (!ag) return null
                            const fmt = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
                            return (
                              <div className="mt-2 p-2 rounded-md text-xs space-y-0.5" style={{ background: 'rgb(var(--bg-sunken))' }}>
                                <div className="flex justify-between font-medium">
                                  <span className="text-[rgb(var(--fg-muted))]">Tuo guadagno</span>
                                  <span className="tabular-nums">{fmt(ag.total)}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-[rgb(var(--emerald-500))]">incassato {fmt(ag.paid)}</span>
                                  <span className="text-[rgb(var(--rose-500))]">da incassare {fmt(ag.pending)}</span>
                                </div>
                                <div className="text-[10px] text-[rgb(var(--fg-subtle))]">{ag.items} voci</div>
                              </div>
                            )
                          })()
                        ) : (
                          e.value_amount && (
                            <p className="text-sm font-medium mt-1 tabular-nums">€ {Number(e.value_amount).toLocaleString('it-IT')}</p>
                          )
                        )}
                        {e.calendar_entry_participants?.length > 0 && (
                          <p className="text-xs text-[rgb(var(--fg-muted))] mt-1">
                            {e.calendar_entry_participants
                              .map((p) => p.user?.business_name ?? p.user?.full_name)
                              .filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </motion.li>
                    ))}
                  </ul>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>

      {(creating || editing) && (
        <EntryForm entry={editing} defaultDate={creating?.date} onClose={() => { setEditing(null); setCreating(null) }} />
      )}
    </div>
  )
}
