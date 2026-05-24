import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export type SupplierEarning = {
  total: number       // somma line_client delle proprie voci
  paid: number        // somma paid_amount
  pending: number     // saldo da incassare
  items: number       // numero voci
  status_breakdown: Record<string, number>  // counts per stato
}

// Aggregato guadagni del fornitore per ogni calendar entry visibile.
// RLS gia` filtra: vede solo quote_items dove supplier_id = lui.
export function useSupplierEarnings(entryIds: string[]) {
  const { user, profile } = useAuth()
  const isSupplier = profile?.role === 'FORNITORE' || profile?.role === 'LOCATION'

  return useQuery({
    enabled: isSupplier && !!user && entryIds.length > 0,
    queryKey: ['supplier-earnings', user?.id, entryIds.sort().join(',')],
    queryFn: async () => {
      // Step 1: trova quote_id per ogni entry
      const { data: entries } = await supabase
        .from('calendar_entries')
        .select('id, quote_id')
        .in('id', entryIds)
      const quoteIdByEntry = new Map<string, string>()
      for (const e of (entries ?? [])) {
        if ((e as any).quote_id) quoteIdByEntry.set((e as any).id, (e as any).quote_id)
      }

      const quoteIds = Array.from(new Set(quoteIdByEntry.values()))
      if (quoteIds.length === 0) return new Map<string, SupplierEarning>()

      // Step 2: aggrega quote_items del fornitore corrente
      const { data: items } = await (supabase.from('quote_items' as any) as any)
        .select('quote_id, line_client, paid_amount, payment_status')
        .in('quote_id', quoteIds)
        .eq('supplier_id', user!.id)

      // Map quote_id -> aggregato
      const byQuote = new Map<string, SupplierEarning>()
      for (const it of ((items ?? []) as any[])) {
        const q = it.quote_id as string
        if (!byQuote.has(q)) byQuote.set(q, { total: 0, paid: 0, pending: 0, items: 0, status_breakdown: {} })
        const agg = byQuote.get(q)!
        const line = Number(it.line_client ?? 0)
        const paid = Number(it.paid_amount ?? 0)
        agg.total += line
        agg.paid += paid
        agg.items += 1
        const st = it.payment_status ?? 'NON_PAGATO'
        agg.status_breakdown[st] = (agg.status_breakdown[st] ?? 0) + 1
      }
      for (const agg of byQuote.values()) agg.pending = agg.total - agg.paid

      // Map entry_id -> aggregato
      const result = new Map<string, SupplierEarning>()
      for (const [entryId, quoteId] of quoteIdByEntry) {
        const a = byQuote.get(quoteId)
        if (a) result.set(entryId, a)
      }
      return result
    },
  })
}
