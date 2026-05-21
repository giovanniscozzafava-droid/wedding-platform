import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type EntryRow = Database['public']['Tables']['calendar_entries']['Row']
type EntryInsert = Database['public']['Tables']['calendar_entries']['Insert']
type EntryUpdate = Database['public']['Tables']['calendar_entries']['Update']
type ParticipantRow = Database['public']['Tables']['calendar_entry_participants']['Row']
type ParticipantInsert = Database['public']['Tables']['calendar_entry_participants']['Insert']

export type EntryWithParticipants = EntryRow & {
  calendar_entry_participants: Array<ParticipantRow & {
    user: { id: string; full_name: string | null; business_name: string | null; subrole: string | null } | null
  }>
}

export function useCalendarEntries(range: { from: string; to: string }) {
  return useQuery<EntryWithParticipants[]>({
    queryKey: ['calendar', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_entries')
        .select(
          'id, owner_id, title, client_name, client_email, date_from, date_to, status, value_amount, notes, quote_id, created_at, updated_at, calendar_entry_participants(*, user:profiles!calendar_entry_participants_user_id_fkey(id, full_name, business_name, subrole))',
        )
        .or(`date_from.gte.${range.from},date_to.gte.${range.from}`)
        .lte('date_from', range.to)
        .order('date_from', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as EntryWithParticipants[]
    },
  })
}

// View ridotta per participant (no client_name, value_amount, notes)
export function useParticipantEntries(range: { from: string; to: string }) {
  return useQuery({
    queryKey: ['calendar', 'participant', range.from, range.to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('calendar_entries_for_participants')
        .select('*')
        .gte('date_from', range.from)
        .lte('date_from', range.to)
        .order('date_from', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      entry,
      participantIds,
    }: {
      entry: Omit<EntryInsert, 'owner_id'>
      participantIds: string[]
    }) => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) throw new Error('Non autenticato')

      const { data: created, error } = await supabase
        .from('calendar_entries')
        .insert({ ...entry, owner_id: me.user.id })
        .select()
        .single()
      if (error) throw error

      if (participantIds.length > 0) {
        const rows: ParticipantInsert[] = participantIds.map((uid) => ({
          entry_id: created.id,
          user_id: uid,
          role_in_entry: 'fornitore',
        }))
        const { error: pErr } = await supabase.from('calendar_entry_participants').insert(rows)
        if (pErr) throw pErr
      }

      // notifica fornitori (Edge Function, no-op se Resend non configurato)
      try {
        await supabase.functions.invoke('calendar-notify', {
          body: { entry_id: created.id, event: 'entry_created' },
        })
      } catch {
        // notifiche best-effort
      }

      return created
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useUpdateEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: EntryUpdate }) => {
      const { data, error } = await supabase
        .from('calendar_entries')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      try {
        await supabase.functions.invoke('calendar-notify', {
          body: { entry_id: id, event: 'entry_updated' },
        })
      } catch {
        /* */
      }
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_entries').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

// Crea/recupera token export iCal per l'utente loggato
export function useEnsureExportToken() {
  return useMutation({
    mutationFn: async () => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) throw new Error('Non autenticato')
      const { data: existing } = await supabase
        .from('calendar_export_tokens')
        .select('token, expires_at')
        .eq('user_id', me.user.id)
        .is('revoked_at', null)
        .gte('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (existing) return existing.token as string
      const { data, error } = await supabase
        .from('calendar_export_tokens')
        .insert({ user_id: me.user.id })
        .select('token')
        .single()
      if (error) throw error
      return data.token as string
    },
  })
}
