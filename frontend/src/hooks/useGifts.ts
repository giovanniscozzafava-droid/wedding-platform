import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Regali per insiemi (famiglie/coppie/gruppi). RLS via gift_can_manage (coppia/owner/admin).
const sb = (t: string): any => (supabase as any).from(t)

export type GiftItem = { id: string; kind: 'MONEY' | 'THING'; amount: number | null; descrizione: string | null; note: string | null }
export type GiftGroup = { id: string; nome: string; tipo: string; invitati: number; soldi: number; regali: GiftItem[] }
export type GiftsSummary = { totale_soldi: number; totale_regali: number; insiemi: GiftGroup[]; senza_insieme: GiftItem[]; error?: string }
export const GROUP_KINDS = [
  { key: 'FAMIGLIA', label: 'Famiglia' }, { key: 'COPPIA', label: 'Coppia' }, { key: 'AMICI', label: 'Gruppo di amici' },
  { key: 'COLLEGHI', label: 'Colleghi' }, { key: 'SINGOLO', label: 'Singolo' }, { key: 'ALTRO', label: 'Altro' },
]

export function useGiftsSummary(entryId: string) {
  return useQuery<GiftsSummary>({
    queryKey: ['gifts', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('event_gifts_summary', { p_entry: entryId })
      if (error) throw error
      return data as GiftsSummary
    },
  })
}

export type GuestRow = { id: string; full_name: string | null; gift_group_id: string | null }
export function useGuestsForGifts(entryId: string) {
  return useQuery<GuestRow[]>({
    queryKey: ['gifts-guests', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await sb('event_guests').select('id, full_name, gift_group_id').eq('entry_id', entryId).order('full_name')
      if (error) throw error
      return (data ?? []) as GuestRow[]
    },
  })
}

export function useGiftMutations(entryId: string) {
  const qc = useQueryClient()
  const inv = () => { qc.invalidateQueries({ queryKey: ['gifts', entryId] }); qc.invalidateQueries({ queryKey: ['gifts-guests', entryId] }) }
  const m = (fn: (p: any) => Promise<void>) => useMutation({ mutationFn: fn, onSuccess: inv })
  return {
    createGroup: m(async (p: { name: string; kind: string }) => { const { error } = await sb('guest_gift_groups').insert({ entry_id: entryId, name: p.name, kind: p.kind }); if (error) throw error }),
    delGroup: m(async (id: string) => { const { error } = await sb('guest_gift_groups').delete().eq('id', id); if (error) throw error }),
    assignGuest: m(async (p: { guest_id: string; group_id: string | null }) => { const { error } = await sb('event_guests').update({ gift_group_id: p.group_id }).eq('id', p.guest_id); if (error) throw error }),
    addGift: m(async (p: { group_id: string | null; kind: 'MONEY' | 'THING'; amount?: number | null; description?: string | null; note?: string | null }) => { const { error } = await sb('event_gifts').insert({ entry_id: entryId, ...p }); if (error) throw error }),
    delGift: m(async (id: string) => { const { error } = await sb('event_gifts').delete().eq('id', id); if (error) throw error }),
  }
}
