import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ConflictAlert = {
  my_quote_id: string
  my_quote_title: string
  my_quote_status: string
  my_quote_total: number
  my_role: 'FORNITORE_DIRETTO' | 'CAPOSTIPITE'
  match_signals: string[]
  other_quote_id: string
  other_owner_role: string
  other_owner_name: string | null
  other_quote_event_date: string
  other_quote_total: number
  other_quote_status: string
  conflict_severity: 'HIGH' | 'MEDIUM' | 'LOW'
}

export function useConflictAlerts() {
  return useQuery({
    queryKey: ['conflict_alerts'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_quote_conflict_alerts')
      if (error) throw error
      return (data ?? []) as unknown as ConflictAlert[]
    },
    staleTime: 60 * 1000,
  })
}
