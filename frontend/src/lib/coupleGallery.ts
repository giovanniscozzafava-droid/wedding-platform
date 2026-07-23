// ============================================================================
// GALLERIA SPOSI (superficie pubblica, link con token, senza login).
// Tipi + wrapper delle RPC anon (gallery_get_by_token / *_decide / *_undo /
// *_advance / *_submit) + URL Drive + raggruppamento in capitoli editoriali.
// ============================================================================
import { supabase } from '@/lib/supabase'

export type GMedia = {
  id: string; drive_file_id: string; thumbnail_link: string | null
  media_type: 'PHOTO' | 'VIDEO'; album_moment: string | null; source_name: string | null
  decision: boolean | null // decisione del giro corrente: true=tieni, false=lascia, null=non deciso
  in_pool: boolean         // nel pool del giro corrente (la pagina swipe filtra su questo)
}
export type GSelection = {
  round: number; status: 'ACTIVE' | 'SUBMITTED'; target_min: number; target_max: number
  total: number; pool: number; decided: number; kept: number; submitted_at: string | null
}
export type GData = {
  ok?: boolean; error?: string
  gallery: { title: string; couple_label: string | null; kind: string; event_date: string | null; expires_at: string | null }
  photographer: { business_name: string | null; full_name: string | null; email: string | null; logo: string | null; color: string | null }
  selection: GSelection
  media: GMedia[]
}
export type GStateResp = { ok?: boolean; error?: string } & Partial<GSelection>

// URL immagine: le foto vivono su Google Drive (thumbnail pubblica, niente auth) oppure
// su storage (thumbnail_link). Mirror di AlbumDesignerPage.
const isDrive = (id: string) => !!id && !id.startsWith('demo-') && !id.startsWith('guest:') && !id.startsWith('album:')
export const thumbUrl = (m: GMedia) => (isDrive(m.drive_file_id) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w800` : (m.thumbnail_link ?? ''))
export const hiUrl = (m: GMedia) => (isDrive(m.drive_file_id) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

export async function loadGallery(token: string): Promise<GData> {
  const { data, error } = await (supabase.rpc as any)('gallery_get_by_token', { p_token: token })
  if (error) throw new Error(error.message)
  return data as GData
}
export const decideMedia = (token: string, media: string, keep: boolean): Promise<GStateResp> =>
  (supabase.rpc as any)('gallery_selection_decide', { p_token: token, p_media: media, p_keep: keep }).then((r: any) => (r.data ?? { error: r.error?.message }) as GStateResp)
export const undoMedia = (token: string, media: string): Promise<GStateResp> =>
  (supabase.rpc as any)('gallery_selection_undo', { p_token: token, p_media: media }).then((r: any) => (r.data ?? { error: r.error?.message }) as GStateResp)
export const advanceRound = (token: string): Promise<GStateResp> =>
  (supabase.rpc as any)('gallery_selection_advance', { p_token: token }).then((r: any) => (r.data ?? { error: r.error?.message }) as GStateResp)
export const submitSelection = (token: string, force = false): Promise<{ ok?: boolean; error?: string; kept?: number; min?: number; max?: number }> =>
  (supabase.rpc as any)('gallery_selection_submit', { p_token: token, p_force: force }).then((r: any) => (r.data ?? { error: r.error?.message }))
export const requestReopen = (token: string): Promise<{ ok?: boolean; error?: string }> =>
  (supabase.rpc as any)('gallery_selection_request_reopen', { p_token: token }).then((r: any) => (r.data ?? { error: r.error?.message }))

// ── Capitoli editoriali: i ~20 "momenti" fini (album_moment) raccolti nei 4 capitoli
//    del racconto. Si mostrano solo i capitoli con foto; l'ordine è quello del racconto.
export const CHAPTERS: { key: string; label: string; moments: string[] }[] = [
  { key: 'preparativi', label: 'I preparativi', moments: ['preparativi', 'preparativi-sposo', 'dettagli-sposa', 'primo-sguardo', 'arrivo', 'dettagli'] },
  { key: 'cerimonia',   label: 'La cerimonia',  moments: ['partecipazione', 'chiesa', 'anelli', 'uscita', 'famiglia'] },
  { key: 'ricevimento', label: 'Il ricevimento', moments: ['coppia', 'aperitivo', 'tableau', 'ricevimento', 'brindisi'] },
  { key: 'festa',       label: 'La festa',       moments: ['torta', 'primo-ballo', 'festa', 'bouquet', 'chiusura'] },
]
const CH_OF = new Map<string, string>()
for (const c of CHAPTERS) for (const m of c.moments) CH_OF.set(m, c.key)

export type Chapter = { key: string; label: string; items: GMedia[] }
export function chaptersOf(media: GMedia[]): Chapter[] {
  const buckets = new Map<string, GMedia[]>()
  for (const m of media) {
    const ch = (m.album_moment && CH_OF.get(m.album_moment)) || '_altro'
    const arr = buckets.get(ch); if (arr) arr.push(m); else buckets.set(ch, [m])
  }
  const out: Chapter[] = []
  for (const c of CHAPTERS) { const items = buckets.get(c.key); if (items?.length) out.push({ key: c.key, label: c.label, items }) }
  const rest = buckets.get('_altro')
  if (rest?.length) out.push({ key: '_altro', label: out.length ? 'La giornata' : 'Le vostre foto', items: rest })
  return out
}

export const fmtEventDate = (s: string | null | undefined) => {
  if (!s) return null
  const d = new Date(s); if (Number.isNaN(+d)) return null
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
}
