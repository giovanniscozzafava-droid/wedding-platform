import { supabase } from '@/lib/supabase'

// Puntino rosso come GUIDA visiva: dal campanello → card evento → tab dentro la card.
export type UnreadEntry = { entry_id: string; types: string[]; n: number }

// Quale tab evidenziare per ogni tipo di notifica.
export const NOTIF_TAB: Record<string, string> = {
  photo_comment: 'foto',
  audio_wish: 'foto',
  circle_request: 'overview',
  circle_accepted: 'overview',
  circle_added: 'overview',
  couple_joined: 'overview',
}

export async function fetchUnreadByEntry(): Promise<Record<string, UnreadEntry>> {
  const { data } = await (supabase as unknown as { rpc: (f: string) => Promise<{ data: UnreadEntry[] | null }> }).rpc('unread_by_entry')
  const map: Record<string, UnreadEntry> = {}
  for (const r of data ?? []) map[r.entry_id] = r
  return map
}

export async function markEntryTabRead(entry: string, types: string[]) {
  await (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => Promise<unknown> }).rpc('mark_entry_notifications_read', { p_entry: entry, p_types: types })
}

// I tipi di notifica che riguardano una certa tab (per spegnere il puntino all'apertura).
export function typesForTab(tab: string): string[] {
  return Object.entries(NOTIF_TAB).filter(([, t]) => t === tab).map(([type]) => type)
}

// La tab da evidenziare per un evento, dati i tipi non letti.
export function tabsWithDot(types: string[]): Set<string> {
  const s = new Set<string>()
  for (const t of types) { const tab = NOTIF_TAB[t]; if (tab) s.add(tab) }
  return s
}
