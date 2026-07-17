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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('maestranze_waitlist_stats')
        if (error) throw error
        setS(data as unknown as Stats)
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
      </div>
    </div>
  )
}
