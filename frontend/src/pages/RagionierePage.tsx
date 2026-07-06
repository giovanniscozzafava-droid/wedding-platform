import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Calculator, Loader2, Users, ChefHat, Wallet, TrendingUp, AlertTriangle, CheckCircle2, Lightbulb } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'

// "Ragioniere" (Location): scegli un evento → l'AI fa quadrare i conti. I NUMERI sono calcolati dal
// server (esatti: coperti, food cost, ricavo, margine, incidenza); Claude fa il controller (verdetto +
// scostamenti + consigli). Wallet AI a token (edge fb-ragioniere).

type EventRow = { id: string; title: string; date_from: string; status: string }
type Conti = {
  evento: { titolo: string; data: string; stato: string }
  coperti: { previsti: number | null; confermati: number; in_attesa: number; rifiutati: number; scostamento: number | null }
  food_cost: { totale_eur: number | null; per_coperto_eur: number | null; calcolato_su_coperti: number; completo: boolean; per_menu: { nome: string; coperti: number; food_cost_totale: number | null; food_cost_coperto: number | null }[] }
  ricavo: { preventivo_eur: number | null; costo_preventivo_eur: number | null; margine_eur: number | null; margine_pct: number | null }
  incidenza_food_cost_pct: number | null
  diete: Record<string, number>
}
type Analisi = { verdetto: 'ok' | 'attenzione' | 'critico'; sintesi: string; alert: string[]; consigli: string[]; incidenza_giudizio: string }

const money = (n: number | null | undefined) => (n == null ? '—' : `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)

export default function RagionierePage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<EventRow[]>([])
  const [sel, setSel] = useState('')
  const [busy, setBusy] = useState(false)
  const [conti, setConti] = useState<Conti | null>(null)
  const [analisi, setAnalisi] = useState<Analisi | null>(null)

  useEffect(() => {
    if (!user) return
    void (async () => {
      const { data } = await supabase.from('calendar_entries').select('id, title, date_from, status').eq('owner_id', user.id).order('date_from', { ascending: false }).limit(200)
      if (Array.isArray(data)) { setEvents(data as EventRow[]); if (data[0]) setSel((data[0] as EventRow).id) }
    })()
  }, [user])

  async function run() {
    if (!sel) { toast.message('Scegli un evento'); return }
    setBusy(true); setConti(null); setAnalisi(null)
    try {
      const { data, error } = await supabase.functions.invoke('fb-ragioniere', { body: { entry_id: sel } })
      const err = (data as { error?: string } | null)?.error
      if (error || err) {
        toast.error(err === 'no_credit' ? 'Credito AI esaurito: ricarica il wallet.' : err === 'no_ai_key' ? 'Manca la chiave AI sul server.' : err === 'forbidden' ? 'Non autorizzato per questo evento.' : `Non riuscito${err ? `: ${err}` : ''}`)
        return
      }
      setConti((data as { conti?: Conti }).conti ?? null)
      setAnalisi((data as { analisi?: Analisi }).analisi ?? null)
    } catch (e) { toast.error(`Non riuscito: ${String((e as Error)?.message ?? e).slice(0, 120)}`) }
    finally { setBusy(false) }
  }

  const vBadge = (v?: string) => v === 'ok' ? 'bg-emerald-100 text-emerald-700' : v === 'critico' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
  const fcHue = (pct: number | null) => pct == null ? 'text-[rgb(var(--fg))]' : pct > 40 ? 'text-rose-600' : pct > 35 ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-5xl px-4 sm:px-8 py-8">
        <div className="flex items-center gap-2 mb-1"><Calculator size={22} className="text-[rgb(var(--gold-600))]" /><h1 className="font-display text-3xl sm:text-4xl">Ragioniere</h1></div>
        <p className="text-[rgb(var(--fg-muted))] mb-6">Scegli un evento: l'AI fa quadrare i conti — coperti, food cost, ricavo, margine — e segnala gli scostamenti.</p>

        <Card className="p-4 flex flex-wrap items-end gap-3 mb-6">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-[rgb(var(--fg-muted))]">Evento</label>
            <Select value={sel} onChange={(e) => setSel(e.target.value)}>
              {events.length === 0 && <option value="">Nessun evento</option>}
              {events.map((e) => <option key={e.id} value={e.id}>{e.title} · {new Date(e.date_from).toLocaleDateString('it-IT')}</option>)}
            </Select>
          </div>
          <Button variant="gold" onClick={() => void run()} disabled={busy || !sel}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />} Fai quadrare i conti</Button>
        </Card>

        {conti && (
          <div className="space-y-5">
            {/* verdetto AI */}
            {analisi && (
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${vBadge(analisi.verdetto)}`}>{analisi.verdetto === 'ok' ? 'Conti a posto' : analisi.verdetto === 'critico' ? 'Critico' : 'Attenzione'}</span>
                  <span className="text-[11px] text-[rgb(var(--fg-subtle))]">Analisi del ragioniere AI</span>
                </div>
                <p className="text-sm">{analisi.sintesi}</p>
              </Card>
            )}

            {/* numeri chiave */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="p-4"><p className="flex items-center gap-1.5 text-xs text-[rgb(var(--fg-muted))]"><Users size={13} /> Coperti</p><p className="font-display text-2xl mt-1">{conti.coperti.confermati}<span className="text-sm text-[rgb(var(--fg-subtle))]"> / {conti.coperti.previsti ?? '—'}</span></p><p className="text-[11px] text-[rgb(var(--fg-muted))]">confermati / previsti{conti.coperti.in_attesa ? ` · ${conti.coperti.in_attesa} in attesa` : ''}</p></Card>
              <Card className="p-4"><p className="flex items-center gap-1.5 text-xs text-[rgb(var(--fg-muted))]"><ChefHat size={13} /> Food cost</p><p className="font-display text-2xl mt-1">{money(conti.food_cost.totale_eur)}</p><p className="text-[11px] text-[rgb(var(--fg-muted))]">{money(conti.food_cost.per_coperto_eur)}/coperto{conti.food_cost.completo ? '' : ' · parziale'}</p></Card>
              <Card className="p-4"><p className="flex items-center gap-1.5 text-xs text-[rgb(var(--fg-muted))]"><TrendingUp size={13} /> Ricavo / margine</p><p className="font-display text-2xl mt-1">{money(conti.ricavo.preventivo_eur)}</p><p className="text-[11px] text-[rgb(var(--fg-muted))]">margine {money(conti.ricavo.margine_eur)}{conti.ricavo.margine_pct != null ? ` (${conti.ricavo.margine_pct}%)` : ''}</p></Card>
              <Card className="p-4"><p className="flex items-center gap-1.5 text-xs text-[rgb(var(--fg-muted))]"><Wallet size={13} /> Incidenza food cost</p><p className={`font-display text-2xl mt-1 ${fcHue(conti.incidenza_food_cost_pct)}`}>{conti.incidenza_food_cost_pct != null ? `${conti.incidenza_food_cost_pct}%` : '—'}</p><p className="text-[11px] text-[rgb(var(--fg-muted))]">sul ricavo (sano ~28-35%)</p></Card>
            </div>

            {/* menu */}
            {conti.food_cost.per_menu.length > 0 && (
              <Card className="p-4">
                <p className="font-medium mb-2">Menu dell'evento</p>
                <div className="space-y-1.5">
                  {conti.food_cost.per_menu.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-sm border-b border-[rgb(var(--border))] last:border-0 pb-1.5">
                      <span>{m.nome} <span className="text-[11px] text-[rgb(var(--fg-subtle))]">· {m.coperti} coperti</span></span>
                      <span className="tabular-nums">{money(m.food_cost_totale)} <span className="text-[11px] text-[rgb(var(--fg-muted))]">({money(m.food_cost_coperto)}/cop.)</span></span>
                    </div>
                  ))}
                </div>
                {Object.keys(conti.diete).length > 0 && <p className="mt-3 text-xs text-[rgb(var(--fg-muted))]">Diete: {Object.entries(conti.diete).map(([d, n]) => `${d} (${n})`).join(' · ')}</p>}
              </Card>
            )}

            {/* alert + consigli AI */}
            {analisi && (analisi.alert?.length > 0 || analisi.consigli?.length > 0) && (
              <div className="grid md:grid-cols-2 gap-3">
                {analisi.alert?.length > 0 && (
                  <Card className="p-4">
                    <p className="flex items-center gap-1.5 font-medium mb-2 text-amber-700"><AlertTriangle size={15} /> Scostamenti / rischi</p>
                    <ul className="space-y-1.5 text-sm">{analisi.alert.map((a, i) => <li key={i} className="flex gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />{a}</li>)}</ul>
                  </Card>
                )}
                {analisi.consigli?.length > 0 && (
                  <Card className="p-4">
                    <p className="flex items-center gap-1.5 font-medium mb-2 text-[rgb(var(--gold-700))]"><Lightbulb size={15} /> Consigli del controller</p>
                    <ul className="space-y-1.5 text-sm">{analisi.consigli.map((c, i) => <li key={i} className="flex gap-2"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />{c}</li>)}</ul>
                  </Card>
                )}
              </div>
            )}
            {analisi?.incidenza_giudizio && <p className="text-xs text-[rgb(var(--fg-muted))]">{analisi.incidenza_giudizio}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
