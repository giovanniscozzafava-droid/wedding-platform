import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type EntryRow = Database['public']['Tables']['calendar_entries']['Row']
type EntryInsert = Database['public']['Tables']['calendar_entries']['Insert']
type EntryUpdate = Database['public']['Tables']['calendar_entries']['Update']
type ParticipantRow = Database['public']['Tables']['calendar_entry_participants']['Row']
type ParticipantInsert = Database['public']['Tables']['calendar_entry_participants']['Insert']

// Campi sensibili separati in calendar_entries_private (split P5): leggibili
// solo da owner/coppia/admin. Li ri-appiattiamo qui per non cambiare i consumer.
export type EntryPrivate = {
  client_name: string | null; client_email: string | null; notes: string | null; value_amount: number | null
}
const PRIVATE_KEYS = ['client_name', 'client_email', 'notes', 'value_amount'] as const
function splitPrivate<T extends Record<string, unknown>>(obj: T) {
  const priv: Record<string, unknown> = {}; const base: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if ((PRIVATE_KEYS as readonly string[]).includes(k)) priv[k] = v; else base[k] = v
  }
  return { base, priv }
}

export type EntryWithParticipants = EntryRow & Partial<EntryPrivate> & {
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
          'id, owner_id, title, date_from, date_to, status, quote_id, created_at, updated_at, calendar_entries_private(client_name, client_email, notes, value_amount), calendar_entry_participants(*, user:profiles!calendar_entry_participants_user_id_fkey(id, full_name, business_name, subrole))',
        )
        .or(`date_from.gte.${range.from},date_to.gte.${range.from}`)
        .lte('date_from', range.to)
        .order('date_from', { ascending: true })
      if (error) throw error
      // Ri-appiattisci i campi sensibili (null per chi non è owner/coppia/admin → RLS).
      return (data ?? []).map((r) => {
        const { calendar_entries_private: p, ...rest } = r as Record<string, unknown> & { calendar_entries_private: EntryPrivate | null }
        return { ...rest, ...(p ?? {}) }
      }) as unknown as EntryWithParticipants[]
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
      entry: Omit<EntryInsert, 'owner_id'> & Partial<EntryPrivate>
      participantIds: string[]
    }) => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) throw new Error('Non autenticato')

      const { base, priv } = splitPrivate(entry as Record<string, unknown>)
      const { data: created, error } = await supabase
        .from('calendar_entries')
        .insert({ ...base, owner_id: me.user.id } as EntryInsert)
        .select()
        .single()
      if (error) throw error
      // Campi sensibili → tabella privata (il trigger crea già la riga vuota).
      if (Object.keys(priv).length > 0) {
        const { error: pe } = await (supabase.from('calendar_entries_private' as never) as never as {
          upsert: (v: unknown) => Promise<{ error: { message: string } | null }>
        }).upsert({ entry_id: created.id, ...priv })
        if (pe) throw pe
      }

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
    mutationFn: async ({ id, patch }: { id: string; patch: EntryUpdate & Partial<EntryPrivate> }) => {
      const { base, priv } = splitPrivate(patch as Record<string, unknown>)
      // Campi sensibili → tabella privata (upsert; il fornitore non vi accede).
      if (Object.keys(priv).length > 0) {
        const { error: pe } = await (supabase.from('calendar_entries_private' as never) as never as {
          upsert: (v: unknown) => Promise<{ error: { message: string } | null }>
        }).upsert({ entry_id: id, ...priv })
        if (pe) throw pe
      }
      const { data, error } = await supabase
        .from('calendar_entries')
        .update(base as EntryUpdate)
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
