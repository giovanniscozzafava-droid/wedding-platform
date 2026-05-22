import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Check, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { publicQuoteByToken } from '@/hooks/useQuotes'

export default function QuotePreviewPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Awaited<ReturnType<typeof publicQuoteByToken>> | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    publicQuoteByToken(token)
      .then(setData)
      .catch((e) => setErr(e?.message ?? 'Errore'))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'rgb(var(--bg))' }}>
        <p className="text-[rgb(var(--fg-subtle))]">Carico il preventivo…</p>
      </div>
    )
  }
  if (err || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'rgb(var(--bg))' }}>
        <div className="text-center max-w-md">
          <h1 className="font-display text-2xl">Preventivo non disponibile</h1>
          <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">{err ?? 'Il link potrebbe essere scaduto o errato.'}</p>
        </div>
      </div>
    )
  }

  const primary = data.owner?.brand_primary_color ?? '#1A2E4F'

  return (
    <div className="min-h-screen py-8 sm:py-14 px-4 relative" style={{ background: 'rgb(var(--bg))' }}>
      <div className="absolute top-0 left-0 right-0 h-72 overflow-hidden">
        <img src="/hero/preview.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(14,17,22,0.35) 0%, rgb(var(--bg)) 100%)' }} />
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="max-w-2xl mx-auto relative">
        <div className="surface surface-lift overflow-hidden">
          <div className="h-2" style={{ background: primary }} />
          <header className="px-6 sm:px-10 pt-8 pb-6 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md" style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                <Sparkles size={14} strokeWidth={2.2} />
              </span>
              <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">Preventivo riservato</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-tight" style={{ color: primary }}>
              {data.title}
            </h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-2">
              Da <strong>{data.owner?.business_name ?? data.owner?.full_name ?? '—'}</strong>
              {' · '}
              <Badge status={data.status} />
            </p>
          </header>

          <div className="px-6 sm:px-10 py-6 space-y-2 text-sm">
            {data.client_name && (
              <p className="text-[rgb(var(--fg-muted))]">Per: <strong className="text-[rgb(var(--fg))]">{data.client_name}</strong></p>
            )}
            {data.event_date && (
              <p className="text-[rgb(var(--fg-muted))]">Data evento: <strong className="text-[rgb(var(--fg))]">
                {new Date(data.event_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </strong></p>
            )}
          </div>

          <div className="px-6 sm:px-10">
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }} data-testid="public-items">
              {data.items.map((it, i) => (
                <li key={i} className="py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{it.name_snapshot}</p>
                    <p className="text-xs text-[rgb(var(--fg-subtle))]">Quantità: {Number(it.quantity)}</p>
                  </div>
                  <p className="font-display text-lg tabular-nums shrink-0">
                    € {Number(it.line_client).toLocaleString('it-IT')}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="px-6 sm:px-10 py-6 mt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-[0.18em] text-[rgb(var(--fg-muted))]">Totale</span>
              <span className="font-display text-3xl sm:text-4xl tabular-nums" style={{ color: primary }}>
                € {Number(data.total_client).toLocaleString('it-IT')}
              </span>
            </div>
          </div>

          {data.pdf_url && (
            <div className="px-6 sm:px-10 pb-4">
              <a href={data.pdf_url} target="_blank" rel="noreferrer" data-testid="public-pdf-link"
                className="inline-flex items-center gap-1 text-sm text-[rgb(var(--fg-muted))] hover:underline">
                Scarica versione PDF <ExternalLink size={12} />
              </a>
            </div>
          )}

          {data.status === 'INVIATO' && (
            <div className="px-6 sm:px-10 pb-8 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="gold" className="flex-1">
                <Link to={`/p/accept/${token}`} data-testid="accept-btn">
                  <Check /> Accetto il preventivo
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to={`/p/reject/${token}`} data-testid="reject-btn">
                  <X /> Rifiuto
                </Link>
              </Button>
            </div>
          )}

          <div className="h-2" style={{ background: data.owner?.brand_primary_color ? primary : 'rgb(var(--gold-500))' }} />
        </div>

        <p className="text-center text-xs text-[rgb(var(--fg-subtle))] mt-6">
          Powered by Planfully &middot; Documento riservato, condividere solo con persone autorizzate.
        </p>
      </motion.div>
    </div>
  )
}
