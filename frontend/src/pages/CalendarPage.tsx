import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, Download } from 'lucide-react'
import { toast } from 'sonner'
import { HelpDot } from '@/components/help/HelpDot'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { EntryForm } from '@/components/calendar/EntryForm'
import { useCalendarEntries, useEnsureExportToken, type EntryWithParticipants } from '@/hooks/useCalendar'
import { useSupplierEarnings } from '@/hooks/useSupplierEarnings'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

// Formattazione data in fuso LOCALE: toISOString() converte in UTC e in Italia
// (UTC+1/+2) sposta la mezzanotte al giorno prima → celle/eventi sfasati di un
// giorno. Usiamo i getter locali per allineare griglia, range e match eventi.
function localYmd(x: Date) {
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
function monthRange(d: Date) {
  const from = new Date(d.getFullYear(), d.getMonth(), 1)
  const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return { from: localYmd(from), to: localYmd(to) }
}
function fmtDay(d: Date) { return localYmd(d) }
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
  const { user } = useAuth()

  type AvailStatus = 'BUSY' | 'TENTATIVE' | 'OPTIONED' | 'UNAVAILABLE'
  type AvailSlot = { id: string; status: AvailStatus; notes?: string | null }
  const [availMap, setAvailMap] = useState<Map<string, AvailSlot>>(new Map())
  type Appt = { id: string; kind: string; title: string; date: string; end_date: string | null; start_time: string | null; end_time: string | null; notes: string | null; location: string | null; done: boolean }
  const [apptsByDay, setApptsByDay] = useState<Map<string, Appt[]>>(new Map())
  // FASCE di disponibilità (più blocchi orari nello stesso giorno).
  type DaySlot = { id: string; date: string; start_time: string | null; end_time: string | null; status: 'AVAILABLE' | 'BUSY' | 'TENTATIVE'; label: string | null }
  const [slotsByDay, setSlotsByDay] = useState<Map<string, DaySlot[]>>(new Map())

  const reloadAvail = useCallback(async () => {
    if (!isSupplier || !user) { setAvailMap(new Map()); setApptsByDay(new Map()); setSlotsByDay(new Map()); return }
    const start = `${range.from.slice(0, 7)}-01`
    const end = range.to
    const av = await (supabase.from('supplier_availability' as any) as any)
      .select('id, date, status, notes').eq('fornitore_id', user.id).gte('date', start).lte('date', end)
    const m = new Map<string, AvailSlot>()
    for (const r of (av.data ?? []) as any[]) m.set(r.date, { id: r.id, status: r.status as AvailStatus, notes: r.notes })
    setAvailMap(m)
    const ap = await (supabase.from('supplier_appointments' as any) as any)
      .select('id, kind, title, date, end_date, start_time, end_time, notes, location, done')
      .eq('owner_id', user.id).gte('date', start).lte('date', end).order('start_time', { ascending: true, nullsFirst: true })
    const am = new Map<string, Appt[]>()
    for (const r of (ap.data ?? []) as Appt[]) {
      const arr = am.get(r.date) ?? []; arr.push(r); am.set(r.date, arr)
    }
    setApptsByDay(am)
    const sl = await (supabase.from('supplier_availability_slots' as any) as any)
      .select('id, date, start_time, end_time, status, label')
      .eq('fornitore_id', user.id).gte('date', start).lte('date', end).order('start_time', { ascending: true, nullsFirst: true })
    const sm = new Map<string, DaySlot[]>()
    for (const r of (sl.data ?? []) as DaySlot[]) { const arr = sm.get(r.date) ?? []; arr.push(r); sm.set(r.date, arr) }
    setSlotsByDay(sm)
  }, [isSupplier, user, range.from, range.to])

  useEffect(() => { void reloadAvail() }, [reloadAvail])

  async function addAppointment(date: string, kind: string, title: string, start?: string, end?: string, endDate?: string) {
    if (!user) return
    const { error } = await (supabase.from('supplier_appointments' as any) as any).insert({
      owner_id: user.id, date, kind, title, start_time: start || null, end_time: end || null, end_date: endDate || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Aggiunto al calendario')
    await reloadAvail()
  }
  async function deleteAppointment(id: string) {
    await (supabase.from('supplier_appointments' as any) as any).delete().eq('id', id)
    await reloadAvail()
  }
  async function addSlot(date: string, status: 'AVAILABLE' | 'BUSY' | 'TENTATIVE', start?: string, end?: string, label?: string) {
    if (!user) return
    const { error } = await (supabase.from('supplier_availability_slots' as any) as any).insert({
      fornitore_id: user.id, date, status, start_time: start || null, end_time: end || null, label: label || null,
    })
    if (error) { toast.error(error.message); return }
    toast.success('Fascia aggiunta')
    await reloadAvail()
  }
  async function deleteSlot(id: string) {
    await (supabase.from('supplier_availability_slots' as any) as any).delete().eq('id', id)
    await reloadAvail()
  }
  // Blocca/sblocca la data con un click: verde = libero (nessuno slot),
  // giallo = forse/opzionato (TENTATIVE), rosso = occupato (BUSY).
  async function setAvailability(date: string, status: AvailStatus | null) {
    if (!user) return
    const existing = availMap.get(date)
    if (status === null) {
      if (existing) await (supabase.from('supplier_availability' as any) as any).delete().eq('id', existing.id)
    } else if (existing) {
      await (supabase.from('supplier_availability' as any) as any).update({ status }).eq('id', existing.id)
    } else {
      const { error } = await (supabase.from('supplier_availability' as any) as any)
        .insert({ fornitore_id: user.id, date, status })
      if (error) { toast.error(error.message); return }
    }
    await reloadAvail()
  }

  // Mobile: porta in vista il pannello del giorno quando se ne seleziona uno
  // (su telefono è sotto la griglia e sembrava che il tap non facesse nulla).
  const dayPanelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (selectedDay && dayPanelRef.current && window.innerWidth < 1024) {
      dayPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [selectedDay])
  const entryIds = useMemo(() => (data ?? []).map((e: any) => e.id), [data])
  const { data: earnings } = useSupplierEarnings(entryIds)
  const monthLabel = cursor.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })

  const grid = useMemo(() => monthGrid(cursor), [cursor])
  const entriesByDay = useMemo(() => {
    const map = new Map<string, EntryWithParticipants[]>()
    for (const e of data ?? []) {
      // Parse date-only come mezzanotte LOCALE (non UTC) per coerenza con la griglia.
      const start = new Date(`${e.date_from}T00:00:00`)
      const end = new Date(`${e.date_to ?? e.date_from}T00:00:00`)
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
            {isSupplier && (
              <div className="flex flex-wrap gap-3 text-[11px] px-4 py-3 border-b" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
                <span className="text-[rgb(var(--fg-muted))] font-medium">Disponibilità:</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-400" /> Disponibile</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: 'rgb(var(--amber-500))' }} /> Forse/opzionato</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: 'rgb(var(--rose-500))' }} /> Pieno/bloccato</span>
                <span className="text-[rgb(var(--fg-subtle))] ml-auto">Clicca un giorno per gestire appuntamenti e blocchi</span>
              </div>
            )}
            <div className="grid grid-cols-7">
              {grid.map((cell, i) => {
                const k = fmtDay(cell.date)
                const dayEvents = entriesByDay.get(k) ?? []
                const isToday = k === fmtDay(new Date())
                const isSelected = k === selectedDay
                const isPast = k < fmtDay(new Date())
                const slot = isSupplier ? availMap.get(k) : undefined
                const dayAppts = isSupplier ? (apptsByDay.get(k) ?? []) : []
                const availBg = isSupplier
                  ? slot?.status === 'BUSY' || slot?.status === 'UNAVAILABLE' ? 'rgb(var(--rose-500) / 0.18)'
                    : slot?.status === 'TENTATIVE' || slot?.status === 'OPTIONED' ? 'rgb(var(--amber-500) / 0.20)'
                    : isPast ? undefined
                    : 'rgb(157 188 152 / 0.14)'
                  : undefined
                const cellBgClass = isSelected ? 'bg-[rgb(var(--bg-sunken))]' : 'hover:bg-[rgb(var(--bg-sunken))]'
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedDay(k)}
                    onDoubleClick={() => canCreate && setCreating({ date: k })}
                    className={`relative min-h-24 p-2 text-left border-t border-r last:border-r-0 transition-colors ${cell.out ? 'opacity-40' : ''} ${cellBgClass}`}
                    style={{ borderColor: 'rgb(var(--border))', background: isSelected ? undefined : availBg }}
                    title={isSupplier ? (slot?.notes ?? 'Disponibile') : undefined}
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
                      {dayAppts.slice(0, 2).map((a) => (
                        <div key={a.id} className="text-[10px] truncate rounded px-1 py-0.5"
                          style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-muted))' }}>
                          {a.start_time ? a.start_time.slice(0, 5) + ' ' : ''}{a.title}
                        </div>
                      ))}
                      {(dayEvents.length + dayAppts.length) > 3 && (
                        <p className="text-[10px] text-[rgb(var(--fg-subtle))]">+{dayEvents.length + dayAppts.length - 3} altri</p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </Card>

          <Card className="overflow-hidden" ref={dayPanelRef}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <h2 className="font-display text-lg">
                {selectedDay
                  ? new Date(selectedDay).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
                  : 'Dettagli giorno'}
              </h2>
              {!selectedDay && <p className="text-xs text-[rgb(var(--fg-subtle))]">Seleziona un giorno nella griglia</p>}
              {/* Blocco disponibilità con un click: libero / forse / occupato */}
              {isSupplier && selectedDay && (() => {
                const st = availMap.get(selectedDay)?.status
                const isFree = !st
                const isMaybe = st === 'TENTATIVE' || st === 'OPTIONED'
                const isBusy = st === 'BUSY' || st === 'UNAVAILABLE'
                const base = 'flex-1 min-h-[40px] rounded-lg text-sm font-medium border transition-colors'
                return (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => void setAvailability(selectedDay, null)} className={base}
                      style={{ background: isFree ? 'rgb(var(--emerald-500))' : 'transparent', color: isFree ? 'white' : 'rgb(var(--emerald-600,5_150_105))', borderColor: 'rgb(var(--emerald-500))' }}>
                      ● Libero
                    </button>
                    <button onClick={() => void setAvailability(selectedDay, 'TENTATIVE')} className={base}
                      style={{ background: isMaybe ? 'rgb(var(--amber-500))' : 'transparent', color: isMaybe ? 'white' : 'rgb(var(--amber-600,217_119_6))', borderColor: 'rgb(var(--amber-500))' }}>
                      ● Forse
                    </button>
                    <button onClick={() => void setAvailability(selectedDay, 'BUSY')} className={base}
                      style={{ background: isBusy ? 'rgb(var(--rose-500))' : 'transparent', color: isBusy ? 'white' : 'rgb(var(--rose-500))', borderColor: 'rgb(var(--rose-500))' }}>
                      ● Occupato
                    </button>
                    <span className="self-center"><HelpDot id="calendar.disponibilita" /></span>
                  </div>
                )
              })()}
            </div>
            <CardContent className="p-0">
              {isSupplier && selectedDay && (
                <SupplierDaySlots
                  date={selectedDay}
                  slots={slotsByDay.get(selectedDay) ?? []}
                  onAdd={addSlot}
                  onDelete={deleteSlot}
                />
              )}
              {isSupplier && selectedDay && (
                <SupplierDayAgenda
                  date={selectedDay}
                  appts={apptsByDay.get(selectedDay) ?? []}
                  onAdd={addAppointment}
                  onDelete={deleteAppointment}
                />
              )}
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

const KIND_LABEL: Record<string, string> = {
  EVENTO: 'Evento', APPUNTAMENTO: 'Appuntamento', PERSONALE: 'Personale', BLOCCO: 'Blocco', VACANZA: 'Vacanza', TODO: 'Da fare',
}

const SLOT_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  AVAILABLE:  { label: 'Libero',  bg: 'rgb(var(--emerald-500))', fg: 'rgb(var(--emerald-600,5_150_105))' },
  TENTATIVE:  { label: 'Forse',   bg: 'rgb(var(--amber-500))',   fg: 'rgb(var(--amber-600,217_119_6))' },
  BUSY:       { label: 'Occupato', bg: 'rgb(var(--rose-500))',   fg: 'rgb(var(--rose-500))' },
}

// FASCE di disponibilità: più finestre orarie nello STESSO giorno (es. libero 9–13, occupato 14–18).
function SupplierDaySlots({ date, slots, onAdd, onDelete }: {
  date: string
  slots: { id: string; start_time: string | null; end_time: string | null; status: 'AVAILABLE' | 'BUSY' | 'TENTATIVE'; label: string | null }[]
  onAdd: (date: string, status: 'AVAILABLE' | 'BUSY' | 'TENTATIVE', start?: string, end?: string, label?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'AVAILABLE' | 'BUSY' | 'TENTATIVE'>('AVAILABLE')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [label, setLabel] = useState('')
  async function submit() {
    if (start && end && end <= start) { toast.error('L’orario di fine deve essere dopo l’inizio'); return }
    await onAdd(date, status, start, end, label.trim())
    setStart(''); setEnd(''); setLabel(''); setStatus('AVAILABLE'); setOpen(false)
  }
  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))]">Disponibilità a fasce</p>
        <button onClick={() => setOpen((v) => !v)} className="text-xs inline-flex items-center gap-1 text-[rgb(var(--gold-600))]"><Plus size={13} /> Aggiungi fascia</button>
      </div>
      {slots.length === 0 ? (
        <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessuna fascia. Puoi indicare più finestre nello stesso giorno (es. libero 9–13, occupato 14–18).</p>
      ) : (
        <ul className="space-y-1.5">
          {slots.map((s) => { const st = SLOT_STATUS[s.status]; return (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: st?.bg }} />
              <span className="text-xs tabular-nums text-[rgb(var(--fg-muted))] w-24 shrink-0">
                {s.start_time ? s.start_time.slice(0, 5) : 'inizio'}–{s.end_time ? s.end_time.slice(0, 5) : 'fine'}
              </span>
              <span className="font-medium" style={{ color: st?.fg }}>{st?.label}</span>
              {s.label && <span className="text-[rgb(var(--fg-muted))] truncate">· {s.label}</span>}
              <button onClick={() => void onDelete(s.id)} className="ml-auto text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))] text-xs">✕</button>
            </li>
          ) })}
        </ul>
      )}
      {open && (
        <div className="mt-3 space-y-2 p-3 rounded-lg" style={{ background: 'rgb(var(--bg-sunken))' }}>
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value as 'AVAILABLE' | 'BUSY' | 'TENTATIVE')} className="text-sm px-2 py-1.5 rounded border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }}>
              {(['AVAILABLE', 'TENTATIVE', 'BUSY'] as const).map((k) => <option key={k} value={k}>{SLOT_STATUS[k]!.label}</option>)}
            </select>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="text-sm px-2 py-1.5 rounded border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} />
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="text-sm px-2 py-1.5 rounded border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} />
          </div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nota (facoltativa) — es. Cerimonia mattina"
            className="w-full text-sm px-2 py-1.5 rounded border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} />
          <Button variant="gold" className="w-full" onClick={() => void submit()}>Salva fascia</Button>
          <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Le fasce sono informative per chi ti propone un preventivo: lo stato GROSSO del giorno (sopra) resta il vincolo per il blocco automatico.</p>
        </div>
      )}
    </div>
  )
}

function SupplierDayAgenda({ date, appts, onAdd, onDelete }: {
  date: string
  appts: { id: string; kind: string; title: string; start_time: string | null; end_time: string | null; notes: string | null }[]
  onAdd: (date: string, kind: string, title: string, start?: string, end?: string, endDate?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('APPUNTAMENTO')
  const [title, setTitle] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  async function submit() {
    if (!title.trim()) { toast.error('Inserisci un titolo'); return }
    await onAdd(date, kind, title.trim(), start, end)
    setTitle(''); setStart(''); setEnd(''); setOpen(false)
  }

  return (
    <div className="px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))]">La mia agenda</p>
        <button onClick={() => setOpen((v) => !v)} className="text-xs inline-flex items-center gap-1 text-[rgb(var(--gold-600))]">
          <Plus size={13} /> Aggiungi
        </button>
      </div>

      {appts.length === 0 ? (
        <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessun appuntamento. Puoi gestire più appuntamenti nello stesso giorno.</p>
      ) : (
        <ul className="space-y-1.5">
          {appts.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              <span className="text-xs tabular-nums text-[rgb(var(--fg-muted))] w-20 shrink-0 pt-0.5">
                {a.start_time ? a.start_time.slice(0, 5) : '—'}{a.end_time ? `–${a.end_time.slice(0, 5)}` : ''}
              </span>
              <div className="min-w-0 flex-1">
                <span className="font-medium">{a.title}</span>
                <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full" style={{ background: 'rgb(var(--bg-sunken))', color: 'rgb(var(--fg-subtle))' }}>{KIND_LABEL[a.kind] ?? a.kind}</span>
              </div>
              <button onClick={() => void onDelete(a.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))] text-xs">✕</button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 space-y-2 p-3 rounded-lg" style={{ background: 'rgb(var(--bg-sunken))' }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Incontro sposi / Commercialista / Richiamare Tizio"
            className="w-full text-sm px-2 py-1.5 rounded border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} />
          <div className="flex gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="text-sm px-2 py-1.5 rounded border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }}>
              {['APPUNTAMENTO', 'PERSONALE', 'BLOCCO', 'VACANZA', 'TODO'].map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="text-sm px-2 py-1.5 rounded border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} />
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="text-sm px-2 py-1.5 rounded border bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} />
          </div>
          <Button variant="gold" className="w-full" onClick={() => void submit()}>Salva</Button>
          <p className="text-[10px] text-[rgb(var(--fg-subtle))]">“Blocco” e “Vacanza” rendono il giorno non disponibile. Gli altri sono solo promemoria.</p>
        </div>
      )}
    </div>
  )
}
