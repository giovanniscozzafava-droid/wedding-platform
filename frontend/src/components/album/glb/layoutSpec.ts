// LA TAVOLA DI OGNI LAYOUT, in frazioni della copertina (origine in alto a sinistra, x→destra, y→basso).
// È l'unica sorgente delle posizioni: la usano il 3D (decal), il PSD per l'azienda e il PDF della
// commessa. Deve combaciare con la geometria di blender/album_gen.py (incassi, fasce, placche).
import type { Layout } from '@/components/album/albumCatalog'

export type Rect = { x: number; y: number; w: number; h: number }   // frazioni 0..1 (centro + misure)
export type LayoutSpec = {
  photos: Rect[]                 // finestre foto (lastra)
  band?: Rect                    // fascia / seconda superficie
  plate?: Rect                   // targhetta
  names: { x: number; y: number; size: number; align?: 'center' | 'left' | 'right' }   // ancora dei nomi (size = altezza in frazione di H)
  logo: { x: number; y: number; w: number }                                            // logo: centro x, BORDO SUPERIORE y, larghezza (frazioni)
  crystals?: { x1: number; y1: number; x2: number; y2: number }[]
}

// Nota: il 3D di album_gen.py lavora in coordinate centrate (y verso l'alto); qui y è verso il basso:
// y_qui = 0.5 − y_3d/h.
export const LAYOUT_SPEC: Record<Layout, LayoutSpec> = {
  plain: { photos: [], names: { x: 0.5, y: 0.84, size: 0.05 }, logo: { x: 0.5, y: 0.4, w: 0.34 } },
  plate: { photos: [], plate: { x: 0.5, y: 0.5, w: 0.32, h: 0.16 }, names: { x: 0.5, y: 0.74, size: 0.05 }, logo: { x: 0.5, y: 0.62, w: 0.26 } },
  monogram: { photos: [], names: { x: 0.5, y: 0.66, size: 0.045 }, logo: { x: 0.5, y: 0.3, w: 0.36 } },
  fascia: { photos: [], band: { x: 0.5, y: 0.5, w: 0.96, h: 0.2 }, plate: { x: 0.74, y: 0.5, w: 0.34, h: 0.11 }, crystals: [{ x1: 0.08, y1: 0.5, x2: 0.62, y2: 0.5 }],
    names: { x: 0.74, y: 0.5, size: 0.03 }, logo: { x: 0.5, y: 0.66, w: 0.28 } },
  'fascia-ornament': { photos: [], band: { x: 0.5, y: 0.46, w: 0.96, h: 0.22 }, crystals: [{ x1: 0.16, y1: 0.36, x2: 0.84, y2: 0.36 }, { x1: 0.16, y1: 0.56, x2: 0.84, y2: 0.56 }],
    names: { x: 0.5, y: 0.46, size: 0.06 }, logo: { x: 0.5, y: 0.37, w: 0.3 } },
  oblique: { photos: [], band: { x: 0.5, y: 0.81, w: 1, h: 0.38 }, crystals: [{ x1: 0, y1: 0.66, x2: 1, y2: 0.49 }], names: { x: 0.62, y: 0.86, size: 0.055 }, logo: { x: 0.62, y: 0.72, w: 0.3 } },
  'swarovski-line': { photos: [], plate: { x: 0.34, y: 0.5, w: 0.36, h: 0.11 }, crystals: [{ x1: 0.6, y1: 0.12, x2: 0.6, y2: 0.88 }], names: { x: 0.34, y: 0.5, size: 0.03 }, logo: { x: 0.34, y: 0.6, w: 0.28 } },
  'swarovski-cluster': { photos: [], names: { x: 0.5, y: 0.72, size: 0.055 }, logo: { x: 0.5, y: 0.56, w: 0.32 } },
  'photo-vertical': { photos: [{ x: 0.58, y: 0.5, w: 0.38, h: 0.58 }], names: { x: 0.29, y: 0.78, size: 0.05 }, logo: { x: 0.29, y: 0.5, w: 0.3 } },
  'photo-panoramic': { photos: [{ x: 0.5, y: 0.42, w: 0.76, h: 0.28 }], names: { x: 0.5, y: 0.7, size: 0.055 }, logo: { x: 0.5, y: 0.6, w: 0.3 } },
  'photo-small': { photos: [{ x: 0.6, y: 0.42, w: 0.3, h: 0.24 }], names: { x: 0.6, y: 0.64, size: 0.042 }, logo: { x: 0.3, y: 0.38, w: 0.3 } },
  'photo-full': { photos: [{ x: 0.5, y: 0.5, w: 0.94, h: 0.94 }], names: { x: 0.5, y: 0.88, size: 0.05 }, logo: { x: 0.5, y: 0.72, w: 0.3 } },
  trilogy: { photos: [{ x: 0.26, y: 0.45, w: 0.2, h: 0.2 }, { x: 0.5, y: 0.45, w: 0.2, h: 0.2 }, { x: 0.74, y: 0.45, w: 0.2, h: 0.2 }], names: { x: 0.5, y: 0.74, size: 0.048 }, logo: { x: 0.5, y: 0.6, w: 0.3 } },
  print: { photos: [], names: { x: 0.5, y: 0.82, size: 0.05 }, logo: { x: 0.5, y: 0.42, w: 0.36 } },
  laser: { photos: [], band: { x: 0.5, y: 0.5, w: 0.92, h: 0.92 }, names: { x: 0.5, y: 0.5, size: 0.06 }, logo: { x: 0.5, y: 0.34, w: 0.36 } },
}

/** Il ritaglio del logo del catalogo diventa un tratto su fondo trasparente, nel colore d'inchiostro;
 *  la sigla «cod.NN» stampata in alto a destra nel riquadro viene cancellata. */
export function logoToInk(img: HTMLImageElement, w: number, h: number, rgb: [number, number, number]): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(w * 0.7), 0, Math.round(w * 0.3), Math.round(h * 0.16))   // via la sigla cod.NN
  const d = ctx.getImageData(0, 0, w, h); const px = d.data
  for (let i = 0; i < px.length; i += 4) {
    const lum = (px[i]! * 0.299 + px[i + 1]! * 0.587 + px[i + 2]! * 0.114) / 255
    px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = Math.round((1 - lum) * 255)
  }
  ctx.putImageData(d, 0, 0)
  return c
}
export const inkRgb = (ink?: string): [number, number, number] =>
  ink === 'white' ? [246, 241, 232] : ink === 'gold' ? [212, 176, 96] : ink === 'silver' ? [215, 215, 220] : [58, 44, 30]

/** Ritaglio «a copertura» di un'immagine dentro un rettangolo (come object-fit: cover). */
export function coverFit(iw: number, ih: number, w: number, h: number): { sx: number; sy: number; sw: number; sh: number } {
  const s = Math.max(w / iw, h / ih)
  const sw = w / s, sh = h / s
  return { sx: (iw - sw) / 2, sy: (ih - sh) / 2, sw, sh }
}
