import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Cover } from '@/components/album/AlbumMockup'

async function uid(): Promise<string | null> { const { data } = await supabase.auth.getUser(); return data.user?.id ?? null }

export type AlbumOrder = {
  id: string; couple_label: string | null; photographer: string; format_key: string; pages: number; copies: number
  cover: Cover; status: string; queue_order: number; reject_reason: string | null; created_at: string
}

export function useIsAlbumLab() {
  return useQuery<boolean>({
    queryKey: ['is-album-lab'],
    queryFn: async () => {
      const id = await uid(); if (!id) return false
      const { data } = await (supabase as any).from('profiles').select('is_album_lab, role').eq('id', id).maybeSingle()
      return !!(data?.is_album_lab || data?.role === 'ADMIN')
    },
    staleTime: 5 * 60_000,
  })
}

export function useAlbumLabList() {
  return useQuery<AlbumOrder[]>({
    queryKey: ['album-lab-list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('album_lab_list')
      if (error) throw error
      return (data ?? []) as AlbumOrder[]
    },
  })
}

export function useAlbumLabMutations() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { order_id: string; status?: string; reason?: string | null; queue?: number | null }) => {
      const { data, error } = await (supabase as any).rpc('album_lab_update', { p_order: p.order_id, p_status: p.status ?? null, p_reason: p.reason ?? null, p_queue: p.queue ?? null })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['album-lab-list'] }),
  })
}

export async function sendAlbumToPrint(entryId: string, cover: Cover, copies: number): Promise<string> {
  const { data, error } = await (supabase as any).rpc('album_send_to_print', { p_entry: entryId, p_cover: cover, p_copies: copies })
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error === 'forbidden' ? 'Non hai i permessi su questo album' : data.error)
  return data.order_id
}
