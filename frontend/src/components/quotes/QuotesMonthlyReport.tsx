import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarRange } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

// CATALOGO preventivi INVIATI per mese/anno (ogni professionista), con accettati / non accettati.
type Row = { ym: string; year: number; month: number; sent: number; accepted: number; rejected: number; pending: number; accepted_value: number }
type Filter = 'all' | 'accepted' | 'not'
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const eur = (n: number) => (n ? n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }) : '—')

type Col = { h: string; r?: boolean; cls?: string; cell: (row: Row) => ReactNode }
function colsFor(f: Filter): Col[] {
  const mese: Col = { h: 'Mese', cell: (r) => MONTHS[r.month - 1] }
  const inviati: Col = { h: 'Inviati', r: true, cell: (r) => r.sent }
  const acc: Col = { h: 'Accettati', r: true, cls: 'text-emerald-700', cell: (r) => r.accepted }
  const nonacc: Col = { h: 'Non acc.', r: true, cls: 'text-rose-600', cell: (r) => r.rejected + r.pending }
  const rej: Col = { h: 'Rifiutati', r: true, cls: 'text-rose-600', cell: (r) => r.rejected }
  const pend: Col = { h: 'In attesa', r: true, cls: 'text-amber-600', cell: (r) => r.pending }
  const tasso: Col = { h: 'Tasso', r: true, cls: 'text-[rgb(var(--fg-muted))]', cell: (r) => (r.sent ? Math.round((r.accepted / r.sent) * 100) : 0) + '%' }
  const valore: Col = { h: 'Valore', r: true, cell: (r) => eur(Number(r.accepted_value || 0)) }
  if (f === 'accepted') return [mese, inviati, acc, tasso, valore]
  if (f === 'not') return [mese, inviati, rej, pend, nonacc]
  return [mese, inviati, acc, nonacc, tasso, valore]
}

export function QuotesMonthlyReport() {
  const { data, isLoading } = useQuery({
    queryKey: ['quotes-monthly-report'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('quotes_monthly_report')
      if (error) throw error
      return ((data?.rows ?? []) as Row[])
    },
  })
  const [filter, setFilter] = useState<Filter>('all')
  const rows = data ?? []

  const byYear = useMemo(() => {
    const m = new Map<number, Row[]>()
    for (const r of rows) { const a = m.get(r.year) ?? (m.set(r.year, []), m.get(r.year)!); a.push(r) }
    return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([y, rs]) => [y, rs.sort((a, b) => b.month - a.month)] as const)
  }, [rows])
  const tot = useMemo(() => rows.reduce((a, r) => ({ sent: a.sent + r.sent, accepted: a.accepted + r.accepted, not: a.not + r.rejected + r.pending, value: a.value + Number(r.accepted_value || 0) }), { sent: 0, accepted: 0, not: 0, value: 0 }), [rows])

  if (isLoading) return <Card className="p-4 mb-6"><div className="skeleton h-24" /></Card>
  if (rows.length === 0) return null
  const cols = colsFor(filter)

  return (
    <Card className="p-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-medium inline-flex items-center gap-2"><CalendarRange size={16} className="text-[rgb(var(--gold-600))]" /> Preventivi inviati per mese</h3>
        <div className="flex items-center gap-1">
          {(([['all', 'Tutti'], ['accepted', 'Accettati'], ['not', 'Non accettati']]) as [Filter, string][]).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`text-[11px] px-2.5 py-1 rounded-full border ${filter === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-transparent' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <Stat label="Inviati (totale)" value={String(tot.sent)} />
        <Stat label="Accettati" value={String(tot.accepted)} cls="text-emerald-700" />
        <Stat label="Non accettati" value={String(tot.not)} cls="text-rose-600" />
        <Stat label="Valore acquisito" value={eur(tot.value)} cls="text-[rgb(var(--gold-700))]" />
      </div>

      <div className="space-y-3">
        {byYear.map(([year, yrows]) => (
          <div key={year}>
            <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">{year}</p>
            <div className="overflow-x-auto rounded-lg border border-[rgb(var(--border))]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[rgb(var(--bg-sunken))] text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">
                    {cols.map((c) => <th key={c.h} className={`font-medium px-3 py-1.5 ${c.r ? 'text-right' : 'text-left'}`}>{c.h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {yrows.map((r) => (
                    <tr key={r.ym} className="border-t border-[rgb(var(--border))]">
                      {cols.map((c) => <td key={c.h} className={`px-3 py-1.5 ${c.r ? 'text-right tabular-nums' : ''} ${c.cls ?? ''}`}>{c.cell(r)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function Stat({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="rounded-lg bg-[rgb(var(--bg-sunken))] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className={`text-base font-semibold tabular-nums ${cls ?? 'text-[rgb(var(--fg))]'}`}>{value}</p>
    </div>
  )
}
