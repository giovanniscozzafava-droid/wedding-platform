// IL PSD PER L'AZIENDA: la copertina a misura reale (300 dpi), a livelli, con le posizioni esatte.
// Livelli: Sfondo (materiale/colore di riferimento) · Finestra foto N (la foto già ritagliata a
// copertura nella sua finestra) · Logo cod.NN · Nomi · Guide (rettangoli con quote in mm) ·
// Specifiche (testo). Più le guide di Photoshop sui bordi di ogni finestra.
import { writePsd, type Psd, type Layer } from 'ag-psd'
import { LAYOUT_SPEC, coverFit, logoToInk, type LayoutSpec } from '@/components/album/glb/layoutSpec'
import type { Layout } from '@/components/album/albumCatalog'

export type CoverPsdInput = {
  layout: Layout
  wCm: number; hCm: number
  dpi?: number
  modelLabel: string
  materialLabel?: string; colorLabel?: string; colorHex?: string
  photos: (HTMLImageElement | null)[]          // una per finestra (in ordine)
  logo?: { image: HTMLImageElement | HTMLCanvasElement; code: string; composed?: boolean } | null
  names?: string
  ink?: string                                  // colore di nomi/logo
  couple?: string; studio?: string; orderRef?: string
}

const mm = (fr: number, cm: number) => Math.round(fr * cm * 10)

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  return [c, c.getContext('2d')!]
}

/** Costruisce il PSD e lo restituisce come Blob. Restituisce anche la tabella delle posizioni (mm). */
export function buildCoverPsd(inp: CoverPsdInput): { blob: Blob; positions: { label: string; x: number; y: number; w: number; h: number }[]; tavolaDataUrl: string } {
  const dpi = inp.dpi ?? 300
  const W = Math.round(inp.wCm / 2.54 * dpi), H = Math.round(inp.hCm / 2.54 * dpi)
  const spec: LayoutSpec = LAYOUT_SPEC[inp.layout]
  const ink = inp.ink ?? '#3a2c1e'
  const layers: Layer[] = []
  const positions: { label: string; x: number; y: number; w: number; h: number }[] = []
  const guides: { location: number; direction: 'horizontal' | 'vertical' }[] = []

  // 1) sfondo: colore del materiale (riferimento visivo, non da stampare)
  {
    const [c, ctx] = canvas(W, H)
    ctx.fillStyle = inp.colorHex ?? '#e9e2d6'; ctx.fillRect(0, 0, W, H)
    layers.push({ name: `Sfondo · ${inp.materialLabel ?? 'materiale'}${inp.colorLabel ? ` ${inp.colorLabel}` : ''} (riferimento)`, canvas: c, opacity: 1 })
  }
  // 2) fascia / lastra (riferimento)
  if (spec.band) {
    const [c, ctx] = canvas(W, H)
    const r = spec.band
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.fillRect((r.x - r.w / 2) * W, (r.y - r.h / 2) * H, r.w * W, r.h * H)
    layers.push({ name: 'Fascia / lastra (riferimento)', canvas: c })
    positions.push({ label: 'Fascia / lastra', x: mm(r.x - r.w / 2, inp.wCm), y: mm(r.y - r.h / 2, inp.hCm), w: mm(r.w, inp.wCm), h: mm(r.h, inp.hCm) })
  }
  // 3) finestre foto: la foto ritagliata a copertura, alle dimensioni esatte
  spec.photos.forEach((r, i) => {
    const x = Math.round((r.x - r.w / 2) * W), y = Math.round((r.y - r.h / 2) * H), w = Math.round(r.w * W), h = Math.round(r.h * H)
    const img = inp.photos[i]
    const [c, ctx] = canvas(w, h)
    if (img) {
      const f = coverFit(img.naturalWidth, img.naturalHeight, w, h)
      ctx.drawImage(img, f.sx, f.sy, f.sw, f.sh, 0, 0, w, h)
    } else {
      ctx.fillStyle = 'rgba(200,200,200,0.5)'; ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#555'; ctx.font = `${Math.round(h * 0.12)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('FOTO', w / 2, h / 2)
    }
    layers.push({ name: `Finestra foto ${spec.photos.length > 1 ? i + 1 : ''} · ${mm(r.w, inp.wCm)}×${mm(r.h, inp.hCm)} mm`.replace('  ', ' '), canvas: c, left: x, top: y, right: x + w, bottom: y + h })
    positions.push({ label: `Finestra foto ${spec.photos.length > 1 ? i + 1 : ''}`.trim(), x: mm(r.x - r.w / 2, inp.wCm), y: mm(r.y - r.h / 2, inp.hCm), w: mm(r.w, inp.wCm), h: mm(r.h, inp.hCm) })
    guides.push({ location: x, direction: 'vertical' }, { location: x + w, direction: 'vertical' }, { location: y, direction: 'horizontal' }, { location: y + h, direction: 'horizontal' })
  })
  // 4) logo del catalogo: dal riquadro al solo tratto (luma → alpha), nel colore d'inchiostro
  if (inp.logo) {
    const iw = inp.logo.image instanceof HTMLCanvasElement ? inp.logo.image.width : inp.logo.image.naturalWidth
    const ih = inp.logo.image instanceof HTMLCanvasElement ? inp.logo.image.height : inp.logo.image.naturalHeight
    const lw = Math.round(spec.logo.w * W), lh = Math.round(lw * ih / iw)
    let t: HTMLCanvasElement
    if (inp.logo.composed) { t = document.createElement('canvas'); t.width = lw; t.height = lh; t.getContext('2d')!.drawImage(inp.logo.image, 0, 0, lw, lh) }
    else t = logoToInk(inp.logo.image as HTMLImageElement, lw, lh, hexToRgb(ink))
    const x = Math.round(spec.logo.x * W - lw / 2), y = Math.round(spec.logo.y * H)
    layers.push({ name: `Logo ${inp.logo.code} · larghezza ${mm(spec.logo.w, inp.wCm)} mm`, canvas: t, left: x, top: y, right: x + lw, bottom: y + lh })
    positions.push({ label: `Logo ${inp.logo.code}`, x: mm(x / W, inp.wCm), y: mm(y / H, inp.hCm), w: mm(lw / W, inp.wCm), h: mm(lh / H, inp.hCm) })
  }
  // 5) nomi (se c'è il logo del catalogo, i nomi sono già nel logo: niente riga doppia)
  if (inp.names && !inp.logo) {
    const size = Math.round(spec.names.size * H)
    const font = `italic 400 ${size}px "Fraunces", "Cormorant Garamond", Georgia, serif`
    const [mc, mctx] = canvas(8, 8); mctx.font = font
    const tw = Math.ceil(mctx.measureText(inp.names).width) + size
    const bw = tw, bh = Math.round(size * 1.4)
    const bx = Math.round(spec.names.x * W - bw / 2), by = Math.round(spec.names.y * H - bh / 2)
    const [c, ctx] = canvas(bw, bh)
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = font
    ctx.fillText(inp.names, bw / 2, bh / 2)
    void mc
    layers.push({ name: `Nomi «${inp.names}» · corpo ${mm(spec.names.size, inp.hCm)} mm`, canvas: c, left: bx, top: by, right: bx + bw, bottom: by + bh })
    positions.push({ label: 'Nomi', x: mm((spec.names.x * W - tw / 2) / W, inp.wCm), y: mm((spec.names.y * H - size / 2) / H, inp.hCm), w: mm(tw / W, inp.wCm), h: mm(size / H, inp.hCm) })
    guides.push({ location: Math.round(spec.names.y * H), direction: 'horizontal' })
  }
  // 6) guide disegnate con le quote (per chi non usa le guide di Photoshop)
  {
    const [c, ctx] = canvas(W, H)
    ctx.strokeStyle = '#e0197a'; ctx.lineWidth = Math.max(2, Math.round(dpi / 100)); ctx.setLineDash([12, 8])
    ctx.fillStyle = '#e0197a'; ctx.font = `${Math.round(dpi * 0.11)}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    for (const p of positions) {
      const x = p.x / 10 / inp.wCm * W, y = p.y / 10 / inp.hCm * H, w = p.w / 10 / inp.wCm * W, h = p.h / 10 / inp.hCm * H
      ctx.strokeRect(x, y, w, h)
      ctx.fillText(`${p.label} · x ${p.x} y ${p.y} · ${p.w}×${p.h} mm`, x + 6, y + 6)
    }
    ctx.setLineDash([]); ctx.strokeStyle = '#e0197a'; ctx.strokeRect(1, 1, W - 2, H - 2)
    ctx.fillText(`Copertina ${inp.wCm}×${inp.hCm} cm · ${dpi} dpi · origine in alto a sinistra`, 12, H - Math.round(dpi * 0.2))
    layers.push({ name: 'Guide e quote (non stampare)', canvas: c, opacity: 1 })
  }
  // 7) specifiche
  {
    const [c, ctx] = canvas(W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(0, 0, Math.round(W * 0.5), Math.round(dpi * 1.1))
    ctx.fillStyle = '#222'; ctx.font = `${Math.round(dpi * 0.12)}px sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    const rows = [
      `Modello: ${inp.modelLabel}`, `Materiale: ${inp.materialLabel ?? '—'} · Colore: ${inp.colorLabel ?? '—'}`,
      `Foto: ${spec.photos.length ? `${spec.photos.length} finestra/e` : 'nessuna'} · Logo: ${inp.logo?.code ?? 'nessuno'} · Nomi: ${inp.names ?? '—'}`,
      `${inp.couple ?? ''} · ${inp.studio ?? ''} · ${inp.orderRef ?? ''}`.replace(/^ · | · $/g, ''),
    ]
    rows.forEach((r, i) => ctx.fillText(r, 16, 16 + i * Math.round(dpi * 0.16)))
    layers.push({ name: 'Specifiche (non stampare)', canvas: c, hidden: true })
  }

  const psd: Psd = {
    width: W, height: H, channels: 3, bitsPerChannel: 8, colorMode: 3,
    children: layers,
    imageResources: {
      resolutionInfo: { horizontalResolution: dpi, horizontalResolutionUnit: 'PPI', widthUnit: 'Centimeters', verticalResolution: dpi, verticalResolutionUnit: 'PPI', heightUnit: 'Centimeters' },
      gridAndGuidesInformation: { grid: { horizontal: 18 * 32, vertical: 18 * 32 }, guides },
    },
  }
  // composito (anteprima Photoshop) = tutti i livelli visibili
  const [comp, cctx] = canvas(W, H)
  for (const l of layers) if (!l.hidden && l.canvas) cctx.drawImage(l.canvas as HTMLCanvasElement, l.left ?? 0, l.top ?? 0)
  psd.canvas = comp
  const buf = writePsd(psd, { generateThumbnail: true })
  // la tavola ridotta (per il PDF della commessa)
  const [tv, tctx] = canvas(900, Math.round(900 * H / W)); tctx.drawImage(comp, 0, 0, tv.width, tv.height)
  return { blob: new Blob([buf], { type: 'image/vnd.adobe.photoshop' }), positions, tavolaDataUrl: tv.toDataURL('image/jpeg', 0.85) }
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
