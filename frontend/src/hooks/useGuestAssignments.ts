import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// ── TRANSPORT ASSIGNMENTS ─────────────────────────────────
export function useGuestTransportLinks(entryId: string | null) {
  return useQuery({
    enabled: !!entryId,
    queryKey: ['guest-transport', entryId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('event_guest_transport' as any) as any)
        .select('id, guest_id, transport_id, notes')
        .eq('entry_id', entryId)
      if (error) throw error
      return (data ?? []) as Array<{ id: string; guest_id: string; transport_id: string; notes: string | null }>
    },
  })
}

export function useTransportAssignMutations(entryId: string) {
  const qc = useQueryClient()
  const link = useMutation({
    mutationFn: async (input: { transport_id: string; guest_ids: string[] }) => {
      const rows = input.guest_ids.map((g) => ({ entry_id: entryId, guest_id: g, transport_id: input.transport_id }))
      const { error } = await (supabase.from('event_guest_transport' as any) as any).upsert(rows, { onConflict: 'guest_id,transport_id', ignoreDuplicates: true })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guest-transport', entryId] }),
  })
  const unlink = useMutation({
    mutationFn: async (input: { transport_id: string; guest_id: string }) => {
      const { error } = await (supabase.from('event_guest_transport' as any) as any)
        .delete().eq('transport_id', input.transport_id).eq('guest_id', input.guest_id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guest-transport', entryId] }),
  })
  return { link, unlink }
}

// ── ACCOMMODATION ASSIGNMENTS ─────────────────────────────
export function useGuestAccommodationLinks(entryId: string | null) {
  return useQuery({
    enabled: !!entryId,
    queryKey: ['guest-accommodation', entryId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('event_guest_accommodation' as any) as any)
        .select('id, guest_id, accommodation_id, room_label, check_in, check_out, notes')
        .eq('entry_id', entryId)
      if (error) throw error
      return (data ?? []) as Array<{ id: string; guest_id: string; accommodation_id: string; room_label: string | null; check_in: string | null; check_out: string | null; notes: string | null }>
    },
  })
}

export function useAccommodationAssignMutations(entryId: string) {
  const qc = useQueryClient()
  const link = useMutation({
    mutationFn: async (input: { accommodation_id: string; guest_ids: string[]; check_in?: string | null; check_out?: string | null; room_label?: string | null }) => {
      const rows = input.guest_ids.map((g) => ({
        entry_id: entryId, guest_id: g, accommodation_id: input.accommodation_id,
        check_in: input.check_in ?? null, check_out: input.check_out ?? null, room_label: input.room_label ?? null,
      }))
      const { error } = await (supabase.from('event_guest_accommodation' as any) as any).upsert(rows, { onConflict: 'guest_id,accommodation_id,check_in', ignoreDuplicates: false })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guest-accommodation', entryId] }),
  })
  const unlink = useMutation({
    mutationFn: async (input: { id: string }) => {
      const { error } = await (supabase.from('event_guest_accommodation' as any) as any).delete().eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['guest-accommodation', entryId] }),
  })
  return { link, unlink }
}
