import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { uploadWithProgress } from '@/lib/uploadWithProgress'
import { resizeImageUnder } from '@/lib/imageResize'
import type { Database } from '@/lib/database.types'

type ServiceRow = Database['public']['Tables']['services']['Row']
type ServiceInsert = Database['public']['Tables']['services']['Insert']
type ServiceUpdate = Database['public']['Tables']['services']['Update']
type CategoryRow = Database['public']['Tables']['service_categories']['Row']
type PhotoRow = Database['public']['Tables']['service_photos']['Row']
type ModifierRow = Database['public']['Tables']['service_modifiers']['Row']
type ModifierInsert = Database['public']['Tables']['service_modifiers']['Insert']

export type ServicePlusRow = { id: string; service_id: string; name: string; price: number; sort_order: number }

export type ServiceWithExtras = ServiceRow & {
  service_photos: PhotoRow[]
  service_modifiers: ModifierRow[]
  service_plus: ServicePlusRow[]
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
          'id, fornitore_id, category_id, name, description, base_price, unit, is_active, display_order, tags, created_at, updated_at, imported_template_id, capostipite_can_edit, service_photos(*), service_modifiers(*), service_plus(id, service_id, name, price, sort_order), service_categories(id, name, slug, subrole)',
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
          'id, fornitore_id, category_id, name, description, base_price, unit, is_active, display_order, tags, created_at, updated_at, imported_template_id, capostipite_can_edit, service_photos(*), service_modifiers(*), service_plus(id, service_id, name, price, sort_order), service_categories(id, name, slug, subrole)',
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
      // I capostipiti possono estendere oltre il loro standard (es. noleggio
      // attrezzatura). Carichiamo il proprio verticale + le trasversali (NULL)
      // + TUTTE le categorie standard, così la tendina non è più limitata.
      let q = supabase
        .from('service_categories')
        .select('*')
        .order('name', { ascending: true })
      if (subrole) q = q.or(`subrole.ilike.${subrole},subrole.is.null,is_standard.eq.true`)
      const { data, error } = await q
      if (error) throw error
      let rows = data ?? []
      // Ordina: prima il proprio verticale, poi le trasversali, poi le altre.
      if (subrole) {
        const sr = subrole.toLowerCase()
        const rank = (c: CategoryRow) => {
          const s = String((c as { subrole?: string | null }).subrole ?? '').toLowerCase()
          return s === sr ? 0 : s === '' ? 1 : 2
        }
        rows = [...rows].sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)))
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
      // .select() ci dice quante righe ha davvero eliminato: se 0 (RLS filtra la riga perché non
      // e' tua, o un trigger la protegge) NON dobbiamo mostrare un falso "Eliminato". Un eventuale
      // errore di cascade (es. voce collegata a un preventivo) risale in chiaro via `error`.
      const { data, error } = await supabase.from('services').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('Non è stato eliminato nulla: il servizio non risulta tuo oppure è protetto (collegato a un preventivo/contratto). Se è importato, aggiornalo o riprova; se persiste segnalacelo.')
      }
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

// Disimporta in BLOCCO: elimina più servizi importati in un colpo. Ritorna quanti ne ha davvero
// tolti (RLS filtra a quelli di proprietà) così l'UI non mente sull'esito.
export function useBulkDeleteServices() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return { deleted: 0 }
      const { data, error } = await supabase.from('services').delete().in('id', ids).select('id')
      if (error) throw error
      return { deleted: data?.length ?? 0 }
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

// "Plus" del servizio: sotto-voci con prezzo proprio → il catalogo mostra "A partire da".
export function useAddPlus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { service_id: string; name: string; price: number; sort_order?: number }) => {
      const { data, error } = await (supabase.from as any)('service_plus').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

export function useRemovePlus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from as any)('service_plus').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  })
}

// Ridimensionamento foto: sistema interno condiviso (lib/imageResize) che garantisce di stare
// SOTTO il cap del bucket service-photos (2MB) — niente più 413, anche su Safari/iPadOS.

export function useUploadPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ serviceId, file, onProgress }: { serviceId: string; file: File; onProgress?: (pct: number) => void }) => {
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
        resized = await resizeImageUnder(file)
      } catch (e) {
        const isHeic = /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
        if (isHeic) {
          throw new Error('Foto in formato HEIC (iPhone) non supportato su questo browser. Vai in Impostazioni iPhone → Fotocamera → Formati → "Più compatibile" (JPEG), oppure converti la foto in JPEG prima di caricarla.')
        }
        throw new Error('Impossibile leggere la foto. Verifica che sia un\'immagine valida (JPG/PNG/WEBP).')
      }
      const photoId = crypto.randomUUID()
      const path = `${serviceId}/${photoId}.${resized.ext}`

      await uploadWithProgress('service-photos', path, resized.blob, {
        contentType: resized.contentType, cacheControl: '3600', upsert: false, onProgress,
      })

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
