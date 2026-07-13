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
      // GDPR: RPC che cancella quote + dipendenze + ritorna i path Storage da rimuovere
      const { data, error } = await (supabase as any).rpc('delete_quote_cascade', { p_quote_id: id })
      if (error) throw error
      const paths = (data as Array<{ bucket: string; path: string }>) ?? []
      // Pulizia Storage (best-effort, no error blocking)
      const byBucket = new Map<string, string[]>()
      for (const r of paths) {
        if (!r.bucket || !r.path) continue
        const arr = byBucket.get(r.bucket) ?? []
        arr.push(r.path)
        byBucket.set(r.bucket, arr)
      }
      for (const [bucket, files] of byBucket.entries()) {
        try { await supabase.storage.from(bucket).remove(files) } catch { /* ignore */ }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}

export function useAddQuoteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: QuoteItemInsert) => {
      const { data, error } = await supabase.from('quote_items').insert(payload).select().single()
      if (error) {
        // Conflitto di disponibilità → traduci in messaggio user-friendly
        if (error.message && error.message.includes('AVAILABILITY_CONFLICT')) {
          const m = error.message.match(/il fornitore (.+?) è OCCUPATO il (\d{4}-\d{2}-\d{2})/)
          if (m) {
            const [, name, date] = m
            const formatted = new Date(date!).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
            throw new Error(`Il fornitore ${name} è OCCUPATO il ${formatted}. Cambia data o scegli un altro fornitore.`)
          }
        }
        throw error
      }
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['quote', vars.quote_id] })
      qc.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useUpdateQuoteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, quoteId, patch }: { id: string; quoteId: string; patch: Database['public']['Tables']['quote_items']['Update'] }) => {
      const { data, error } = await supabase.from('quote_items').update(patch).eq('id', id).select().single()
      if (error) throw error
      return { data, quoteId }
    },
    onSuccess: ({ quoteId }) => {
      qc.invalidateQueries({ queryKey: ['quote', quoteId] })
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
    owner: { business_name: string | null; full_name: string | null; brand_primary_color: string | null; brand_logo_url: string | null }
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
