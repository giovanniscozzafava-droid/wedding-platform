import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type ClientRow = Database['public']['Tables']['supplier_clients']['Row']
type ClientInsert = Database['public']['Tables']['supplier_clients']['Insert']
type ClientUpdate = Database['public']['Tables']['supplier_clients']['Update']

export type SupplierClientWithStats = ClientRow & {
  quote_count: number
  quoted_amount: number
  signed_contracts: number
  event_entry_id: string | null
}

export function useSupplierClients() {
  return useQuery({
    queryKey: ['supplier_clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_clients_dashboard')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as SupplierClientWithStats[]
    },
  })
}

export function useCreateSupplierClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<ClientInsert, 'supplier_id'>) => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) throw new Error('Non autenticato')
      const { data, error } = await supabase
        .from('supplier_clients')
        .insert({ ...payload, supplier_id: me.user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier_clients'] }),
  })
}

export function useUpdateSupplierClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ClientUpdate }) => {
      const { data, error } = await supabase
        .from('supplier_clients')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier_clients'] }),
  })
}

export function useDeleteSupplierClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('supplier_clients').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier_clients'] }),
  })
}
