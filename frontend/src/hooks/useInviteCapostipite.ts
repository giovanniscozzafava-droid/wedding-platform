// Slice minimale: WP/Location invita un altro capostipite via RPC.
// La RPC inserisce una riga in supplier_invites con target_role='WEDDING_PLANNER' o 'LOCATION'.
// Restituisce token + url accept gia' formattato per copia manuale.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type InviteCapostipiteRow = {
  id: string
  email: string
  capostipite_id: string
  token: string
  status: string
  target_role: 'WEDDING_PLANNER' | 'LOCATION'
  subrole_hint: string | null
  message: string | null
  expires_at: string
  invited_at: string
}

export type InviteCapostipiteResult = {
  invite: InviteCapostipiteRow
  accept_url: string
}

export function useInviteCapostipite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      email: string
      target_role?: 'WEDDING_PLANNER' | 'LOCATION'
      message?: string
      subrole_hint?: string
    }): Promise<InviteCapostipiteResult> => {
      const { data, error } = await (supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: InviteCapostipiteRow | null; error: { message: string } | null }>
      }).rpc('wp_invite_capostipite', {
        p_email: payload.email.trim().toLowerCase(),
        p_target_role: payload.target_role ?? 'WEDDING_PLANNER',
        p_message: payload.message ?? null,
        p_subrole_hint: payload.subrole_hint ?? null,
      })
      if (error) throw new Error(error.message)
      if (!data) throw new Error('invito_non_creato')
      const accept_url = `${window.location.origin}/invito-capostipite/${data.token}`
      return { invite: data, accept_url }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-invites'] })
      qc.invalidateQueries({ queryKey: ['capostipite-invites'] })
      qc.invalidateQueries({ queryKey: ['my-referral-stats'] })
    },
  })
}
