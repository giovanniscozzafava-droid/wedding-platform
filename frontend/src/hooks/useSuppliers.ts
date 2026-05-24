import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type SupplierSummary = {
  id: string
  full_name: string | null
  business_name: string | null
  subrole: string | null
  phone: string | null
  collaboration_id: string
  collaboration_status: string
  accepted_at: string | null
  service_count: number
  photo_count: number
  avatar_url: string
}

// Fallback DiceBear se profile.brand_logo_url e' null. Stesso seed = stesso colore stabile.
function dicebearFor(name: string | null | undefined): string {
  const seed = (name ?? 'Fornitore').slice(0, 30)
  const colors = ['C49A5C', '1A2E4F', '7E6633', 'D4A5A5', '9CAF88', '8B4513', 'B19CD9', '1F3A5F']
  let h = 0
  for (const c of seed) h = ((h << 5) - h + c.charCodeAt(0)) | 0
  const color = colors[Math.abs(h) % colors.length]
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${color}&fontWeight=700&fontSize=42&textColor=ffffff`
}

function avatarUrlFrom(profile: { brand_logo_url?: string | null; business_name?: string | null; full_name?: string | null }): string {
  if (profile.brand_logo_url && profile.brand_logo_url.trim()) return profile.brand_logo_url
  return dicebearFor(profile.business_name ?? profile.full_name)
}

export function useSuppliers() {
  return useQuery<SupplierSummary[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborations')
        .select(
          'id, status, accepted_at, fornitore_id, supplier:profiles!collaborations_fornitore_id_fkey(id, full_name, business_name, subrole, phone, brand_logo_url)',
        )
        .order('accepted_at', { ascending: false, nullsFirst: false })
      if (error) throw error

      const rows = (data ?? []) as Array<{
        id: string
        status: string
        accepted_at: string | null
        fornitore_id: string
        supplier: { id: string; full_name: string | null; business_name: string | null; subrole: string | null; phone: string | null; brand_logo_url: string | null } | null
      }>

      const supplierIds = rows.map((r) => r.fornitore_id)
      const [servicesAgg, photosAgg] = await Promise.all([
        supabase.from('services').select('fornitore_id').in('fornitore_id', supplierIds).eq('is_active', true),
        supabase.from('service_photos').select('service_id, services!inner(fornitore_id)').in('services.fornitore_id', supplierIds),
      ])

      const serviceCount = new Map<string, number>()
      for (const r of (servicesAgg.data ?? []) as any[]) {
        serviceCount.set(r.fornitore_id, (serviceCount.get(r.fornitore_id) ?? 0) + 1)
      }
      const photoCount = new Map<string, number>()
      for (const r of (photosAgg.data ?? []) as any[]) {
        const fid = r.services?.fornitore_id
        if (fid) photoCount.set(fid, (photoCount.get(fid) ?? 0) + 1)
      }

      return rows
        .filter((r) => r.supplier)
        .map((r) => ({
          id: r.supplier!.id,
          full_name: r.supplier!.full_name,
          business_name: r.supplier!.business_name,
          subrole: r.supplier!.subrole,
          phone: r.supplier!.phone,
          collaboration_id: r.id,
          collaboration_status: r.status,
          accepted_at: r.accepted_at,
          service_count: serviceCount.get(r.fornitore_id) ?? 0,
          photo_count: photoCount.get(r.fornitore_id) ?? 0,
          avatar_url: avatarUrlFrom(r.supplier!),
        }))
    },
  })
}

export function useSupplier(id: string | null) {
  return useQuery({
    queryKey: ['supplier', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, business_name, subrole, phone, brand_primary_color, brand_secondary_color, brand_logo_url')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { ...data, avatar_url: avatarUrlFrom(data) }
    },
  })
}

export type InviteSupplierResult = {
  ok: true
  mode: 'collab_direct' | 'email_sent' | 'link_only' | 'email_failed_link_fallback'
  invite_id?: string
  accept_url?: string
  token?: string
  email_error?: string
}

export function useInviteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { email: string; subrole?: string; message?: string; skip_email?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('invite-supplier', { body: payload })
      if (error) {
        // FunctionsHttpError espone la Response in .context — estrai il body JSON per il messaggio chiaro
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          const body = await ctx.json().catch(() => null) as { error?: string } | null
          if (body?.error) throw new Error(body.error)
        }
        throw new Error(error.message ?? 'Errore invito fornitore')
      }
      const r = data as InviteSupplierResult & { error?: string }
      if (r?.error) throw new Error(r.error)
      return r
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] })
      qc.invalidateQueries({ queryKey: ['supplier-invites'] })
    },
  })
}

export type SupplierInvite = {
  id: string
  email: string
  token: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELED'
  subrole_hint: string | null
  message: string | null
  invited_at: string
  accepted_at: string | null
  expires_at: string
}

export function useSupplierInvites() {
  return useQuery<SupplierInvite[]>({
    queryKey: ['supplier-invites'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_invites')
        .select('id, email, token, status, subrole_hint, message, invited_at, accepted_at, expires_at')
        .order('invited_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SupplierInvite[]
    },
  })
}

export function useCancelSupplierInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('supplier_invites').update({ status: 'CANCELED' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supplier-invites'] }),
  })
}

export function useRevokeCollaboration() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (collabId: string) => {
      const { error } = await supabase
        .from('collaborations')
        .update({ status: 'REVOKED', revoked_at: new Date().toISOString() })
        .eq('id', collabId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}
