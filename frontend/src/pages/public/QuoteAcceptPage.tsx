import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { publicQuoteAccept } from '@/hooks/useQuotes'

export default function QuoteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    publicQuoteAccept(token).then((ok) => {
      if (ok) setState('ok')
      else { setState('err'); setMsg('Preventivo non trovato o gia` gestito') }
    }).catch((e) => { setState('err'); setMsg(e?.message ?? 'Errore') })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{state === 'ok' ? 'Grazie!' : state === 'err' ? 'Operazione non completata' : 'Conferma...'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state === 'ok' && (
            <p data-testid="accept-ok">Hai accettato il preventivo. Il wedding planner ricevera` una notifica.</p>
          )}
          {state === 'err' && <p className="text-red-600">{msg}</p>}
          <Link to={`/p/preview/${token}`} className="text-sm underline">Torna al preventivo</Link>
        </CardContent>
      </Card>
    </div>
  )
}
