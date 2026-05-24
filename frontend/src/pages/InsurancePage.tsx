import { useEffect, useState } from 'react'
import { ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react'
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
  product_name: string
  coverage_type: string | null
  base_price: number | null
  description: string | null
  contract_terms: string | null
  is_active: boolean
  exclusive_until: string | null
}

type Policy = {
  id: string
  offer_id: string | null
  entry_id: string
  policy_number: string | null
  premium: number | null
  status: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

const COVERAGE_LABEL: Record<string, string> = {
  ANNULLAMENTO: 'Annullamento evento',
  MALATTIA: 'Malattia sposi',
  MALTEMPO: 'Maltempo',
  RC_OSPITI: 'RC ospiti',
  ALL_INCLUSIVE: 'All inclusive',
}

export default function InsurancePage() {
  const { user } = useAuth()
  const [offers, setOffers] = useState<Offer[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: o } = await (supabase.from('insurance_offers' as any) as any)
      .select('*').eq('is_active', true).order('created_at', { ascending: false })
    const { data: p } = await (supabase.from('insurance_policies' as any) as any)
      .select('*').order('created_at', { ascending: false })
    setOffers((o ?? []) as Offer[])
    setPolicies((p ?? []) as Policy[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <header className="mb-6">
        <h1 className="font-display text-3xl flex items-center gap-2"><ShieldCheck size={22} /> Assicurazione matrimonio</h1>
        <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">
          Polizze dedicate al giorno-X — annullamento, maltempo, RC ospiti. Partner Planfully.
        </p>
      </header>

      <section className="mb-8">
        <h2 className="font-medium text-lg mb-3">Polizze disponibili</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading && <p className="text-sm text-[rgb(var(--fg-subtle))]">Caricamento...</p>}
          {!loading && offers.length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))]">Nessuna polizza attiva al momento.</p>}
          {offers.map((o) => (
            <Card key={o.id} className="p-5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg">{o.product_name}</h3>
                  <p className="text-xs text-[rgb(var(--fg-subtle))]">{o.partner_name}</p>
                </div>
                {o.exclusive_until && new Date(o.exclusive_until) > new Date() && (
                  <Badge tone="gold"><Sparkles size={10} /> Esclusiva</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {o.coverage_type && <Badge tone="sage">{COVERAGE_LABEL[o.coverage_type] ?? o.coverage_type}</Badge>}
                {o.base_price != null && (
                  <span className="text-sm">Da <strong>€ {Number(o.base_price).toLocaleString('it-IT')}</strong> a evento</span>
                )}
              </div>
              {o.description && <p className="text-sm text-[rgb(var(--fg-muted))]">{o.description}</p>}
              <PolicyForm offerId={o.id} userId={user?.id} onCreated={load} />
            </Card>
          ))}
        </div>
      </section>

      {policies.length > 0 && (
        <section>
          <h2 className="font-medium text-lg mb-3">Le tue polizze ({policies.length})</h2>
          <Card>
            <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
              {policies.map((p) => (
                <li key={p.id} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium">{p.policy_number ?? 'In attesa numero'} {p.premium ? `· € ${Number(p.premium).toLocaleString('it-IT')}` : ''}</p>
                    <p className="text-xs text-[rgb(var(--fg-subtle))]">
                      {p.start_date} → {p.end_date} · {new Date(p.created_at).toLocaleDateString('it-IT')}
                    </p>
                  </div>
                  <Badge tone={p.status === 'ATTIVA' || p.status === 'LIQUIDATA' ? 'emerald' : p.status === 'RIFIUTATA' || p.status === 'SCADUTA' ? 'rose' : 'amber'}>
                    {p.status === 'ATTIVA' && <CheckCircle2 size={10} />} {p.status}
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

function PolicyForm({ offerId, userId, onCreated }: { offerId: string; userId: string | undefined; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [entryId, setEntryId] = useState('')
  const [premium, setPremium] = useState('')
  const [busy, setBusy] = useState(false)
  const [weddings, setWeddings] = useState<Array<{ id: string; title: string; date_from: string }>>([])

  useEffect(() => {
    if (!open) return
    ;(async () => {
      const { data } = await (supabase.from('calendar_entries') as any)
        .select('id, title, date_from')
        .eq('owner_id', userId)
        .eq('kind', 'WEDDING')
        .order('date_from', { ascending: true })
      setWeddings((data ?? []) as any)
    })()
  }, [open, userId])

  async function submit() {
    if (!entryId) return toast.error('Seleziona un matrimonio')
    setBusy(true)
    try {
      const w = weddings.find((x) => x.id === entryId)
      const date = w?.date_from ?? null
      const { error } = await (supabase.from('insurance_policies' as any) as any).insert({
        offer_id: offerId, entry_id: entryId,
        premium: premium ? Number(premium) : null,
        status: 'PREVENTIVO',
        start_date: date ? date.slice(0, 10) : null,
        end_date: date ? date.slice(0, 10) : null,
      })
      if (error) throw error
      toast.success('Preventivo polizza creato')
      setOpen(false); setEntryId(''); setPremium('')
      onCreated()
    } catch (e) { toast.error((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="pt-2 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
      {!open ? (
        <Button variant="gold" size="sm" onClick={() => setOpen(true)}>Richiedi polizza</Button>
      ) : (
        <div className="space-y-2 mt-2">
          <div className="space-y-1">
            <Label>Matrimonio</Label>
            <select className="w-full rounded-md border px-3 py-1.5 text-sm bg-[rgb(var(--bg-elev))]"
              style={{ borderColor: 'rgb(var(--border))' }}
              value={entryId} onChange={(e) => setEntryId(e.target.value)}>
              <option value="">Seleziona...</option>
              {weddings.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title} · {new Date(w.date_from).toLocaleDateString('it-IT')}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Premio offerto €</Label>
            <Input type="number" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="240" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Annulla</Button>
            <Button variant="gold" size="sm" onClick={submit} disabled={busy}>{busy ? 'Invio...' : 'Crea preventivo'}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
