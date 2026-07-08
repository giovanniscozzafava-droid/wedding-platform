import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Hook del gestionale F&B (PRP-4 Fase A). RLS owner-only: location_id = auth.uid().
// NB: chiamata inline (supabase.from(t)) per non perdere il `this` (from() usa this.rest).
const sb = (t: string): any => (supabase as any).from(t)
async function uid(): Promise<string | null> { const { data } = await supabase.auth.getUser(); return data.user?.id ?? null }

export type FbIngredient = { id: string; name: string; category: string | null; stock_unit: 'G' | 'ML' | 'PZ'; yield_percent: number; current_cost: number | null }
export type FbRecipeItem = { id: string; recipe_id: string; ingredient_id: string | null; subrecipe_id: string | null; qty: number; unit: string }
export type FbRecipe = { id: string; name: string; yield_qty: number; yield_unit: string; is_subrecipe: boolean; items: FbRecipeItem[] }
export type FbMenuItem = { id: string; menu_id: string; recipe_id: string; qty_per_cover: number; course: string | null; sort_order: number }
export const COURSES: Array<{ key: string; label: string }> = [
  { key: 'APERITIVO', label: 'Aperitivo' }, { key: 'ANTIPASTO', label: 'Antipasti' }, { key: 'PRIMO', label: 'Primi' },
  { key: 'SECONDO', label: 'Secondi' }, { key: 'CONTORNO', label: 'Contorni' }, { key: 'DOLCE', label: 'Dolce' },
  { key: 'FRUTTA', label: 'Frutta' }, { key: 'BEVANDE', label: 'Bevande' },
]
export type FbMenu = { id: string; name: string; service_id: string | null; basis: string; items: FbMenuItem[] }

export function useIngredients() {
  return useQuery<FbIngredient[]>({
    queryKey: ['fb-ing'],
    queryFn: async () => {
      const { data, error } = await sb('fb_ingredients').select('*, fb_ingredient_cost_versions(cost_per_unit,valid_until)').eq('is_active', true).order('name')
      if (error) throw error
      return (data ?? []).map((i: any) => ({ ...i, current_cost: (i.fb_ingredient_cost_versions || []).find((c: any) => c.valid_until === null)?.cost_per_unit ?? null }))
    },
  })
}
export function useRecipes() {
  return useQuery<FbRecipe[]>({
    queryKey: ['fb-rec'],
    queryFn: async () => {
      const { data, error } = await sb('fb_recipes').select('*, items:fb_recipe_items!recipe_id(*)').order('name')
      if (error) throw error
      return (data ?? []) as FbRecipe[]
    },
  })
}
export function useMenus() {
  return useQuery<FbMenu[]>({
    queryKey: ['fb-menu'],
    queryFn: async () => {
      const { data, error } = await sb('fb_menus').select('*, items:fb_menu_items(*)').eq('is_active', true).order('name')
      if (error) throw error
      return (data ?? []) as FbMenu[]
    },
  })
}
// Servizi della location (per agganciare il menu → margine preventivo)
export function useMyServices() {
  return useQuery<Array<{ id: string; name: string; base_price: number; unit: string }>>({
    queryKey: ['fb-my-services'],
    queryFn: async () => {
      const id = await uid(); if (!id) return []
      const { data, error } = await sb('services').select('id,name,base_price,unit').eq('fornitore_id', id).eq('is_active', true).order('name')
      if (error) throw error
      return data ?? []
    },
  })
}
// Food cost GENERALE: costo a coperto di tutti i menu (vista listino/confronto)
export function useAllMenusFoodcost() {
  return useQuery<Array<{ menu_id: string; name: string; cost_per_cover: number; total_cost: number }>>({
    queryKey: ['fb-allfc'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('fb_all_menus_foodcost')
      if (error) throw error
      return data ?? []
    },
  })
}
// Food cost del menu (RPC SECURITY INVOKER)
export function useMenuFoodcost(menuId: string | null, covers: number) {
  return useQuery<{ total_cost: number; cost_per_cover: number } | null>({
    queryKey: ['fb-foodcost', menuId, covers],
    enabled: !!menuId && covers > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('fb_menu_foodcost', { p_menu_id: menuId, p_covers: covers })
      if (error) throw error
      return (data && data[0]) || { total_cost: 0, cost_per_cover: 0 }
    },
  })
}

// ── FASE B: fornitori, listini, eventi↔menu, fabbisogno ────────────────────
export type FbSupplier = { id: string; name: string; email: string | null; phone: string | null; min_order_value: number; products: Array<{ id: string; ingredient_id: string; pack_label: string; pack_qty_stock_unit: number; pack_price: number; is_preferred: boolean }> }
export function useSuppliers() {
  return useQuery<FbSupplier[]>({
    queryKey: ['fb-sup'],
    queryFn: async () => {
      const { data, error } = await sb('fb_suppliers').select('*, products:fb_supplier_products(*)').eq('is_active', true).order('name')
      if (error) throw error
      return (data ?? []) as FbSupplier[]
    },
  })
}
export type FbLocEvent = { id: string; title: string | null; date_from: string; guest_count: number | null; menus: Array<{ id: string; menu_id: string; covers: number | null; role: string; label: string | null }> }
export function useLocationEvents() {
  return useQuery<FbLocEvent[]>({
    queryKey: ['fb-events'],
    queryFn: async () => {
      const id = await uid(); if (!id) return []
      const { data, error } = await sb('calendar_entries').select('id, title, date_from, guest_count, menus:fb_event_menus(id, menu_id, covers, role, label)').eq('owner_id', id).order('date_from')
      if (error) throw error
      return (data ?? []) as FbLocEvent[]
    },
  })
}
// Costo per GRUPPO di coperti dell'evento (ospiti/bambini/professionisti/brigata)
export type EventCosting = { gruppi: Array<{ em_id: string; role: string; label: string | null; menu: string; coperti: number; total_cost: number; cost_per_cover: number }> }
export function useEventCosting(entryId: string | null, enabled: boolean) {
  return useQuery<EventCosting>({
    queryKey: ['fb-costing', entryId],
    enabled: enabled && !!entryId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('fb_event_costing', { p_entry: entryId })
      if (error) throw error
      return { gruppi: (data?.gruppi ?? []) as EventCosting['gruppi'] }
    },
  })
}
export type FbRequirement = { ingredient_id: string; ingredient_name: string; stock_unit: string; qty_needed: number; supplier_id: string | null; supplier_name: string | null; supplier_product_id: string | null; pack_label: string | null; pack_qty: number | null; packs_needed: number | null; pack_price: number | null; line_cost: number | null }
export function useRequirements(from: string, to: string, enabled: boolean, net = false) {
  return useQuery<FbRequirement[]>({
    queryKey: ['fb-req', from, to, net],
    enabled: enabled && !!from && !!to,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('fb_compute_requirements', { p_from: from, p_to: to, p_net: net })
      if (error) throw error
      return (data ?? []) as FbRequirement[]
    },
  })
}
export type FbLot = { id: string; ingredient_id: string; lot_code: string | null; qty_remaining: number; unit_cost: number; expiry_date: string | null; ingredient: { name: string; stock_unit: string } | null }
export function useStock() {
  return useQuery<FbLot[]>({
    queryKey: ['fb-stock'],
    queryFn: async () => {
      const { data, error } = await sb('fb_stock_lots').select('id, ingredient_id, lot_code, qty_remaining, unit_cost, expiry_date, ingredient:fb_ingredients(name, stock_unit)').gt('qty_remaining', 0).order('expiry_date', { nullsFirst: false })
      if (error) throw error
      return (data ?? []) as FbLot[]
    },
  })
}

export type FbAiWallet = { balance_eur: number; monthly_min_eur: number; active: boolean }
export function useAiWallet() {
  return useQuery<FbAiWallet | null>({
    queryKey: ['fb-ai-wallet'],
    queryFn: async () => {
      const id = await uid(); if (!id) return null
      const { data } = await sb('fb_ai_wallet').select('balance_eur, monthly_min_eur, active').eq('location_id', id).maybeSingle()
      return (data ?? null) as FbAiWallet | null
    },
  })
}

export type FbBrigadeMember = { id: string; full_name: string; role: string; reparto: string; phone: string | null; hourly_cost: number }
export function useBrigade() {
  return useQuery<FbBrigadeMember[]>({
    queryKey: ['fb-brigade'],
    queryFn: async () => {
      const { data, error } = await sb('fb_brigade_members').select('id, full_name, role, reparto, phone, hourly_cost').eq('active', true).order('reparto')
      if (error) throw error
      return (data ?? []) as FbBrigadeMember[]
    },
  })
}
export async function fetchEventSheet(entryId: string) {
  const { data, error } = await (supabase as any).rpc('fb_event_sheet', { p_entry: entryId })
  if (error) throw error
  return data
}
export async function fetchBrand(): Promise<{ businessName: string; primary: string | null }> {
  const id = await uid(); if (!id) return { businessName: 'Evento', primary: null }
  const { data } = await sb('profiles').select('business_name, full_name, brand_primary_color').eq('id', id).maybeSingle()
  return { businessName: data?.business_name || data?.full_name || 'Evento', primary: data?.brand_primary_color ?? null }
}

// Prova menu di un evento: proposte + ultima prova (token) + risultati voti
// Sistema A (voto/risultati via fb_tasting_votes) spento: qui restano solo le PROPOSTE di menu
// dell'evento (Sistema C: voto/conferma piatti avviene nella scheda Menu della dashboard evento).
export type EventTasting = {
  proposals: Array<{ menu_id: string; is_chosen: boolean; name: string }>
}
export function useEventTasting(entryId: string | null, enabled: boolean) {
  return useQuery<EventTasting>({
    queryKey: ['fb-tasting', entryId],
    enabled: enabled && !!entryId,
    queryFn: async () => {
      const { data: props } = await sb('fb_menu_proposals').select('menu_id, is_chosen, menu:fb_menus(name)').eq('entry_id', entryId)
      return { proposals: (props ?? []).map((p: any) => ({ menu_id: p.menu_id, is_chosen: p.is_chosen, name: p.menu?.name ?? '—' })) }
    },
  })
}

// ── Cantina bottiglie (regola "1 bottiglia ogni N coperti") ────────────────
export type FbCantina = { id: string; name: string; category: string; bottle_ml: number; cost_per_bottle: number; covers_per_bottle: number; stock_bottles: number; is_default: boolean }
export const CANTINA_CATS: Array<{ key: string; label: string }> = [
  { key: 'BOLLICINE', label: 'Bollicine' }, { key: 'BIANCO', label: 'Bianco' }, { key: 'ROSATO', label: 'Rosato' },
  { key: 'ROSSO', label: 'Rosso' }, { key: 'BIRRA', label: 'Birra' }, { key: 'AMARO', label: 'Amaro' },
  { key: 'ACQUA', label: 'Acqua' }, { key: 'ANALCOLICO', label: 'Analcolico' },
]
export function useCantina() {
  return useQuery<FbCantina[]>({
    queryKey: ['fb-cantina'],
    queryFn: async () => {
      const { data, error } = await sb('fb_cantina').select('id, name, category, bottle_ml, cost_per_bottle, covers_per_bottle, stock_bottles, is_default').eq('is_active', true).order('category').order('name')
      if (error) throw error
      return (data ?? []) as FbCantina[]
    },
  })
}
export type CantinaPlanRow = { cantina_id: string; nome: string; categoria: string; bottle_ml: number; coperti_per_bottiglia: number; bottiglie: number; giacenza: number; da_comprare: number; costo_bottiglia: number; costo_totale: number; costo_acquisto: number }
export async function fetchCantinaPlan(entryId: string): Promise<{ coperti: number; righe: CantinaPlanRow[] } | null> {
  const { data, error } = await (supabase as any).rpc('fb_event_cantina_plan', { p_entry: entryId })
  if (error) throw error
  if (!data || data.error) return null
  return { coperti: data.coperti ?? 0, righe: (data.righe ?? []) as CantinaPlanRow[] }
}
export async function consumeCantina(entryId: string) {
  const { data, error } = await (supabase as any).rpc('fb_cantina_consume_event', { p_entry: entryId })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data
}

// Piatti confermati dell'evento (per la composizione menu lato location)
export function useEventDishes(entryId: string | null, enabled: boolean) {
  return useQuery<string[]>({
    queryKey: ['fb-dishes', entryId],
    enabled: enabled && !!entryId,
    queryFn: async () => {
      const { data, error } = await sb('fb_event_dish').select('menu_item_id').eq('entry_id', entryId)
      if (error) throw error
      return (data ?? []).map((r: any) => r.menu_item_id as string)
    },
  })
}

export function useFoodCostMutations() {
  const qc = useQueryClient()
  const inv = () => { ['fb-ing', 'fb-rec', 'fb-menu', 'fb-foodcost', 'fb-allfc', 'fb-sup', 'fb-events', 'fb-costing', 'fb-dishes', 'fb-req', 'fb-stock', 'fb-ai-wallet', 'fb-brigade', 'fb-tasting', 'fb-cantina'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })) }
  const m = (fn: (p: any) => Promise<void>) => useMutation({ mutationFn: fn, onSuccess: inv })
  return {
    addIngredient: m(async (p: { name: string; stock_unit: string; yield_percent: number; category?: string | null }) => {
      const id = await uid(); const { error } = await sb('fb_ingredients').insert({ location_id: id, ...p }); if (error) throw error
    }),
    setCost: m(async (p: { ingredient_id: string; cost_per_unit: number }) => { const { error } = await sb('fb_ingredient_cost_versions').insert(p); if (error) throw error }),
    delIngredient: m(async (id: string) => { const { error } = await sb('fb_ingredients').update({ is_active: false }).eq('id', id); if (error) throw error }),
    addRecipe: m(async (p: { name: string; yield_qty: number; yield_unit: string }) => { const id = await uid(); const { error } = await sb('fb_recipes').insert({ location_id: id, ...p }); if (error) throw error }),
    delRecipe: m(async (id: string) => { const { error } = await sb('fb_recipes').delete().eq('id', id); if (error) throw error }),
    addRecipeItem: m(async (p: { recipe_id: string; ingredient_id: string; qty: number; unit: string }) => { const { error } = await sb('fb_recipe_items').insert(p); if (error) throw error }),
    delRecipeItem: m(async (id: string) => { const { error } = await sb('fb_recipe_items').delete().eq('id', id); if (error) throw error }),
    addMenu: m(async (p: { name: string; service_id?: string | null }) => { const id = await uid(); const { error } = await sb('fb_menus').insert({ location_id: id, ...p }); if (error) throw error }),
    loadPreset: m(async () => { const { data, error } = await (supabase as any).rpc('fb_load_isole_preset'); if (error) throw error; if (data?.error) throw new Error(data.error) }),
    // Fase B
    addSupplier: m(async (p: { name: string; email?: string | null; phone?: string | null; min_order_value?: number }) => { const id = await uid(); const { error } = await sb('fb_suppliers').insert({ location_id: id, ...p }); if (error) throw error }),
    delSupplier: m(async (id: string) => { const { error } = await sb('fb_suppliers').update({ is_active: false }).eq('id', id); if (error) throw error }),
    addSupplierProduct: m(async (p: { supplier_id: string; ingredient_id: string; pack_label: string; pack_qty_stock_unit: number; pack_price: number; is_preferred?: boolean }) => { const { error } = await sb('fb_supplier_products').insert(p); if (error) throw error }),
    delSupplierProduct: m(async (id: string) => { const { error } = await sb('fb_supplier_products').delete().eq('id', id); if (error) throw error }),
    setEventMenu: m(async (p: { entry_id: string; menu_id: string; covers: number | null; role?: string; label?: string | null }) => { const id = await uid(); const { error } = await sb('fb_event_menus').insert({ location_id: id, ...p }); if (error) throw error }),
    delEventMenu: m(async (id: string) => { const { error } = await sb('fb_event_menus').delete().eq('id', id); if (error) throw error }),
    addBrigadeMember: m(async (p: { full_name: string; role: string; reparto: string; phone?: string | null; hourly_cost?: number }) => { const id = await uid(); const { error } = await sb('fb_brigade_members').insert({ location_id: id, ...p }); if (error) throw error }),
    delBrigadeMember: m(async (id: string) => { const { error } = await sb('fb_brigade_members').update({ active: false }).eq('id', id); if (error) throw error }),
    confirmDish: m(async (p: { entry_id: string; menu_item_id: string; on: boolean }) => { const { data, error } = await (supabase as any).rpc('fb_dish_confirm', { p_entry: p.entry_id, p_menu_item_id: p.menu_item_id, p_on: p.on }); if (error) throw error; if (data?.error) throw new Error(data.error) }),
    addCantina: m(async (p: { name: string; category: string; bottle_ml: number; cost_per_bottle: number; covers_per_bottle: number; stock_bottles: number; is_default?: boolean }) => { const id = await uid(); const { error } = await sb('fb_cantina').insert({ location_id: id, ...p }); if (error) throw error }),
    updCantina: m(async (p: { id: string; patch: Record<string, unknown> }) => { const { error } = await sb('fb_cantina').update(p.patch).eq('id', p.id); if (error) throw error }),
    delCantina: m(async (id: string) => { const { error } = await sb('fb_cantina').update({ is_active: false }).eq('id', id); if (error) throw error }),
    // Bolla fornitore (JPG singola o PDF → pagine in JPEG) → Qwen-VL estrae le righe → lotti in magazzino
    importBolla: m(async (p: { base64: string; media_type: string } | { images: string[] }) => {
      const body = 'images' in p ? { images: p.images } : { base64: p.base64, media_type: p.media_type }
      const { data: ex, error: e1 } = await (supabase as any).functions.invoke('fb-read-bolla', { body })
      if (e1) throw new Error(e1.message)
      if (!ex?.ok) {
        const map: Record<string, string> = {
          no_ai_key: 'Chiave AI non configurata (DASHSCOPE_API_KEY).',
          no_credit: 'Credito AI esaurito: ricarica per leggere altri documenti.',
          forbidden: 'Solo le location possono importare documenti.',
          auth: 'Sessione scaduta, rientra e riprova.',
          ai_error: 'Documento non letto (errore del servizio AI).',
          parse: 'Non sono riuscito a interpretare il documento.',
          no_file: 'File mancante.',
        }
        throw new Error(map[ex?.error as string] ?? ('Lettura non riuscita: ' + (ex?.error ?? 'sconosciuto')))
      }
      const righe = ex.righe ?? []
      if (!righe.length) throw new Error('Nessuna riga merce riconosciuta nel documento')
      const { data: rec, error: e2 } = await (supabase as any).rpc('fb_receive_from_bolla', { p_lines: righe })
      if (e2) throw new Error(e2.message)
      if (rec?.error) throw new Error(rec.error)
    }),
    delMenu: m(async (id: string) => { const { error } = await sb('fb_menus').update({ is_active: false }).eq('id', id); if (error) throw error }),
    linkMenuService: m(async (p: { id: string; service_id: string | null }) => { const { error } = await sb('fb_menus').update({ service_id: p.service_id }).eq('id', p.id); if (error) throw error }),
    addMenuItem: m(async (p: { menu_id: string; recipe_id: string; qty_per_cover: number; course?: string | null }) => { const { error } = await sb('fb_menu_items').insert(p); if (error) throw error }),
    loadStructured: m(async () => { const { data, error } = await (supabase as any).rpc('fb_seed_structured_menus'); if (error) throw error; if (data?.error) throw new Error(data.error) }),
    proposeMenus: m(async (p: { entry_id: string; menu_ids: string[] }) => { const { data, error } = await (supabase as any).rpc('fb_propose_menus', { p_entry: p.entry_id, p_menu_ids: p.menu_ids }); if (error) throw error; if (data?.error) throw new Error(data.error) }),
    // createTasting / chooseMenu rimossi: Sistema A spento (voto/scelta ora nella scheda Menu → Sistema C).
    delMenuItem: m(async (id: string) => { const { error } = await sb('fb_menu_items').delete().eq('id', id); if (error) throw error }),
  }
}
