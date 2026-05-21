import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { publicQuoteByToken } from '@/hooks/useQuotes'

export default function QuotePreviewPage() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<Awaited<ReturnType<typeof publicQuoteByToken>> | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    publicQuoteByToken(token).then(setData).catch((e) => setErr(e?.message ?? 'Errore'))
  }, [token])

  if (err) return <div className="p-6 text-red-600">{err}</div>
  if (!data) return <div className="p-6 text-slate-500">Caricamento preventivo...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{data.title}</CardTitle>
            <p className="text-sm text-slate-500">
              Da {data.owner?.business_name ?? data.owner?.full_name ?? '—'} · stato {data.status}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.client_name && <p>Cliente: <strong>{data.client_name}</strong></p>}
            {data.event_date && <p>Data evento: <strong>{data.event_date}</strong></p>}
            <hr />
            <ul className="space-y-1 text-sm" data-testid="public-items">
              {data.items.map((it, i) => (
                <li key={i} className="flex justify-between">
                  <span>{it.name_snapshot} × {Number(it.quantity)}</span>
                  <span>€ {Number(it.line_client).toLocaleString('it-IT')}</span>
                </li>
              ))}
            </ul>
            <hr />
            <p className="text-right text-lg">
              <strong>Totale: € {Number(data.total_client).toLocaleString('it-IT')}</strong>
            </p>
            {data.pdf_url && (
              <p className="text-sm">
                <a href={data.pdf_url} target="_blank" rel="noreferrer" className="underline text-slate-900" data-testid="public-pdf-link">
                  Scarica PDF
                </a>
              </p>
            )}
            {data.status === 'INVIATO' && (
              <div className="flex gap-2 pt-2">
                <Link to={`/p/accept/${token}`}>
                  <Button data-testid="accept-btn">Accetto il preventivo</Button>
                </Link>
                <Link to={`/p/reject/${token}`}>
                  <Button variant="destructive" data-testid="reject-btn">Rifiuto</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
