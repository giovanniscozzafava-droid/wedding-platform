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
          'id, fornitore_id, category_id, name, description, base_price, unit, is_active, display_order, created_at, updated_at, service_photos(*), service_modifiers(*), service_categories(id, name, slug, subrole)',
        )
        .order('display_order', { ascending: true })
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
          'id, fornitore_id, category_id, name, description, base_price, unit, is_active, display_order, created_at, updated_at, service_photos(*), service_modifiers(*), service_categories(id, name, slug, subrole)',
        )
        .eq('fornitore_id', supplierId!)
        .eq('is_active', true)
        .order('display_order', { ascending: true })
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
      // Se passato subrole: SOLO categorie di quel verticale (match
      // case-insensitive: in anagrafica esiste sia 'parrucchiere' che
      // 'Parrucchiere'). Senza subrole: categorie trasversali (subrole IS NULL).
      if (subrole) q = q.ilike('subrole', subrole)
      const { data, error } = await q
      if (error) throw error
      let rows = data ?? []
      // Fallback: se per il subrole non ci sono categorie standard,
      // mostriamo quelle trasversali (subrole IS NULL) per non lasciare
      // il dropdown vuoto.
      if (subrole && rows.length === 0) {
        const fb = await supabase
          .from('service_categories')
          .select('*')
          .is('subrole', null)
          .order('name', { ascending: true })
        if (!fb.error) rows = fb.data ?? []
      }
      return rows
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

export function useReorderServices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await (supabase as unknown as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: Error | null }> })
        .rpc('reorder_services', { p_ids: orderedIds })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
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

// Resize lato browser: max 1400px lato lungo, prima webp q=0.78, fallback jpeg q=0.78.
// WebP ha ~30% bytes in meno a parita di qualita visiva → ottimizza storage cloud.
// Riduce tipica foto 5MB → ~200KB e bypassa il file_size_limit 2MB.
async function resizeImage(file: File, maxDim = 1400, quality = 0.78): Promise<{ blob: Blob; ext: 'webp' | 'jpg'; contentType: string }> {
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
  // prova webp, fallback jpeg
  const webp = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/webp', quality))
  if (webp && webp.size > 0) return { blob: webp, ext: 'webp', contentType: 'image/webp' }
  const jpeg = await new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), 'image/jpeg', quality))
  if (!jpeg) throw new Error('Impossibile generare immagine compressa')
  return { blob: jpeg, ext: 'jpg', contentType: 'image/jpeg' }
}

export function useUploadPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ serviceId, file }: { serviceId: string; file: File }) => {
      // Limite foto: max 10 per servizio
      const { count } = await supabase.from('service_photos')
        .select('id', { count: 'exact', head: true })
        .eq('service_id', serviceId)
      if ((count ?? 0) >= 10) throw new Error('Limite raggiunto (max 10 foto per servizio)')

      // Resize: il canvas accetta qualsiasi formato che il browser decodifica.
      // HEIC dell'iPhone viene decodificato da Safari/iOS ma NON da Chrome desktop.
      // Se decodifica fallisce, mostra messaggio chiaro.
      let resized
      try {
        resized = await resizeImage(file)
      } catch (e) {
        const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
        if (isHeic) {
          throw new Error('Foto in formato HEIC (iPhone) non supportato su questo browser. Vai in Impostazioni iPhone → Fotocamera → Formati → "Più compatibile" (JPEG), oppure converti la foto in JPEG prima di caricarla.')
        }
        throw new Error('Impossibile leggere la foto. Verifica che sia un\'immagine valida (JPG/PNG/WEBP).')
      }
      const photoId = crypto.randomUUID()
      const path = `${serviceId}/${photoId}.${resized.ext}`

      const up = await supabase.storage.from('service-photos').upload(path, resized.blob, {
        contentType: resized.contentType, cacheControl: '3600', upsert: false,
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
