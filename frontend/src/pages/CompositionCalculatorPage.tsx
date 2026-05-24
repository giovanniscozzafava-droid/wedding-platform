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

// Catalogo NOMI servizi tipici per settore — il fornitore sceglie da qui
const SERVICE_NAMES_BY_SUBROLE: Record<string, string[]> = {
  fotografo: ['Servizio matrimonio full day', 'Servizio cerimonia 4h', 'Pre-wedding shoot', 'Album premium 30x30', 'Album standard', 'Box stampe fine art', 'Riprese drone', 'Foto group corporate', 'Galleria online consegna', 'Editing 300 foto'],
  videomaker: ['Video matrimonio full day', 'Highlights 3 min', 'Film completo 30 min', 'Reel social verticale', 'Same Day Edit (SDE)', 'Riprese drone aeree', 'Aftermovie', 'Trailer cinematografico'],
  fioraio: ['Bouquet sposa', 'Bouquet damigella', 'Boutonnière sposo', 'Centrotavola tondo', 'Centrotavola lungo', 'Allestimento cerimonia chiesa', 'Allestimento gazebo/arco', 'Composizione tableau', 'Petali per uscita', 'Fiori per torta', 'Corona fiori sposa', 'Composizione altare'],
  catering: ['Menu base', 'Menu deluxe', 'Menu vegetariano', 'Menu kids', 'Open bar 4h', 'Open bar premium', 'Aperitivo finger food', 'Buffet di dolci', 'Service camerieri', 'Bartender dedicato', 'Welcome drink', 'Late night snack'],
  pasticcere: ['Torta nuziale 1 piano', 'Torta nuziale 2 piani', 'Torta nuziale 3 piani', 'Confetti personalizzati', 'Confettata mignon', 'Cake topper personalizzato', 'Sweet table', 'Mini cake ospiti'],
  musica: ['DJ set 5 ore', 'DJ set + Live PA', 'Band live cerimonia', 'Band live ricevimento', 'Trio acustico', 'Quartetto archi cerimonia', 'Cantante solista', 'Service audio cerimonia', 'Service luci dance floor'],
  allestimenti: [
    'Sedie chiavarine dorate', 'Sedie chiavarine bianche', 'Sedie cross-back legno', 'Sedie ghost trasparenti',
    'Poltrone vintage lounge', 'Divani chesterfield', 'Pouf colorati',
    'Tavoli imperiali 4m', 'Tavoli rotondi 1.5m', 'Tavoli quadrati 2m',
    'Tovagliato lino naturale', 'Tovagliato organza ricamata', 'Runner velluto', 'Mise en place oro/rame',
    'Piatti porcellana bianca', 'Charger plates oro', 'Bicchieri cristallo', 'Posateria oro',
    'Arco floreale matrimonio', 'Gazebo bianco 6x6', 'Tunnel di fiori', 'Lounge area chill-out',
    'Lighting design ambient', 'Catene luminose patio', 'Spot dance floor', 'Faretti architetturali',
    'Sound system audio', 'Pista da ballo', 'Welcome corner', 'Photo booth + props',
  ],
  make_up: ['Make-up sposa con prova', 'Make-up sposa giorno', 'Acconciatura sposa', 'Make-up testimoni', 'Make-up mamme', 'Trial styling', 'Touch-up presente in location'],
  abiti: ['Abito sposa atelier su misura', 'Abito sposa ready-to-wear', 'Velo / coprispalle', 'Accessori sposa', 'Abito sposo', 'Cravatta / papillon set', 'Scarpe sposa'],
  location: ['Pacchetto location + menu', 'Affitto sala matrimonio', 'Affitto giardino', 'Affitto piscina', 'Cerimonia civile in struttura', 'Pernotto suite sposi'],
  auto: ['Auto sposi vintage Fiat 500', 'Auto sposi Mercedes', 'Auto sposi Rolls Royce', 'Limousine 8 posti', 'Pulmino navetta'],
  animazione: ['Mago / illusionista', 'Animazione bambini', 'Statua vivente', 'Fuochi pirotecnici', 'Spettacolo fuoco'],
  celebrante: ['Cerimonia simbolica', 'Officiante laico', 'Cerimonia delle alleanze'],
  wedding_planner: ['Pianificazione completa', 'Day coordinator', 'Mood board + concept', 'Wedding designer', 'Destination wedding'],
  altro: ['Servizio personalizzato'],
}

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
    { label: 'Pacchetto sedute + tavoli', items: [
      { name: 'Sedie chiavarine dorate (noleggio)', unit_price: 4.5, quantity: 100, unit: 'pz' },
      { name: 'Tavoli imperiali 4m', unit_price: 85, quantity: 3, unit: 'pz' },
      { name: 'Tavoli rotondi 1.5m', unit_price: 35, quantity: 8, unit: 'pz' },
      { name: 'Trasporto + montaggio + smontaggio', unit_price: 450, quantity: 1, unit: 'pz' },
    ] },
    { label: 'Tovagliato + mise en place premium', items: [
      { name: 'Tovagliato lino naturale (a tavolo)', unit_price: 22, quantity: 11, unit: 'pz' },
      { name: 'Runner velluto bordeaux', unit_price: 18, quantity: 11, unit: 'pz' },
      { name: 'Piatti porcellana bianca (set 6 pz)', unit_price: 12, quantity: 100, unit: 'pz' },
      { name: 'Charger plates oro', unit_price: 4.5, quantity: 100, unit: 'pz' },
      { name: 'Bicchieri cristallo (set 4)', unit_price: 5, quantity: 100, unit: 'pz' },
      { name: 'Posateria oro (set)', unit_price: 8, quantity: 100, unit: 'pz' },
    ] },
    { label: 'Lounge + chill-out', items: [
      { name: 'Divani chesterfield velluto', unit_price: 180, quantity: 3, unit: 'pz' },
      { name: 'Poltrone vintage spaiate', unit_price: 65, quantity: 6, unit: 'pz' },
      { name: 'Pouf colorati', unit_price: 25, quantity: 12, unit: 'pz' },
      { name: 'Tappeto persiano vintage', unit_price: 95, quantity: 2, unit: 'pz' },
      { name: 'Tavolini caffè bassi', unit_price: 35, quantity: 3, unit: 'pz' },
    ] },
    { label: 'Lighting design completo', items: [
      { name: 'Catene luminose 50m', unit_price: 220, quantity: 1, unit: 'pz' },
      { name: 'Spot dance floor LED', unit_price: 95, quantity: 6, unit: 'pz' },
      { name: 'Faretti architetturali warm', unit_price: 45, quantity: 12, unit: 'pz' },
      { name: 'Macchina del fumo + neon', unit_price: 280, quantity: 1, unit: 'pz' },
      { name: 'Service tecnico operatore', unit_price: 380, quantity: 1, unit: 'pz' },
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
              <Label htmlFor="comp-name">Nome servizio</Label>
              {SERVICE_NAMES_BY_SUBROLE[profile?.subrole ?? '']?.length ? (
                <Select id="comp-name" value={name} onChange={(e) => setName(e.target.value)}>
                  <option value="">— Scegli dal tuo catalogo —</option>
                  {(SERVICE_NAMES_BY_SUBROLE[profile?.subrole ?? ''] ?? []).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value="__custom__">+ Personalizzato (digita sotto)</option>
                </Select>
              ) : (
                <Input id="comp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Bouquet sposa peonie" />
              )}
              {name === '__custom__' && (
                <Input className="mt-2" placeholder="Digita il nome personalizzato"
                  value="" onChange={(e) => setName(e.target.value)} />
              )}
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
