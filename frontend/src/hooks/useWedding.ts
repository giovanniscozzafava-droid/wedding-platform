import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

// Campi sensibili spostati in calendar_entries_private (split P5): ri-appiattiti
// nel risultato per i consumer owner/coppia.
type WeddingPrivate = { client_name: string | null; client_email: string | null; notes: string | null; value_amount: number | null }
const PRIV_SELECT = 'calendar_entries_private(client_name, client_email, notes, value_amount)'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function flattenPrivate(row: any): any {
  if (!row) return row
  const { calendar_entries_private: p, ...rest } = row
  return { ...rest, ...(p ?? {}) }
}

export type WeddingRow = Database['public']['Tables']['calendar_entries']['Row'] & Partial<WeddingPrivate> & {
  quote: (Pick<Database['public']['Tables']['quotes']['Row'],
    'id' | 'title' | 'status' | 'total_client' | 'access_token' | 'pdf_url' | 'revision'> & {
    quote_items?: Array<{ count: number }>
  }) | null
}

export function useWeddings() {
  return useQuery<WeddingRow[]>({
    queryKey: ['weddings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_entries')
        .select(`
          *,
          ${PRIV_SELECT},
          quote:quotes!calendar_entries_quote_fk(id, title, status, total_client, access_token, pdf_url, revision)
        `)
        .in('status', ['OPZIONATA', 'CONFERMATA', 'IN_TRATTATIVA'])
        .order('date_from', { ascending: true })
      if (error) throw error
      const base = (data ?? []).map((r) => flattenPrivate(r as Record<string, unknown>)) as unknown as WeddingRow[]
      // D-CAL-4: il fornitore-collaboratore non legge piu' la riga base (niente titolo
      // libero). Recupera gli eventi collaborati dalla view mascherata "Tipo · data".
      const seen = new Set(base.map((r) => r.id))
      const collab = await (supabase.from('calendar_entries_collab' as never) as any)
        .select('*')
        .in('status', ['OPZIONATA', 'CONFERMATA', 'IN_TRATTATIVA'])
        .order('date_from', { ascending: true })
      const extra = ((collab.data ?? []) as unknown as WeddingRow[]).filter((r) => !seen.has(r.id))
      return [...base, ...extra].sort((a, b) => (a.date_from ?? '').localeCompare(b.date_from ?? ''))
    },
  })
}

export function useWedding(entryId: string | null) {
  return useQuery({
    queryKey: ['wedding', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_entries')
        .select(`
          *,
          ${PRIV_SELECT},
          owner:profiles!calendar_entries_owner_id_fkey(id, full_name, business_name, subrole, role),
          quote:quotes!calendar_entries_quote_fk(id, owner_id, title, client_name, client_email, event_date, guest_count, status, revision, access_token, total_client, pdf_url, pdf_variant, sent_at, accepted_at, rejected_at, rejection_reason, sent_email_log, client_response_log, created_at, updated_at, table_count, direct_client_id, event_location, event_kind, access_token_expires_at, forced_without_questionnaire, token_hash, token_revoked_at, token_consumed_at, quote_origin, quote_context, first_opened_at, last_opened_at, open_count, total_discount_percent, total_discount_amount, subtotal_client, followup_count, last_followup_at, archived_at, date_contested_notified_at, funnel_paused, closed_at, quote_items(id, quote_id, service_id, supplier_id, name_snapshot, description_snapshot, unit_snapshot, quantity, modifiers_applied, line_client, sort_order, created_at, updated_at, quantity_basis, is_optional, alternative_group, selected_by_client, client_selected_at, payment_status, paid_amount, paid_at, payment_method, supplier_confirmed_at, supplier_confirmed_by, erogatore_e_capostipite, supplier_presence, item_discount_percent, client_decision, client_decided_at, client_decline_reason, supplier:profiles!quote_items_supplier_id_fkey(id, full_name, business_name, subrole))),
          calendar_entry_participants(*, user:profiles!calendar_entry_participants_user_id_fkey(id, full_name, business_name, subrole))
        `)
        .eq('id', entryId!)
        .maybeSingle()
      if (error) throw error
      // D-CAL-4: se la riga base non e' leggibile (fornitore-collaboratore: niente
      // policy diretta), ripiega sulla view mascherata "Tipo · data" (titolo redatto).
      if (!data) {
        const { data: masked } = await (supabase.from('calendar_entries_collab' as never) as any)
          .select('*')
          .eq('id', entryId!)
          .maybeSingle()
        return masked ?? null
      }
      return flattenPrivate(data as Record<string, unknown> | null)
    },
  })
}

// Timeline
export function useTimeline(entryId: string | null) {
  return useQuery({
    queryKey: ['timeline', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_timeline')
        .select('*, supplier:profiles(id, business_name, full_name, subrole)')
        .eq('entry_id', entryId!)
        .order('ord', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useTimelineMutations(entryId: string) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['timeline', entryId] })
  return {
    add: useMutation({
      mutationFn: async (input: Partial<Database['public']['Tables']['event_timeline']['Insert']>) => {
        const { data, error } = await supabase.from('event_timeline').insert({ entry_id: entryId, title: 'Nuovo step', ...input }).select().single()
        if (error) throw error
        return data
      },
      onSuccess: inv,
    }),
    update: useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: Partial<Database['public']['Tables']['event_timeline']['Update']> }) => {
        const { error } = await supabase.from('event_timeline').update(patch).eq('id', id)
        if (error) throw error
      },
      onSuccess: inv,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('event_timeline').delete().eq('id', id)
        if (error) throw error
      },
      onSuccess: inv,
    }),
  }
}

// Tables + Guests
export function useTables(entryId: string | null) {
  return useQuery({
    queryKey: ['tables', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('event_tables').select('*').eq('entry_id', entryId!).order('table_no')
      if (error) throw error
      return data ?? []
    },
  })
}
export function useGuests(entryId: string | null) {
  return useQuery({
    queryKey: ['guests', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('event_guests').select('*').eq('entry_id', entryId!)
        .order('sort_order', { nullsFirst: false }).order('full_name')
      if (error) throw error
      return data ?? []
    },
  })
}

function genericMutations(table: string, key: string, entryId: string) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: [key, entryId] })
  return {
    add: useMutation({
      mutationFn: async (input: any) => {
        const { data, error } = await (supabase.from(table as any) as any).insert({ entry_id: entryId, ...input }).select().single()
        if (error) throw error
        return data
      },
      onSuccess: inv,
    }),
    update: useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
        const { error } = await (supabase.from(table as any) as any).update(patch).eq('id', id)
        if (error) throw error
      },
      onSuccess: inv,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await (supabase.from(table as any) as any).delete().eq('id', id)
        if (error) throw error
      },
      onSuccess: inv,
    }),
  }
}

export const useTableMutations = (entryId: string) => genericMutations('event_tables', 'tables', entryId)
export const useGuestMutations = (entryId: string) => genericMutations('event_guests', 'guests', entryId)
export const useTaskMutations = (entryId: string) => genericMutations('wedding_tasks', 'tasks', entryId)
export const useMoodMutations = (entryId: string) => genericMutations('mood_images', 'mood', entryId)
export const usePlaylistMutations = (entryId: string) => genericMutations('event_playlist', 'playlist', entryId)
export const useBudgetCatMutations = (entryId: string) => genericMutations('budget_categories', 'budget-cats', entryId)
export const useBudgetEntryMutations = (entryId: string) => genericMutations('budget_entries', 'budget-entries', entryId)
export const useAccommodationMutations = (entryId: string) => genericMutations('event_accommodations', 'accommodations', entryId)
export const useTransportMutations = (entryId: string) => genericMutations('event_transport', 'transport', entryId)
export const useGadgetMutations = (entryId: string) => genericMutations('event_gadgets', 'gadgets', entryId)
export const useSubEventMutations = (entryId: string) => genericMutations('event_subevents', 'subevents', entryId)

export function useAccommodations(entryId: string | null) {
  return useQuery({
    queryKey: ['accommodations', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('event_accommodations').select('*').eq('entry_id', entryId!).order('checkin_date')
      if (error) throw error
      return data ?? []
    },
  })
}
export function useTransport(entryId: string | null) {
  return useQuery({
    queryKey: ['transport', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('event_transport').select('*').eq('entry_id', entryId!).order('depart_at')
      if (error) throw error
      return data ?? []
    },
  })
}
export function useGadgets(entryId: string | null) {
  return useQuery({
    queryKey: ['gadgets', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('event_gadgets').select('*').eq('entry_id', entryId!).order('kind').order('updated_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}
export function useSubEvents(entryId: string | null) {
  return useQuery({
    queryKey: ['subevents', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('event_subevents').select('*').eq('entry_id', entryId!).order('date_at')
      if (error) throw error
      return data ?? []
    },
  })
}
export function useUpdateWedding(entryId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: any) => {
      // Split P5: i campi sensibili vanno in calendar_entries_private.
      const PK = ['client_name', 'client_email', 'notes', 'value_amount']
      const priv: any = {}; const base: any = {}
      for (const k of Object.keys(patch ?? {})) { (PK.includes(k) ? priv : base)[k] = patch[k] }
      if (Object.keys(priv).length > 0) {
        const { error: pe } = await (supabase.from('calendar_entries_private' as any) as any).upsert({ entry_id: entryId, ...priv })
        if (pe) throw pe
      }
      if (Object.keys(base).length > 0) {
        const { error } = await supabase.from('calendar_entries').update(base).eq('id', entryId)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wedding', entryId] }),
  })
}

export function useTasks(entryId: string | null) {
  return useQuery({
    queryKey: ['tasks', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('wedding_tasks').select('*').eq('entry_id', entryId!).order('phase').order('ord')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMood(entryId: string | null) {
  return useQuery({
    queryKey: ['mood', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('mood_images').select('*').eq('entry_id', entryId!).order('ord')
      if (error) throw error
      return data ?? []
    },
  })
}

// Menu matrimoniale (sezioni: antipasto, primo, secondo, dolce, bevande, ...)
export function useMenu(entryId: string | null) {
  return useQuery({
    queryKey: ['menu', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('event_menu' as any) as any)
        .select('*, supplier:profiles(id, business_name, full_name)')
        .eq('entry_id', entryId!)
        .order('section')
        .order('ord')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useMenuMutations(entryId: string) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['menu', entryId] })
  return {
    add: useMutation({
      mutationFn: async (input: { section: string; title: string; description?: string; dietary_tags?: string[]; allergens?: string[]; price_per_guest?: number | null; notes?: string; is_optional?: boolean; supplier_id?: string | null; ord?: number }) => {
        const { data, error } = await (supabase.from('event_menu' as any) as any).insert({ entry_id: entryId, ord: 0, ...input }).select().single()
        if (error) throw error
        return data
      },
      onSuccess: inv,
    }),
    update: useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
        const { error } = await (supabase.from('event_menu' as any) as any).update(patch).eq('id', id)
        if (error) throw error
      },
      onSuccess: inv,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await (supabase.from('event_menu' as any) as any).delete().eq('id', id)
        if (error) throw error
      },
      onSuccess: inv,
    }),
  }
}

export function usePlaylist(entryId: string | null) {
  return useQuery({
    queryKey: ['playlist', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('event_playlist').select('*').eq('entry_id', entryId!).order('moment').order('ord')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useBudget(entryId: string | null) {
  return useQuery({
    queryKey: ['budget', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const [cats, entries] = await Promise.all([
        supabase.from('budget_categories').select('*').eq('entry_id', entryId!).order('ord'),
        supabase.from('budget_entries').select('*').eq('entry_id', entryId!).order('paid_at', { ascending: false }),
      ])
      if (cats.error) throw cats.error
      if (entries.error) throw entries.error
      return { categories: cats.data ?? [], entries: entries.data ?? [] }
    },
  })
}

// Contracts
export function useContracts(quoteId?: string | null) {
  return useQuery({
    queryKey: ['contracts', quoteId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('contracts').select('*').order('updated_at', { ascending: false })
      if (quoteId) q = q.eq('quote_id', quoteId)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useContractMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['contracts'] })
  return {
    create: useMutation({
      mutationFn: async (input: Partial<Database['public']['Tables']['contracts']['Insert']> & { title: string }) => {
        const { data: me } = await supabase.auth.getUser()
        if (!me.user) throw new Error('Non autenticato')
        const { data, error } = await supabase.from('contracts').insert({ ...input, owner_id: me.user.id }).select().single()
        if (error) throw error
        return data
      },
      onSuccess: inv,
    }),
    update: useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: Partial<Database['public']['Tables']['contracts']['Update']> }) => {
        const { error } = await supabase.from('contracts').update(patch).eq('id', id)
        if (error) throw error
      },
      onSuccess: inv,
    }),
    send: useMutation({
      mutationFn: async (contractId: string) => {
        const token = crypto.randomUUID()
        const { error } = await supabase.from('contracts').update({ status: 'INVIATO', access_token: token }).eq('id', contractId)
        if (error) throw error
        return token
      },
      onSuccess: inv,
    }),
    // Firmato su carta: stampato e firmato a mano, il fornitore lo registra come FIRMATO (RPC, non UPDATE diretto).
    markPaper: useMutation({
      mutationFn: async (contractId: string) => {
        const { error } = await (supabase as any).rpc('contract_mark_signed_paper', { p_id: contractId })
        if (error) throw error
      },
      onSuccess: inv,
    }),
  }
}

export function useQuoteViews(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote-views', quoteId],
    enabled: !!quoteId,
    queryFn: async () => {
      const { data, error } = await supabase.from('quote_views').select('*').eq('quote_id', quoteId!).order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return data ?? []
    },
  })
}

// Attività del preventivo per l'OWNER: stage + conteggio aperture + timeline di OGNI vista.
export function useQuoteActivity(quoteId: string | null) {
  return useQuery({
    queryKey: ['quote-activity', quoteId],
    enabled: !!quoteId,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('quote_activity', { p_quote_id: quoteId })
      if (error) throw error
      return data as {
        ok?: boolean; stage?: string; sent_at?: string | null; email_sent?: boolean
        open_count?: number; first_opened_at?: string | null; last_opened_at?: string | null
        registered_at?: string | null; accepted_at?: string | null; rejected_at?: string | null
        status?: string; views?: Array<{ at: string; ua: string | null }>
      }
    },
  })
}

// ── PIANTINE SALA (floor plans) ────────────────────────────────────────────
export function useEventFloorPlan(entryId: string | null) {
  return useQuery({
    queryKey: ['floorplan', entryId], enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('event_floor_plans' as any) as any).select('*').eq('entry_id', entryId!).maybeSingle()
      if (error) throw error
      return data as { entry_id: string; image_url: string | null; ratio: number; name: string | null; floor_plan_id: string | null; width_m: number | null; length_m: number | null; venue_name: string | null; room_name: string | null } | null
    },
  })
}

export function useFloorPlanLibrary() {
  return useQuery({
    queryKey: ['floorplan-lib'],
    queryFn: async () => {
      const { data: au } = await supabase.auth.getUser()
      if (!au?.user) return []
      const { data, error } = await (supabase.from('floor_plans' as any) as any).select('*').eq('owner_id', au.user.id).order('sort_order')
      if (error) throw error
      return (data ?? []) as Array<{ id: string; name: string; image_url: string | null; ratio: number; width_m: number | null; length_m: number | null }>
    },
  })
}

export function useFloorPlanMutations(entryId: string) {
  const qc = useQueryClient()
  const inv = () => { qc.invalidateQueries({ queryKey: ['floorplan', entryId] }); qc.invalidateQueries({ queryKey: ['floorplan-lib'] }) }
  return {
    setForEvent: useMutation({
      mutationFn: async (p: { image_url: string; ratio: number; name?: string | null; floor_plan_id?: string | null }) => {
        const { error } = await (supabase.from('event_floor_plans' as any) as any).upsert({ entry_id: entryId, image_url: p.image_url, ratio: p.ratio, name: p.name ?? null, floor_plan_id: p.floor_plan_id ?? null, updated_at: new Date().toISOString() })
        if (error) throw error
      }, onSuccess: inv,
    }),
    clearForEvent: useMutation({
      mutationFn: async () => { const { error } = await (supabase.from('event_floor_plans' as any) as any).delete().eq('entry_id', entryId); if (error) throw error }, onSuccess: inv,
    }),
    // Metratura sala (m) per la piantina in scala. Upsert che NON tocca image_url esistente.
    setDims: useMutation({
      mutationFn: async (p: { width_m: number | null; length_m: number | null; venue_name?: string | null; room_name?: string | null }) => {
        const row: any = { entry_id: entryId, width_m: p.width_m, length_m: p.length_m, updated_at: new Date().toISOString() }
        if (p.venue_name !== undefined) row.venue_name = p.venue_name
        if (p.room_name !== undefined) row.room_name = p.room_name
        const { error } = await (supabase.from('event_floor_plans' as any) as any).upsert(row)
        if (error) throw error
      }, onSuccess: inv,
    }),
    // Salva la sala (solo metratura, senza immagine) nella libreria del proprietario, riusabile.
    saveRoom: useMutation({
      mutationFn: async (p: { name: string; width_m: number; length_m: number }) => {
        const { data: au } = await supabase.auth.getUser(); if (!au?.user) throw new Error('Non autenticato')
        const ratio = p.length_m > 0 ? p.width_m / p.length_m : 1.6
        const { data, error } = await (supabase.from('floor_plans' as any) as any).insert({ owner_id: au.user.id, name: p.name, width_m: p.width_m, length_m: p.length_m, ratio }).select().single()
        if (error) throw error; return data
      }, onSuccess: inv,
    }),
    addToLibrary: useMutation({
      mutationFn: async (p: { image_url: string; ratio: number; name: string }) => {
        const { data: au } = await supabase.auth.getUser(); if (!au?.user) throw new Error('Non autenticato')
        const { data, error } = await (supabase.from('floor_plans' as any) as any).insert({ owner_id: au.user.id, image_url: p.image_url, ratio: p.ratio, name: p.name }).select().single()
        if (error) throw error; return data
      }, onSuccess: inv,
    }),
    removeFromLibrary: useMutation({
      mutationFn: async (id: string) => { const { error } = await (supabase.from('floor_plans' as any) as any).delete().eq('id', id); if (error) throw error }, onSuccess: inv,
    }),
  }
}

// ── ZONE / POI della planimetria ───────────────────────────────────────────
export function useEventZones(entryId: string | null) {
  return useQuery({
    queryKey: ['zones', entryId], enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await (supabase.from('event_plan_zones' as any) as any).select('zones').eq('entry_id', entryId!).maybeSingle()
      if (error) throw error
      return ((data?.zones ?? []) as any[])
    },
  })
}
export function useSetEventZones(entryId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (zones: any[]) => {
      const { error } = await (supabase.from('event_plan_zones' as any) as any).upsert({ entry_id: entryId, zones, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    // Ottimistico: la cache (= prop zones) riflette subito il nuovo stato, così il round-trip
    // col server non fa "sparire" le zone appena disegnate prima che il refetch completi.
    onMutate: async (zones: any[]) => {
      await qc.cancelQueries({ queryKey: ['zones', entryId] })
      const prev = qc.getQueryData(['zones', entryId])
      qc.setQueryData(['zones', entryId], zones)
      return { prev }
    },
    onError: (_e, _v, ctx: any) => { if (ctx?.prev !== undefined) qc.setQueryData(['zones', entryId], ctx.prev) },
    onSettled: () => qc.invalidateQueries({ queryKey: ['zones', entryId] }),
  })
}
