// Tipi condivisi del motore Studio immagine.
export type Tool =
  | 'brush' | 'pencil' | 'ink' | 'marker' | 'watercolor' | 'chalk' | 'pastel' | 'floral' | 'airbrush' | 'smudge' | 'eraser' | 'stamp'
  | 'line' | 'rect' | 'ellipse' | 'arrow' | 'fill' | 'text' | 'eyedropper' | 'hand' | 'move'
export type LayerMeta = { id: string; name: string; visible: boolean; opacity: number; blend: GlobalCompositeOperation; alphaLock?: boolean }
export type SymMode = 'off' | 'v' | 'h' | 'quad' | 'radial'
export type Pt = { x: number; y: number }
export type DabOpt = { color: string; size: number; opacity: number; press: number; tilt: number; motif?: string; softness?: number }
// Oggetto testo editabile (stile Photoshop): coord in spazio DOC (px canvas), larghezza box `w` con a-capo automatico.
export type TextObj = { id: string; x: number; y: number; w: number; text: string; font: string; size: number; color: string; align: 'left' | 'center' | 'right' }
