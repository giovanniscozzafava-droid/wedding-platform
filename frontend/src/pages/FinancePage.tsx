import { useEffect, useState } from 'react'
import { Wallet, ExternalLink, CheckCircle2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Offer = {
  id: string
  partner_name: string
  partner_logo_url: string | null
  apr_percent: number | null
  max_amount: number | null
  max_months: number | null
  description: string | null
  contract_terms: string | null
  is_active: boolean
  exclusive_until: string | null
}

type Application = {
  id: string
  offer_id: string | null
  quote_id: string
  amount: number
  months: number
  status: string
  notes: string | null
  created_at: string
}

export default function FinancePage() {
  const { user } = useAuth()
  const [offers, setOffers] = useState<Offer[]>([])
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: o } = await (supabase.from('finance_offers' as any) as any)
      .select('*').eq('is_active', true).order('created_at', { ascending: false })
    const { data: a } = await (supabase.from('finance_applications' as any) as any)
      .select('*').order('created_at', { ascending: false })
    setOffers((o ?? []) as Offer[])
    setApps((a ?? []) as Application[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <header className="mb-6">
        <h1 className="font-display text-3xl flex items-center gap-2"><Wallet size={22} /> Finanziamento matrimonio</h1>
        <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
          Proposte di finanziamento esclusive per i tuoi clienti — partner Planfully.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="font-medium text-lg mb-3">Partner attivi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading && <p className="text-sm text-[rgb(var(--fg-subtle))]">Caricamento...</p>}
          {!loading && offers.length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))]">Nessun partner attivo al momento.</p>}
          {offers.map((o) => (
            <Card key={o.id} className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg">{o.partner_name}</h3>
                {o.exclusive_until && new Date(o.exclusive_until) > new Date() && (
                  <Badge tone="gold"><Sparkles size={10} /> Esclusiva</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <Stat label="TAEG" v={o.apr_percent ? `${o.apr_percent}%` : '—'} />
                <Stat label="Max importo" v={o.max_amount ? `€ ${Number(o.max_amount).toLocaleString('it-IT')}` : '—'} />
                <Stat label="Max rate" v={o.max_months ? `${o.max_months} mesi` : '—'} />
              </div>
              {o.description && <p className="text-sm text-[rgb(var(--fg-muted))]">{o.description}</p>}
              <RequestForm offerId={o.id} userId={user?.id} onCreated={load} />
            </Card>
          ))}
        </div>
      </section>

      {apps.length > 0 && (
        <section>
          <h2 className="font-medium text-lg mb-3">Le tue richieste ({apps.length})</h2>
          <Card>
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {apps.map((a) => (
                <li key={a.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">€ {Number(a.amount).toLocaleString('it-IT')} · {a.months} mesi</p>
                    <p className="text-xs text-[rgb(var(--fg-subtle))]">
                      Quote #{a.quote_id.slice(0, 8)} · {new Date(a.created_at).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <Badge tone={a.status === 'APPROVATA' || a.status === 'EROGATA' ? 'emerald' : a.status === 'RIFIUTATA' ? 'rose' : 'amber'}>
                    {a.status === 'APPROVATA' && <CheckCircle2 size={10} />} {a.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  )
}

function Stat({ label, v }: { label: string; v: string }) {
  return (
    <div className="rounded-lg p-2 text-center" style={{ background: 'rgb(var(--bg-sunken))' }}>
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className="font-medium text-sm">{v}</p>
    </div>
  )
}

function RequestForm({ offerId, userId, onCreated }: { offerId: string; userId: string | undefined; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [quoteId, setQuoteId] = useState('')
  const [amount, setAmount] = useState('')
  const [months, setMonths] = useState('36')
  const [busy, setBusy] = useState(false)
  const [quotes, setQuotes] = useState<Array<{ id: string; total_client: number; created_at: string; entry?: any }>>([])

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const { data } = await (supabase.from('quotes') as any)
        .select('id, total_client, created_at, calendar_entry:entry_id(title)')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      setQuotes((data ?? []) as any)
    })()
  }, [open, userId])

  async function submit() {
    if (!userId) return toast.error('Non autenticato')
    if (!quoteId || !amount) return toast.error('Preventivo e importo sono obbligatori')
    setBusy(true)
    try {
      const { error } = await (supabase.from('finance_applications' as any) as any).insert({
        offer_id: offerId, quote_id: quoteId, applicant_id: userId,
        amount: Number(amount), months: Number(months || 36), status: 'INVIATA',
      })
      if (error) throw error
      toast.success('Richiesta inviata')
      setOpen(false); setQuoteId(''); setAmount(''); setMonths('36')
      onCreated()
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
      {!open ? (
        <Button variant="gold" size="sm" onClick={() => setOpen(true)}>Richiedi finanziamento <ExternalLink size={12} /></Button>
      ) : (
        <div className="space-y-2 mt-2">
          <div className="space-y-1">
            <Label>Preventivo</Label>
            <select className="w-full rounded-md border px-3 py-1.5 text-sm bg-[rgb(var(--bg-elev))]"
              style={{ borderColor: 'rgb(var(--border))' }}
              value={quoteId} onChange={(e) => {
                setQuoteId(e.target.value)
                const q = quotes.find((x) => x.id === e.target.value)
                if (q && !amount) setAmount(String(q.total_client))
              }}>
              <option value="">Seleziona...</option>
              {quotes.map((q: any) => (
                <option key={q.id} value={q.id}>
                  {q.calendar_entry?.title ?? 'Preventivo'} · € {Number(q.total_client).toLocaleString('it-IT')}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Importo €</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Mesi</Label>
              <Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annulla</Button>
            <Button variant="gold" size="sm" onClick={submit} disabled={busy}>{busy ? 'Invio...' : 'Invia richiesta'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
