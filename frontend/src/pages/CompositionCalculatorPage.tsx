import { useState, useMemo, useEffect } from 'react'
import { Plus, Trash2, Save, Calculator, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

type Comp = { id?: string; name: string; unit_price: number; quantity: number; unit: string; notes?: string }

const UNITS = ['pz', 'gambo', 'mazzo', 'kg', 'g', 'l', 'ml', 'h', 'm', 'altro']

const PRESET_FLORAL: Comp[] = [
  { name: 'Rosa David Austin', unit_price: 4.5, quantity: 5, unit: 'gambo' },
  { name: 'Eucalipto verde', unit_price: 2, quantity: 3, unit: 'gambo' },
  { name: 'Peonia bianca', unit_price: 8, quantity: 3, unit: 'gambo' },
  { name: "Mano d'opera", unit_price: 25, quantity: 1, unit: 'h' },
  { name: 'Confezione + nastro', unit_price: 4, quantity: 1, unit: 'pz' },
]

export default function CompositionCalculatorPage() {
  const { user, profile } = useAuth()
  const [components, setComponents] = useState<Comp[]>([])
  const [name, setName] = useState('')
  const [markup, setMarkup] = useState(40)
  const [marketHints, setMarketHints] = useState<any[]>([])

  // Costo totale (somma componenti)
  const cost = useMemo(() => components.reduce((s, c) => s + Number(c.unit_price) * Number(c.quantity), 0), [components])
  const sale = useMemo(() => cost * (1 + markup / 100), [cost, markup])
  const margin = sale - cost

  // Hint borsino
  useEffect(() => {
    if (!profile?.subrole) return
    void (async () => {
      const { data } = await (supabase.from('market_prices' as any) as any).select('service_kind, unit, price_p25, price_median, price_p75').eq('subrole', profile.subrole)
      setMarketHints((data ?? []) as any[])
    })()
  }, [profile?.subrole])

  function addComp() {
    setComponents((c) => [...c, { name: '', unit_price: 0, quantity: 1, unit: 'pz' }])
  }
  function updateComp(i: number, patch: Partial<Comp>) {
    setComponents((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  }
  function removeComp(i: number) {
    setComponents((c) => c.filter((_, j) => j !== i))
  }
  function loadFloralPreset() {
    setComponents(PRESET_FLORAL.map((p) => ({ ...p })))
    if (!name) setName('Bouquet sposa romantico')
  }

  async function saveAsService() {
    if (!user) return
    if (!name.trim()) { toast.error('Nome composizione obbligatorio'); return }
    if (components.length === 0) { toast.error('Aggiungi almeno un componente'); return }
    try {
      // Cerca o crea categoria default
      const { data: cat } = await supabase.from('service_categories').select('id').eq('slug', profile?.subrole ?? 'altro').maybeSingle()
      let category_id = cat?.id
      if (!category_id) {
        const { data: any_cat } = await supabase.from('service_categories').select('id').limit(1).maybeSingle()
        category_id = any_cat?.id
      }
      if (!category_id) { toast.error('Categoria non trovata'); return }

      const { data: svc, error } = await supabase.from('services').insert({
        fornitore_id: user.id,
        category_id,
        name: name.trim(),
        description: `Composizione costruita dal calcolatore. ${components.length} componenti. Markup ${markup}%.`,
        base_price: Math.round(sale * 100) / 100,
        unit: 'PEZZO',
        is_active: true,
      }).select().single()
      if (error) throw error

      // Salva componenti
      const compRows = components.map((c, ord) => ({
        service_id: svc.id, name: c.name, unit_price: c.unit_price, quantity: c.quantity, unit: c.unit, notes: c.notes ?? null, ord,
      }))
      const { error: cErr } = await (supabase.from('service_components' as any) as any).insert(compRows)
      if (cErr) throw cErr
      toast.success('Servizio salvato con calcolatore composizione')
      setName('')
      setComponents([])
    } catch (e) { toast.error((e as Error).message) }
  }

  return (
    <div className="min-h-full">
      <div className="max-w-5xl mx-auto px-4 sm:px-10 py-8">
        <PageHeader
          eyebrow="Strumento"
          title="Calcolatore composizione"
          description="Costruisci pezzo per pezzo. Ideale per fiori, allestimenti, gadget personalizzati."
        />

        {marketHints.length > 0 && (
          <Card className="p-4 mb-6 bg-[rgb(var(--bg-sunken))]">
            <div className="flex items-start gap-2 mb-3">
              <TrendingUp size={16} className="text-[rgb(var(--gold-500))] mt-0.5" />
              <div>
                <p className="font-medium text-sm">Borsino di mercato Italia — categoria {profile?.subrole}</p>
                <p className="text-xs text-[rgb(var(--fg-muted))]">Range realistici per la tua categoria. Usali come riferimento.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {marketHints.slice(0, 6).map((m, i) => (
                <div key={i} className="text-xs flex items-center gap-2 p-2 rounded-md" style={{ background: 'rgb(var(--bg-elev))' }}>
                  <span className="flex-1 truncate">{m.service_kind} <Badge tone="neutral">{m.unit}</Badge></span>
                  <span className="font-mono tabular-nums">€{m.price_p25}–{m.price_p75} <strong>(med {m.price_median})</strong></span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-4 sm:p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="space-y-1">
              <Label htmlFor="comp-name">Nome composizione</Label>
              <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Bouquet sposa peonie" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="markup">Markup %</Label>
              <Input id="markup" type="number" min={0} value={markup} onChange={(e) => setMarkup(Number(e.target.value || 0))} />
            </div>
          </div>

          {profile?.subrole === 'fioraio' && components.length === 0 && (
            <Button variant="outline" onClick={loadFloralPreset} className="mb-3">
              <Plus size={14} /> Carica esempio bouquet
            </Button>
          )}

          <div className="space-y-2">
            {components.map((c, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-4 space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider">Componente</Label>
                  <Input value={c.name} onChange={(e) => updateComp(i, { name: e.target.value })} placeholder="Es. Rosa David Austin" />
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider">Quantità</Label>
                  <Input type="number" step="0.01" value={c.quantity} onChange={(e) => updateComp(i, { quantity: Number(e.target.value || 0) })} />
                </div>
                <div className="col-span-4 sm:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider">Unità</Label>
                  <Select value={c.unit} onChange={(e) => updateComp(i, { unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </div>
                <div className="col-span-3 sm:col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider">€/un.</Label>
                  <Input type="number" step="0.01" value={c.unit_price} onChange={(e) => updateComp(i, { unit_price: Number(e.target.value || 0) })} />
                </div>
                <div className="col-span-1 sm:col-span-1 text-right">
                  <p className="text-xs text-[rgb(var(--fg-muted))]">Sub</p>
                  <p className="font-mono text-sm tabular-nums">€{(c.unit_price * c.quantity).toFixed(2)}</p>
                </div>
                <div className="col-span-12 sm:col-span-1 flex justify-end">
                  <Button variant="ghost" size="icon" onClick={() => removeComp(i)}><Trash2 size={14} /></Button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addComp} className="w-full"><Plus size={14} /> Aggiungi componente</Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Stat label="Costo materiali" value={`€ ${cost.toFixed(2)}`} />
            <Stat label="Markup" value={`+${markup}%`} tone="gold" />
            <Stat label="Prezzo vendita" value={`€ ${sale.toFixed(2)}`} tone="emerald" />
          </div>
          <p className="text-sm text-center text-[rgb(var(--fg-muted))]">
            Margine: <strong>€ {margin.toFixed(2)}</strong>
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-end">
            <Button variant="outline" onClick={() => { setName(''); setComponents([]); setMarkup(40) }}>
              <Calculator size={14} /> Resetta
            </Button>
            <Button variant="gold" onClick={saveAsService}>
              <Save size={14} /> Salva come servizio
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'gold' | 'emerald' }) {
  const cls = tone === 'gold' ? 'text-[rgb(var(--gold-700))]'
    : tone === 'emerald' ? 'text-[rgb(var(--emerald-500))]' : ''
  return (
    <div className="text-center surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className={`font-display text-2xl mt-1 tabular-nums ${cls}`}>{value}</p>
    </div>
  )
}
