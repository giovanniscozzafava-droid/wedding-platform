import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Persistenza dei progetti dello Studio disegno. RLS owner-only: owner_id = auth.uid().
const sb = (t: string): any => (supabase as any).from(t)
async function uid(): Promise<string | null> { const { data } = await supabase.auth.getUser(); return data.user?.id ?? null }

export type DesignMeta = { id: string; title: string; width: number; height: number; thumbnail: string | null; updated_at: string }
export type DesignFull = DesignMeta & { doc: string | null }

export function useDesigns() {
  return useQuery<DesignMeta[]>({
    queryKey: ['design-docs'],
    queryFn: async () => {
      const id = await uid(); if (!id) return []
      const { data, error } = await sb('design_docs').select('id, title, width, height, thumbnail, updated_at').eq('owner_id', id).order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as DesignMeta[]
    },
  })
}

export async function fetchDesign(id: string): Promise<DesignFull | null> {
  const { data, error } = await sb('design_docs').select('id, title, width, height, thumbnail, doc, updated_at').eq('id', id).maybeSingle()
  if (error) throw error
  return (data ?? null) as DesignFull | null
}

export function useDesignMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['design-docs'] })
  return {
    save: useMutation({
      mutationFn: async (p: { id?: string | null; title: string; width: number; height: number; doc: string; thumbnail: string }): Promise<string> => {
        const owner = await uid(); if (!owner) throw new Error('Sessione scaduta')
        if (p.id) {
          const { error } = await sb('design_docs').update({ title: p.title, width: p.width, height: p.height, doc: p.doc, thumbnail: p.thumbnail }).eq('id', p.id)
          if (error) throw error
          return p.id
        }
        const { data, error } = await sb('design_docs').insert({ owner_id: owner, title: p.title, width: p.width, height: p.height, doc: p.doc, thumbnail: p.thumbnail }).select('id').single()
        if (error) throw error
        return data.id as string
      },
      onSuccess: inv,
    }),
    del: useMutation({
      mutationFn: async (id: string) => { const { error } = await sb('design_docs').delete().eq('id', id); if (error) throw error },
      onSuccess: inv,
    }),
  }
}
