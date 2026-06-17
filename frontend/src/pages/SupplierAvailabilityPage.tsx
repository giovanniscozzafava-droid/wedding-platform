import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X, Clock, Unlock, Calendar as CalendarIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Status = 'AVAILABLE' | 'BUSY' | 'TENTATIVE'

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function daysInMonth(d: Date): number { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }

const MONTHS_IT = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

export default function SupplierAvailabilityPage() {
  const { user } = useAuth()
  const [cursor, setCursor] = useState(new Date())
  const [busyMap, setBusyMap] = useState<Map<string, { status: Status; id: string; notes?: string | null }>>(new Map())
  const [busy, setBusy] = useState(false)
  const [capacity, setCapacity] = useState<number>(1)        // eventi gestibili nello stesso giorno (slot)
  const [capSaving, setCapSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await (supabase.from('profiles' as any) as any).select('daily_capacity').eq('id', user.id).maybeSingle()
      setCapacity(Math.max(1, Number((data as { daily_capacity?: number | null } | null)?.daily_capacity ?? 1)))
    })()
  }, [user])

  async function saveCapacity(v: number) {
    const val = Math.max(1, Math.min(50, v))
    setCapacity(val); setCapSaving(true)
    try {
      const { error } = await (supabase as any).rpc('set_daily_capacity', { p_value: val })
      if (error) throw error
      toast.success(val === 1 ? 'Un evento al giorno' : `Fino a ${val} eventi nello stesso giorno`)
    } catch (e) { toast.error((e as Error).message) } finally { setCapSaving(false) }
  }

  async function load() {
    if (!user) return
    const start = ymd(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
    const end = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0))
    const { data, error } = await (supabase.from('supplier_availability' as any) as any)
      .select('id, date, status, notes')
      .eq('fornitore_id', user.id)
      .gte('date', start)
      .lte('date', end)
    if (error) { toast.error(error.message); return }
    const m = new Map<string, { status: Status; id: string; notes?: string | null }>()
    for (const r of (data ?? []) as any[]) m.set(r.date, { status: r.status as Status, id: r.id, notes: r.notes })
    setBusyMap(m)
  }

  useEffect(() => { void load() }, [user, cursor])

  async function toggle(date: string) {
    if (!user) return
    setBusy(true)
    try {
      const cur = busyMap.get(date)
      const newStatus: Status | null = cur?.status === 'BUSY' ? 'TENTATIVE'
        : cur?.status === 'TENTATIVE' ? null  // delete
        : 'BUSY' // new
      if (newStatus === null && cur) {
        const { error } = await (supabase.from('supplier_availability' as any) as any).delete().eq('id', cur.id)
        if (error) throw error
      } else if (cur) {
        const { error } = await (supabase.from('supplier_availability' as any) as any).update({ status: newStatus }).eq('id', cur.id)
        if (error) throw error
      } else {
        const { error } = await (supabase.from('supplier_availability' as any) as any).insert({ fornitore_id: user.id, date, status: 'BUSY' })
        if (error) throw error
      }
      await load()
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  async function unblock(id: string) {
    setBusy(true)
    try {
      const { error } = await (supabase.from('supplier_availability' as any) as any).delete().eq('id', id)
      if (error) throw error
      toast.success('Data sbloccata')
      await load()
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  const autoBlocked = useMemo(() => {
    const today = ymd(new Date())
    const out: Array<{ id: string; date: string; status: Status; notes: string; kind: 'quote' | 'contract' | 'manual' }> = []
    for (const [date, slot] of busyMap.entries()) {
      if (date < today) continue
      const n = (slot.notes ?? '').toLowerCase()
      const kind: 'quote' | 'contract' | 'manual' =
        n.includes('contratto firmato') || n.startsWith('contratto') ? 'contract'
        : n.includes('preventivo') ? 'quote'
        : 'manual'
      out.push({ id: slot.id, date, status: slot.status, notes: slot.notes ?? '', kind })
    }
    return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 12)
  }, [busyMap])

  const days = useMemo(() => {
    const first = startOfMonth(cursor)
    const firstWeekday = (first.getDay() + 6) % 7  // L=0
    const total = daysInMonth(cursor)
    const grid: Array<{ d?: number; date?: string; key: string }> = []
    for (let i = 0; i < firstWeekday; i++) grid.push({ key: `pad-${i}` })
    for (let i = 1; i <= total; i++) {
      const date = ymd(new Date(cursor.getFullYear(), cursor.getMonth(), i))
      grid.push({ d: i, date, key: date })
    }
    return grid
  }, [cursor])

  const today = ymd(new Date())

  const monthSummary = useMemo(() => {
    const monthDates = Array.from(busyMap.keys()).filter((d) => d.startsWith(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`))
    const busyDays = monthDates.filter((d) => busyMap.get(d)?.status === 'BUSY').length
    const tentDays = monthDates.filter((d) => busyMap.get(d)?.status === 'TENTATIVE').length
    return { busyDays, tentDays }
  }, [busyMap, cursor])

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-4 sm:px-10 py-8">
        <PageHeader
          eyebrow="Disponibilità"
          title="Il tuo calendario"
          description="Marca i giorni occupati o tentativi. I wedding planner non potranno aggiungerti ai preventivi per quelle date."
        />

        {/* CAPIENZA GIORNALIERA (SLOT): quanti eventi puoi gestire nello stesso giorno */}
        <Card className="p-4 sm:p-5 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium flex items-center gap-1.5"><Clock size={15} className="text-[rgb(var(--gold-600))]" /> Quanti eventi al giorno puoi gestire?</p>
              <p className="text-xs text-[rgb(var(--fg-muted))] mt-0.5">Se lavori a <strong>slot</strong> (es. un fiorista o un acconciatore fa più matrimoni in un giorno), alza il numero. Una data risulta “piena” solo quando hai raggiunto questa capienza.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="icon" disabled={capSaving || capacity <= 1} onClick={() => void saveCapacity(capacity - 1)}>−</Button>
              <div className="w-16 text-center">
                <div className="text-2xl font-display tabular-nums leading-none">{capacity}</div>
                <div className="text-[10px] text-[rgb(var(--fg-subtle))]">{capacity === 1 ? 'evento/giorno' : 'eventi/giorno'}</div>
              </div>
              <Button variant="outline" size="icon" disabled={capSaving || capacity >= 50} onClick={() => void saveCapacity(capacity + 1)}>+</Button>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              <ChevronLeft size={16} />
            </Button>
            <h2 className="font-display text-xl">{MONTHS_IT[cursor.getMonth()]} {cursor.getFullYear()}</h2>
            <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              <ChevronRight size={16} />
            </Button>
          </div>

          <div className="flex gap-3 text-xs mb-3 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-emerald-400" /> Sì disponibile</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: 'rgb(var(--amber-500))' }} /> Forse</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: 'rgb(var(--rose-500))' }} /> No (occupato)</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: 'rgb(var(--bg-sunken))' }} /> Non marcato</span>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] text-center py-1">{w}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((cell) => {
              if (!cell.d) return <div key={cell.key} />
              const slot = busyMap.get(cell.date!)
              const isToday = cell.date === today
              const isPast = cell.date! < today
              const bg = slot?.status === 'BUSY' ? 'rgb(var(--rose-500))'
                : slot?.status === 'TENTATIVE' ? 'rgb(var(--amber-500))'
                : isPast ? 'rgb(var(--bg-sunken))'
                : 'rgb(157 188 152)'  // verde chiaro (disponibile default)
              const color = slot?.status ? 'rgb(var(--bg))' : isPast ? 'rgb(var(--fg-subtle))' : 'rgb(20 40 30)'
              return (
                <button
                  key={cell.key}
                  disabled={busy}
                  onClick={() => toggle(cell.date!)}
                  className={`aspect-square rounded-md text-sm font-medium transition-all hover:scale-[1.03] disabled:opacity-50 ${isToday ? 'ring-2 ring-[rgb(var(--gold-500))]' : ''}`}
                  style={{ background: bg, color }}
                  title={slot?.notes ?? ''}
                >
                  {cell.d}
                </button>
              )
            })}
          </div>
        </Card>

        <Card className="p-4 text-sm">
          <p className="font-medium mb-2">Mese corrente:</p>
          <div className="flex flex-wrap gap-4 text-xs text-[rgb(var(--fg-muted))]">
            <span className="flex items-center gap-1.5"><X size={12} className="text-[rgb(var(--rose-500))]" /> {monthSummary.busyDays} giorni occupati</span>
            <span className="flex items-center gap-1.5"><Clock size={12} className="text-[rgb(var(--amber-500))]" /> {monthSummary.tentDays} tentativi</span>
          </div>
          <p className="text-xs text-[rgb(var(--fg-subtle))] mt-3">
            Click su un giorno per ciclare: <strong>Disponibile</strong> → <strong>Occupato</strong> → <strong>Tentativo</strong> → Disponibile.
          </p>
        </Card>

        {autoBlocked.length > 0 && (
          <Card className="p-4 sm:p-6 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarIcon size={16} style={{ color: 'rgb(var(--gold-700))' }} />
              <h3 className="font-display text-lg">Prossime date bloccate</h3>
            </div>
            <p className="text-xs text-[rgb(var(--fg-muted))] mb-4">
              Date bloccate dal sistema (preventivi accettati, contratti firmati) o manualmente. Sblocca quando una trattativa salta o riprogrammi l'evento.
            </p>
            <div className="space-y-2">
              {autoBlocked.map((b) => (
                <div key={b.id} className="flex items-center gap-3 p-3 rounded-lg border" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-elev))' }}>
                  <span
                    className="shrink-0 inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium tabular-nums"
                    style={{
                      background: b.status === 'BUSY' ? 'rgb(var(--rose-500))' : 'rgb(var(--amber-500))',
                      color: 'white',
                      minWidth: 92,
                    }}
                  >
                    {new Date(b.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'rgb(var(--fg))' }}>
                      {b.kind === 'contract' ? 'Contratto firmato' : b.kind === 'quote' ? 'Preventivo' : 'Bloccato manualmente'}
                    </p>
                    {b.notes && <p className="text-xs truncate" style={{ color: 'rgb(var(--fg-muted))' }}>{b.notes}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      if (b.kind === 'contract') {
                        if (!confirm('Questo blocco proviene da un contratto FIRMATO. Sbloccare la data NON annulla il contratto. Continuare?')) return
                      } else if (b.kind === 'quote') {
                        if (!confirm('Questo blocco proviene da un preventivo. Sblocca solo se la trattativa è effettivamente saltata.')) return
                      }
                      void unblock(b.id)
                    }}
                  >
                    <Unlock size={14} /> Sblocca
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
