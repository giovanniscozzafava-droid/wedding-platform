import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'

type Stats = {
  totale: number
  confermati: number
  per_famiglia: { famiglia: string; n: number }[]
  per_mestiere: { mestiere: string; n: number }[]
  per_provincia: { provincia: string; regione: string; n: number }[]
  per_source: { source: string; n: number }[]
  per_disponibilita: { quando: string; n: number }[]
}

type Iscritto = {
  id: string
  nome: string
  email: string
  telefono: string
  mestiere: string
  famiglia: string | null
  provincia_nome: string
  regione: string
  disponibilita: string[]
  instagram: string | null
  portfolio: string | null
  source: string
  confermato: boolean
  email_confirmed_at: string | null
  created_at: string
}

function quando(iso: string): string {
  // Data leggibile senza librerie: "17/07 alle 14:57".
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} alle ${p(d.getHours())}:${p(d.getMinutes())}`
}

function Barre({ titolo, righe, totale }: { titolo: string; righe: { l: string; n: number }[]; totale: number }) {
  if (!righe.length) return null
  const max = Math.max(...righe.map((r) => r.n), 1)
  return (
    <Card className="p-5">
      <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'rgb(var(--fg-subtle))' }}>{titolo}</p>
      <div className="space-y-2">
        {righe.map((r) => (
          <div key={r.l}>
            <div className="flex justify-between text-sm mb-1">
              <span style={{ color: 'rgb(var(--fg))' }}>{r.l}</span>
              <span style={{ color: 'rgb(var(--fg-muted))' }}>
                {r.n}{totale > 0 && <span className="text-xs ml-1.5" style={{ color: 'rgb(var(--fg-subtle))' }}>
                  {Math.round((r.n / totale) * 100)}%</span>}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgb(var(--bg-sunken))' }}>
              <div className="h-full rounded-full"
                style={{ width: `${(r.n / max) * 100}%`, background: 'rgb(var(--gold-500))' }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default function WaitlistAdminPage() {
  const [s, setS] = useState<Stats | null>(null)
  const [iscritti, setIscritti] = useState<Iscritto[]>([])
  const [loading, setLoading] = useState(true)
  const [soloConfermati, setSoloConfermati] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const [stats, lista] = await Promise.all([
          supabase.rpc('maestranze_waitlist_stats'),
          supabase.rpc('maestranze_waitlist_list'),
        ])
        if (stats.error) throw stats.error
        if (lista.error) throw lista.error
        setS(stats.data as unknown as Stats)
        setIscritti((lista.data ?? []) as unknown as Iscritto[])
      } catch (e) { toast.error((e as Error).message) } finally { setLoading(false) }
    })()
  }, [])

  if (loading) return <div className="max-w-4xl mx-auto px-6 py-10"><div className="skeleton h-40 rounded-xl" /></div>
  if (!s) return null

  // Il tasso di conferma è il numero che dice se le email arrivano davvero.
  const tasso = s.totale > 0 ? Math.round((s.confermati / s.totale) * 100) : 0

  return (
    <div className="min-h-full">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Maestranze" title="Lista d'attesa"
          description="Il numero che conta è quello dei confermati: sono le email verificate, le uniche raggiungibili a settembre." />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <Card className="p-5">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--fg-subtle))' }}>Confermati</p>
            <p className="font-display text-4xl" style={{ color: 'rgb(var(--fg))' }}>{s.confermati}</p>
          </Card>
          <Card className="p-5">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--fg-subtle))' }}>Iscritti totali</p>
            <p className="font-display text-4xl" style={{ color: 'rgb(var(--fg-muted))' }}>{s.totale}</p>
          </Card>
          <Card className="p-5">
            <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgb(var(--fg-subtle))' }}>Tasso conferma</p>
            <p className="font-display text-4xl" style={{ color: 'rgb(var(--fg-muted))' }}>{tasso}%</p>
            {s.totale >= 10 && tasso < 60 && (
              <p className="text-[11px] mt-1.5" style={{ color: 'rgb(var(--fg-subtle))' }}>
                Sotto il 60%: guarda se le email finiscono nello spam.
              </p>
            )}
          </Card>
        </div>

        {s.totale === 0 ? (
          <Card className="p-10 text-center">
            <p className="text-sm" style={{ color: 'rgb(var(--fg-muted))' }}>Ancora nessun iscritto.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Barre titolo="Da dove arrivano" totale={s.totale}
              righe={s.per_source.map((r) => ({ l: r.source, n: r.n }))} />
            <Barre titolo="Quando lavorano" totale={s.totale}
              righe={s.per_disponibilita.map((r) => ({ l: r.quando.toLowerCase().replace('_', ' '), n: r.n }))} />
            <Barre titolo="Famiglia di mestiere" totale={s.totale}
              righe={s.per_famiglia.map((r) => ({ l: r.famiglia, n: r.n }))} />
            <Barre titolo="Provincia" totale={s.totale}
              righe={s.per_provincia.slice(0, 12).map((r) => ({ l: r.provincia, n: r.n }))} />
            <div className="sm:col-span-2">
              <Barre titolo="Mestiere dichiarato" totale={s.totale}
                righe={s.per_mestiere.slice(0, 20).map((r) => ({ l: r.mestiere, n: r.n }))} />
            </div>
          </div>
        )}

        {/* ------------------------------------------- ogni singolo iscritto */}
        {iscritti.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm uppercase tracking-[0.18em]" style={{ color: 'rgb(var(--fg-muted))' }}>
                Ogni iscritto {soloConfermati && `(solo confermati)`}
              </h2>
              <button onClick={() => setSoloConfermati((v) => !v)}
                className="text-xs underline underline-offset-2" style={{ color: 'rgb(var(--fg-muted))' }}>
                {soloConfermati ? 'Mostra tutti' : 'Solo confermati'}
              </button>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 720 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                    {['Stato', 'Persona', 'Mestiere', 'Zona', 'Disponibilità', 'Da dove', 'Quando'].map((h) => (
                      <th key={h} className="text-left font-medium px-3 py-2.5 text-[11px] uppercase tracking-wider whitespace-nowrap"
                        style={{ color: 'rgb(var(--fg-subtle))' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {iscritti.filter((i) => !soloConfermati || i.confermato).map((i) => (
                    <tr key={i.id} style={{ borderBottom: '1px solid rgb(var(--border))' }}>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <span className="size-2 rounded-full" style={{
                            background: i.confermato ? 'rgb(var(--gold-500))' : 'rgb(var(--border-strong))',
                          }} />
                          {i.confermato ? 'Confermato' : 'In attesa'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div style={{ color: 'rgb(var(--fg))' }}>{i.nome}</div>
                        <div className="text-xs" style={{ color: 'rgb(var(--fg-subtle))' }}>
                          <a href={`mailto:${i.email}`} className="hover:underline">{i.email}</a>
                          {' · '}
                          <a href={`tel:${i.telefono}`} className="hover:underline">{i.telefono}</a>
                        </div>
                        {(i.instagram || i.portfolio) && (
                          <div className="text-xs mt-0.5" style={{ color: 'rgb(var(--fg-subtle))' }}>
                            {i.instagram && <a href={`https://instagram.com/${i.instagram}`} target="_blank"
                              rel="noreferrer" className="hover:underline">@{i.instagram}</a>}
                            {i.instagram && i.portfolio && ' · '}
                            {i.portfolio && <a href={i.portfolio} target="_blank" rel="noreferrer"
                              className="hover:underline">sito</a>}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div style={{ color: 'rgb(var(--fg))' }}>{i.mestiere}</div>
                        {i.famiglia && <div className="text-xs" style={{ color: 'rgb(var(--fg-subtle))' }}>{i.famiglia}</div>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap" style={{ color: 'rgb(var(--fg-muted))' }}>
                        {i.provincia_nome}
                        <div className="text-xs" style={{ color: 'rgb(var(--fg-subtle))' }}>{i.regione}</div>
                      </td>
                      <td className="px-3 py-3 text-xs" style={{ color: 'rgb(var(--fg-muted))' }}>
                        {i.disponibilita.length
                          ? i.disponibilita.map((d) => d.toLowerCase().replace('_', ' ')).join(', ')
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: 'rgb(var(--fg-muted))' }}>{i.source}</td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap" style={{ color: 'rgb(var(--fg-subtle))' }}>{quando(i.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <p className="text-[11px] mt-2" style={{ color: 'rgb(var(--fg-subtle))' }}>
              Ricevi una notifica nel campanello a ogni conferma. Chi è "in attesa" si è iscritto ma non ha ancora
              cliccato il link nell'email.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
