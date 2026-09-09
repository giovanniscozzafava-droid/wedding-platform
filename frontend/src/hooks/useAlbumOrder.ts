import { supabase } from '@/lib/supabase'

// "Album: dal PDF a un dunque" — dopo l'approvazione del layout (album_layout_approval,
// esistente), la coppia sceglie le opzioni di stampa con uno stepper semplice (senza prezzi:
// beta senza money-talk) e chiude con una conferma esplicita. Tutto arriva in album_orders
// (coda stampa/FotoLab già esistente), notifica il fotografo (tabella notifiche) e compare
// nella scheda commissione pubblica (/p/commissione/:token).

const COMM_BUCKET = 'album-commissions'

export type OptionCategory = 'COVER_COLOR' | 'LOGO' | 'BOX' | 'FINISH'
export type CatalogOption = { id: string; key: string; label: string; description: string | null; allows_cover_photo: boolean }
export type OptionCatalog = Record<OptionCategory, CatalogOption[]>

const EMPTY_CATALOG: OptionCatalog = { COVER_COLOR: [], LOGO: [], BOX: [], FINISH: [] }

export async function getOptionCatalogForEntry(entryId: string): Promise<OptionCatalog> {
  const { data, error } = await (supabase as any).rpc('album_option_catalog_for_entry', { p_entry: entryId })
  if (error) throw error
  if (!data?.ok) return EMPTY_CATALOG
  return { ...EMPTY_CATALOG, ...(data.options ?? {}) } as OptionCatalog
}

export type ChosenOption = { key: string; label: string } | null
export type OptionChoices = {
  cover_color?: ChosenOption
  logo?: ChosenOption
  box?: ChosenOption
  finishes?: { key: string; label: string }[]
}

export type CoverPhotoCandidate = { id: string; thumb: string; label: string | null }

// Foto già selezionate per l'album (album_choice = 'KEPT'): stesso criterio usato
// dall'impaginatore. La coppia sceglie la foto di copertina fra queste.
export async function getCoverPhotoCandidates(entryId: string): Promise<CoverPhotoCandidate[]> {
  const { data, error } = await (supabase.from as any)('gallery_media')
    .select('id, drive_file_id, thumbnail_link, source_name, media_type, album_choice')
    .eq('entry_id', entryId).eq('media_type', 'PHOTO').eq('album_choice', 'KEPT')
    .order('created_at', { ascending: true })
  if (error) throw error
  const isDrive = (driveId: string | null) => !!driveId && !driveId.startsWith('demo-') && !driveId.startsWith('guest:') && !driveId.startsWith('album:')
  return ((data ?? []) as { id: string; drive_file_id: string | null; thumbnail_link: string | null; source_name: string | null }[])
    .map((m) => ({
      id: m.id,
      thumb: isDrive(m.drive_file_id) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w400` : (m.thumbnail_link ?? ''),
      label: m.source_name,
    }))
    .filter((m) => !!m.thumb)
}

export async function confirmAlbumOrder(entryId: string, payload: {
  optionChoices: OptionChoices; note?: string | null; coverPhotoMediaId?: string | null; coverPhotoNote?: string | null
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc('album_order_confirm', {
    p_entry: entryId,
    p_option_choices: payload.optionChoices ?? {},
    p_note: payload.note?.trim() || null,
    p_cover_photo_media_id: payload.coverPhotoMediaId ?? null,
    p_cover_photo_note: payload.coverPhotoNote?.trim() || null,
  })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error === 'forbidden' ? 'Non autorizzato per questo evento' : 'Conferma non riuscita')
  return data.order_id as string
}

export type AlbumOrderStatus = {
  layoutApproved: boolean
  confirmed: boolean
  orderId?: string
  confirmedAt?: string
  confirmedByName?: string
  optionChoices?: OptionChoices
  notes?: string | null
  coverPhotoUrl?: string | null
  coverPhotoLabel?: string | null
  coverPhotoNote?: string | null
  pages?: number
  formatKey?: string
  orderPdfPath?: string | null
}

export async function getAlbumOrderStatus(entryId: string): Promise<AlbumOrderStatus> {
  const { data, error } = await (supabase as any).rpc('album_order_status', { p_entry: entryId })
  if (error) throw error
  if (!data?.ok) return { layoutApproved: false, confirmed: false }
  return {
    layoutApproved: !!data.layout_approved,
    confirmed: !!data.confirmed,
    orderId: data.order_id,
    confirmedAt: data.confirmed_at,
    confirmedByName: data.confirmed_by_name,
    optionChoices: data.option_choices,
    notes: data.notes,
    coverPhotoUrl: data.cover_photo_url,
    coverPhotoLabel: data.cover_photo_label,
    coverPhotoNote: data.cover_photo_note,
    pages: data.pages,
    formatKey: data.format_key,
    orderPdfPath: data.order_pdf_path,
  }
}

export async function approveAlbumLayout(entryId: string): Promise<void> {
  const { data, error } = await (supabase as any).rpc('album_approve_layout', { p_entry: entryId })
  if (error) throw error
  if (data?.error === 'no_layout') throw new Error('Nessuna pagina da approvare')
  if (data?.error) throw new Error(data.error)
}

export async function reopenAlbumLayout(entryId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('album_reopen_layout', { p_entry: entryId })
  if (error) throw error
}

export async function uploadOrderPdf(entryId: string, blob: Blob): Promise<string> {
  const path = `${entryId}/scheda-ordine-${crypto.randomUUID()}.pdf`
  const up = await supabase.storage.from(COMM_BUCKET).upload(path, blob, { contentType: 'application/pdf', upsert: true })
  if (up.error) throw up.error
  return path
}

export async function saveOrderPdfPath(orderId: string, path: string): Promise<void> {
  const { data, error } = await (supabase as any).rpc('album_order_save_pdf_path', { p_order: orderId, p_path: path })
  if (error) throw error
  if (!data?.ok) throw new Error('Non salvato')
}

export async function getOrderPdfSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(COMM_BUCKET).createSignedUrl(path, 3600)
  if (error) throw error
  return data.signedUrl
}

// --- Fotografo: gestione del catalogo opzioni (colore copertina / logo / box / finiture) ---
export type MyOption = CatalogOption & { category: OptionCategory; active: boolean; sort_order: number }

export async function getMyOptionCatalog(): Promise<MyOption[]> {
  const { data: uidData } = await supabase.auth.getUser()
  const id = uidData.user?.id
  if (!id) return []
  const { data, error } = await (supabase.from as any)('album_option_catalog')
    .select('id, category, key, label, description, allows_cover_photo, sort_order, active')
    .eq('owner_id', id)
    .order('category', { ascending: true }).order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as any
}

export async function getGlobalDefaultOptions(): Promise<(CatalogOption & { category: OptionCategory; sort_order: number })[]> {
  const { data, error } = await (supabase.from as any)('album_option_catalog')
    .select('id, category, key, label, description, allows_cover_photo, sort_order, active')
    .is('owner_id', null).eq('active', true)
    .order('category', { ascending: true }).order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as any
}

export async function upsertMyOption(row: {
  id?: string; category: OptionCategory; key: string; label: string; description?: string | null
  allows_cover_photo?: boolean; sort_order?: number; active?: boolean
}): Promise<void> {
  const { data: uidData } = await supabase.auth.getUser()
  const owner_id = uidData.user?.id
  if (!owner_id) throw new Error('Non autenticato')
  const payload = {
    id: row.id, owner_id, category: row.category, key: row.key, label: row.label,
    description: row.description ?? null, allows_cover_photo: !!row.allows_cover_photo,
    sort_order: row.sort_order ?? 0, active: row.active ?? true,
  }
  const { error } = await (supabase.from as any)('album_option_catalog').upsert(payload)
  if (error) throw error
}

export async function deleteMyOption(id: string): Promise<void> {
  const { error } = await (supabase.from as any)('album_option_catalog').delete().eq('id', id)
  if (error) throw error
}

// Copia i default globali come punto di partenza personalizzabile (owner_id proprio),
// per il fotografo che vuole personalizzare senza scrivere tutto da zero.
export async function cloneDefaultsAsMine(category: OptionCategory): Promise<void> {
  const { data: uidData } = await supabase.auth.getUser()
  const owner_id = uidData.user?.id
  if (!owner_id) throw new Error('Non autenticato')
  const defaults = await getGlobalDefaultOptions()
  const rows = defaults.filter((d) => d.category === category).map((d) => ({
    owner_id, category: d.category, key: d.key, label: d.label, description: d.description,
    allows_cover_photo: d.allows_cover_photo, sort_order: d.sort_order, active: true,
  }))
  if (!rows.length) return
  const { error } = await (supabase.from as any)('album_option_catalog').upsert(rows, { onConflict: 'owner_id,category,key' })
  if (error) throw error
}
