import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, X, Clock } from 'lucide-react'
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
      </div>
    </div>
  )
}
