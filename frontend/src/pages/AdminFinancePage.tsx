import { useEffect, useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, Percent, CreditCard, Target, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'

const rpc = (fn: string, a?: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }> }).rpc(fn, a)

const fmtE = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0)

// Pacchetti abbonamento fornitori (da gennaio 2027). Capostipiti e clienti non pagano.
const PLANS = [{ k: 'base', label: 'Base', price: 29 }, { k: 'plus', label: 'Plus', price: 59 }, { k: 'premium', label: 'Premium', price: 79 }]

type Overview = {
  cassetto: number; entrate_una_tantum: number; costi_una_tantum: number
  entrate_ricorrenti_mese: number; costi_ricorrenti_mese: number; netto_ricorrente_mese: number
  commissioni_totali: number; commissioni_incassate: number; commissioni_da_incassare: number
  users_by_role: Record<string, number>; subs_by_status: Record<string, number>; fornitori_totali: number
}
type Entry = { id: string; direction: string; category: string | null; label: string; amount: number; recurrence: string; entry_date: string; notes: string | null }
type Month = { mese: string; entrate: number; costi: number }

export default function AdminFinancePage() {
  const [ov, setOv] = useState<Overview | null>(null)
  const [costs, setCosts] = useState<Entry[]>([])
  const [incomes, setIncomes] = useState<Entry[]>([])
  const [months, setMonths] = useState<Month[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  // proiezione: % di fornitori che sottoscrivono e a quale piano
  const [adoption, setAdoption] = useState(20)
  const [planPrice, setPlanPrice] = useState(29)

  async function load() {
    try {
      const [o, c, i, m] = await Promise.all([
        rpc('admin_finance_overview'), rpc('admin_finance_entries', { p_direction: 'OUT' }),
        rpc('admin_finance_entries', { p_direction: 'IN' }), rpc('admin_finance_monthly', { p_months: 12 }),
      ])
      const ovr = o.data as Overview & { error?: string }
      if (ovr?.error) { setErr('Accesso riservato allo staff.'); return }
      setOv(ovr); setCosts((c.data as Entry[]) ?? []); setIncomes((i.data as Entry[]) ?? [])
      setMonths(((m.data as { months?: Month[] })?.months) ?? [])
    } catch (e) { setErr((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  if (loading) return <div className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">Carico…</div>
  if (err) return <div className="max-w-3xl mx-auto px-6 py-10"><Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">{err}</Card></div>
  if (!ov) return null

  const fornitori = ov.fornitori_totali
  const mrrProiettato = Math.round((fornitori * (adoption / 100)) * planPrice)
  const burn = ov.costi_ricorrenti_mese
  const nettoMese = mrrProiettato + ov.entrate_ricorrenti_mese - burn
  const breakEvenSubs = planPrice > 0 ? Math.ceil(burn / planPrice) : 0
  const breakEvenAdoption = fornitori > 0 ? Math.min(100, Math.round((breakEvenSubs / fornitori) * 100)) : 0
  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.entrate, m.costi)))

  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Admin · Finance" title="Conti di Planfully"
          description="Ricavi (abbonamenti + commissioni), costi della piattaforma, cassetto e strategia per scalare." />

        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi icon={<Wallet size={16} />} label="Cassetto (saldo)" value={fmtE(ov.cassetto)} tone={ov.cassetto >= 0 ? 'emerald' : 'rose'} />
          <Kpi icon={<TrendingUp size={16} />} label="Entrate ricorrenti / mese" value={fmtE(ov.entrate_ricorrenti_mese)} />
          <Kpi icon={<TrendingDown size={16} />} label="Costi ricorrenti / mese" value={fmtE(ov.costi_ricorrenti_mese)} tone="rose" />
          <Kpi icon={<Target size={16} />} label="Netto ricorrente / mese" value={fmtE(ov.netto_ricorrente_mese)} tone={ov.netto_ricorrente_mese >= 0 ? 'emerald' : 'rose'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* RICAVI */}
          <Card className="p-5">
            <h2 className="font-display text-lg mb-3 flex items-center gap-2"><CreditCard size={18} className="text-[rgb(var(--gold-600))]" /> Ricavi della piattaforma</h2>
            <Row k="Abbonamenti fornitori — attivi (paganti)" v={`${payingCount(ov.subs_by_status)}`} />
            <Row k="Commissioni (%) incassate" v={fmtE(ov.commissioni_incassate)} />
            <Row k="Commissioni da incassare" v={fmtE(ov.commissioni_da_incassare)} />
            <Row k="Commissioni totali maturate" v={fmtE(ov.commissioni_totali)} />
            <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-3">
              Pacchetti fornitori (da gennaio 2027): {PLANS.map((p) => `${p.label} ${p.price}€`).join(' · ')}. Capostipiti e clienti non pagano.
            </p>
          </Card>

          {/* PROIEZIONE / STRATEGIA */}
          <Card className="p-5">
            <h2 className="font-display text-lg mb-3 flex items-center gap-2"><Sparkles size={18} className="text-[rgb(var(--gold-600))]" /> Budget & strategia</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-[rgb(var(--fg-muted))]">% fornitori che sottoscrivono</label>
                <input type="range" min={0} max={100} value={adoption} onChange={(e) => setAdoption(Number(e.target.value))} className="w-full accent-[rgb(var(--gold-500))]" />
                <p className="text-sm font-medium">{adoption}% di {fornitori}</p>
              </div>
              <div>
                <label className="text-xs text-[rgb(var(--fg-muted))]">Piano medio</label>
                <select value={planPrice} onChange={(e) => setPlanPrice(Number(e.target.value))} className="w-full text-sm border rounded-lg px-2 py-2 bg-transparent mt-1" style={{ borderColor: 'rgb(var(--border))' }}>
                  {PLANS.map((p) => <option key={p.k} value={p.price}>{p.label} · {p.price}€</option>)}
                </select>
              </div>
            </div>
            <div className="rounded-lg p-3 text-sm" style={{ background: 'rgb(var(--bg-sunken))' }}>
              <Row k="MRR proiettato (abbonamenti)" v={fmtE(mrrProiettato)} />
              <Row k="Netto mensile proiettato" v={fmtE(nettoMese)} />
              <Row k="Break-even: abbonati necessari" v={`${breakEvenSubs} (≈ ${breakEvenAdoption}% dei fornitori)`} />
            </div>
            <div className="mt-3 text-xs text-[rgb(var(--fg-muted))] space-y-1">
              <p className="font-medium text-[rgb(var(--fg))]">Mosse consigliate per scalare:</p>
              {strategy(ov, mrrProiettato, breakEvenSubs, fornitori).map((s, i) => <p key={i}>• {s}</p>)}
            </div>
          </Card>
        </div>

        {/* COSTI PIATTAFORMA */}
        <Card className="p-5 mt-6">
          <h2 className="font-display text-lg mb-3 flex items-center gap-2"><TrendingDown size={18} className="text-[rgb(var(--rose-500))]" /> Costi della piattaforma</h2>
          <EntryEditor direction="OUT" onSaved={load} />
          <EntryList entries={costs} onChanged={load} />
        </Card>

        {/* ENTRATE MANUALI (cassetto) */}
        <Card className="p-5 mt-6">
          <h2 className="font-display text-lg mb-3 flex items-center gap-2"><TrendingUp size={18} className="text-[rgb(var(--emerald-500))]" /> Entrate / cassetto (manuali)</h2>
          <EntryEditor direction="IN" onSaved={load} />
          <EntryList entries={incomes} onChanged={load} />
        </Card>

        {/* REPORT MENSILE */}
        <Card className="p-5 mt-6">
          <h2 className="font-display text-lg mb-4 flex items-center gap-2"><Percent size={18} className="text-[rgb(var(--gold-600))]" /> Report ultimi 12 mesi</h2>
          <div className="flex items-end gap-2 h-40 overflow-x-auto">
            {months.map((m) => (
              <div key={m.mese} className="flex flex-col items-center gap-1 min-w-[34px]">
                <div className="flex items-end gap-0.5 h-32">
                  <div title={`Entrate ${fmtE(m.entrate)}`} style={{ height: `${(m.entrate / maxBar) * 100}%`, width: 10, background: 'rgb(var(--emerald-500))', borderRadius: 3 }} />
                  <div title={`Costi ${fmtE(m.costi)}`} style={{ height: `${(m.costi / maxBar) * 100}%`, width: 10, background: 'rgb(var(--rose-500))', borderRadius: 3 }} />
                </div>
                <span className="text-[9px] text-[rgb(var(--fg-subtle))]">{m.mese.slice(5)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-[rgb(var(--fg-muted))]">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgb(var(--emerald-500))' }} /> Entrate</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgb(var(--rose-500))' }} /> Costi</span>
          </div>
        </Card>
      </div>
    </div>
  )
}

function payingCount(subs: Record<string, number>) {
  return (subs.PLUS ?? 0) + (subs.PREMIUM ?? 0)
}

function strategy(ov: Overview, mrr: number, breakEvenSubs: number, fornitori: number): string[] {
  const out: string[] = []
  if (mrr < ov.costi_ricorrenti_mese) out.push(`Sei sotto break-even: servono ${breakEvenSubs} fornitori abbonati per coprire i costi ricorrenti.`)
  else out.push('Sei sopra il break-even sui ricorrenti: reinvesti il margine in acquisizione.')
  if (fornitori < 50) out.push('Priorità: portare i fornitori a 50+ (la rete cresce con l\'offerta). Spingi inviti e vetrine.')
  else out.push('Massa critica di fornitori raggiunta: ora alza il tasso di conversione ad abbonamento (onboarding + valore percepito).')
  if (ov.commissioni_da_incassare > 0) out.push(`Incassa ${fmtE(ov.commissioni_da_incassare)} di commissioni maturate ma non ancora saldate.`)
  out.push('Tieni i costi ricorrenti sotto il 50% delle entrate ricorrenti per un runway sano.')
  return out
}

function EntryEditor({ direction, onSaved }: { direction: 'IN' | 'OUT'; onSaved: () => void }) {
  const [label, setLabel] = useState(''); const [amount, setAmount] = useState(''); const [category, setCategory] = useState('')
  const [recurrence, setRecurrence] = useState('UNA_TANTUM'); const [date, setDate] = useState(''); const [saving, setSaving] = useState(false)
  async function add() {
    if (!label.trim() || !Number(amount)) { toast.error('Inserisci voce e importo'); return }
    setSaving(true)
    const { data, error } = await rpc('admin_finance_entry_add', {
      p_direction: direction, p_label: label.trim(), p_amount: Number(amount), p_category: category.trim() || null,
      p_recurrence: recurrence, p_entry_date: date || null,
    })
    setSaving(false)
    if (error || (data as { error?: string })?.error) { toast.error('Errore'); return }
    setLabel(''); setAmount(''); setCategory(''); setRecurrence('UNA_TANTUM'); setDate(''); toast.success('Aggiunto'); onSaved()
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 mb-3">
      <Input className="sm:col-span-2 text-sm" placeholder={direction === 'OUT' ? 'Es. Hosting Vercel' : 'Es. Abbonamento fornitore'} value={label} onChange={(e) => setLabel(e.target.value)} />
      <Input className="text-sm" type="number" placeholder="€" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input className="text-sm" placeholder="Categoria" value={category} onChange={(e) => setCategory(e.target.value)} />
      <select className="text-sm border rounded-lg px-2 bg-transparent" style={{ borderColor: 'rgb(var(--border))' }} value={recurrence} onChange={(e) => setRecurrence(e.target.value)}>
        <option value="UNA_TANTUM">Una tantum</option>
        <option value="MENSILE">Mensile</option>
        <option value="ANNUALE">Annuale</option>
      </select>
      <Button variant="gold" disabled={saving} onClick={() => void add()}><Plus size={14} className="mr-1" /> Aggiungi</Button>
    </div>
  )
}

function EntryList({ entries, onChanged }: { entries: Entry[]; onChanged: () => void }) {
  async function del(id: string) {
    await rpc('admin_finance_entry_delete', { p_id: id }); onChanged()
  }
  if (entries.length === 0) return <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessuna voce.</p>
  return (
    <div className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
      {entries.map((e) => (
        <div key={e.id} className="flex items-center gap-3 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate">{e.label}</p>
            <p className="text-xs text-[rgb(var(--fg-muted))]">{[e.category, recLabel(e.recurrence), new Date(e.entry_date).toLocaleDateString('it-IT')].filter(Boolean).join(' · ')}</p>
          </div>
          <span className="font-medium tabular-nums">{fmtE(e.amount)}</span>
          <button onClick={() => void del(e.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]"><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  )
}
function recLabel(r: string) { return r === 'MENSILE' ? 'mensile' : r === 'ANNUALE' ? 'annuale' : 'una tantum' }

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: 'emerald' | 'rose' }) {
  const c = tone === 'emerald' ? 'rgb(var(--emerald-600))' : tone === 'rose' ? 'rgb(var(--rose-500))' : 'rgb(var(--fg))'
  return (
    <Card className="p-4">
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1.5">{icon} {label}</p>
      <p className="font-display text-2xl mt-1 tabular-nums" style={{ color: c }}>{value}</p>
    </Card>
  )
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between gap-3 py-1 text-sm"><span className="text-[rgb(var(--fg-muted))]">{k}</span><span className="font-medium tabular-nums">{v}</span></div>
}
