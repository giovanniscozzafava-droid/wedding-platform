import { useEffect, useState } from 'react'
import { Boxes, Plus, Trash2, Minus, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

// Magazzino ALLESTIMENTO per location: tovagliato, piatti/sottopiatti, posate, bicchieri,
// centrotavola, mise en place, arredo, illuminazione. Distinto dal food (ingredienti).
const sb = (t: string): any => (supabase as any).from(t)
type Item = { id: string; category: string; name: string; qty: number; unit: string; low_threshold: number | null; notes: string | null }
const CATS: Array<{ key: string; label: string }> = [
  { key: 'TOVAGLIATO', label: 'Tovagliato' }, { key: 'PIATTI', label: 'Piatti & sottopiatti' }, { key: 'POSATE', label: 'Posate' },
  { key: 'BICCHIERI', label: 'Bicchieri' }, { key: 'CENTROTAVOLA', label: 'Centrotavola' }, { key: 'MISE_EN_PLACE', label: 'Mise en place' },
  { key: 'ARREDO', label: 'Arredo & sedute' }, { key: 'ILLUMINAZIONE', label: 'Illuminazione' }, { key: 'ALTRO', label: 'Altro' },
]

export default function MagazzinoPage() {
  const [items, setItems] = useState<Item[]>([])
  const [uid, setUid] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name: '', category: 'TOVAGLIATO', qty: '', unit: 'PZ' })

  async function load() {
    const { data: u } = await supabase.auth.getUser()
    const id = u.user?.id ?? null; setUid(id)
    if (!id) { setLoading(false); return }
    const { data } = await sb('location_inventory').select('*').eq('location_id', id).order('category').order('sort_order').order('name')
    setItems((data ?? []) as Item[]); setLoading(false)
  }
  useEffect(() => { void load() }, [])

  async function add() {
    if (!uid || !form.name.trim()) return toast.error('Nome articolo richiesto')
    const { error } = await sb('location_inventory').insert({ location_id: uid, name: form.name.trim(), category: form.category, qty: Number(form.qty) || 0, unit: form.unit || 'PZ' })
    if (error) return toast.error('Non riuscito')
    setForm({ ...form, name: '', qty: '' }); await load()
  }
  async function patch(id: string, p: Partial<Item>) {
    setItems((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)))
    await sb('location_inventory').update({ ...p, updated_at: new Date().toISOString() }).eq('id', id)
  }
  async function bump(it: Item, d: number) { await patch(it.id, { qty: Math.max(0, Number(it.qty) + d) }) }
  async function del(id: string) { await sb('location_inventory').delete().eq('id', id); await load() }

  if (loading) return <div className="p-8 text-[rgb(var(--fg-muted))]">Carico il magazzino…</div>

  const byCat = CATS.map((c) => ({ ...c, list: items.filter((i) => i.category === c.key) })).filter((c) => c.list.length > 0)
  const lowN = items.filter((i) => i.low_threshold != null && Number(i.qty) < Number(i.low_threshold)).length

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="font-display text-2xl flex items-center gap-2"><Boxes size={22} /> Magazzino allestimento</h1>
        <p className="text-sm text-[rgb(var(--fg-muted))] mt-0.5">Carica quello che hai in casa: tovagliato, piatti, sottopiatti, posate, bicchieri, centrotavola, mise en place, arredo, luci. {lowN > 0 && <span className="text-[rgb(var(--rose-600))] font-medium">{lowN} articoli sotto scorta.</span>}</p>
      </div>

      {/* Aggiungi articolo */}
      <Card className="p-4">
        <div className="grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
          <div><Label htmlFor="mi-name">Articolo</Label><Input id="mi-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Es. Sottopiatto oro" onKeyDown={(e) => e.key === 'Enter' && add()} /></div>
          <div>
            <Label>Categoria</Label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-10 px-3 rounded-lg border bg-[rgb(var(--bg-elev))] border-[rgb(var(--border))]">
              {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div><Label>Q.tà</Label><Input type="number" min="0" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="w-24" placeholder="0" /></div>
          <div><Label>Unità</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-20" /></div>
          <Button variant="gold" onClick={add}><Plus size={15} /> Aggiungi</Button>
        </div>
      </Card>

      {byCat.length === 0 && <Card className="p-8 text-center text-[rgb(var(--fg-muted))]">Magazzino vuoto. Aggiungi il primo articolo qui sopra.</Card>}

      {byCat.map((c) => (
        <div key={c.key}>
          <h2 className="font-display text-lg mb-2" style={{ color: 'rgb(var(--gold-700))' }}>{c.label} <span className="text-sm font-normal text-[rgb(var(--fg-muted))]">({c.list.length})</span></h2>
          <div className="space-y-2">
            {c.list.map((it) => {
              const low = it.low_threshold != null && Number(it.qty) < Number(it.low_threshold)
              return (
                <Card key={it.id} className={`p-3 ${low ? 'ring-1 ring-[rgb(var(--rose-400))]' : ''}`}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <Input value={it.name} onChange={(e) => patch(it.id, { name: e.target.value })} className="flex-1 min-w-[140px] h-9" />
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => bump(it, -1)} aria-label="-1"><Minus size={14} /></Button>
                      <Input type="number" min="0" value={it.qty} onChange={(e) => patch(it.id, { qty: Number(e.target.value) || 0 })} className="w-20 h-9 text-center" />
                      <Button variant="ghost" size="icon" onClick={() => bump(it, +1)} aria-label="+1"><Plus size={14} /></Button>
                      <Input value={it.unit} onChange={(e) => patch(it.id, { unit: e.target.value })} className="w-16 h-9" />
                    </div>
                    <div className="flex items-center gap-1" title="Soglia scorta minima">
                      <span className="text-[11px] text-[rgb(var(--fg-subtle))]">min</span>
                      <Input type="number" min="0" value={it.low_threshold ?? ''} onChange={(e) => patch(it.id, { low_threshold: e.target.value === '' ? null : Number(e.target.value) })} className="w-16 h-9" placeholder="—" />
                    </div>
                    {low && <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgb(var(--rose-100))', color: 'rgb(var(--rose-700))' }}><AlertTriangle size={11} /> sotto scorta</span>}
                    <Button variant="ghost" size="icon" onClick={() => del(it.id)} aria-label="Elimina"><Trash2 size={14} /></Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
