import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Hook del gestionale F&B (PRP-4 Fase A). RLS owner-only: location_id = auth.uid().
const sb = supabase.from as unknown as (t: string) => any
async function uid(): Promise<string | null> { const { data } = await supabase.auth.getUser(); return data.user?.id ?? null }

export type FbIngredient = { id: string; name: string; category: string | null; stock_unit: 'G' | 'ML' | 'PZ'; yield_percent: number; current_cost: number | null }
export type FbRecipeItem = { id: string; recipe_id: string; ingredient_id: string | null; subrecipe_id: string | null; qty: number; unit: string }
export type FbRecipe = { id: string; name: string; yield_qty: number; yield_unit: string; is_subrecipe: boolean; items: FbRecipeItem[] }
export type FbMenuItem = { id: string; menu_id: string; recipe_id: string; qty_per_cover: number }
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
      const { data, error } = await sb('fb_recipes').select('*, items:fb_recipe_items(*)').order('name')
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
export type FbLocEvent = { id: string; title: string | null; date_from: string; guest_count: number | null; menus: Array<{ id: string; menu_id: string; covers: number | null }> }
export function useLocationEvents() {
  return useQuery<FbLocEvent[]>({
    queryKey: ['fb-events'],
    queryFn: async () => {
      const id = await uid(); if (!id) return []
      const { data, error } = await sb('calendar_entries').select('id, title, date_from, guest_count, menus:fb_event_menus(id, menu_id, covers)').eq('owner_id', id).order('date_from')
      if (error) throw error
      return (data ?? []) as FbLocEvent[]
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

export function useFoodCostMutations() {
  const qc = useQueryClient()
  const inv = () => { ['fb-ing', 'fb-rec', 'fb-menu', 'fb-foodcost', 'fb-sup', 'fb-events', 'fb-req', 'fb-stock', 'fb-ai-wallet', 'fb-brigade'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })) }
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
    setEventMenu: m(async (p: { entry_id: string; menu_id: string; covers: number | null }) => { const id = await uid(); const { error } = await sb('fb_event_menus').insert({ location_id: id, ...p }); if (error) throw error }),
    delEventMenu: m(async (id: string) => { const { error } = await sb('fb_event_menus').delete().eq('id', id); if (error) throw error }),
    addBrigadeMember: m(async (p: { full_name: string; role: string; reparto: string; phone?: string | null; hourly_cost?: number }) => { const id = await uid(); const { error } = await sb('fb_brigade_members').insert({ location_id: id, ...p }); if (error) throw error }),
    delBrigadeMember: m(async (id: string) => { const { error } = await sb('fb_brigade_members').update({ active: false }).eq('id', id); if (error) throw error }),
    // Bolla fornitore (PDF/JPG) → Claude estrae le righe → lotti in magazzino
    importBolla: m(async (p: { base64: string; media_type: string }) => {
      const { data: ex, error: e1 } = await (supabase as any).functions.invoke('fb-read-bolla', { body: { base64: p.base64, media_type: p.media_type } })
      if (e1) throw new Error(e1.message)
      if (!ex?.ok) {
        const map: Record<string, string> = {
          no_ai_key: 'Chiave AI non configurata (ANTHROPIC_API_KEY).',
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
    addMenuItem: m(async (p: { menu_id: string; recipe_id: string; qty_per_cover: number }) => { const { error } = await sb('fb_menu_items').insert(p); if (error) throw error }),
    delMenuItem: m(async (id: string) => { const { error } = await sb('fb_menu_items').delete().eq('id', id); if (error) throw error }),
  }
}
