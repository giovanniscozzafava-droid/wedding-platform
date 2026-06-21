import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Carrot, BookOpen, UtensilsCrossed, Plus, Trash2, Link2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import {
  useIngredients, useRecipes, useMenus, useMyServices, useMenuFoodcost, useFoodCostMutations,
  type FbIngredient, type FbRecipe, type FbMenu,
} from '@/hooks/useFoodCost'

const eur = (n: number) => '€ ' + (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// l'ingrediente è in g/ml/pz; in UI mostriamo €/kg, €/L, €/pz (più leggibile)
const bigUnit = (u: string) => (u === 'G' ? 'kg' : u === 'ML' ? 'L' : 'pz')
const factor = (u: string) => (u === 'G' || u === 'ML' ? 1000 : 1)         // 1 kg = 1000 g
const toStock = (v: number, u: string) => v / factor(u)                      // €/kg → €/g
const fromStock = (c: number, u: string) => c * factor(u)                    // €/g → €/kg

export default function FoodCostPage() {
  const [tab, setTab] = useState<'ing' | 'rec' | 'menu'>('ing')
  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Gestionale F&B" title="Food cost"
          description="Ingredienti e costi, ricette, menu: sai esattamente quanto ti costa un coperto e che margine fai. Aggancia il menu a un servizio per vedere il margine reale del preventivo." />
        <div className="flex gap-2 mb-5">
          {([['ing', 'Ingredienti', Carrot], ['rec', 'Ricette', BookOpen], ['menu', 'Menu', UtensilsCrossed]] as const).map(([k, l, Icon]) => (
            <Button key={k} variant={tab === k ? 'gold' : 'outline'} size="sm" onClick={() => setTab(k)}><Icon size={14} /> {l}</Button>
          ))}
        </div>
        {tab === 'ing' && <IngredientiTab />}
        {tab === 'rec' && <RicetteTab />}
        {tab === 'menu' && <MenuTab />}
      </div>
    </div>
  )
}

function IngredientiTab() {
  const { data: list } = useIngredients()
  const mut = useFoodCostMutations()
  const [name, setName] = useState(''); const [unit, setUnit] = useState('G'); const [yield_, setYield] = useState('100'); const [cat, setCat] = useState('')
  async function add() {
    if (name.trim().length < 2) { toast.error('Nome ingrediente'); return }
    try { await mut.addIngredient.mutateAsync({ name: name.trim(), stock_unit: unit, yield_percent: Number(yield_) || 100, category: cat.trim() || null }); setName(''); setCat(''); toast.success('Ingrediente aggiunto') }
    catch (e) { toast.error((e as Error).message) }
  }
  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Ingrediente<Input value={name} onChange={(e) => setName(e.target.value)} className="w-44 mt-0.5" placeholder="Farina 00" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Unità<Select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-24 mt-0.5"><option value="G">grammi</option><option value="ML">ml</option><option value="PZ">pezzi</option></Select></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Resa %<Input type="number" value={yield_} onChange={(e) => setYield(e.target.value)} className="w-20 mt-0.5" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Categoria<Input value={cat} onChange={(e) => setCat(e.target.value)} className="w-32 mt-0.5" placeholder="Farine" /></label>
        <Button size="sm" onClick={add}><Plus size={14} /> Aggiungi</Button>
      </Card>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] border-b border-[rgb(var(--border))]"><th className="p-2">Ingrediente</th><th className="p-2">Resa</th><th className="p-2">Costo</th><th className="p-2 w-10"></th></tr></thead>
          <tbody>
            {(list ?? []).map((i) => <IngredientRow key={i.id} ing={i} />)}
            {(list ?? []).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-[rgb(var(--fg-subtle))]">Nessun ingrediente. Aggiungine uno qui sopra.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
function IngredientRow({ ing }: { ing: FbIngredient }) {
  const mut = useFoodCostMutations()
  const [cost, setCost] = useState(ing.current_cost != null ? String(fromStock(ing.current_cost, ing.stock_unit)) : '')
  async function save() {
    const v = parseFloat(cost.replace(',', '.')); if (!(v > 0)) { toast.error('Costo non valido'); return }
    try { await mut.setCost.mutateAsync({ ingredient_id: ing.id, cost_per_unit: toStock(v, ing.stock_unit) }); toast.success('Costo aggiornato') }
    catch (e) { toast.error((e as Error).message) }
  }
  return (
    <tr className="border-b border-[rgb(var(--border))] last:border-0">
      <td className="p-2"><span className="font-medium">{ing.name}</span> {ing.category && <span className="text-[rgb(var(--fg-subtle))] text-xs">· {ing.category}</span>}</td>
      <td className="p-2 text-[rgb(var(--fg-muted))]">{ing.yield_percent}%</td>
      <td className="p-2"><div className="flex items-center gap-1"><Input value={cost} onChange={(e) => setCost(e.target.value)} className="w-24 h-8" placeholder="0,00" /><span className="text-xs text-[rgb(var(--fg-muted))]">€/{bigUnit(ing.stock_unit)}</span><Button size="sm" variant="outline" onClick={save}>OK</Button></div></td>
      <td className="p-2"><button onClick={() => { if (confirm(`Eliminare ${ing.name}?`)) mut.delIngredient.mutate(ing.id) }} className="text-[rgb(var(--rose-500))]"><Trash2 size={14} /></button></td>
    </tr>
  )
}

function RicetteTab() {
  const { data: recipes } = useRecipes()
  const { data: ings } = useIngredients()
  const mut = useFoodCostMutations()
  const [sel, setSel] = useState<string | null>(null)
  const [name, setName] = useState(''); const [yq, setYq] = useState('1'); const [yu, setYu] = useState('PZ')
  const ingMap = useMemo(() => new Map((ings ?? []).map((i) => [i.id, i])), [ings])
  const recipe = (recipes ?? []).find((r) => r.id === sel) ?? null
  function recipeCost(r: FbRecipe): number {
    return (r.items ?? []).reduce((s, it) => { if (!it.ingredient_id) return s; const ing = ingMap.get(it.ingredient_id); return s + it.qty * ((ing?.yield_percent ?? 100) / 100) * (ing?.current_cost ?? 0) }, 0)
  }
  async function add() { if (name.trim().length < 2) { toast.error('Nome ricetta'); return } try { await mut.addRecipe.mutateAsync({ name: name.trim(), yield_qty: Number(yq) || 1, yield_unit: yu }); setName(''); toast.success('Ricetta creata') } catch (e) { toast.error((e as Error).message) } }
  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4">
      <div className="space-y-3">
        <Card className="p-3 space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome ricetta (es. Impasto pizza)" />
          <div className="flex gap-2"><label className="text-[11px] text-[rgb(var(--fg-muted))] flex-1">Produce<Input type="number" value={yq} onChange={(e) => setYq(e.target.value)} className="mt-0.5" /></label><label className="text-[11px] text-[rgb(var(--fg-muted))]">Unità<Select value={yu} onChange={(e) => setYu(e.target.value)} className="mt-0.5"><option>PZ</option><option>G</option><option>ML</option><option value="PORZIONI">porzioni</option></Select></label></div>
          <Button size="sm" className="w-full" onClick={add}><Plus size={14} /> Crea ricetta</Button>
        </Card>
        <Card className="overflow-hidden">
          {(recipes ?? []).map((r) => (
            <button key={r.id} onClick={() => setSel(r.id)} className={`w-full text-left px-3 py-2 border-b border-[rgb(var(--border))] last:border-0 flex items-center justify-between ${sel === r.id ? 'bg-[rgb(var(--gold-100))]' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
              <span className="text-sm">{r.name}</span><span className="text-xs text-[rgb(var(--fg-muted))]">{eur(recipeCost(r))}</span>
            </button>
          ))}
          {(recipes ?? []).length === 0 && <p className="p-4 text-center text-xs text-[rgb(var(--fg-subtle))]">Nessuna ricetta.</p>}
        </Card>
      </div>
      <Card className="p-4">
        {!recipe ? <p className="text-sm text-[rgb(var(--fg-subtle))]">Seleziona una ricetta per modificarne gli ingredienti.</p> : (
          <RecipeEditor recipe={recipe} ings={ings ?? []} cost={recipeCost(recipe)} />
        )}
      </Card>
    </div>
  )
}
function RecipeEditor({ recipe, ings, cost }: { recipe: FbRecipe; ings: FbIngredient[]; cost: number }) {
  const mut = useFoodCostMutations()
  const ingMap = useMemo(() => new Map(ings.map((i) => [i.id, i])), [ings])
  const [ingId, setIngId] = useState(''); const [qty, setQty] = useState('')
  async function addItem() {
    const ing = ingMap.get(ingId); const q = parseFloat(qty.replace(',', '.'))
    if (!ing || !(q > 0)) { toast.error('Scegli ingrediente e quantità'); return }
    try { await mut.addRecipeItem.mutateAsync({ recipe_id: recipe.id, ingredient_id: ingId, qty: q, unit: ing.stock_unit }); setQty('') } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div><h3 className="font-display text-lg">{recipe.name}</h3><p className="text-xs text-[rgb(var(--fg-muted))]">Produce {recipe.yield_qty} {recipe.yield_unit} · costo totale <strong>{eur(cost)}</strong></p></div>
        <button onClick={() => { if (confirm('Eliminare la ricetta?')) mut.delRecipe.mutate(recipe.id) }} className="text-[rgb(var(--rose-500))]"><Trash2 size={16} /></button>
      </div>
      <div className="space-y-1 mb-3">
        {(recipe.items ?? []).filter((it) => it.ingredient_id).map((it) => { const ing = ingMap.get(it.ingredient_id!); return (
          <div key={it.id} className="flex items-center gap-2 text-sm py-1 border-b border-[rgb(var(--border))] last:border-0">
            <span className="flex-1">{ing?.name ?? '—'}</span>
            <span className="text-[rgb(var(--fg-muted))]">{it.qty} {ing?.stock_unit}</span>
            <span className="w-20 text-right">{eur(it.qty * ((ing?.yield_percent ?? 100) / 100) * (ing?.current_cost ?? 0))}</span>
            <button onClick={() => mut.delRecipeItem.mutate(it.id)} className="text-[rgb(var(--rose-500))]"><Trash2 size={13} /></button>
          </div>
        ) })}
        {(recipe.items ?? []).length === 0 && <p className="text-xs text-[rgb(var(--fg-subtle))]">Nessun ingrediente in ricetta.</p>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-[rgb(var(--fg-muted))] flex-1 min-w-[180px]">Ingrediente<Select value={ingId} onChange={(e) => setIngId(e.target.value)} className="mt-0.5"><option value="">Scegli…</option>{ings.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Quantità ({ingMap.get(ingId)?.stock_unit ?? 'g/ml/pz'})<Input value={qty} onChange={(e) => setQty(e.target.value)} className="w-28 mt-0.5" placeholder="600" /></label>
        <Button size="sm" onClick={addItem}><Plus size={14} /> Aggiungi</Button>
      </div>
    </div>
  )
}

function MenuTab() {
  const { data: menus } = useMenus()
  const { data: recipes } = useRecipes()
  const { data: services } = useMyServices()
  const mut = useFoodCostMutations()
  const [sel, setSel] = useState<string | null>(null)
  const [name, setName] = useState('')
  const menu = (menus ?? []).find((m) => m.id === sel) ?? null
  async function add() { if (name.trim().length < 2) { toast.error('Nome menu'); return } try { await mut.addMenu.mutateAsync({ name: name.trim() }); setName(''); toast.success('Menu creato') } catch (e) { toast.error((e as Error).message) } }
  return (
    <div className="grid md:grid-cols-[300px_1fr] gap-4">
      <div className="space-y-3">
        <Card className="p-3 space-y-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome menu (es. Menu Mare)" />
          <Button size="sm" className="w-full" onClick={add}><Plus size={14} /> Crea menu</Button>
          <Button size="sm" variant="outline" className="w-full" onClick={async () => { try { await mut.loadPreset.mutateAsync(undefined as never); toast.success('Buffet pronti caricati: giromano · isole · dolci. Modifica grammi e costi a piacere.') } catch (e) { toast.error((e as Error).message) } }}>Carica buffet pronti (giromano · isole · dolci)</Button>
          <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Grammature realistiche a ospite, già pronte. Le ritocchi tu.</p>
        </Card>
        <Card className="overflow-hidden">
          {(menus ?? []).map((m) => (
            <button key={m.id} onClick={() => setSel(m.id)} className={`w-full text-left px-3 py-2 border-b border-[rgb(var(--border))] last:border-0 ${sel === m.id ? 'bg-[rgb(var(--gold-100))]' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}><span className="text-sm">{m.name}</span></button>
          ))}
          {(menus ?? []).length === 0 && <p className="p-4 text-center text-xs text-[rgb(var(--fg-subtle))]">Nessun menu.</p>}
        </Card>
      </div>
      <Card className="p-4">
        {!menu ? <p className="text-sm text-[rgb(var(--fg-subtle))]">Seleziona un menu per comporlo e vederne il food cost.</p> : (
          <MenuEditor menu={menu} recipes={recipes ?? []} services={services ?? []} />
        )}
      </Card>
    </div>
  )
}
function MenuEditor({ menu, recipes, services }: { menu: FbMenu; recipes: FbRecipe[]; services: Array<{ id: string; name: string; base_price: number; unit: string }> }) {
  const mut = useFoodCostMutations()
  const [covers, setCovers] = useState(100)
  const [recId, setRecId] = useState(''); const [qpc, setQpc] = useState('1')
  const recMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
  const { data: fc } = useMenuFoodcost(menu.id, covers)
  const svc = services.find((s) => s.id === menu.service_id)
  const perCover = fc?.cost_per_cover ?? 0
  const price = svc?.base_price ?? 0
  const fcPct = price > 0 ? (perCover / price) * 100 : null
  async function addItem() { const r = recMap.get(recId); const q = parseFloat(qpc.replace(',', '.')); if (!r || !(q > 0)) { toast.error('Scegli ricetta e quantità'); return } try { await mut.addMenuItem.mutateAsync({ menu_id: menu.id, recipe_id: recId, qty_per_cover: q }); setQpc('1') } catch (e) { toast.error((e as Error).message) } }
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-lg">{menu.name}</h3>
        <button onClick={() => { if (confirm('Eliminare il menu?')) mut.delMenu.mutate(menu.id) }} className="text-[rgb(var(--rose-500))]"><Trash2 size={16} /></button>
      </div>

      <div className="rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ background: 'rgb(var(--gold-100))' }}>
        <div><p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Coperti</p><Input type="number" value={covers} onChange={(e) => setCovers(Math.max(1, Number(e.target.value) || 1))} className="h-8 mt-0.5" /></div>
        <div><p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Food cost / coperto</p><p className="font-display text-xl">{eur(perCover)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Food cost totale</p><p className="font-display text-xl">{eur(fc?.total_cost ?? 0)}</p></div>
        <div><p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Food cost %</p><p className={`font-display text-xl ${fcPct != null && fcPct > 35 ? 'text-[rgb(var(--rose-600))]' : ''}`}>{fcPct != null ? fcPct.toFixed(1) + '%' : '—'}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
        <Link2 size={14} className="text-[rgb(var(--fg-muted))]" />
        <span className="text-[rgb(var(--fg-muted))]">Servizio collegato:</span>
        <Select value={menu.service_id ?? ''} onChange={(e) => mut.linkMenuService.mutate({ id: menu.id, service_id: e.target.value || null })} className="w-56 h-8">
          <option value="">— nessuno —</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({eur(s.base_price)})</option>)}
        </Select>
        {svc && perCover > 0 && <span className="text-xs text-[rgb(var(--fg-muted))]">margine/coperto <strong>{eur(price - perCover)}</strong></span>}
      </div>

      <div className="space-y-1 mb-3">
        {(menu.items ?? []).map((it) => { const r = recMap.get(it.recipe_id); return (
          <div key={it.id} className="flex items-center gap-2 text-sm py-1 border-b border-[rgb(var(--border))] last:border-0">
            <span className="flex-1">{r?.name ?? '—'}</span>
            <span className="text-[rgb(var(--fg-muted))]">×{it.qty_per_cover} a coperto</span>
            <button onClick={() => mut.delMenuItem.mutate(it.id)} className="text-[rgb(var(--rose-500))]"><Trash2 size={13} /></button>
          </div>
        ) })}
        {(menu.items ?? []).length === 0 && <p className="text-xs text-[rgb(var(--fg-subtle))]">Nessuna ricetta nel menu.</p>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-[rgb(var(--fg-muted))] flex-1 min-w-[180px]">Ricetta<Select value={recId} onChange={(e) => setRecId(e.target.value)} className="mt-0.5"><option value="">Scegli…</option>{recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Per coperto<Input value={qpc} onChange={(e) => setQpc(e.target.value)} className="w-24 mt-0.5" /></label>
        <Button size="sm" onClick={addItem}><Plus size={14} /> Aggiungi</Button>
      </div>
    </div>
  )
}
