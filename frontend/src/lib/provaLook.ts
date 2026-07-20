// PROVA LOOK (Beta) — tipi + wrapper RPC/edge-function per i due strumenti (acconciatura/trucco).
import { supabase } from '@/lib/supabase'

export type LookKind = 'hair' | 'makeup'
export type LookStyle = { id: string; owner_id: string | null; kind: LookKind; category: string; label: string; prompt_fragment: string; sort: number }
export type LookSession = { id: string; owner_id: string; kind: LookKind; client_label: string | null; selfie_path: string | null; selfie_url: string | null; share_token: string; status: string; created_at: string }
export type LookProposal = { id: string; session_id: string; title: string | null; image_url: string | null; status: 'DRAFT' | 'KEPT' | 'DISCARDED'; client_favorite: boolean; created_at: string }

// etichette categorie (ordine di visualizzazione nel compositore)
export const MAKEUP_CATS = ['preset', 'occasione', 'occhi', 'labbra', 'incarnato', 'blush', 'ciglia', 'intensita'] as const
export const HAIR_CATS = ['preset', 'acconciatura', 'volume', 'accessori', 'colore', 'occasione'] as const
export const CAT_LABEL: Record<string, string> = {
  preset: 'Preset', occasione: 'Occasione', occhi: 'Occhi', labbra: 'Labbra', incarnato: 'Incarnato',
  blush: 'Blush', ciglia: 'Ciglia & sopracciglia', intensita: 'Intensità',
  acconciatura: 'Acconciatura', volume: 'Volume', accessori: 'Accessori', colore: 'Colore',
}

export async function loadCatalog(kind: LookKind): Promise<LookStyle[]> {
  const { data, error } = await (supabase.from as any)('look_styles')
    .select('id, owner_id, kind, category, label, prompt_fragment, sort')
    .eq('kind', kind).eq('active', true).order('sort')
  if (error) throw new Error(error.message)
  return (data ?? []) as LookStyle[]
}

export async function createSession(kind: LookKind, clientLabel: string, entryId?: string | null): Promise<LookSession> {
  const { data, error } = await (supabase.rpc as any)('look_session_create', { p_kind: kind, p_client_label: clientLabel, p_entry: entryId ?? null })
  if (error) throw new Error(error.message)
  return data as LookSession
}

// carica la foto della cliente (fornitore autenticato) e la aggancia alla sessione
export async function uploadSelfie(session: LookSession, file: File): Promise<string> {
  const { data: me } = await supabase.auth.getUser()
  const uid = me.user?.id; if (!uid) throw new Error('auth')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${uid}/look-src/${crypto.randomUUID()}.${ext}`
  const up = await supabase.storage.from('event-guest-uploads').upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (up.error) throw up.error
  const url = supabase.storage.from('event-guest-uploads').getPublicUrl(path).data.publicUrl
  const { error } = await (supabase.rpc as any)('look_session_set_selfie', { p_session: session.id, p_path: path, p_url: url })
  if (error) throw new Error(error.message)
  return url
}

export async function generateProposal(sessionId: string, prompt: string, title: string, spec: unknown): Promise<{ ok?: boolean; error?: string; proposal?: LookProposal; balance?: number; cost?: number }> {
  const { data, error } = await (supabase as any).functions.invoke('look-generate', { body: { session_id: sessionId, prompt, title, spec } })
  if (error) return { error: error.message }
  return data
}

export const setProposalStatus = (id: string, status: 'DRAFT' | 'KEPT' | 'DISCARDED') =>
  (supabase.rpc as any)('look_proposal_set_status', { p_proposal: id, p_status: status })

export const sendSession = (sessionId: string): Promise<{ ok?: boolean; error?: string; token?: string; kept?: number }> =>
  (supabase.rpc as any)('look_session_send', { p_session: sessionId }).then((r: any) => r.data ?? { error: r.error?.message })

// ── vista cliente (anon, per token) ──
export type LookClientData = { ok?: boolean; error?: string; kind: LookKind; client_label: string | null; studio: string | null; logo: string | null; color: string | null; proposals: { id: string; title: string | null; image_url: string; favorite: boolean }[] }
export async function loadByToken(token: string): Promise<LookClientData> {
  const { data, error } = await (supabase.rpc as any)('look_get_by_token', { p_token: token })
  if (error) throw new Error(error.message)
  return data as LookClientData
}
export const setFavorite = (token: string, proposalId: string) =>
  (supabase.rpc as any)('look_set_favorite', { p_token: token, p_proposal: proposalId }).then((r: any) => r.data ?? { error: r.error?.message })

// costruisce il prompt dai frammenti scelti + testo libero
export function composePrompt(fragments: string[], freeText: string): string {
  const parts = [...fragments.map((f) => f.trim()).filter(Boolean)]
  if (freeText.trim()) parts.push(freeText.trim())
  return parts.join(', ')
}
