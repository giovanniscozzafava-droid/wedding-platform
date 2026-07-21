import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { MONDI_BY_SLUG } from '@/lib/mondi'

type Req = {
  id: string
  nome: string
  attivita: string
  ruolo: string
  ruolo_altro: string | null
  email: string
  telefono: string | null
  provincia_nome: string | null
  messaggio: string | null
  source: string
  mondo: string | null
  stato: string
  created_at: string
}

const RUOLO_LABEL: Record<string, string> = {
  LOCATION: 'Location', WEDDING_PLANNER: 'Wedding planner', FORNITORE: 'Fornitore', ALTRO: 'Altro',
}
const STATI = ['NUOVA', 'CONTATTATA', 'ACCETTATA', 'RIFIUTATA']

function quando(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} · ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function AccessRequestsAdminPage() {
  const [rows, setRows] = useState<Req[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<string>('TUTTE')

  async function load() {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('access_requests_list')
      if (error) throw error
      setRows((data ?? []) as unknown as Req[])
    } catch (e) { toast.error((e as Error).message) } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  async function setStato(id: string, stato: string) {
    try {
      const { error } = await supabase.rpc('access_request_set_stato', { p_id: id, p_stato: stato })
      if (error) throw error
      setRows((rs) => rs.map((r) => r.id === id ? { ...r, stato } : r))
    } catch (e) { toast.error((e as Error).message) }
  }

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-10"><div className="skeleton h-40 rounded-xl" /></div>

  const nuove = rows.filter((r) => r.stato === 'NUOVA').length
  const visibili = filtro === 'TUTTE' ? rows : rows.filter((r) => r.stato === filtro)

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Accesso" title="Richieste di accesso"
          description="Chi ha chiesto di entrare dalla landing. Ricevi una notifica nel campanello a ogni nuova richiesta." />

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {['TUTTE', ...STATI].map((s) => {
            const active = filtro === s
            const n = s === 'TUTTE' ? rows.length : rows.filter((r) => r.stato === s).length
            return (
              <button key={s} onClick={() => setFiltro(s)}
                className="px-3 py-1.5 rounded-lg text-xs border transition-colors"
                style={active
                  ? { background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))', borderColor: 'rgb(var(--gold-500))' }
                  : { borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
                {s === 'TUTTE' ? 'Tutte' : s.charAt(0) + s.slice(1).toLowerCase()} · {n}
              </button>
            )
          })}
          {nuove > 0 && <span className="text-xs ml-auto" style={{ color: 'rgb(var(--fg-subtle))' }}>{nuove} da guardare</span>}
        </div>

        {visibili.length === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm" style={{ color: 'rgb(var(--fg-muted))' }}>Nessuna richiesta.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {visibili.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium" style={{ color: 'rgb(var(--fg))' }}>{r.attivita}</p>
                      <span className="text-[11px] px-2 py-0.5 rounded-full border"
                        style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg-muted))' }}>
                        {RUOLO_LABEL[r.ruolo] ?? r.ruolo_altro ?? r.ruolo}
                      </span>
                      {r.mondo && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full"
                          style={{ background: 'rgb(var(--gold-500))', color: 'rgb(var(--bg))' }}
                          title={`Arrivato dalla pagina /${r.mondo}`}>
                          {MONDI_BY_SLUG[r.mondo]?.nome ?? `/${r.mondo}`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-0.5" style={{ color: 'rgb(var(--fg-muted))' }}>
                      {r.nome}
                      {r.provincia_nome && <> · {r.provincia_nome}</>}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'rgb(var(--fg-subtle))' }}>
                      <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                      {r.telefono && <> · <a href={`tel:${r.telefono}`} className="hover:underline">{r.telefono}</a></>}
                      {' · '}{quando(r.created_at)}
                    </p>
                    {r.messaggio && (
                      <p className="text-sm mt-2 pl-3 border-l-2" style={{ borderColor: 'rgb(var(--border))', color: 'rgb(var(--fg))' }}>{r.messaggio}</p>
                    )}
                  </div>
                  <select value={r.stato} onChange={(e) => void setStato(r.id, e.target.value)}
                    className="h-9 px-2 rounded-lg border text-xs bg-transparent shrink-0"
                    style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--fg))' }}>
                    {STATI.map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
