import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

// Angoli evento: il professionista compone "angoli" a tema mettendo insieme accessori.
// RLS via corner_can_manage. Pattern sb() per non perdere il `this` di supabase.from.
const sb = (t: string): any => (supabase as any).from(t)

export type CornerItem = {
  id: string; corner_id: string; entry_id: string; label: string; qty: number
  unit_cost: number | null; note: string | null; checked: boolean; sort_order: number
}
export type Corner = {
  id: string; entry_id: string; name: string; kind: string; note: string | null
  status: 'DA_PREPARARE' | 'PRONTO'; assignee: string | null; sort_order: number
  items: CornerItem[]
}

// Preset: tipi di angolo con accessori tipici pre-compilati (modificabili).
export type CornerPreset = { kind: string; label: string; emoji: string; items: string[] }
export const CORNER_PRESETS: CornerPreset[] = [
  { kind: 'BOMBONIERE', label: 'Angolo bomboniere', emoji: '🎁', items: ['Bomboniere', 'Consolle/tavolo', 'Tovaglia', 'Cartellini nomi', 'Segnaposto', 'Fiori / centrotavola', 'Cartello "Grazie"'] },
  { kind: 'POLAROID', label: 'Angolo polaroid', emoji: '📸', items: ['Macchina Polaroid', 'Pellicole', 'Filo + mollette', 'Pennarelli', 'Lavagna / cornice', 'Cestino raccogli-foto', 'Cartello istruzioni'] },
  { kind: 'CONFETTATA', label: 'Confettata', emoji: '🍬', items: ['Confetti (gusti vari)', 'Vasi / alzatine', 'Sacchetti', 'Palette / cucchiai', 'Cartellini gusti', 'Nastri', 'Cartello'] },
  { kind: 'CANDY', label: 'Candy bar', emoji: '🍭', items: ['Caramelle assortite', 'Barattoli in vetro', 'Alzatine', 'Sacchetti / scatoline', 'Pinze', 'Etichette'] },
  { kind: 'PHOTOBOOTH', label: 'Photo booth', emoji: '🎬', items: ['Fondale / backdrop', 'Props (occhiali, cappelli…)', 'Luci', 'Stampante istantanea', 'Cornici', 'Cavalletto'] },
  { kind: 'WELCOME', label: 'Angolo welcome', emoji: '👋', items: ['Cartello benvenuto', 'Cavalletto / lavagna', 'Tableau', 'Fiori', 'Acqua aromatizzata', 'Ventagli / coperte'] },
  { kind: 'GUESTBOOK', label: 'Libro firme', emoji: '✍️', items: ['Guestbook', 'Penne', 'Polaroid + colla', 'Supporto / leggio', 'Cartello'] },
  { kind: 'SWEET', label: 'Sweet table', emoji: '🧁', items: ['Dolcetti / mignon', 'Alzatine', 'Piattini', 'Posate', 'Tovaglioli', 'Cartellini'] },
  { kind: 'CIGAR', label: 'Angolo sigari', emoji: '🚬', items: ['Sigari', 'Tagliasigari', 'Accendini / fiammiferi', 'Posacenere', 'Poltroncine', 'Cartello'] },
  { kind: 'DRINK', label: 'Angolo drink / open bar', emoji: '🍸', items: ['Bicchieri', 'Spirits / bottiglie', 'Ghiaccio', 'Guarnizioni', 'Shaker / attrezzi', 'Listino drink', 'Cannucce'] },
  { kind: 'PROFUMI', label: 'Angolo profumi', emoji: '🌸', items: ['Boccette profumo', 'Etichette', 'Imbuto', 'Cartello'] },
  { kind: 'ALTRO', label: 'Angolo personalizzato', emoji: '✨', items: [] },
]
export const presetByKind = (k: string): CornerPreset =>
  CORNER_PRESETS.find((p) => p.kind === k) ?? CORNER_PRESETS[CORNER_PRESETS.length - 1]!

export function useCorners(entryId: string) {
  return useQuery<Corner[]>({
    queryKey: ['corners', entryId],
    enabled: !!entryId,
    queryFn: async () => {
      const { data, error } = await sb('event_corners')
        .select('*, items:event_corner_items(*)')
        .eq('entry_id', entryId)
        .order('sort_order')
      if (error) throw error
      return (data ?? []).map((c: Corner) => ({ ...c, items: (c.items ?? []).slice().sort((a, b) => a.sort_order - b.sort_order) }))
    },
  })
}

export function useCornerMutations(entryId: string) {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ['corners', entryId] })

  // crea un angolo da preset (o vuoto) + i suoi accessori
  const createFromPreset = useMutation({
    mutationFn: async (p: CornerPreset) => {
      const { data: corner, error } = await sb('event_corners')
        .insert({ entry_id: entryId, name: p.label, kind: p.kind }).select('id').single()
      if (error) throw error
      if (p.items.length) {
        const rows = p.items.map((label, i) => ({ corner_id: corner.id, entry_id: entryId, label, sort_order: i }))
        const { error: e2 } = await sb('event_corner_items').insert(rows)
        if (e2) throw e2
      }
      return corner.id as string
    },
    onSuccess: refresh,
  })

  const updateCorner = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Corner> }) => {
      const { error } = await sb('event_corners').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const deleteCorner = useMutation({
    mutationFn: async (id: string) => { const { error } = await sb('event_corners').delete().eq('id', id); if (error) throw error },
    onSuccess: refresh,
  })

  const addItem = useMutation({
    mutationFn: async ({ cornerId, label, sort }: { cornerId: string; label: string; sort: number }) => {
      const { error } = await sb('event_corner_items').insert({ corner_id: cornerId, entry_id: entryId, label, sort_order: sort })
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<CornerItem> }) => {
      const { error } = await sb('event_corner_items').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: refresh,
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => { const { error } = await sb('event_corner_items').delete().eq('id', id); if (error) throw error },
    onSuccess: refresh,
  })

  return { createFromPreset, updateCorner, deleteCorner, addItem, updateItem, deleteItem }
}

export const cornerCost = (c: Corner): number =>
  c.items.reduce((s, it) => s + (it.unit_cost ?? 0) * (it.qty || 0), 0)
