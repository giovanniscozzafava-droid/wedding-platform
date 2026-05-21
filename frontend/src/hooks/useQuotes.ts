import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type QuoteRow = Database['public']['Tables']['quotes']['Row']
type QuoteInsert = Database['public']['Tables']['quotes']['Insert']
type QuoteUpdate = Database['public']['Tables']['quotes']['Update']
type QuoteItemRow = Database['public']['Tables']['quote_items']['Row']
type QuoteItemInsert = Database['public']['Tables']['quote_items']['Insert']

export type QuoteWithItems = QuoteRow & {
  quote_items: QuoteItemRow[]
}

export function useQuotes() {
  return useQuery<QuoteRow[]>({
    queryKey: ['quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useQuote(id: string | null) {
  return useQuery<QuoteWithItems | null>({
    queryKey: ['quote', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data as unknown as QuoteWithItems | null
    },
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<QuoteInsert, 'owner_id'>) => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) throw new Error('Non autenticato')
      const { data, error } = await supabase
        .from('quotes')
        .insert({ ...payload, owner_id: me.user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}

export function useUpdateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: QuoteUpdate }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['quote', vars.id] })
    },
  })
}

export function useDeleteQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}

export function useAddQuoteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: QuoteItemInsert) => {
      const { data, error } = await supabase.from('quote_items').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['quote', vars.quote_id] })
      qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useRemoveQuoteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, quoteId }: { id: string; quoteId: string }) => {
      const { error } = await supabase.from('quote_items').delete().eq('id', id)
      if (error) throw error
      return quoteId
    },
    onSuccess: (qid) => {
      qc.invalidateQueries({ queryKey: ['quote', qid] })
      qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useSetSupplierMarkup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ quoteId, supplierId, percent }: { quoteId: string; supplierId: string; percent: number }) => {
      const { data, error } = await supabase
        .from('quote_supplier_markups')
        .upsert(
          { quote_id: quoteId, supplier_id: supplierId, markup_percent: percent },
          { onConflict: 'quote_id,supplier_id' },
        )
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['quote', vars.quoteId] })
    },
  })
}

export function useGeneratePdf() {
  return useMutation({
    mutationFn: async ({ quoteId, variant }: { quoteId: string; variant?: 'NEUTRA' | 'PREMIUM' }) => {
      const { data, error } = await supabase.functions.invoke<{ url: string; variant: string; premium_applied: boolean }>(
        'quote-generate-pdf',
        { body: { quote_id: quoteId, variant } },
      )
      if (error) throw error
      return data!
    },
  })
}

export function useSendQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (quoteId: string) => {
      const { data, error } = await supabase.functions.invoke<{ access_token: string; pdf_url: string }>(
        'quote-send',
        { body: { quote_id: quoteId } },
      )
      if (error) throw error
      return data!
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

// Public RPCs (no auth required, eseguite con anon key)
export async function publicQuoteByToken(token: string) {
  const { data, error } = await supabase.rpc('quote_get_by_token', { p_token: token })
  if (error) throw error
  return data as unknown as {
    id: string
    title: string
    client_name: string | null
    event_date: string | null
    status: string
    revision: number
    total_client: number
    pdf_url: string | null
    owner: { business_name: string | null; full_name: string | null; brand_primary_color: string | null }
    items: Array<{ name_snapshot: string; quantity: number; snapshot_price: number; line_client: number }>
  } | null
}

export async function publicQuoteAccept(token: string) {
  const { data, error } = await supabase.rpc('quote_accept_by_token', { p_token: token })
  if (error) throw error
  return data as boolean
}

export async function publicQuoteReject(token: string, reason: string) {
  const { data, error } = await supabase.rpc('quote_reject_by_token', { p_token: token, p_reason: reason })
  if (error) throw error
  return data as boolean
}
