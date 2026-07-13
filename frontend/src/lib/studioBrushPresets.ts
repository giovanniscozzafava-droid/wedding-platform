// Preset di pennello per lo Studio immagine: 36 "disegnati a mano" (matita/penna/acquerello/…)
// + preset personalizzati salvabili (localStorage) e scegliibili da dropdown.
export type StudioTool =
  | 'brush' | 'pencil' | 'ink' | 'marker' | 'watercolor' | 'chalk' | 'pastel' | 'floral' | 'airbrush' | 'smudge'
export type BrushPreset = { id: string; name: string; tool: StudioTool; size: number; opacity: number; color?: string; custom?: boolean }

const P = (id: string, name: string, tool: StudioTool, size: number, opacity: number, color?: string): BrushPreset => ({ id, name, tool, size, opacity, color })

// 36 preset predefiniti, raggruppabili per "famiglia".
export const BUILTIN_PRESETS: BrushPreset[] = [
  // Matite
  P('pen-hb', 'Matita HB', 'pencil', 6, 0.7), P('pen-2b', 'Matita 2B', 'pencil', 10, 0.85),
  P('pen-6b', 'Matita 6B morbida', 'pencil', 18, 0.95), P('pen-hard', 'Matita dura fine', 'pencil', 3, 0.55),
  P('pen-sketch', 'Schizzo veloce', 'pencil', 4, 0.5), P('pen-shade', 'Ombreggiatura', 'pencil', 34, 0.28),
  // Penne / inchiostro
  P('ink-fine', 'Penna fine', 'ink', 3, 1), P('ink-med', 'Penna media', 'ink', 6, 1),
  P('ink-bold', 'Penna grossa', 'ink', 12, 1), P('ink-full', 'Inchiostro pieno', 'ink', 22, 1),
  P('ink-detail', 'Dettaglio fine', 'ink', 2, 1), P('ink-outline', 'Contorno netto', 'ink', 5, 1),
  // Pennarelli / evidenziatori
  P('mrk-std', 'Pennarello', 'marker', 16, 0.9), P('mrk-wide', 'Pennarello largo', 'marker', 32, 0.85),
  P('mrk-hi-yellow', 'Evidenziatore giallo', 'marker', 40, 0.35, '#ffe14d'),
  P('mrk-hi-pink', 'Evidenziatore rosa', 'marker', 40, 0.35, '#ff8fb3'),
  P('mrk-hi-green', 'Evidenziatore verde', 'marker', 40, 0.35, '#b6f09a'),
  // Acquerello
  P('wc-light', 'Acquerello leggero', 'watercolor', 44, 0.22), P('wc-med', 'Acquerello medio', 'watercolor', 66, 0.4),
  P('wc-strong', 'Acquerello carico', 'watercolor', 92, 0.6), P('wc-wash', 'Velatura', 'watercolor', 120, 0.15),
  // Carboncino / gesso / pastello
  P('chk-char', 'Carboncino', 'chalk', 24, 0.8), P('chk-fine', 'Carboncino fine', 'chalk', 10, 0.7),
  P('chk-gesso', 'Gessetto', 'chalk', 22, 0.55), P('pst-soft', 'Pastello morbido', 'pastel', 34, 0.75),
  P('pst-std', 'Pastello', 'pastel', 22, 0.85),
  // Aerografo / spray
  P('air-soft', 'Aerografo', 'airbrush', 50, 0.28), P('air-fine', 'Aerografo fine', 'airbrush', 24, 0.4),
  P('air-spray', 'Spray', 'airbrush', 72, 0.22),
  // Pennelli
  P('br-soft', 'Pennello morbido', 'brush', 30, 0.6), P('br-hard', 'Pennello duro', 'brush', 12, 1),
  P('br-calli', 'Pennello calligrafico', 'brush', 18, 1), P('br-big', 'Pennello grande', 'brush', 80, 0.8),
  P('br-fill', 'Riempimento', 'brush', 130, 0.95),
  // Extra
  P('smudge', 'Sfumino', 'smudge', 30, 1), P('floral', 'Floreale', 'floral', 40, 0.9), P('floral-sm', 'Floreale piccolo', 'floral', 20, 0.9),
]

const KEY = 'studio:brushPresets'
export function loadCustomPresets(): BrushPreset[] {
  try { const raw = localStorage.getItem(KEY); const arr = raw ? JSON.parse(raw) : []; return Array.isArray(arr) ? arr.map((x) => ({ ...x, custom: true })) : [] } catch { return [] }
}
export function saveCustomPreset(p: Omit<BrushPreset, 'id' | 'custom'>): BrushPreset[] {
  const list = loadCustomPresets()
  const id = `custom-${Date.now()}`
  const next = [...list, { ...p, id, custom: true }]
  try { localStorage.setItem(KEY, JSON.stringify(next.map(({ custom: _c, ...r }) => r))) } catch { /* quota */ }
  return next
}
export function deleteCustomPreset(id: string): BrushPreset[] {
  const next = loadCustomPresets().filter((p) => p.id !== id)
  try { localStorage.setItem(KEY, JSON.stringify(next.map(({ custom: _c, ...r }) => r))) } catch { /* */ }
  return next
}
