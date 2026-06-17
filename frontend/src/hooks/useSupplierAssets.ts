import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// tabella nuova non ancora nei tipi generati: accesso non tipizzato
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = () => (supabase as any).from('supplier_assets')

export type SupplierAsset = {
  id: string
  supplier_id: string
  storage_path: string
  caption: string | null
  tags: string[]
  kind: string
  event_kind: string | null
  is_public: boolean
  sort_order: number
  created_at: string
}

const BUCKET = 'supplier-assets'

export function assetPublicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

export function useSupplierAssets() {
  return useQuery<SupplierAsset[]>({
    queryKey: ['supplier-assets'],
    queryFn: async () => {
      const { data, error } = await tbl().select('*').order('sort_order').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as SupplierAsset[]
    },
  })
}

export function useSupplierAssetMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['supplier-assets'] })
  return {
    upload: useMutation({
      mutationFn: async ({ file, tags, caption, event_kind }: { file: File; tags?: string[]; caption?: string; event_kind?: string | null }) => {
        const { data: me } = await supabase.auth.getUser()
        const uid = me.user?.id
        if (!uid) throw new Error('Non autenticato')
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
        const path = `${uid}/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '31536000', upsert: false })
        if (up.error) throw up.error
        const { error } = await tbl().insert({ supplier_id: uid, storage_path: path, tags: tags ?? [], caption: caption ?? null, event_kind: event_kind ?? null })
        if (error) throw error
      },
      onSuccess: inv,
    }),
    update: useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<SupplierAsset, 'caption' | 'tags' | 'event_kind' | 'is_public' | 'sort_order'>> }) => {
        const { error } = await tbl().update(patch).eq('id', id)
        if (error) throw error
      },
      onSuccess: inv,
    }),
    remove: useMutation({
      mutationFn: async (asset: SupplierAsset) => {
        const { error } = await tbl().delete().eq('id', asset.id)
        if (error) throw error
        try { await supabase.storage.from(BUCKET).remove([asset.storage_path]) } catch { /* best-effort */ }
      },
      onSuccess: inv,
    }),
  }
}
