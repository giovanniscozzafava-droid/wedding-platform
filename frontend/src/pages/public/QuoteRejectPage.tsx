import { type FormEvent, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    setBusy(true)
    setErr(null)
    try {
      const ok = await publicQuoteReject(token, reason)
      if (ok) setDone(true)
      else setErr('Operazione non riuscita')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Errore')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{done ? 'Risposta inviata' : 'Rifiuto preventivo'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {done ? (
            <>
              <p data-testid="reject-ok">Grazie per averci risposto.</p>
              <Link to={`/p/preview/${token}`} className="text-sm underline">Torna al preventivo</Link>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reason">Motivazione (opzionale)</Label>
                <textarea id="reason" rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
              <div className="flex justify-end gap-2">
                <Link to={`/p/preview/${token}`}>
                  <Button type="button" variant="outline">Annulla</Button>
                </Link>
                <Button type="submit" variant="destructive" disabled={busy}>{busy ? 'Invio...' : 'Conferma rifiuto'}</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
