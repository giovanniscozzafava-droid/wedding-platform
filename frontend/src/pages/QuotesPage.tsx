import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCreateQuote, useDeleteQuote, useQuotes } from '@/hooks/useQuotes'

const STATUS_COLOR: Record<string, string> = {
  BOZZA:    'bg-slate-100 text-slate-700',
  INVIATO:  'bg-amber-100 text-amber-900',
  ACCETTATO: 'bg-emerald-100 text-emerald-900',
  RIFIUTATO: 'bg-rose-100 text-rose-900',
  CONVERTITO_IN_CONTRATTO: 'bg-blue-100 text-blue-900',
}

export default function QuotesPage() {
  const { data, isLoading, error } = useQuotes()
  const create = useCreateQuote()
  const del = useDeleteQuote()
  const nav = useNavigate()
  const [openNew, setOpenNew] = useState(false)
  const [form, setForm] = useState({
    title: '',
    client_name: '',
    client_email: '',
    event_date: '',
    guest_count: '',
  })
  const [createErr, setCreateErr] = useState<string | null>(null)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setCreateErr(null)
    try {
      const q = await create.mutateAsync({
        title: form.title.trim(),
        client_name: form.client_name || null,
        client_email: form.client_email || null,
        event_date: form.event_date || null,
        guest_count: form.guest_count ? Number(form.guest_count) : null,
      })
      nav(`/quotes/${q.id}`)
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : 'Errore')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link to="/" className="text-sm text-slate-500 hover:underline">← Home</Link>
            <h1 className="text-2xl font-semibold">Preventivi</h1>
          </div>
          <Button onClick={() => setOpenNew(true)} data-testid="new-quote-btn">+ Nuovo preventivo</Button>
        </div>

        {isLoading && <p className="text-slate-500">Caricamento...</p>}
        {error && <p className="text-red-600">{(error as Error).message}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(data ?? []).map((q) => (
            <Card key={q.id} data-testid={`quote-${q.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex justify-between items-start">
                  <span>{q.title}</span>
                  <span className={`text-xs font-normal px-2 py-1 rounded ${STATUS_COLOR[q.status] ?? 'bg-slate-100'}`}>{q.status}</span>
                </CardTitle>
                <p className="text-xs text-slate-500">
                  v{q.revision} · {q.client_name ?? '—'} · {q.event_date ?? 'data non definita'}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">
                  Totale cliente: <strong>€ {Number(q.total_client).toLocaleString('it-IT')}</strong> · Margine € {Number(q.margin_amount).toLocaleString('it-IT')} ({Number(q.margin_percent).toFixed(1)}%)
                </p>
                <div className="flex gap-2">
                  <Link to={`/quotes/${q.id}`}>
                    <Button variant="outline" size="sm">Apri</Button>
                  </Link>
                  <Button variant="destructive" size="sm" onClick={() => {
                    if (confirm('Eliminare?')) del.mutate(q.id)
                  }}>Elimina</Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(data ?? []).length === 0 && !isLoading && (
            <p className="text-slate-500" data-testid="empty-quotes">Nessun preventivo. Creane uno.</p>
          )}
        </div>
      </div>

      {openNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Nuovo preventivo</h2>
            <form onSubmit={handleCreate} className="space-y-4" data-testid="quote-create-form">
              <div className="space-y-2">
                <Label htmlFor="title">Titolo</Label>
                <Input id="title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cname">Nome cliente</Label>
                <Input id="cname" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cemail">Email cliente</Label>
                <Input id="cemail" type="email" value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edate">Data evento</Label>
                  <Input id="edate" type="date" value={form.event_date} onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gc">Invitati</Label>
                  <Input id="gc" type="number" value={form.guest_count} onChange={(e) => setForm((f) => ({ ...f, guest_count: e.target.value }))} />
                </div>
              </div>
              {createErr && <p className="text-sm text-red-600" role="alert" data-testid="quote-create-error">{createErr}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>Annulla</Button>
                <Button type="submit">Crea</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
