import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Carrot, BookOpen, UtensilsCrossed, Plus, Trash2, Link2, Truck, CalendarDays, ShoppingCart, Boxes, AlertTriangle, FileUp, ChefHat, FileText, Wine, ClipboardList } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import {
  useIngredients, useRecipes, useMenus, useMyServices, useMenuFoodcost, useFoodCostMutations,
  useSuppliers, useLocationEvents, useRequirements, useStock, useAiWallet, useBrigade, useAllMenusFoodcost, useEventTasting, useEventCosting,
  useCantina, CANTINA_CATS, fetchCantinaPlan, consumeCantina, useEventDishes,
  usePurchaseOrders, generatePurchaseOrders,
  useOpenStocktake, useStocktakeLines, openStocktake, saveStocktakeCount, closeStocktake,
  fetchEventSheet, fetchBrand, COURSES,
  type FbIngredient, type FbRecipe, type FbMenu, type FbSupplier, type FbBrigadeMember, type FbCantina, type CantinaPlanRow, type FbPO, type FbStocktake, type FbStocktakeLine,
} from '@/hooks/useFoodCost'
import { buildFoglioServizio } from '@/lib/foglioServizio'
import { buildListaSpesa } from '@/lib/listaSpesa'

const eur = (n: number) => '€ ' + (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
// l'ingrediente è in g/ml/pz; in UI mostriamo €/kg, €/L, €/pz (più leggibile)
const bigUnit = (u: string) => (u === 'G' ? 'kg' : u === 'ML' ? 'L' : 'pz')
const factor = (u: string) => (u === 'G' || u === 'ML' ? 1000 : 1)         // 1 kg = 1000 g
const toStock = (v: number, u: string) => v / factor(u)                      // €/kg → €/g
const fromStock = (c: number, u: string) => c * factor(u)                    // €/g → €/kg

export default function FoodCostPage() {
  const [tab, setTab] = useState<'ing' | 'rec' | 'menu' | 'cant' | 'sup' | 'ev' | 'fab' | 'mag' | 'inv' | 'brig'>('ing')
  return (
    <div className="min-h-full">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 py-10">
        <PageHeader eyebrow="Gestionale ristorazione" title="Food cost & approvvigionamento"
          description="Ingredienti e costi → ricette → menu (food cost a coperto) → fornitori e listini → fabbisogno dagli eventi → lista spesa. Tutto connesso: dal menu dell'evento esce la spesa da fare." />
        <div className="flex flex-wrap gap-2 mb-5">
          {([['ing', 'Ingredienti', Carrot], ['rec', 'Ricette', BookOpen], ['menu', 'Menu', UtensilsCrossed], ['cant', 'Cantina', Wine], ['sup', 'Fornitori', Truck], ['ev', 'Eventi', CalendarDays], ['fab', 'Fabbisogno', ShoppingCart], ['mag', 'Magazzino', Boxes], ['inv', 'Inventario', ClipboardList], ['brig', 'Brigata', ChefHat]] as const).map(([k, l, Icon]) => (
            <Button key={k} variant={tab === k ? 'gold' : 'outline'} size="sm" onClick={() => setTab(k)}><Icon size={14} /> {l}</Button>
          ))}
        </div>
        {tab === 'ing' && <IngredientiTab />}
        {tab === 'rec' && <RicetteTab />}
        {tab === 'menu' && <MenuTab />}
        {tab === 'cant' && <CantinaTab />}
        {tab === 'sup' && <FornitoriTab />}
        {tab === 'ev' && <EventiTab />}
        {tab === 'fab' && <FabbisognoTab />}
        {tab === 'mag' && <MagazzinoTab />}
        {tab === 'inv' && <InventarioTab />}
        {tab === 'brig' && <BrigataTab />}
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
  const { data: allFc } = useAllMenusFoodcost()
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
          <Button size="sm" variant="outline" className="w-full" onClick={async () => { try { await mut.loadStructured.mutateAsync(undefined as never); toast.success('Menu a fasce caricati: Argento · Oro · Platino (strutturati per portate).') } catch (e) { toast.error((e as Error).message) } }}>Carica menu a fasce (Argento · Oro · Platino)</Button>
          <Button size="sm" variant="outline" className="w-full" onClick={async () => { try { await mut.loadPreset.mutateAsync(undefined as never); toast.success('Buffet pronti caricati: giromano · isole · dolci.') } catch (e) { toast.error((e as Error).message) } }}>Carica buffet pronti (giromano · isole)</Button>
          <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Proposte strutturate per portate, già pronte. Le ritocchi tu.</p>
        </Card>
        {(allFc ?? []).length > 0 && (
          <Card className="overflow-hidden">
            <div className="px-3 py-2 border-b border-[rgb(var(--border))] text-xs font-medium inline-flex items-center gap-1.5"><UtensilsCrossed size={13} /> Food cost generale (€/coperto)</div>
            <table className="w-full text-xs"><tbody>
              {(allFc ?? []).map((m) => (
                <tr key={m.menu_id} className="border-b border-[rgb(var(--border))] last:border-0 cursor-pointer hover:bg-[rgb(var(--bg-sunken))]" onClick={() => setSel(m.menu_id)}>
                  <td className="px-3 py-1.5">{m.name}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{eur(m.cost_per_cover)}</td>
                </tr>
              ))}
            </tbody></table>
          </Card>
        )}
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
  const [recId, setRecId] = useState(''); const [qpc, setQpc] = useState('1'); const [course, setCourse] = useState('ANTIPASTO')
  const recMap = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
  const { data: fc } = useMenuFoodcost(menu.id, covers)
  const svc = services.find((s) => s.id === menu.service_id)
  const perCover = fc?.cost_per_cover ?? 0
  const price = svc?.base_price ?? 0
  const fcPct = price > 0 ? (perCover / price) * 100 : null
  async function addItem() { const r = recMap.get(recId); const q = parseFloat(qpc.replace(',', '.')); if (!r || !(q > 0)) { toast.error('Scegli ricetta e quantità'); return } try { await mut.addMenuItem.mutateAsync({ menu_id: menu.id, recipe_id: recId, qty_per_cover: q, course }); setQpc('1') } catch (e) { toast.error((e as Error).message) } }
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

      <div className="space-y-3 mb-3">
        {COURSES.filter((c) => (menu.items ?? []).some((it) => (it.course || 'ANTIPASTO') === c.key)).map((c) => (
          <div key={c.key}>
            <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--gold-700))] font-semibold mb-1">{c.label}</p>
            {(menu.items ?? []).filter((it) => (it.course || 'ANTIPASTO') === c.key).map((it) => { const r = recMap.get(it.recipe_id); return (
              <div key={it.id} className="flex items-center gap-2 text-sm py-1 border-b border-[rgb(var(--border))] last:border-0">
                <span className="flex-1">{r?.name ?? '—'}{it.qty_per_cover !== 1 && <span className="text-[rgb(var(--fg-subtle))] text-xs"> · a scelta</span>}</span>
                <span className="text-[rgb(var(--fg-muted))] text-xs">×{it.qty_per_cover}</span>
                <button onClick={() => mut.delMenuItem.mutate(it.id)} className="text-[rgb(var(--rose-500))]"><Trash2 size={13} /></button>
              </div>
            ) })}
          </div>
        ))}
        {(menu.items ?? []).length === 0 && <p className="text-xs text-[rgb(var(--fg-subtle))]">Nessuna portata nel menu.</p>}
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-[rgb(var(--border))] pt-3">
        <label className="text-[11px] text-[rgb(var(--fg-muted))] flex-1 min-w-[160px]">Ricetta<Select value={recId} onChange={(e) => setRecId(e.target.value)} className="mt-0.5"><option value="">Scegli…</option>{recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Portata<Select value={course} onChange={(e) => setCourse(e.target.value)} className="mt-0.5">{COURSES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Per coperto<Input value={qpc} onChange={(e) => setQpc(e.target.value)} className="w-20 mt-0.5" /></label>
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

// ── Cantina: catalogo bevande + regola "1 bottiglia ogni N coperti" ─────────
function CantinaTab() {
  const { data: cantina } = useCantina()
  const mut = useFoodCostMutations()
  const [name, setName] = useState(''); const [cat, setCat] = useState('ROSSO'); const [ml, setMl] = useState('750')
  const [cost, setCost] = useState(''); const [cpb, setCpb] = useState('3'); const [stock, setStock] = useState('0')
  async function add() {
    if (name.trim().length < 2) { toast.error('Nome bevanda'); return }
    try {
      await mut.addCantina.mutateAsync({ name: name.trim(), category: cat, bottle_ml: Number(ml) || 750, cost_per_bottle: parseFloat(cost.replace(',', '.')) || 0, covers_per_bottle: parseFloat(cpb.replace(',', '.')) || 3, stock_bottles: Number(stock) || 0, is_default: true })
      setName(''); setCost(''); setStock('0'); toast.success('Bevanda aggiunta')
    } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <div className="space-y-4">
      <p className="text-xs text-[rgb(var(--fg-muted))]">La cantina applica la regola <strong>1 bottiglia ogni N coperti</strong>: per ogni evento calcola bottiglie totali, giacenza e quante comprarne. Le bevande “di default” entrano automaticamente in ogni evento.</p>
      <Card className="p-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Bevanda<Input value={name} onChange={(e) => setName(e.target.value)} className="w-48 mt-0.5" placeholder="Cirò Rosso DOC" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Tipo<Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-28 mt-0.5">{CANTINA_CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">ml<Input type="number" value={ml} onChange={(e) => setMl(e.target.value)} className="w-20 mt-0.5" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">€/bott.<Input value={cost} onChange={(e) => setCost(e.target.value)} className="w-20 mt-0.5" placeholder="9,00" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">1 ogni<Input value={cpb} onChange={(e) => setCpb(e.target.value)} className="w-16 mt-0.5" placeholder="3" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Giacenza<Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-20 mt-0.5" /></label>
        <Button size="sm" onClick={add}><Plus size={14} /> Aggiungi</Button>
      </Card>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] border-b border-[rgb(var(--border))]"><th className="p-2">Bevanda</th><th className="p-2">Regola</th><th className="p-2">€/bott.</th><th className="p-2">Giacenza</th><th className="p-2">Default</th><th className="p-2 w-10"></th></tr></thead>
          <tbody>
            {(cantina ?? []).map((b) => <CantinaRow key={b.id} b={b} mut={mut} />)}
            {(cantina ?? []).length === 0 && <tr><td colSpan={6} className="p-6 text-center text-[rgb(var(--fg-subtle))]">Nessuna bevanda. Aggiungi le bottiglie della tua cantina.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
function CantinaRow({ b, mut }: { b: FbCantina; mut: ReturnType<typeof useFoodCostMutations> }) {
  const [stock, setStock] = useState(String(b.stock_bottles))
  const catLabel = CANTINA_CATS.find((c) => c.key === b.category)?.label ?? b.category
  return (
    <tr className="border-b border-[rgb(var(--border))] last:border-0">
      <td className="p-2"><span className="font-medium">{b.name}</span> <span className="text-[rgb(var(--fg-subtle))] text-xs">· {catLabel} · {b.bottle_ml}ml</span></td>
      <td className="p-2 text-[rgb(var(--fg-muted))]">1 ogni {b.covers_per_bottle} cop.</td>
      <td className="p-2">{eur(b.cost_per_bottle)}</td>
      <td className="p-2"><div className="flex items-center gap-1"><Input value={stock} onChange={(e) => setStock(e.target.value)} className="w-16 h-8" /><Button size="sm" variant="outline" onClick={() => mut.updCantina.mutate({ id: b.id, patch: { stock_bottles: Number(stock) || 0 } })}>OK</Button></div></td>
      <td className="p-2"><input type="checkbox" checked={b.is_default} onChange={(e) => mut.updCantina.mutate({ id: b.id, patch: { is_default: e.target.checked } })} /></td>
      <td className="p-2"><button onClick={() => { if (confirm(`Eliminare ${b.name}?`)) mut.delCantina.mutate(b.id) }} className="text-[rgb(var(--rose-500))]"><Trash2 size={14} /></button></td>
    </tr>
  )
}

function EventiTab() {
  const { data: events } = useLocationEvents()
  const { data: menus } = useMenus()
  const { data: recipes } = useRecipes()
  const mut = useFoodCostMutations()
  const menuMap = useMemo(() => new Map((menus ?? []).map((m) => [m.id, m])), [menus])
  const recipeName = useMemo(() => { const m = new Map((recipes ?? []).map((r) => [r.id, r.name])); return (id: string) => m.get(id) ?? '—' }, [recipes])
  return (
    <div className="space-y-3">
      <p className="text-xs text-[rgb(var(--fg-muted))]">Assegna a ogni evento uno o più menu con il <strong>gruppo di coperti</strong> (ospiti · bambini · professionisti/fornitori · brigata): ogni gruppo può avere il suo menu e i suoi coperti. Da qui esce il fabbisogno della spesa e lo scarico dispensa, sommando tutti i gruppi.</p>
      {(events ?? []).map((ev) => <EventRow key={ev.id} ev={ev} menus={menus ?? []} menuMap={menuMap} recipeName={recipeName} mut={mut} />)}
      {(events ?? []).length === 0 && <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Nessun evento.</Card>}
    </div>
  )
}
const EVENT_ROLES: Array<[string, string]> = [['OSPITI', 'Ospiti'], ['BAMBINI', 'Bambini'], ['PROFESSIONISTI', 'Professionisti/fornitori'], ['BRIGATA', 'Brigata']]
const roleLabel = (r: string) => EVENT_ROLES.find(([v]) => v === r)?.[1] ?? r
const roleTone: Record<string, string> = { OSPITI: 'bg-[rgb(var(--gold-100))]', BAMBINI: 'bg-[rgb(var(--sky-100,var(--gold-100)))]', PROFESSIONISTI: 'bg-[rgb(var(--sage-100,var(--gold-100)))]', BRIGATA: 'bg-[rgb(var(--bg-sunken))]' }

function EventRow({ ev, menus, menuMap, recipeName, mut }: { ev: any; menus: FbMenu[]; menuMap: Map<string, FbMenu>; recipeName: (id: string) => string; mut: ReturnType<typeof useFoodCostMutations> }) {
  const [menuId, setMenuId] = useState(''); const [covers, setCovers] = useState(''); const [role, setRole] = useState('OSPITI'); const [label, setLabel] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false); const [showProva, setShowProva] = useState(false); const [showCantina, setShowCantina] = useState(false); const [showCompose, setShowCompose] = useState(false)
  const hasMenus = (ev.menus ?? []).length > 0
  const { data: costing } = useEventCosting(ev.id, hasMenus)
  const grandTotal = (costing?.gruppi ?? []).reduce((s, g) => s + (g.total_cost ?? 0), 0)
  async function add() {
    if (!menuId) { toast.error('Scegli un menu'); return }
    try {
      await mut.setEventMenu.mutateAsync({ entry_id: ev.id, menu_id: menuId, covers: covers ? Number(covers) : null, role, label: label.trim() || null })
      setMenuId(''); setCovers(''); setLabel('')
    } catch (e) { toast.error((e as Error).message) }
  }
  async function foglio() {
    setPdfBusy(true)
    try {
      const [sheet, brand] = await Promise.all([fetchEventSheet(ev.id), fetchBrand()])
      if (!sheet || sheet.error) throw new Error('Aggancia prima un menu a questo evento')
      const doc = await buildFoglioServizio(sheet, brand)
      doc.save(`foglio-servizio-${(ev.title || 'evento').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.pdf`)
    } catch (e) { toast.error((e as Error).message) } finally { setPdfBusy(false) }
  }
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div><p className="font-medium text-sm">{ev.title ?? 'Evento'}</p><p className="text-[11px] text-[rgb(var(--fg-subtle))]">{new Date(ev.date_from).toLocaleDateString('it-IT')}{ev.guest_count ? ` · ${ev.guest_count} coperti` : ''}</p></div>
        <div className="flex items-end gap-1.5 flex-wrap justify-end">
          {hasMenus && <Button size="sm" variant="outline" onClick={foglio} disabled={pdfBusy}><FileText size={14} /> {pdfBusy ? '…' : 'Foglio PDF'}</Button>}
          <Select value={role} onChange={(e) => setRole(e.target.value)} className="h-8 w-36" title="Gruppo di coperti">{EVENT_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
          <Select value={menuId} onChange={(e) => setMenuId(e.target.value)} className="h-8 w-40"><option value="">+ menu…</option>{menus.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
          <Input value={covers} onChange={(e) => setCovers(e.target.value)} className="h-8 w-20" placeholder="coperti" />
          {role !== 'OSPITI' && <Input value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 w-32" placeholder="etichetta (es. fotografi)" />}
          <Button size="sm" onClick={add}><Plus size={14} /></Button>
        </div>
      </div>
      {hasMenus && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ev.menus.map((em: any) => (
            <span key={em.id} className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${roleTone[em.role] ?? 'bg-[rgb(var(--gold-100))]'}`}>
              {em.role && em.role !== 'OSPITI' && <strong className="uppercase tracking-wide">{roleLabel(em.role)}:</strong>}
              {menuMap.get(em.menu_id)?.name ?? 'menu'}{em.label ? ` · ${em.label}` : ''}{em.covers ? ` ×${em.covers}` : ''}
              <button onClick={() => mut.delEventMenu.mutate(em.id)} className="text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))]">×</button>
            </span>
          ))}
        </div>
      )}
      {(costing?.gruppi ?? []).length > 0 && (
        <div className="mt-2 rounded-lg border border-[rgb(var(--border))] overflow-hidden text-[11px]">
          <table className="w-full">
            <tbody>
              {costing!.gruppi.map((g) => (
                <tr key={g.em_id} className="border-b border-[rgb(var(--border))] last:border-0">
                  <td className="px-2 py-1">{roleLabel(g.role)}{g.label ? ` · ${g.label}` : ''}</td>
                  <td className="px-2 py-1 text-[rgb(var(--fg-subtle))]">{g.menu}</td>
                  <td className="px-2 py-1 text-right text-[rgb(var(--fg-muted))]">{g.coperti} cop.</td>
                  <td className="px-2 py-1 text-right">{eur(g.cost_per_cover)}/cop.</td>
                  <td className="px-2 py-1 text-right font-medium">{eur(g.total_cost)}</td>
                </tr>
              ))}
              <tr className="bg-[rgb(var(--bg-sunken))]"><td className="px-2 py-1 font-medium" colSpan={4}>Food cost totale evento (tutti i gruppi)</td><td className="px-2 py-1 text-right font-semibold">{eur(grandTotal)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-2 flex gap-4 flex-wrap">
        {hasMenus && <button onClick={() => setShowCompose((v) => !v)} className="text-xs text-[rgb(var(--gold-700))] font-medium inline-flex items-center gap-1"><UtensilsCrossed size={12} /> {showCompose ? '− Chiudi composizione' : 'Componi menu (piatti)'}</button>}
        <button onClick={() => setShowProva((v) => !v)} className="text-xs text-[rgb(var(--gold-700))] font-medium">{showProva ? '− Chiudi prova menu' : 'Prova menu & voti ospiti'}</button>
        <button onClick={() => setShowCantina((v) => !v)} className="text-xs text-[rgb(var(--gold-700))] font-medium inline-flex items-center gap-1"><Wine size={12} /> {showCantina ? '− Chiudi cantina' : 'Cantina & bottiglie'}</button>
      </div>
      {showCompose && <MenuComposePanel ev={ev} menuMap={menuMap} recipeName={recipeName} mut={mut} />}
      {showProva && <ProvaMenuPanel ev={ev} menus={menus} mut={mut} />}
      {showCantina && <CantinaEventPanel ev={ev} />}
    </Card>
  )
}

function MenuComposePanel({ ev, menuMap, recipeName, mut }: { ev: any; menuMap: Map<string, FbMenu>; recipeName: (id: string) => string; mut: ReturnType<typeof useFoodCostMutations> }) {
  const { data: confirmed } = useEventDishes(ev.id, true)
  const confSet = new Set(confirmed ?? [])
  const ospMenus = (ev.menus ?? []).filter((em: any) => (em.role ?? 'OSPITI') === 'OSPITI')
  if (!ospMenus.length) return <div className="mt-3 rounded-xl border border-[rgb(var(--border))] p-3 bg-[rgb(var(--bg-sunken))] text-sm text-[rgb(var(--fg-subtle))]">Assegna prima un menu al gruppo <strong>Ospiti</strong>, poi qui spunti i piatti che compongono il menu dell'evento.</div>
  return (
    <div className="mt-3 rounded-xl border border-[rgb(var(--border))] p-3 bg-[rgb(var(--bg-sunken))] space-y-3">
      <p className="text-[11px] text-[rgb(var(--fg-muted))]">Spunta i piatti del catalogo che entrano nel menu di questo evento: i confermati guidano food cost, fabbisogno e scarico dispensa. Nessun piatto spuntato = intero menu.</p>
      {ospMenus.map((em: any) => {
        const menu = menuMap.get(em.menu_id); if (!menu) return null
        const items = [...(menu.items ?? [])].sort((a, b) => (a.course ?? '').localeCompare(b.course ?? '') || (a.sort_order ?? 0) - (b.sort_order ?? 0))
        const confCount = items.filter((it) => confSet.has(it.id)).length
        return (
          <div key={em.id} className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2">
            <p className="text-xs font-medium mb-1">{menu.name} <span className="text-[rgb(var(--fg-subtle))]">· {confCount > 0 ? `${confCount} piatti scelti` : 'tutto il menu'}</span></p>
            {COURSES.map(({ key, label }) => {
              const courseItems = items.filter((it) => (it.course ?? '') === key)
              if (!courseItems.length) return null
              return (
                <div key={key} className="mt-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {courseItems.map((it) => {
                      const on = confSet.has(it.id)
                      return (
                        <label key={it.id} className={`text-[11px] px-2 py-1 rounded-full inline-flex items-center gap-1 cursor-pointer border ${on ? 'bg-[rgb(var(--gold-100))] border-[rgb(var(--gold-300))]' : 'border-[rgb(var(--border))]'}`}>
                          <input type="checkbox" checked={on} onChange={(e) => mut.confirmDish.mutate({ entry_id: ev.id, menu_item_id: it.id, on: e.target.checked })} />
                          {recipeName(it.recipe_id)}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function CantinaEventPanel({ ev }: { ev: any }) {
  const qc = useQueryClient()
  const [plan, setPlan] = useState<{ coperti: number; righe: CantinaPlanRow[] } | null>(null)
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false)
  async function load() { setLoading(true); try { setPlan(await fetchCantinaPlan(ev.id)) } catch (e) { toast.error((e as Error).message) } finally { setLoading(false) } }
  useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ev.id])
  async function scarica() {
    if (!confirm('Scaricare le bottiglie dalla cantina per questo evento? (idempotente)')) return
    setBusy(true)
    try { const r = await consumeCantina(ev.id); toast.success(`Cantina scaricata: ${r?.bevande_scaricate ?? 0} bevande`); qc.invalidateQueries({ queryKey: ['fb-cantina'] }); await load() }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const righe = plan?.righe ?? []
  const totBott = righe.reduce((s, r) => s + (r.bottiglie ?? 0), 0)
  const totBuy = righe.reduce((s, r) => s + (r.costo_acquisto ?? 0), 0)
  const totCost = righe.reduce((s, r) => s + (r.costo_totale ?? 0), 0)
  return (
    <div className="mt-3 rounded-xl border border-[rgb(var(--border))] p-3 bg-[rgb(var(--bg-sunken))]">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Piano cantina — {plan?.coperti ?? 0} coperti · {totBott} bottiglie</p>
        {righe.length > 0 && <Button size="sm" variant="outline" onClick={scarica} disabled={busy}><Wine size={13} /> {busy ? '…' : 'Scarica cantina'}</Button>}
      </div>
      {loading ? <p className="text-sm text-[rgb(var(--fg-subtle))]">Calcolo…</p>
        : righe.length === 0 ? <p className="text-sm text-[rgb(var(--fg-subtle))]">Nessuna bevanda “di default” in cantina. Aggiungile nel tab Cantina.</p>
        : (
        <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))] text-[11px] bg-[rgb(var(--bg))]">
          <table className="w-full">
            <thead><tr className="text-left text-[rgb(var(--fg-subtle))] border-b border-[rgb(var(--border))]"><th className="px-2 py-1">Bevanda</th><th className="px-2 py-1 text-right">Bottiglie</th><th className="px-2 py-1 text-right">Giacenza</th><th className="px-2 py-1 text-right">Da comprare</th><th className="px-2 py-1 text-right">Spesa</th></tr></thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.cantina_id} className="border-b border-[rgb(var(--border))] last:border-0">
                  <td className="px-2 py-1">{r.nome} <span className="text-[rgb(var(--fg-subtle))]">· 1 ogni {r.coperti_per_bottiglia}</span></td>
                  <td className="px-2 py-1 text-right font-medium">{r.bottiglie}</td>
                  <td className="px-2 py-1 text-right text-[rgb(var(--fg-muted))]">{r.giacenza}</td>
                  <td className="px-2 py-1 text-right">{r.da_comprare > 0 ? <span className="text-[rgb(var(--rose-600))] font-medium">{r.da_comprare}</span> : '—'}</td>
                  <td className="px-2 py-1 text-right">{eur(r.costo_acquisto)}</td>
                </tr>
              ))}
              <tr className="bg-[rgb(var(--bg-sunken))]"><td className="px-2 py-1 font-medium">Totale</td><td className="px-2 py-1 text-right font-medium">{totBott}</td><td></td><td className="px-2 py-1 text-right font-medium text-[rgb(var(--rose-600))]">{righe.reduce((s, r) => s + r.da_comprare, 0)}</td><td className="px-2 py-1 text-right font-semibold">{eur(totBuy)}</td></tr>
            </tbody>
          </table>
          <p className="px-2 py-1 text-[10px] text-[rgb(var(--fg-subtle))]">Valore cantina servita: {eur(totCost)} · da acquistare (oltre giacenza): {eur(totBuy)}</p>
        </div>
      )}
    </div>
  )
}

function ProvaMenuPanel({ ev, menus, mut }: { ev: any; menus: FbMenu[]; mut: ReturnType<typeof useFoodCostMutations> }) {
  const { data: t } = useEventTasting(ev.id, true)
  const [pick, setPick] = useState<Record<string, boolean>>({})
  const proposedIds = new Set((t?.proposals ?? []).map((p) => p.menu_id))
  async function propose() {
    const ids = Object.keys(pick).filter((k) => pick[k])
    if (!ids.length) { toast.error('Seleziona almeno un menu'); return }
    try { await mut.proposeMenus.mutateAsync({ entry_id: ev.id, menu_ids: ids }); setPick({}) } catch (e) { toast.error((e as Error).message) }
  }
  return (
    <div className="mt-3 rounded-xl border border-[rgb(var(--border))] p-3 space-y-3 bg-[rgb(var(--bg-sunken))]">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-1">Proponi i menu all'evento</p>
        <div className="flex flex-wrap gap-2">
          {menus.map((m) => proposedIds.has(m.id)
            ? <span key={m.id} className="text-[11px] px-2 py-1 rounded-full bg-[rgb(var(--gold-100))]">{m.name} ✓</span>
            : <label key={m.id} className="text-[11px] px-2 py-1 rounded-full border border-[rgb(var(--border))] inline-flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={!!pick[m.id]} onChange={(e) => setPick((p) => ({ ...p, [m.id]: e.target.checked }))} />{m.name}</label>)}
        </div>
        {menus.some((m) => !proposedIds.has(m.id)) && <Button size="sm" variant="outline" className="mt-2" onClick={propose}><Plus size={13} /> Proponi selezionati</Button>}
      </div>
      <div className="border-t border-[rgb(var(--border))] pt-3">
        <p className="text-sm text-[rgb(var(--fg-muted))]">
          Voto e conferma dei piatti — e il ribaltamento su food cost, fabbisogno e dispensa — avvengono nella <strong>scheda Menu</strong> della dashboard dell'evento: lì il cliente vota e conferma i singoli piatti.
        </p>
      </div>
    </div>
  )
}

function FabbisognoTab() {
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [go, setGo] = useState(false); const [net, setNet] = useState(true); const [gen, setGen] = useState(false)
  const { data: req, isFetching } = useRequirements(from, to, go, net)
  const qc = useQueryClient()
  async function genOrders() {
    if (!from || !to) { toast.error('Scegli il periodo'); return }
    setGen(true)
    try {
      const r = await generatePurchaseOrders(from, to)
      qc.invalidateQueries({ queryKey: ['fb-po'] })
      toast.success(`Lista spesa creata: ${r.ordini} ordini, ${r.righe} righe${r.senza_fornitore ? ` · ${r.senza_fornitore} ingredienti senza listino` : ''}`)
    } catch (e) { toast.error((e as Error).message) } finally { setGen(false) }
  }
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
        <Button size="sm" variant="outline" onClick={genOrders} disabled={!from || !to || gen}><FileText size={14} /> {gen ? 'Genero…' : 'Genera lista spesa (ordini)'}</Button>
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
      <OrdiniList />
    </div>
  )
}

const PO_STATUS: Record<string, string> = { BOZZA: 'Bozza', INVIATO: 'Inviato', RICEVUTO_PARZIALE: 'Ricevuto parz.', RICEVUTO: 'Ricevuto', ANNULLATO: 'Annullato' }
function OrdiniList() {
  const { data: orders } = usePurchaseOrders()
  const mut = useFoodCostMutations()
  const [busy, setBusy] = useState(false)
  const list = orders ?? []
  async function stampa() {
    const toPrint = list.filter((o) => o.status === 'BOZZA' || o.status === 'INVIATO')
    if (!toPrint.length) { toast.error('Nessun ordine bozza/inviato da stampare'); return }
    setBusy(true)
    try { const brand = await fetchBrand(); const doc = await buildListaSpesa(toPrint, brand); doc.save('lista-spesa.pdf') }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  if (!list.length) return null
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2 border-b border-[rgb(var(--border))] flex items-center justify-between">
        <span className="font-medium text-sm inline-flex items-center gap-1.5"><FileText size={14} /> Lista spesa · ordini ({list.length})</span>
        <Button size="sm" variant="outline" onClick={stampa} disabled={busy}><FileText size={13} /> {busy ? '…' : 'Stampa PDF per lo chef'}</Button>
      </div>
      <div className="divide-y divide-[rgb(var(--border))]">
        {list.map((o: FbPO) => (
          <div key={o.id} className="px-3 py-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-sm">
                <span className="font-medium">{o.supplier?.name ?? '— senza fornitore —'}</span>
                <span className="text-[rgb(var(--fg-subtle))] text-xs"> · {o.items?.length ?? 0} righe · {eur(o.total_cost)}{o.expected_date ? ` · entro ${new Date(o.expected_date).toLocaleDateString('it-IT')}` : ''}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${o.status === 'BOZZA' ? 'bg-[rgb(var(--bg-sunken))]' : 'bg-[rgb(var(--gold-100))]'}`}>{PO_STATUS[o.status] ?? o.status}</span>
                {o.status === 'BOZZA' && <Button size="sm" variant="outline" onClick={() => mut.setPOStatus.mutate({ id: o.id, status: 'INVIATO' })}>Invia allo chef</Button>}
                {o.status !== 'RICEVUTO' && <button onClick={() => { if (confirm('Eliminare questo ordine?')) mut.delPO.mutate(o.id) }} className="text-[rgb(var(--rose-500))]"><Trash2 size={14} /></button>}
              </div>
            </div>
            {o.items?.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-[rgb(var(--fg-muted))]">
                {o.items.map((it) => <span key={it.id} className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-sunken))]">{it.product?.ingredient?.name ?? '—'} · {it.qty_packs}× {it.product?.pack_label ?? ''}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

// ── Inventario fisico: la direzione conta col tablet, scarto vs teorico ─────
function InventarioTab() {
  const { data: open, isLoading } = useOpenStocktake()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  async function start() {
    setBusy(true)
    try { await openStocktake(); qc.invalidateQueries({ queryKey: ['fb-stocktake'] }) }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  if (isLoading) return <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Carico…</Card>
  if (!open) return (
    <Card className="p-8 text-center space-y-3">
      <ClipboardList size={28} className="mx-auto text-[rgb(var(--gold-500))]" />
      <p className="text-sm text-[rgb(var(--fg-muted))] max-w-md mx-auto">Nessun inventario in corso. Avvia una sessione: la direzione va in magazzino col tablet e conta le quantità <strong>reali</strong>. Il sistema le confronta col teorico (le “carte”), calcola lo <strong>scarto</strong> e alla chiusura rettifica i lotti al reale.</p>
      <Button onClick={start} disabled={busy}><ClipboardList size={15} /> {busy ? 'Preparo…' : 'Avvia inventario'}</Button>
    </Card>
  )
  return <StocktakeCounter st={open} />
}

function StocktakeCounter({ st }: { st: FbStocktake }) {
  const { data: lines } = useStocktakeLines(st.id, true)
  const qc = useQueryClient()
  const [local, setLocal] = useState<Record<string, string>>({})
  const [q, setQ] = useState(''); const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!lines) return
    setLocal((prev) => { const n = { ...prev }; for (const l of lines) if (!(l.id in n)) n[l.id] = l.counted_qty != null ? String(l.counted_qty / factor(l.ingredient?.stock_unit ?? 'PZ')) : ''; return n })
  }, [lines])
  async function save(l: FbStocktakeLine, raw: string) {
    const f = factor(l.ingredient?.stock_unit ?? 'PZ')
    const t = raw.trim(); const num = t === '' ? null : parseFloat(t.replace(',', '.'))
    if (t !== '' && (num == null || isNaN(num) || num < 0)) return
    try { await saveStocktakeCount(l.id, num == null ? null : num * f) } catch (e) { toast.error((e as Error).message) }
  }
  async function close() {
    if (!confirm('Chiudere l’inventario e rettificare il magazzino ai valori contati? I lotti verranno allineati al reale.')) return
    setBusy(true)
    try {
      const r = await closeStocktake(st.id)
      toast.success(`Inventario chiuso: ${r.righe_rettificate} rettifiche · scarto ${eur(r.scarto_valore)}`)
      qc.invalidateQueries({ queryKey: ['fb-stocktake'] }); qc.invalidateQueries({ queryKey: ['fb-stock'] }); qc.invalidateQueries({ queryKey: ['fb-stocktake-lines'] })
    } catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const all = lines ?? []
  const filtered = all.filter((l) => (l.ingredient?.name ?? '').toLowerCase().includes(q.toLowerCase()))
  const cats = [...new Set(filtered.map((l) => l.ingredient?.category ?? 'Altro'))].sort((a, b) => a.localeCompare(b, 'it'))
  const countedN = all.filter((l) => { const v = local[l.id]; return v !== undefined && v.trim() !== '' }).length
  const scarto = all.reduce((s, l) => {
    const v = local[l.id]; if (v === undefined || v.trim() === '') return s
    const c = parseFloat(v.replace(',', '.')); if (isNaN(c)) return s
    return s + (c * factor(l.ingredient?.stock_unit ?? 'PZ') - l.theoretical_qty) * (l.unit_cost ?? 0)
  }, 0)
  return (
    <div className="space-y-3">
      <Card className="p-3 flex flex-wrap items-center gap-3 sticky top-2 z-10">
        <span className="text-sm font-medium inline-flex items-center gap-1.5"><ClipboardList size={15} /> Inventario · {st.warehouse?.name ?? 'Magazzino'}</span>
        <span className="text-xs text-[rgb(var(--fg-subtle))]">{countedN}/{all.length} contati</span>
        <span className={`text-sm ${scarto < 0 ? 'text-[rgb(var(--rose-600))]' : scarto > 0 ? 'text-[rgb(var(--gold-700))]' : ''}`}>Scarto: <strong>{eur(scarto)}</strong></span>
        <div className="ml-auto flex items-center gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca…" className="h-8 w-36" />
          <Button size="sm" onClick={close} disabled={busy || countedN === 0}>{busy ? 'Chiudo…' : 'Chiudi e rettifica'}</Button>
        </div>
      </Card>
      {cats.map((cat) => (
        <Card key={cat} className="overflow-hidden">
          <div className="px-3 py-1.5 border-b border-[rgb(var(--border))] text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] bg-[rgb(var(--bg-sunken))]">{cat}</div>
          <div className="divide-y divide-[rgb(var(--border))]">
            {filtered.filter((l) => (l.ingredient?.category ?? 'Altro') === cat).map((l) => {
              const u = l.ingredient?.stock_unit ?? 'PZ'; const f = factor(u)
              const teoBig = l.theoretical_qty / f
              const v = local[l.id] ?? ''
              const c = v.trim() === '' ? null : parseFloat(v.replace(',', '.'))
              const dBig = c != null && !isNaN(c) ? c - teoBig : null
              return (
                <div key={l.id} className="px-3 py-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{l.ingredient?.name ?? '—'}</p>
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))]">teorico {teoBig.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {bigUnit(u)}</p>
                  </div>
                  {dBig != null && Math.abs(dBig) > 1e-9 && <span className={`text-[11px] px-2 py-0.5 rounded-full ${dBig < 0 ? 'bg-[rgb(var(--rose-100))] text-[rgb(var(--rose-700))]' : 'bg-[rgb(var(--gold-100))]'}`}>{dBig > 0 ? '+' : ''}{dBig.toLocaleString('it-IT', { maximumFractionDigits: 2 })} {bigUnit(u)}</span>}
                  <div className="flex items-center gap-1">
                    <Input value={v} onChange={(e) => setLocal((p) => ({ ...p, [l.id]: e.target.value }))} onBlur={(e) => save(l, e.target.value)} inputMode="decimal" className="h-9 w-24 text-right" placeholder="reale" />
                    <span className="text-xs text-[rgb(var(--fg-muted))] w-6">{bigUnit(u)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ))}
      {all.length === 0 && <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Nessun ingrediente attivo da contare.</Card>}
    </div>
  )
}

// ── FASE C: Magazzino + Scadenziario ────────────────────────────────────────
function MagazzinoTab() {
  const { data: lots } = useStock()
  const { data: wallet } = useAiWallet()
  const mut = useFoodCostMutations()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const noCredit = wallet != null && wallet.balance_eur <= 0
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    setBusy(true)
    try {
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
      if (isPdf) {
        // Qwen-VL legge immagini, non PDF: rasterizzo le pagine (max 10) in JPEG lato browser.
        const { loadPdf, renderPdfPageDataUrl } = await import('../lib/pdf')
        const pdf = await loadPdf(await f.arrayBuffer())
        const n = Math.min(pdf.numPages, 10)
        const images: string[] = []
        for (let p = 1; p <= n; p++) images.push(await renderPdfPageDataUrl(pdf, p, 1600, 0.85))
        await mut.importBolla.mutateAsync({ images })
      } else {
        const base64 = await new Promise<string>((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result)); rd.onerror = rej; rd.readAsDataURL(f) })
        await mut.importBolla.mutateAsync({ base64, media_type: f.type || 'image/jpeg' })
      }
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
        <Button size="sm" disabled={busy || noCredit} onClick={() => fileRef.current?.click()}>{busy ? 'Leggo il documento…' : 'Importa bolla / scontrino / fattura'}</Button>
        {wallet != null && (
          <span className={`text-xs px-2 py-1 rounded-full ${noCredit ? 'bg-[rgb(var(--rose-100))] text-[rgb(var(--rose-700))]' : 'bg-[rgb(var(--gold-100))]'}`}>
            Credito AI {eur(wallet.balance_eur)}{noCredit && ' · esaurito, ricarica'}
          </span>
        )}
        <span className="text-[11px] text-[rgb(var(--fg-subtle))]">PDF o foto: l'AI legge le righe e le carica in magazzino. Ogni lettura scala i token dal credito.</span>
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

// ── BRIGATA ─────────────────────────────────────────────────────────────────
function BrigataTab() {
  const { data: brigata } = useBrigade()
  const mut = useFoodCostMutations()
  const [nome, setNome] = useState(''); const [ruolo, setRuolo] = useState(''); const [reparto, setReparto] = useState('CUCINA'); const [tel, setTel] = useState('')
  async function add() {
    if (nome.trim().length < 2 || ruolo.trim().length < 2) { toast.error('Nome e ruolo'); return }
    try { await mut.addBrigadeMember.mutateAsync({ full_name: nome.trim(), role: ruolo.trim(), reparto, phone: tel.trim() || null }); setNome(''); setRuolo(''); setTel('') } catch (e) { toast.error((e as Error).message) }
  }
  const reparti = [['CUCINA', 'Cucina'], ['SALA', 'Sala'], ['BAR', 'Bar'], ['PLONGE', 'Lavaggio']] as const
  return (
    <div className="space-y-4">
      <Card className="p-3 flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Nome<Input value={nome} onChange={(e) => setNome(e.target.value)} className="w-44 mt-0.5" placeholder="Mario Rossi" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Ruolo<Input value={ruolo} onChange={(e) => setRuolo(e.target.value)} className="w-40 mt-0.5" placeholder="Cameriere" /></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Reparto<Select value={reparto} onChange={(e) => setReparto(e.target.value)} className="mt-0.5">{reparti.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></label>
        <label className="text-[11px] text-[rgb(var(--fg-muted))]">Telefono<Input value={tel} onChange={(e) => setTel(e.target.value)} className="w-32 mt-0.5" /></label>
        <Button size="sm" onClick={add}><Plus size={14} /> Aggiungi</Button>
      </Card>
      {reparti.map(([k, l]) => {
        const mem = (brigata ?? []).filter((b: FbBrigadeMember) => b.reparto === k)
        if (!mem.length) return null
        return (
          <Card key={k} className="overflow-hidden">
            <div className="px-4 py-2 border-b border-[rgb(var(--border))] font-medium text-sm inline-flex items-center gap-1.5"><ChefHat size={14} /> {l} ({mem.length})</div>
            <table className="w-full text-sm"><tbody>
              {mem.map((p: FbBrigadeMember) => (
                <tr key={p.id} className="border-b border-[rgb(var(--border))] last:border-0">
                  <td className="p-2 font-medium">{p.role}</td><td className="p-2">{p.full_name}</td>
                  <td className="p-2 text-right text-[rgb(var(--fg-muted))]">{p.phone || ''}</td>
                  <td className="p-2 text-right w-8"><button onClick={() => mut.delBrigadeMember.mutate(p.id)} className="text-[rgb(var(--rose-500))]"><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody></table>
          </Card>
        )
      })}
      {(brigata ?? []).length === 0 && <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Nessun membro. Aggiungi la tua brigata (cucina, sala, bar, lavaggio).</Card>}
      <p className="text-[11px] text-[rgb(var(--fg-subtle))]">La brigata entra nel <strong>Foglio di servizio PDF</strong> di ogni evento (tab Eventi → Foglio PDF), insieme a piatti, fabbisogno, prelievo magazzino e tavoli.</p>
    </div>
  )
}
