import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type ServiceRow = Database['public']['Tables']['services']['Row']
type ServiceInsert = Database['public']['Tables']['services']['Insert']
type ServiceUpdate = Database['public']['Tables']['services']['Update']
type CategoryRow = Database['public']['Tables']['service_categories']['Row']
type PhotoRow = Database['public']['Tables']['service_photos']['Row']
type ModifierRow = Database['public']['Tables']['service_modifiers']['Row']
type ModifierInsert = Database['public']['Tables']['service_modifiers']['Insert']

export type ServiceWithExtras = ServiceRow & {
  service_photos: PhotoRow[]
  service_modifiers: ModifierRow[]
  service_categories: Pick<CategoryRow, 'id' | 'name' | 'slug' | 'subrole'> | null
}

export type ServiceWithSupplier = ServiceWithExtras & {
  supplier: { id: string; full_name: string | null; business_name: string | null; subrole: string | null } | null
}

export function useServices(opts?: { onlyActive?: boolean }) {
  return useQuery<ServiceWithExtras[]>({
    queryKey: ['services', { onlyActive: opts?.onlyActive ?? true }],
    queryFn: async () => {
      let q = supabase
        .from('services')
        .select(
          'id, fornitore_id, category_id, name, description, base_price, unit, is_active, created_at, updated_at, service_photos(*), service_modifiers(*), service_categories(id, name, slug, subrole)',
        )
        .order('updated_at', { ascending: false })
      if (opts?.onlyActive ?? true) q = q.eq('is_active', true)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as ServiceWithExtras[]
    },
  })
}

export function useServicesBySupplier(supplierId: string | null) {
  return useQuery<ServiceWithExtras[]>({
    queryKey: ['services', 'supplier', supplierId],
    enabled: !!supplierId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select(
          'id, fornitore_id, category_id, name, description, base_price, unit, is_active, created_at, updated_at, service_photos(*), service_modifiers(*), service_categories(id, name, slug, subrole)',
        )
        .eq('fornitore_id', supplierId!)
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as ServiceWithExtras[]
    },
  })
}

export function useCategories(subrole?: string | null) {
  return useQuery<CategoryRow[]>({
    queryKey: ['categories', subrole ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('service_categories')
        .select('*')
        .order('name', { ascending: true })
      if (subrole) q = q.or(`subrole.eq.${subrole},subrole.is.null`)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCollaboratingSuppliers() {
  return useQuery({
    queryKey: ['collaborations', 'active-suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborations')
        .select(
          'id, status, fornitore_id, accepted_at, supplier:profiles!collaborations_fornitore_id_fkey(id, full_name, business_name, subrole)',
        )
        .eq('status', 'ACTIVE')
        .order('accepted_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Omit<ServiceInsert, 'fornitore_id'>) => {
      const { data: me } = await supabase.auth.getUser()
      if (!me.user) throw new Error('Utente non autenticato')
      const { data, error } = await supabase
        .from('services')
        .insert({ ...payload, fornitore_id: me.user.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useUpdateService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ServiceUpdate }) => {
      const { data, error } = await supabase
        .from('services')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('services').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useAddModifier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ModifierInsert) => {
      const { data, error } = await supabase
        .from('service_modifiers')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useRemoveModifier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_modifiers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

// Resize lato browser: max 1600px lato lungo, jpeg quality 0.82.
// Riduce tipica foto 5MB → ~300KB e bypassa il file_size_limit 2MB.
async function resizeImage(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = rej
    i.src = dataUrl
  })
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height))
  const w = Math.round(img.width * ratio)
  const h = Math.round(img.height * ratio)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise<Blob>((res, rej) => {
    canvas.toBlob((b) => b ? res(b) : rej(new Error('toBlob fallito')), 'image/jpeg', quality)
  })
}

export function useUploadPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ serviceId, file }: { serviceId: string; file: File }) => {
      // Validazione mime
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Formato non supportato. Usa JPG, PNG o WEBP.')
      }
      // Limite foto: max 10 per servizio
      const { count } = await supabase.from('service_photos')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', serviceId)
      if ((count ?? 0) >= 10) throw new Error('Limite raggiunto (max 10 foto per servizio)')

      // Resize → blob jpeg
      const resized = await resizeImage(file)
      const photoId = crypto.randomUUID()
      const path = `${serviceId}/${photoId}.jpg`

      const up = await supabase.storage.from('service-photos').upload(path, resized, {
        contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
      })
      if (up.error) throw new Error(up.error.message)

      const { data: pub } = supabase.storage.from('service-photos').getPublicUrl(path)
      // thumbnail = stesso URL (CSS gestisce la dimensione visibile)
      const ins = await supabase.from('service_photos').insert({
        id: photoId,
        service_id: serviceId,
        original_url: pub.publicUrl,
        thumbnail_url: pub.publicUrl,
        sort_order: count ?? 0,
      }).select().single()
      if (ins.error) {
        await supabase.storage.from('service-photos').remove([path])
        throw new Error(ins.error.message)
      }
      return { photo: ins.data as PhotoRow }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useDeletePhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_photos').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}
