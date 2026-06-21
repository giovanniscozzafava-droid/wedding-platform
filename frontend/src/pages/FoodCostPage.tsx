import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Carrot, BookOpen, UtensilsCrossed, Plus, Trash2, Link2, Truck, CalendarDays, ShoppingCart, Boxes, AlertTriangle, FileUp } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import {
  useIngredients, useRecipes, useMenus, useMyServices, useMenuFoodcost, useFoodCostMutations,
  useSuppliers, useLocationEvents, useRequirements, useStock,
  type FbIngredient, type FbRecipe, type FbMenu, type FbSupplier,
} from '@/hooks/useFoodCost'

const eur = (n: number) => '€ ' + (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// l'ingrediente è in g/ml/pz; in UI mostriamo €/kg, €/L, €/pz (più leggibile)
const bigUnit = (u: string) => (u === 'G' ? 'kg' : u === 'ML' ? 'L' : 'pz')
const factor = (u: string) => (u === 'G' || u === 'ML' ? 1000 : 1)         // 1 kg = 1000 g
const toStock = (v: number, u: string) => v / factor(u)                      // €/kg → €/g
const fromStock = (c: number, u: string) => c * factor(u)                    // €/g → €/kg

export default function FoodCostPage() {
  const [tab, setTab] = useState<'ing' | 'rec' | 'menu' | 'sup' | 'ev' | 'fab' | 'mag'>('ing')
  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Gestionale ristorazione" title="Food cost & approvvigionamento"
          description="Ingredienti e costi → ricette → menu (food cost a coperto) → fornitori e listini → fabbisogno dagli eventi → lista spesa. Tutto connesso: dal menu dell'evento esce la spesa da fare." />
        <div className="flex flex-wrap gap-2 mb-5">
          {([['ing', 'Ingredienti', Carrot], ['rec', 'Ricette', BookOpen], ['menu', 'Menu', UtensilsCrossed], ['sup', 'Fornitori', Truck], ['ev', 'Eventi', CalendarDays], ['fab', 'Fabbisogno', ShoppingCart], ['mag', 'Magazzino', Boxes]] as const).map(([k, l, Icon]) => (
            <Button key={k} variant={tab === k ? 'gold' : 'outline'} size="sm" onClick={() => setTab(k)}><Icon size={14} /> {l}</Button>
          ))}
        </div>
        {tab === 'ing' && <IngredientiTab />}
        {tab === 'rec' && <RicetteTab />}
        {tab === 'menu' && <MenuTab />}
        {tab === 'sup' && <FornitoriTab />}
        {tab === 'ev' && <EventiTab />}
        {tab === 'fab' && <FabbisognoTab />}
        {tab === 'mag' && <MagazzinoTab />}
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

// ── FASE B ──────────────────────────────────────────────────────────────────
function FornitoriTab() {
  const { data: suppliers } = useSuppliers()
  const { data: ings } = useIngredients()
  const mut = useFoodCostMutations()
  const [name, setName] = useState(''); const [phone, setPhone] = useState('')
  async function add() { if (name.trim().length < 2) { toast.error('Nome fornitore'); return } try { await mut.addSupplier.mutateAsync({ name: name.trim(), phone: phone.trim() || null }); setName(''); setPhone(''); toast.success('Fornitore aggiunto') } catch (e) { toast.error((e as Error).message) } }
  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Fornitore<Input value={name} onChange={(e) => setName(e.target.value)} className="w-48 mt-0.5" placeholder="Molino Rossi" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Telefono<Input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-36 mt-0.5" /></label>
        <Button size="sm" onClick={add}><Plus size={14} /> Aggiungi</Button>
      </Card>
      {(suppliers ?? []).map((s) => <SupplierCard key={s.id} sup={s} ings={ings ?? []} />)}
      {(suppliers ?? []).length === 0 && <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Nessun fornitore. Aggiungine uno + i suoi listini (le confezioni d'acquisto).</Card>}
    </div>
  )
}
function SupplierCard({ sup, ings }: { sup: FbSupplier; ings: FbIngredient[] }) {
  const mut = useFoodCostMutations()
  const ingMap = useMemo(() => new Map(ings.map((i) => [i.id, i])), [ings])
  const [ingId, setIngId] = useState(''); const [label, setLabel] = useState(''); const [packQty, setPackQty] = useState(''); const [price, setPrice] = useState('')
  async function addProd() {
    const ing = ingMap.get(ingId); const q = parseFloat(packQty.replace(',', '.')); const pr = parseFloat(price.replace(',', '.'))
    if (!ing || !(q > 0) || !(pr > 0) || !label.trim()) { toast.error('Compila ingrediente, confezione, quantità e prezzo'); return }
    // packQty in kg/L/pz → stock_unit (g/ml/pz)
    const factor = ing.stock_unit === 'G' || ing.stock_unit === 'ML' ? 1000 : 1
    try { await mut.addSupplierProduct.mutateAsync({ supplier_id: sup.id, ingredient_id: ingId, pack_label: label.trim(), pack_qty_stock_unit: q * factor, pack_price: pr, is_preferred: true }); setLabel(''); setPackQty(''); setPrice('') } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div><h3 className="font-display text-lg">{sup.name}</h3>{sup.phone && <p className="text-xs text-[rgb(var(--fg-muted))]">{sup.phone}</p>}</div>
        <button onClick={() => { if (confirm(`Eliminare ${sup.name}?`)) mut.delSupplier.mutate(sup.id) }} className="text-[rgb(var(--rose-500))]"><Trash2 size={16} /></button>
      </div>
      <div className="space-y-1 mb-3">
        {(sup.products ?? []).map((pr) => { const ing = ingMap.get(pr.ingredient_id); const bu = ing?.stock_unit === 'G' ? 'kg' : ing?.stock_unit === 'ML' ? 'L' : 'pz'; const factor = ing?.stock_unit === 'G' || ing?.stock_unit === 'ML' ? 1000 : 1; return (
          <div key={pr.id} className="flex items-center gap-2 text-sm py-1 border-b border-[rgb(var(--border))] last:border-0">
            <span className="flex-1">{ing?.name ?? '—'} · <span className="text-[rgb(var(--fg-muted))]">{pr.pack_label}</span></span>
            <span className="text-[rgb(var(--fg-muted))]">{(pr.pack_qty_stock_unit / factor).toLocaleString('it-IT')} {bu} · {eur(pr.pack_price)}</span>
            <button onClick={() => mut.delSupplierProduct.mutate(pr.id)} className="text-[rgb(var(--rose-500))]"><Trash2 size={13} /></button>
          </div>
        ) })}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-[rgb(var(--fg-muted))] flex-1 min-w-[160px]">Ingrediente<Select value={ingId} onChange={(e) => setIngId(e.target.value)} className="mt-0.5"><option value="">Scegli…</option>{ings.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Confezione<Input value={label} onChange={(e) => setLabel(e.target.value)} className="w-28 mt-0.5" placeholder="Sacco 25kg" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Qtà ({ingMap.get(ingId)?.stock_unit === 'PZ' ? 'pz' : (ingMap.get(ingId)?.stock_unit === 'ML' ? 'L' : 'kg')})<Input value={packQty} onChange={(e) => setPackQty(e.target.value)} className="w-20 mt-0.5" placeholder="25" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Prezzo €<Input value={price} onChange={(e) => setPrice(e.target.value)} className="w-20 mt-0.5" placeholder="20" /></label>
        <Button size="sm" onClick={addProd}><Plus size={14} /> Listino</Button>
      </div>
    </Card>
  )
}

function EventiTab() {
  const { data: events } = useLocationEvents()
  const { data: menus } = useMenus()
  const mut = useFoodCostMutations()
  const menuMap = useMemo(() => new Map((menus ?? []).map((m) => [m.id, m])), [menus])
  return (
    <div className="space-y-3">
      <p className="text-xs text-[rgb(var(--fg-muted))]">Assegna a ogni evento il menu (costato) e i coperti: da qui esce il fabbisogno della spesa.</p>
      {(events ?? []).map((ev) => <EventRow key={ev.id} ev={ev} menus={menus ?? []} menuMap={menuMap} mut={mut} />)}
      {(events ?? []).length === 0 && <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Nessun evento.</Card>}
    </div>
  )
}
function EventRow({ ev, menus, menuMap, mut }: { ev: any; menus: FbMenu[]; menuMap: Map<string, FbMenu>; mut: ReturnType<typeof useFoodCostMutations> }) {
  const [menuId, setMenuId] = useState(''); const [covers, setCovers] = useState('')
  async function add() { if (!menuId) { toast.error('Scegli un menu'); return } try { await mut.setEventMenu.mutateAsync({ entry_id: ev.id, menu_id: menuId, covers: covers ? Number(covers) : null }); setMenuId(''); setCovers('') } catch (e) { toast.error((e as Error).message) } }
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div><p className="font-medium text-sm">{ev.title ?? 'Evento'}</p><p className="text-[11px] text-[rgb(var(--fg-subtle))]">{new Date(ev.date_from).toLocaleDateString('it-IT')}{ev.guest_count ? ` · ${ev.guest_count} coperti` : ''}</p></div>
        <div className="flex items-end gap-1.5">
          <Select value={menuId} onChange={(e) => setMenuId(e.target.value)} className="h-8 w-40"><option value="">+ menu…</option>{menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
          <Input value={covers} onChange={(e) => setCovers(e.target.value)} className="h-8 w-20" placeholder="coperti" />
          <Button size="sm" onClick={add}><Plus size={14} /></Button>
        </div>
      </div>
      {(ev.menus ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ev.menus.map((em: any) => (
            <span key={em.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[rgb(var(--gold-100))]">
              {menuMap.get(em.menu_id)?.name ?? 'menu'}{em.covers ? ` ×${em.covers}` : ''}
              <button onClick={() => mut.delEventMenu.mutate(em.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]">×</button>
            </span>
          ))}
        </div>
      )}
    </Card>
  )
}

function FabbisognoTab() {
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [go, setGo] = useState(false); const [net, setNet] = useState(true)
  const { data: req, isFetching } = useRequirements(from, to, go, net)
  const groups = useMemo(() => {
    const m = new Map<string, { name: string; rows: typeof req; total: number }>()
    for (const r of req ?? []) {
      const k = r.supplier_id ?? 'none'
      const g = m.get(k) ?? { name: r.supplier_name ?? '— senza fornitore (manca il listino) —', rows: [] as any, total: 0 }
      ;(g.rows as any).push(r); g.total += r.line_cost ?? 0; m.set(k, g)
    }
    return [...m.values()]
  }, [req])
  const grand = (req ?? []).reduce((s, r) => s + (r.line_cost ?? 0), 0)
  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Dal<Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setGo(false) }} className="mt-0.5" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Al<Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setGo(false) }} className="mt-0.5" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))] inline-flex items-center gap-1.5 pb-2"><input type="checkbox" checked={net} onChange={(e) => { setNet(e.target.checked); setGo(false) }} /> sottrai giacenza</label>
        <Button size="sm" onClick={() => setGo(true)} disabled={!from || !to}><ShoppingCart size={14} /> Calcola fabbisogno</Button>
        {go && req && <span className="text-sm ml-auto">Totale spesa: <strong>{eur(grand)}</strong></span>}
      </Card>
      {go && isFetching && <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Calcolo…</Card>}
      {go && req && req.length === 0 && <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Nessun fabbisogno nel periodo. Assegna menu+coperti agli eventi (tab Eventi).</Card>}
      {groups.map((g, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="px-4 py-2 border-b border-[rgb(var(--border))] flex items-center justify-between"><span className="font-medium text-sm inline-flex items-center gap-1.5"><Truck size={14} /> {g.name}</span><span className="text-sm">{eur(g.total)}</span></div>
          <table className="w-full text-sm">
            <tbody>
              {(g.rows as any[]).map((r, j) => (
                <tr key={j} className="border-b border-[rgb(var(--border))] last:border-0">
                  <td className="p-2">{r.ingredient_name}</td>
                  <td className="p-2 text-[rgb(var(--fg-muted))] text-right">{Number(r.qty_needed).toLocaleString('it-IT')} {r.stock_unit}</td>
                  <td className="p-2 text-right">{r.packs_needed ? `${r.packs_needed} × ${r.pack_label}` : <span className="text-[rgb(var(--rose-600))]">manca listino</span>}</td>
                  <td className="p-2 text-right font-medium">{r.line_cost != null ? eur(r.line_cost) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  )
}

// ── FASE C: Magazzino + Scadenziario ────────────────────────────────────────
function MagazzinoTab() {
  const { data: lots } = useStock()
  const mut = useFoodCostMutations()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    setBusy(true)
    try {
      const base64 = await new Promise<string>((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(f) })
      await mut.importBolla.mutateAsync({ base64, media_type: f.type || 'image/jpeg' })
      toast.success('Documento letto: merce caricata in magazzino')
    } catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }, [])
  const bigUnitOf = (u: string) => (u === 'G' ? 'kg' : u === 'ML' ? 'L' : 'pz')
  const fac = (u: string) => (u === 'G' || u === 'ML' ? 1000 : 1)
  const giacenze = useMemo(() => {
    const m = new Map<string, { name: string; unit: string; qty: number; value: number }>()
    for (const l of lots ?? []) {
      const g = m.get(l.ingredient_id) ?? { name: l.ingredient?.name ?? '—', unit: l.ingredient?.stock_unit ?? 'PZ', qty: 0, value: 0 }
      g.qty += l.qty_remaining; g.value += l.qty_remaining * l.unit_cost; m.set(l.ingredient_id, g)
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'it'))
  }, [lots])
  const totalValue = (lots ?? []).reduce((s, l) => s + l.qty_remaining * l.unit_cost, 0)
  const dated = (lots ?? []).filter((l) => l.expiry_date).slice().sort((a, b) => (a.expiry_date! < b.expiry_date! ? -1 : 1))
  const daysTo = (d: string) => Math.round((new Date(d).getTime() - today) / 86400000)
  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium inline-flex items-center gap-1.5"><FileUp size={15} /> Ricezione da documento</span>
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={onFile} />
        <Button size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Leggo il documento…' : 'Importa bolla / scontrino / fattura'}</Button>
        <span className="text-[11px] text-[rgb(var(--fg-subtle))]">PDF o foto: l'AI legge le righe e le carica in magazzino come lotti.</span>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
      <Card className="overflow-hidden">
        <div className="px-4 py-2 border-b border-[rgb(var(--border))] flex items-center justify-between"><span className="font-medium text-sm inline-flex items-center gap-1.5"><Boxes size={14} /> Giacenze</span><span className="text-sm">valore {eur(totalValue)}</span></div>
        <table className="w-full text-sm"><tbody>
          {giacenze.map((g, i) => (
            <tr key={i} className="border-b border-[rgb(var(--border))] last:border-0"><td className="p-2">{g.name}</td><td className="p-2 text-right text-[rgb(var(--fg-muted))]">{(g.qty / fac(g.unit)).toLocaleString('it-IT', { maximumFractionDigits: 2 })} {bigUnitOf(g.unit)}</td><td className="p-2 text-right">{eur(g.value)}</td></tr>
          ))}
          {giacenze.length === 0 && <tr><td className="p-6 text-center text-[rgb(var(--fg-subtle))]" colSpan={3}>Magazzino vuoto. La giacenza si carica ricevendo gli ordini.</td></tr>}
        </tbody></table>
      </Card>
      <Card className="overflow-hidden">
        <div className="px-4 py-2 border-b border-[rgb(var(--border))] font-medium text-sm inline-flex items-center gap-1.5"><AlertTriangle size={14} /> Scadenziario (FEFO)</div>
        <table className="w-full text-sm"><tbody>
          {dated.map((l) => { const d = daysTo(l.expiry_date!); const danger = d < 0; const warn = d >= 0 && d <= 7; const u = l.ingredient?.stock_unit ?? 'PZ'; return (
            <tr key={l.id} className="border-b border-[rgb(var(--border))] last:border-0" style={{ background: danger ? 'rgb(220 38 38 / 0.08)' : warn ? 'rgb(245 158 11 / 0.10)' : undefined }}>
              <td className="p-2">{l.ingredient?.name ?? '—'}{l.lot_code && <span className="text-[rgb(var(--fg-subtle))] text-xs"> · {l.lot_code}</span>}</td>
              <td className="p-2 text-right text-[rgb(var(--fg-muted))]">{(l.qty_remaining / fac(u)).toLocaleString('it-IT', { maximumFractionDigits: 2 })} {bigUnitOf(u)}</td>
              <td className="p-2 text-right text-xs">{new Date(l.expiry_date!).toLocaleDateString('it-IT')}<span className={danger ? 'text-[rgb(var(--rose-600))] font-medium' : warn ? 'text-[rgb(var(--gold-700))] font-medium' : 'text-[rgb(var(--fg-subtle))]'}> · {danger ? `scaduto ${-d}g fa` : `tra ${d}g`}</span></td>
            </tr>) })}
          {dated.length === 0 && <tr><td className="p-6 text-center text-[rgb(var(--fg-subtle))]" colSpan={3}>Nessun lotto con scadenza.</td></tr>}
        </tbody></table>
      </Card>
      </div>
    </div>
  )
}
