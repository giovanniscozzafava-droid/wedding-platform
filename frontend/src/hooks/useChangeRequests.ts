import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export type EntityType = 'GUEST' | 'TABLE' | 'ACCOMMODATION' | 'TRANSPORT' | 'TIMELINE' | 'SUBEVENT' | 'WEBSITE' | 'MENU' | 'OTHER'
export type ReqAction = 'CREATE' | 'UPDATE' | 'DELETE'
export type ReqStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'APPLIED'

export type ChangeRequest = {
  id: string
  wedding_id: string
  requested_by: string
  entity_type: EntityType
  entity_id: string | null
  action: ReqAction
  title: string
  description: string | null
  payload: Record<string, any>
  status: ReqStatus
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
  updated_at: string
  requester?: { id: string; full_name: string | null; email: string | null } | null
}

export function useChangeRequests(weddingId: string | null | undefined) {
  return useQuery({
    enabled: !!weddingId,
    queryKey: ['change-requests', weddingId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('couple_change_requests' as any) as any)
        .select('*, requester:requested_by(id, full_name, email)')
        .eq('wedding_id', weddingId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as ChangeRequest[]
    },
  })
}

export function useCreateChangeRequest(weddingId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: {
      entity_type: EntityType
      entity_id?: string | null
      action?: ReqAction
      title: string
      description?: string
      payload?: Record<string, any>
    }) => {
      if (!user) throw new Error('Non autenticato')
      const { error } = await (supabase.from('couple_change_requests' as any) as any).insert({
        wedding_id: weddingId,
        requested_by: user.id,
        entity_type: input.entity_type,
        entity_id: input.entity_id ?? null,
        action: input.action ?? 'UPDATE',
        title: input.title,
        description: input.description ?? null,
        payload: input.payload ?? {},
      })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['change-requests', weddingId] }) },
  })
}

export function useReviewChangeRequest(weddingId: string) {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (input: { id: string; status: 'APPROVED' | 'REJECTED' | 'APPLIED'; review_note?: string }) => {
      const { error } = await (supabase.from('couple_change_requests' as any) as any)
        .update({
          status: input.status,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_note: input.review_note ?? null,
        })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['change-requests', weddingId] }) },
  })
}

export function entityLabel(t: EntityType): string {
  return ({
    GUEST: 'Invitato',
    TABLE: 'Tavolo',
    ACCOMMODATION: 'Alloggio',
    TRANSPORT: 'Trasporto',
    TIMELINE: 'Scaletta',
    SUBEVENT: 'Sub-evento',
    WEBSITE: 'Sito ospiti',
    MENU: 'Menu',
    OTHER: 'Altro',
  })[t] ?? t
}
