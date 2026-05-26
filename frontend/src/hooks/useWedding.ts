import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type WeddingRow = Database['public']['Tables']['calendar_entries']['Row'] & {
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
          quote:quotes!calendar_entries_quote_fk(id, title, status, total_client, access_token, pdf_url, revision)
        `)
        .in('status', ['OPZIONATA', 'CONFERMATA', 'IN_TRATTATIVA'])
        .order('date_from', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as WeddingRow[]
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
          quote:quotes!calendar_entries_quote_fk(*, quote_items(*)),
          calendar_entry_participants(*, user:profiles!calendar_entry_participants_user_id_fkey(id, full_name, business_name, subrole))
        `)
        .eq('id', entryId!)
        .maybeSingle()
      if (error) throw error
      return data
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
      const { data, error } = await supabase.from('event_guests').select('*').eq('entry_id', entryId!).order('full_name')
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
      const { error } = await supabase.from('calendar_entries').update(patch).eq('id', entryId)
      if (error) throw error
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
