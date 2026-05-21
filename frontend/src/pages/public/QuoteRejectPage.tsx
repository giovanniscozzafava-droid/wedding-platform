import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/input'
import { publicQuoteReject } from '@/hooks/useQuotes'

export default function QuoteRejectPage() {
  const { token } = useParams<{ token: string }>()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setBusy(true); setErr(null)
    try {
      const ok = await publicQuoteReject(token, reason)
      if (ok) setDone(true)
      else setErr('Operazione non riuscita')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Errore') }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center aurora px-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="surface surface-lift w-full max-w-md p-8">
        {done ? (
          <div className="text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full mb-4"
              style={{ background: 'rgb(var(--emerald-100))', color: 'rgb(var(--emerald-500))' }}>
              <CheckCircle2 size={28} />
            </span>
            <h1 className="font-display text-2xl mb-2">Risposta inviata</h1>
            <p className="text-sm text-[rgb(var(--fg-muted))]" data-testid="reject-ok">
              Grazie per averci risposto.
            </p>
            <Link to={`/p/preview/${token}`} className="inline-block mt-4 text-sm text-[rgb(var(--fg-muted))] hover:underline">
              Torna al preventivo
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h1 className="font-display text-2xl">Rifiuto preventivo</h1>
              <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
                Una motivazione aiuta a calibrare proposte future. Opzionale.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">Motivazione</Label>
              <Textarea id="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {err && <p className="text-sm text-[rgb(var(--rose-500))]" role="alert">{err}</p>}
            <div className="flex justify-end gap-2">
              <Button asChild type="button" variant="outline">
                <Link to={`/p/preview/${token}`}>Annulla</Link>
              </Button>
              <Button type="submit" variant="destructive" disabled={busy}>
                {busy ? 'Invio...' : 'Conferma rifiuto'}
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  )
}
