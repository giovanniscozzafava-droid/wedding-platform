import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { publicQuoteAccept } from '@/hooks/useQuotes'

export default function QuoteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<'idle' | 'ok' | 'err'>('idle')
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    publicQuoteAccept(token)
      .then((ok) => {
        if (ok) setState('ok')
        else { setState('err'); setMsg('Preventivo non trovato o già gestito.') }
      })
      .catch((e) => { setState('err'); setMsg(e?.message ?? 'Errore') })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center aurora px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="surface surface-lift w-full max-w-md p-10 text-center">
        {state === 'idle' && (
          <>
            <Loader2 className="mx-auto mb-4 animate-spin" style={{ color: 'rgb(var(--fg-muted))' }} />
            <h1 className="font-display text-2xl">Confermo...</h1>
          </>
        )}
        {state === 'ok' && (
          <>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-500))' }}>
              <CheckCircle2 size={28} />
            </span>
            <h1 className="font-display text-3xl tracking-tight">Grazie!</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))] mt-2 mb-6" data-testid="accept-ok">
              Hai accettato il preventivo. Il wedding planner riceverà una notifica e ti contatterà a breve.
            </p>
            <Link to={`/p/preview/${token}`} className="text-sm text-[rgb(var(--fg-muted))] hover:underline">
              Torna al preventivo
            </Link>
          </>
        )}
        {state === 'err' && (
          <>
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--rose-100))', color: 'rgb(var(--rose-500))' }}>
              <AlertCircle size={28} />
            </span>
            <h1 className="font-display text-2xl">Non è andata</h1>
            <p className="text-sm text-[rgb(var(--rose-500))] mt-2 mb-6">{msg}</p>
            <Link to={`/p/preview/${token}`} className="text-sm text-[rgb(var(--fg-muted))] hover:underline">
              Torna al preventivo
            </Link>
          </>
        )}
      </motion.div>
    </div>
  )
}
