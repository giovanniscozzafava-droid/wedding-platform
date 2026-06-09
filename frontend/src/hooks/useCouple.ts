import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type CoupleMember = {
  id: string
  entry_id: string
  user_id: string | null
  email: string
  full_name: string | null
  role: 'SPOSO' | 'SPOSA' | 'PARTNER' | 'PERSONA_DI_FIDUCIA'
  invite_token: string
  invited_at: string
  accepted_at: string | null
}

export function useCoupleMembers(entryId: string | null) {
  return useQuery<CoupleMember[]>({
    queryKey: ['couple-members', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await supabase.from('wedding_couple_members').select('*').eq('entry_id', entryId!).order('invited_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as CoupleMember[]
    },
  })
}

export function useCoupleMemberMutations(entryId: string) {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['couple-members', entryId] })
  return {
    invite: useMutation({
      mutationFn: async (payload: { email: string; full_name?: string; role?: CoupleMember['role'] }) => {
        const { data, error } = await supabase.from('wedding_couple_members').insert({
          entry_id: entryId, email: payload.email,
          full_name: payload.full_name ?? null,
          role: payload.role ?? 'PARTNER',
        }).select().single()
        if (error) throw error
        return data
      },
      onSuccess: inv,
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from('wedding_couple_members').delete().eq('id', id)
        if (error) throw error
      },
      onSuccess: inv,
    }),
  }
}

// Per la dashboard sposi: lista i wedding di cui sono membri
export function useMyWeddings() {
  return useQuery({
    queryKey: ['my-couple-weddings'],
    queryFn: async () => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) return []
      const { data, error } = await supabase
        .from('wedding_couple_members')
        .select(`
          id, role, accepted_at,
          entry:calendar_entries(*, calendar_entries_private(client_name, client_email, notes, value_amount), owner:profiles!calendar_entries_owner_id_fkey(full_name, business_name, brand_primary_color))
        `)
        .eq('user_id', me.user.id)
      if (error) throw error
      // La coppia (cliente) vede i propri campi sensibili: ri-appiattiti dall'embed.
      return (data ?? []).map((row: any) => {
        if (row?.entry?.calendar_entries_private) {
          row.entry = { ...row.entry, ...row.entry.calendar_entries_private }
        }
        return row
      }) as Array<{
        id: string
        role: CoupleMember['role']
        accepted_at: string | null
        entry: any
      }>
    },
  })
}

export async function acceptCoupleInvite(token: string) {
  const { data, error } = await supabase.rpc('couple_accept_invite', { p_token: token })
  if (error) throw error
  return data as boolean
}
