// Libreria CONDIVISA di preset (disposizioni tavola). Non appena staff/admin salva un preset,
// viene distribuito automaticamente a TUTTI i professionisti: qui si legge la libreria (tutti) e,
// se sei curatore (staff/admin), si scrive/cancella. I preset si applicano per NUMERO di foto
// sulla tavola (bucket): un preset da 3 foto compare solo sulle tavole da 3 foto.
import { supabase } from './supabase'
import type { SavedLayout } from './albumLayouts'
import type { Frame } from './albumEngine'
import type { FreeSlot } from './albumLayouts'

type Row = { id: string; name: string; n: number; frames: Frame[] | null; els: FreeSlot[] | null }

// Tutti leggono la libreria condivisa.
export async function listSharedPresets(): Promise<SavedLayout[]> {
  try {
    const { data } = await (supabase.from as any)('album_shared_presets')
      .select('id, name, n, frames, els').order('created_at', { ascending: false })
    return ((data ?? []) as Row[])
      .filter((r) => Array.isArray(r.frames) && r.frames!.length)
      .map((r) => ({ id: r.id, name: r.name, n: r.n, frames: r.frames as Frame[], ...(r.els && r.els.length ? { els: r.els } : {}), shared: true }))
  } catch { return [] }
}

// Sei curatore (staff/admin) → puoi scrivere nella libreria di tutti?
export async function amIPresetCurator(): Promise<boolean> {
  try { const { data } = await (supabase as any).rpc('am_i_preset_curator'); return !!data } catch { return false }
}

// Salva un preset nella libreria condivisa (solo curatori; l'RLS blocca gli altri).
export async function saveSharedPreset(name: string, frames: Frame[], els?: FreeSlot[]): Promise<SavedLayout | null> {
  const n = (els && els.length ? els.length : frames.length)
  const { data, error } = await (supabase.from as any)('album_shared_presets')
    .insert({ name: name.trim() || `Libreria ${n} foto`, n, frames, els: els && els.length ? els : null })
    .select('id, name, n, frames, els').single()
  if (error || !data) return null
  const r = data as Row
  return { id: r.id, name: r.name, n: r.n, frames: r.frames as Frame[], ...(r.els && r.els.length ? { els: r.els } : {}), shared: true }
}

export async function deleteSharedPreset(id: string): Promise<void> {
  try { await (supabase.from as any)('album_shared_presets').delete().eq('id', id) } catch { /* RLS/curator */ }
}
