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

const PRESETS_BY_SUBROLE: Record<string, { label: string; items: Comp[] }[]> = {
  fioraio: [
    { label: 'Bouquet sposa romantico', items: [
      { name: 'Rosa David Austin', unit_price: 4.5, quantity: 5, unit: 'gambo' },
      { name: 'Eucalipto verde', unit_price: 2, quantity: 3, unit: 'gambo' },
      { name: 'Peonia bianca', unit_price: 8, quantity: 3, unit: 'gambo' },
      { name: "Mano d'opera", unit_price: 25, quantity: 1, unit: 'h' },
      { name: 'Confezione + nastro', unit_price: 4, quantity: 1, unit: 'pz' },
    ] },
    { label: 'Centrotavola tondo', items: [
      { name: 'Rosa garden', unit_price: 3.5, quantity: 6, unit: 'gambo' },
      { name: 'Eucalipto', unit_price: 1.5, quantity: 4, unit: 'gambo' },
      { name: 'Vaso vetro trasparente', unit_price: 8, quantity: 1, unit: 'pz' },
      { name: "Mano d'opera", unit_price: 25, quantity: 0.5, unit: 'h' },
    ] },
  ],
  fotografo: [
    { label: 'Pacchetto full day', items: [
      { name: 'Servizio 8h matrimonio', unit_price: 1500, quantity: 1, unit: 'pz' },
      { name: 'Pre-wedding shoot', unit_price: 400, quantity: 1, unit: 'pz' },
      { name: 'Album premium 30x30', unit_price: 480, quantity: 1, unit: 'pz' },
      { name: 'Galleria online consegna', unit_price: 80, quantity: 1, unit: 'pz' },
      { name: 'Editing 300 foto', unit_price: 350, quantity: 1, unit: 'pz' },
    ] },
  ],
  videomaker: [
    { label: 'Pacchetto video full day', items: [
      { name: 'Riprese 10h con 2 operatori', unit_price: 2000, quantity: 1, unit: 'pz' },
      { name: 'Highlights 3 min', unit_price: 350, quantity: 1, unit: 'pz' },
      { name: 'Film completo 30 min', unit_price: 600, quantity: 1, unit: 'pz' },
      { name: 'Reel social verticale', unit_price: 250, quantity: 1, unit: 'pz' },
    ] },
  ],
  catering: [
    { label: 'Menu base x 100 ospiti', items: [
      { name: 'Aperitivo + finger food (a persona)', unit_price: 18, quantity: 100, unit: 'pz' },
      { name: 'Antipasto', unit_price: 12, quantity: 100, unit: 'pz' },
      { name: 'Primo piatto', unit_price: 15, quantity: 100, unit: 'pz' },
      { name: 'Secondo + contorno', unit_price: 22, quantity: 100, unit: 'pz' },
      { name: 'Dessert + torta', unit_price: 14, quantity: 100, unit: 'pz' },
      { name: 'Beverage open bar 4h', unit_price: 28, quantity: 100, unit: 'pz' },
      { name: 'Service camerieri (a 10 ospiti)', unit_price: 180, quantity: 10, unit: 'pz' },
    ] },
  ],
  pasticcere: [
    { label: 'Torta nuziale 3 piani', items: [
      { name: 'Base sponge + crema (per kg)', unit_price: 35, quantity: 6, unit: 'kg' },
      { name: 'Decorazione zucchero/fondant', unit_price: 120, quantity: 1, unit: 'pz' },
      { name: 'Trasporto', unit_price: 60, quantity: 1, unit: 'pz' },
    ] },
  ],
  musica: [
    { label: 'DJ set + service', items: [
      { name: 'DJ 5 ore', unit_price: 800, quantity: 1, unit: 'pz' },
      { name: 'Service audio (mixer, casse, microfoni)', unit_price: 350, quantity: 1, unit: 'pz' },
      { name: 'Luci dance floor', unit_price: 250, quantity: 1, unit: 'pz' },
    ] },
  ],
  allestimenti: [
    { label: 'Allestimento cerimonia outdoor', items: [
      { name: 'Arco bianco con drappi', unit_price: 350, quantity: 1, unit: 'pz' },
      { name: 'Sedie chiavarine bianche', unit_price: 3, quantity: 80, unit: 'pz' },
      { name: 'Tappeto fiori petali', unit_price: 220, quantity: 1, unit: 'pz' },
      { name: 'Trasporto + montaggio', unit_price: 280, quantity: 1, unit: 'pz' },
    ] },
  ],
  make_up: [
    { label: 'Beauty sposa + accompagnatori', items: [
      { name: 'Prova make-up sposa', unit_price: 80, quantity: 1, unit: 'pz' },
      { name: 'Make-up sposa giorno', unit_price: 220, quantity: 1, unit: 'pz' },
      { name: 'Acconciatura sposa', unit_price: 180, quantity: 1, unit: 'pz' },
      { name: 'Make-up testimoni (a persona)', unit_price: 90, quantity: 3, unit: 'pz' },
    ] },
  ],
  location: [
    { label: 'Pacchetto location + menu (Sud Italia)', items: [
      { name: 'Affitto sala/spazio esterno', unit_price: 3500, quantity: 1, unit: 'pz' },
      { name: 'Menu base (a persona)', unit_price: 95, quantity: 100, unit: 'pz' },
      { name: 'Service camerieri/cuochi', unit_price: 1200, quantity: 1, unit: 'pz' },
      { name: 'Tavoli + mise en place', unit_price: 600, quantity: 1, unit: 'pz' },
    ] },
  ],
}

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

  const presets = PRESETS_BY_SUBROLE[profile?.subrole ?? ''] ?? []

  function addComp() {
    setComponents((c) => [...c, { name: '', unit_price: 0, quantity: 1, unit: 'pz' }])
  }
  function updateComp(i: number, patch: Partial<Comp>) {
    setComponents((c) => c.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  }
  function removeComp(i: number) {
    setComponents((c) => c.filter((_, j) => j !== i))
  }
  function loadPreset(idx: number) {
    const p = presets[idx]
    if (!p) return
    setComponents(p.items.map((it) => ({ ...it })))
    if (!name) setName(p.label)
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

          {presets.length > 0 && components.length === 0 && (
            <div className="mb-3 p-3 rounded-lg border" style={{ borderColor: 'rgb(var(--border))', background: 'rgb(var(--bg-sunken))' }}>
              <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-muted))] mb-2">
                Modelli pronti — categoria {profile?.subrole}
              </p>
              <div className="flex flex-wrap gap-2">
                {presets.map((p, i) => (
                  <Button key={i} variant="outline" size="sm" onClick={() => loadPreset(i)}>
                    <Plus size={12} /> {p.label}
                  </Button>
                ))}
              </div>
            </div>
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
