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

function avatarUrlFor(uid: string) {
  return `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/brand-assets/${uid}/avatar.jpg`
}

export function useSuppliers() {
  return useQuery<SupplierSummary[]>({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborations')
        .select(
          'id, status, accepted_at, fornitore_id, supplier:profiles!collaborations_fornitore_id_fkey(id, full_name, business_name, subrole, phone)',
        )
        .order('accepted_at', { ascending: false, nullsFirst: false })
      if (error) throw error

      const rows = (data ?? []) as Array<{
        id: string
        status: string
        accepted_at: string | null
        fornitore_id: string
        supplier: SupplierSummary['business_name'] extends string
          ? Pick<SupplierSummary, 'id' | 'full_name' | 'business_name' | 'subrole' | 'phone'>
          : { id: string; full_name: string | null; business_name: string | null; subrole: string | null; phone: string | null } | null
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
          avatar_url: avatarUrlFor(r.fornitore_id),
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
        .select('id, full_name, business_name, subrole, phone, brand_primary_color, brand_secondary_color')
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      return { ...data, avatar_url: avatarUrlFor(data.id) }
    },
  })
}

export function useInviteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (email: string) => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) throw new Error('Non autenticato')

      // Cerca utente esistente per email (RLS: amministrazione lato server in v2)
      // Per MVP: invio Resend tramite Edge Function (non implementata ora);
      // qui creiamo collaboration in PENDING per email NON ancora in piattaforma:
      // serve user lookup via funzione admin. Simulato cercando in profiles via RPC.
      // In MVP demo: chiediamo che il fornitore sia gia registrato; se l'email
      // corrisponde a un profilo, creiamo la collaboration.
      const { data: found } = await supabase
        .from('profiles')
        .select('id, role')
        .ilike('full_name', `%${email.split('@')[0]}%`)
        .maybeSingle()

      if (!found) {
        throw new Error('Fornitore non trovato. In v1 servono profili gia` registrati; v2 implementeremo invito via email magic link.')
      }
      if (found.role !== 'FORNITORE') {
        throw new Error('Il profilo trovato non e\' un fornitore.')
      }
      const { data, error } = await supabase
        .from('collaborations')
        .insert({ capostipite_id: me.user.id, fornitore_id: found.id, status: 'PENDING' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
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
