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
}

/**
 * Banner che chiama check_suppliers_busy_in_range e mostra eventuali conflitti
 * fornitore-data. Si aggiorna ogni volta che cambia la lista fornitori o la
 * data del preventivo.
 */
export function AvailabilityBanner({ date, dateTo, supplierIds }: Props) {
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!date || supplierIds.length === 0) {
      setConflicts([])
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
        })
        if (!cancelled) {
          if (error) {
            setConflicts([])
          } else {
            setConflicts((data ?? []) as Conflict[])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [date, dateTo, JSON.stringify(supplierIds)])

  if (!date || supplierIds.length === 0) return null
  if (loading) return null

  const busy = conflicts.filter((c) => c.status === 'BUSY')
  const tentative = conflicts.filter((c) => c.status === 'TENTATIVE')

  if (busy.length === 0 && tentative.length === 0) {
    return (
      <Card className="p-3 mb-4 flex items-center gap-3"
        style={{ background: 'rgb(var(--bg-sunken))', borderColor: 'rgb(34 197 94 / 0.4)' }}>
        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
        <p className="text-sm text-[rgb(var(--fg-muted))]">
          Tutti i fornitori del preventivo sono <strong>liberi</strong> nella data selezionata.
        </p>
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
        </div>
      </div>
    </Card>
  )
}
