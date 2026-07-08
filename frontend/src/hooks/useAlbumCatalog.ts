import { supabase } from '@/lib/supabase'
import { loadPdf } from '@/lib/pdf'

// Dati del flusso "Catalogo PDF → scelta + firma → commessa". Il fotografo carica il PDF
// del proprio catalogo e marca gli hotspot; la coppia lo sfoglia, sceglie, firma → commessa
// in album_orders (coda azienda). Bucket: album-catalogs (pubblico), album-commissions (privato).

const CAT_BUCKET = 'album-catalogs'
const COMM_BUCKET = 'album-commissions'

export type Hotspot = {
  id?: string; page: number; x: number; y: number; w: number; h: number
  label: string; default_format?: string | null; default_pages?: number | null
  cost?: number | null    // costo di listino (quanto paga il fotografo al lab) — l'AI lo legge dal PDF
  price?: number | null   // prezzo di vendita al cliente (= costo + ricarico)
}
export type Catalog = { id: string; name: string; pdf_path: string; page_count: number; owner_id?: string; studio?: string; markup_percent?: number }
export type CommissionSpecs = { format: string; size?: string; pages: number; box?: string; finishes?: string[]; note?: string }
export type CommissionPayload = {
  catalog_id?: string | null; page?: number | null; model_label: string
  specs: CommissionSpecs; signed_by: string; signed_at: string; commission_pdf_path?: string | null
}

async function uid(): Promise<string | null> {
  const { data } = await supabase.auth.getUser(); return data.user?.id ?? null
}

export function catalogPublicUrl(path: string): string {
  return supabase.storage.from(CAT_BUCKET).getPublicUrl(path).data.publicUrl
}

// --- FOTOGRAFO -------------------------------------------------------------
export async function getMyCatalog(): Promise<{ catalog: Catalog; hotspots: Hotspot[] } | null> {
  const id = await uid(); if (!id) return null
  const { data: cat } = await (supabase as any)
    .from('album_catalogs').select('id,name,pdf_path,page_count,owner_id,markup_percent')
    .eq('owner_id', id).eq('active', true).order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (!cat) return null
  const { data: hs } = await (supabase as any)
    .from('album_catalog_hotspots').select('id,page,x,y,w,h,label,default_format,default_pages,price,cost')
    .eq('catalog_id', cat.id).order('page', { ascending: true })
  return { catalog: cat as Catalog, hotspots: (hs ?? []) as Hotspot[] }
}

// AI: legge il PDF del catalogo ed estrae [{label, price}] (il fotografo poi conferma).
export async function extractCatalogPrices(pdfPath: string): Promise<{ label: string; price: number | null }[]> {
  const buf = await (await fetch(catalogPublicUrl(pdfPath))).arrayBuffer()
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  const base64 = btoa(bin)
  const { data, error } = await (supabase as any).functions.invoke('album-catalog-extract', { body: { base64 } })
  if (error) throw new Error(error.message)
  if (!data?.ok) {
    const e = data?.error
    throw new Error(e === 'no_ai_key' ? 'Manca la chiave AI sul server (ANTHROPIC_API_KEY)'
      : e === 'parse' || e === 'ai_error' ? "L'AI non è riuscita a leggere i prezzi dal PDF"
      : (e ?? 'Estrazione non riuscita'))
  }
  return (data.models ?? []) as { label: string; price: number | null }[]
}

// Modelli del catalogo del fotografo (label + prezzo), per il listino/pacchetti e il pannello prezzo.
export async function getCatalogModels(): Promise<{ label: string; price: number | null }[]> {
  const r = await getMyCatalog()
  if (!r) return []
  const seen = new Map<string, number | null>()
  for (const h of r.hotspots) if (!seen.has(h.label)) seen.set(h.label, h.price ?? null)
  return Array.from(seen, ([label, price]) => ({ label, price }))
}

export async function uploadCatalogPdf(file: File, name?: string): Promise<Catalog> {
  const id = await uid(); if (!id) throw new Error('Non autenticato')
  if (file.type !== 'application/pdf') throw new Error('Carica un file PDF')
  // numero pagine via pdf.js
  let pageCount = 0
  try { const doc = await loadPdf(await file.arrayBuffer()); pageCount = doc.numPages } catch { pageCount = 0 }
  const path = `${id}/${crypto.randomUUID()}.pdf`
  const up = await supabase.storage.from(CAT_BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: true })
  if (up.error) throw up.error
  // 1 catalogo attivo per fotografo (MVP): disattiva i precedenti
  await (supabase as any).from('album_catalogs').update({ active: false }).eq('owner_id', id).eq('active', true)
  const { data, error } = await (supabase as any).from('album_catalogs')
    .insert({ owner_id: id, name: name || file.name.replace(/\.pdf$/i, '') || 'Catalogo album', pdf_path: path, page_count: pageCount, active: true })
    .select('id,name,pdf_path,page_count,owner_id').single()
  if (error) throw error
  return data as Catalog
}

export async function saveHotspots(catalogId: string, hotspots: Hotspot[]): Promise<void> {
  await (supabase as any).from('album_catalog_hotspots').delete().eq('catalog_id', catalogId)
  if (!hotspots.length) return
  const rows = hotspots.map((h) => ({
    catalog_id: catalogId, page: h.page, x: h.x, y: h.y, w: h.w, h: h.h,
    label: h.label || 'Modello', default_format: h.default_format ?? null, default_pages: h.default_pages ?? null,
    price: h.price ?? null, cost: h.cost ?? null,
  }))
  const { error } = await (supabase as any).from('album_catalog_hotspots').insert(rows)
  if (error) throw error
}

// Ricarico predefinito del catalogo (%): prezzo cliente = costo × (1 + ricarico/100).
export async function saveCatalogMarkup(catalogId: string, pct: number): Promise<void> {
  const { error } = await (supabase as any).from('album_catalogs').update({ markup_percent: Math.max(0, pct) }).eq('id', catalogId)
  if (error) throw error
}
export const applyMarkup = (cost: number | null | undefined, pct: number): number | null =>
  cost == null ? null : Math.round(Number(cost) * (1 + Math.max(0, pct) / 100))

export async function getStudioProfile(): Promise<{ business_name?: string; full_name?: string } | null> {
  const id = await uid(); if (!id) return null
  const { data } = await (supabase as any).from('profiles').select('business_name,full_name').eq('id', id).maybeSingle()
  return data ?? null
}

// --- COPPIA ----------------------------------------------------------------
export async function getCatalogForEntry(entryId: string): Promise<{ catalog: Catalog; hotspots: Hotspot[] } | null> {
  const { data, error } = await (supabase as any).rpc('album_catalog_for_entry', { p_entry: entryId })
  if (error) throw error
  if (!data || data.error) return null
  return { catalog: data.catalog as Catalog, hotspots: (data.hotspots ?? []) as Hotspot[] }
}

export async function uploadCommissionPdf(entryId: string, blob: Blob): Promise<string> {
  const path = `${entryId}/${crypto.randomUUID()}.pdf`
  const up = await supabase.storage.from(COMM_BUCKET).upload(path, blob, { contentType: 'application/pdf', upsert: true })
  if (up.error) throw up.error
  return path
}

export async function createCommission(entryId: string, payload: CommissionPayload): Promise<string> {
  const { data, error } = await (supabase as any).rpc('album_commission_create', { p_entry: entryId, p_payload: payload })
  if (error) throw error
  if (!data?.ok) throw new Error(data?.error === 'forbidden' ? 'Non autorizzato per questo evento' : 'Commessa non creata')
  // Notifica SEMPRE il fotografo (email): la commessa firmata deve arrivargli.
  try {
    await (supabase as any).functions.invoke('commission-notify', { body: {
      entryId, order_id: data.order_id, model_label: payload.model_label, page: payload.page,
      specs: payload.specs, signed_by: payload.signed_by, pdf_path: payload.commission_pdf_path,
    } })
  } catch { /* notifica best-effort, non blocca la firma */ }
  return data.order_id as string
}
