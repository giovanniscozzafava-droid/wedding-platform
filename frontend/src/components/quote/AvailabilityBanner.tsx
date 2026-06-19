import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type Conflict = {
  fornitore_id: string
  conflict_date: string
  status: 'BUSY' | 'TENTATIVE'
  notes: string | null
  supplier_business_name: string | null
  supplier_full_name: string | null
}

type Props = {
  /** event_date del preventivo o data evento da controllare. */
  date: string | null
  /** id dei fornitori da verificare. */
  supplierIds: string[]
  /** opzionale: range (per matrimoni che coprono più giorni). */
  dateTo?: string | null
  /** opzionale: id del quote corrente — esclude i BUSY che lui stesso ha generato. */
  excludeQuoteId?: string | null
}

/**
 * Banner che chiama check_suppliers_busy_in_range e mostra eventuali conflitti
 * fornitore-data. Si aggiorna ogni volta che cambia la lista fornitori o la
 * data del preventivo.
 */
type DaySlot = { fornitore_id: string; start_time: string | null; end_time: string | null; status: 'AVAILABLE' | 'BUSY' | 'TENTATIVE'; label: string | null }
const SLOT_LABEL: Record<string, string> = { AVAILABLE: 'Libero', TENTATIVE: 'Forse', BUSY: 'Occupato' }
const hhmm = (t: string | null, fb: string) => (t ? t.slice(0, 5) : fb)

export function AvailabilityBanner({ date, dateTo, supplierIds, excludeQuoteId }: Props) {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [slots, setSlots] = useState<DaySlot[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!date || supplierIds.length === 0) {
      setConflicts([]); setSlots([])
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const { data, error } = await (supabase as any).rpc('check_suppliers_busy_in_range', {
          p_supplier_ids: supplierIds,
          p_date_from: date,
          p_date_to: dateTo ?? date,
          p_exclude_quote_id: excludeQuoteId ?? null,
        })
        if (!cancelled) setConflicts(error ? [] : ((data ?? []) as Conflict[]))
        // FASCE dichiarate dai fornitori per la data (più finestre nello stesso giorno)
        const { data: sd } = await (supabase as any).rpc('supplier_day_slots', { p_ids: supplierIds, p_date: date })
        if (!cancelled) setSlots((sd ?? []) as DaySlot[])
        const { data: pf } = await (supabase.from('profiles') as any).select('id, business_name, full_name').in('id', supplierIds)
        if (!cancelled) { const nm: Record<string, string> = {}; for (const p of (pf ?? []) as any[]) nm[p.id] = p.business_name ?? p.full_name ?? 'Fornitore'; setNames(nm) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [date, dateTo, JSON.stringify(supplierIds), excludeQuoteId])

  // Blocco "fasce orarie dichiarate" (per-fornitore) — riusato in entrambi gli stati del banner.
  const slotsBlock = slots.length === 0 ? null : (
    <div className="mt-2 pt-2 border-t border-[rgb(var(--border))]">
      <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Fasce orarie dichiarate</p>
      <ul className="space-y-0.5">
        {Object.entries(slots.reduce((acc, s) => { (acc[s.fornitore_id] ??= []).push(s); return acc }, {} as Record<string, DaySlot[]>)).map(([fid, ss]) => (
          <li key={fid} className="text-xs text-[rgb(var(--fg-muted))]">
            <strong className="text-[rgb(var(--fg))]">{names[fid] ?? 'Fornitore'}</strong>: {ss.map((s) => `${SLOT_LABEL[s.status]} ${hhmm(s.start_time, '0:00')}–${hhmm(s.end_time, '24:00')}${s.label ? ` (${s.label})` : ''}`).join(' · ')}
          </li>
        ))}
      </ul>
    </div>
  )

  if (!date || supplierIds.length === 0) return null
  if (loading) return null

  const busy = conflicts.filter((c) => c.status === 'BUSY')
  const tentative = conflicts.filter((c) => c.status === 'TENTATIVE')

  if (busy.length === 0 && tentative.length === 0) {
    return (
      <Card className="p-3 mb-4"
        style={{ background: 'rgb(var(--bg-sunken))', borderColor: 'rgb(34 197 94 / 0.4)' }}>
        <div className="flex items-center gap-3">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            Tutti i fornitori del preventivo sono <strong>liberi</strong> nella data selezionata.
          </p>
        </div>
        {slotsBlock}
      </Card>
    )
  }

  return (
    <Card className="p-4 mb-4 border-l-4"
      style={{
        borderLeftColor: busy.length > 0 ? 'rgb(var(--rose-500))' : 'rgb(var(--amber-500))',
        background: 'rgb(var(--bg-sunken))',
      }}>
      <div className="flex items-start gap-3">
        <AlertTriangle size={18}
          className={busy.length > 0 ? 'text-[rgb(var(--rose-500))]' : 'text-[rgb(var(--amber-500))]'}
          />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">
            {busy.length > 0
              ? `${busy.length} ${busy.length === 1 ? 'fornitore OCCUPATO' : 'fornitori OCCUPATI'} in questa data`
              : `${tentative.length} ${tentative.length === 1 ? 'fornitore IN FORSE' : 'fornitori IN FORSE'}`}
          </p>
          <ul className="mt-2 space-y-1">
            {busy.map((c, i) => (
              <li key={`b-${i}`} className="text-sm flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgb(var(--rose-500) / 0.15)', color: 'rgb(var(--rose-500))' }}>
                  OCCUPATO
                </span>
                <strong>{c.supplier_business_name ?? c.supplier_full_name ?? 'Fornitore'}</strong>
                <span className="text-[rgb(var(--fg-subtle))]">
                  il {new Date(c.conflict_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                  {c.notes && ` · ${c.notes}`}
                </span>
              </li>
            ))}
            {tentative.map((c, i) => (
              <li key={`t-${i}`} className="text-sm flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ background: 'rgb(var(--amber-500) / 0.15)', color: 'rgb(var(--amber-600))' }}>
                  FORSE
                </span>
                <strong>{c.supplier_business_name ?? c.supplier_full_name ?? 'Fornitore'}</strong>
                <span className="text-[rgb(var(--fg-subtle))]">
                  il {new Date(c.conflict_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
                  {c.notes && ` · ${c.notes}`}
                </span>
              </li>
            ))}
          </ul>
          {busy.length > 0 && (
            <p className="text-xs text-[rgb(var(--fg-muted))] mt-3">
              Il sistema non permette di aggiungere voci con fornitori già occupati.
              Cambia la data del preventivo o sostituisci il fornitore.
            </p>
          )}
          {slotsBlock}
        </div>
      </div>
    </Card>
  )
}
