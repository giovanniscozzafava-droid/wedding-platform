// IL PSD PER L'AZIENDA: la copertina a misura reale (300 dpi), a livelli, con le posizioni esatte.
// Livelli: Sfondo (materiale/colore di riferimento) · Finestra foto N (la foto già ritagliata a
// copertura nella sua finestra) · Logo cod.NN · Nomi · Guide (rettangoli con quote in mm) ·
// Specifiche (testo). Più le guide di Photoshop sui bordi di ogni finestra.
import { writePsd, type Psd, type Layer } from 'ag-psd'
import { LAYOUT_SPEC, cropRect, logoToInk, drawCoverText, coverTextMetrics, frameOf, type LayoutSpec, type PhotoCrop, type PhotoFrame, type LogoPlace, type TextPlace } from '@/components/album/glb/layoutSpec'
import { namePlacements, drawDecor, PLATE_MARGIN, decorMap, decorBBox } from '@/components/album/glb/decal'
import type { Decor } from '@/components/album/glb/decor.generated'
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
  /** la data scritta in copertina, come l'ha voluta la coppia */
  dateText?: string
  textPlace?: TextPlace
  ink?: string                                  // colore di nomi/logo
  /** Il decoro proprio del modello (dal catalogo): stampa a tutta copertina + cristalli con i centri. */
  decor?: { family: string; spec: Decor; print: HTMLImageElement | null; stones: HTMLImageElement | null } | null
  /** impaginazione scelta dalla coppia: ritaglio per finestra e posizione/misura del blocco nomi-logo */
  photoCrops?: Record<number, PhotoCrop>
  /** il riquadro di ogni foto quando la coppia lo sposta/allarga/inclina */
  photoFrames?: Record<number, PhotoFrame>
  logoPlace?: LogoPlace
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
  const spec0: LayoutSpec = LAYOUT_SPEC[inp.layout]
  // il blocco nomi/logo dove l'ha messo la coppia (editor), altrimenti dove lo mette il layout
  const spec: LayoutSpec = inp.logoPlace ? { ...spec0, logo: { x: inp.logoPlace.x, y: inp.logoPlace.y, w: inp.logoPlace.w }, names: { ...spec0.names, x: inp.logoPlace.x, y: inp.logoPlace.y + 0.03, align: 'center' } } : spec0
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
  // 3) finestre foto: la foto ritagliata a copertura, alle dimensioni esatte. Il riquadro è quello del
  //    modello, oppure quello che la coppia ha spostato/allargato/inclinato (l'artigiano monta a mano).
  spec.photos.forEach((win, i) => {
    const r: PhotoFrame = frameOf(spec.photos, i, inp.photoFrames) ?? { ...win, rot: 0 }
    const rot = r.rot ?? 0
    const x = Math.round((r.x - r.w / 2) * W), y = Math.round((r.y - r.h / 2) * H), w = Math.round(r.w * W), h = Math.round(r.h * H)
    const img = inp.photos[i]
    // la foto ritagliata nel suo riquadro
    const [inner, ictx] = canvas(Math.max(1, w), Math.max(1, h))
    if (img) {
      // ritaglio «a copertura» col ritaglio scelto dalla coppia nell'editor (stessa geometria del 3D)
      const f = cropRect(img.naturalWidth, img.naturalHeight, w, h, inp.photoCrops?.[i])
      ictx.drawImage(img, f.sx, f.sy, f.sw, f.sh, 0, 0, w, h)
    } else {
      ictx.fillStyle = 'rgba(200,200,200,0.5)'; ictx.fillRect(0, 0, w, h)
      ictx.fillStyle = '#555'; ictx.font = `${Math.round(h * 0.12)}px sans-serif`; ictx.textAlign = 'center'; ictx.fillText('FOTO', w / 2, h / 2)
    }
    const nome = `Finestra foto ${spec.photos.length > 1 ? i + 1 : ''} · ${mm(r.w, inp.wCm)}×${mm(r.h, inp.hCm)} mm${rot ? ` · inclinata ${rot}°` : ''}${inp.photoFrames?.[i] ? ' · spostata dalla coppia (misura da catalogo)' : ''}`.replace('  ', ' ')
    if (rot) {
      // inclinata: il livello copre tutta la copertina, la foto è ruotata attorno al centro del riquadro
      const [c, ctx] = canvas(W, H)
      ctx.save(); ctx.translate(r.x * W, r.y * H); ctx.rotate((rot * Math.PI) / 180)
      ctx.drawImage(inner, -w / 2, -h / 2); ctx.restore()
      layers.push({ name: nome, canvas: c })
    } else {
      layers.push({ name: nome, canvas: inner, left: x, top: y, right: x + w, bottom: y + h })
      guides.push({ location: x, direction: 'vertical' }, { location: x + w, direction: 'vertical' }, { location: y, direction: 'horizontal' }, { location: y + h, direction: 'horizontal' })
    }
    positions.push({ label: `Finestra foto ${spec.photos.length > 1 ? i + 1 : ''}${rot ? ` (inclinata ${rot}°)` : ''}`.trim(), x: mm(r.x - r.w / 2, inp.wCm), y: mm(r.y - r.h / 2, inp.hCm), w: mm(r.w, inp.wCm), h: mm(r.h, inp.hCm) })
  })
  // 3b) il DECORO del modello: la stampa/laser del catalogo a tutta copertina (tinta nell'inchiostro, o a colori)
  //     e i cristalli Swarovski, uno per uno, coi centri quotati
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  if (inp.decor?.print) {
    const [c, ctx] = canvas(W, H)
    const d = inp.decor.spec
    drawDecor(ctx, W, H, d, hexToRgb(ink), { print: inp.decor.print, stones: null }, { inset: 0, aspect: inp.wCm / inp.hCm })
    const what = d.kind === 'plate' ? 'piastra Cristalwhite intagliata (bianco = piastra, vuoto = foro col tessuto a vista)'
      : d.kind === 'strip' ? 'fascia stampata a tutta larghezza' : d.kind === 'panel' ? 'pannello Cristalplex, motivo chiaro'
      : d.color ? 'stampa a colori' : d.tint === 'white' ? 'tratto chiaro' : 'tratto nel colore scelto'
    layers.push({ name: `Decoro ${cap(inp.decor.family)} · ${what} · a tutta copertina`, canvas: c })
    if (d.kind === 'plate') positions.push({ label: 'Piastra Cristalwhite', x: mm(PLATE_MARGIN, inp.wCm), y: mm(PLATE_MARGIN, inp.hCm), w: mm(1 - 2 * PLATE_MARGIN, inp.wCm), h: mm(1 - 2 * PLATE_MARGIN, inp.hCm) })
  }
  if (inp.decor?.spec.stonesXY.length) {
    const [c, ctx] = canvas(W, H)
    const pts = inp.decor.spec.stonesXY
    ctx.lineWidth = Math.max(2, Math.round(dpi / 120)); ctx.font = `${Math.round(dpi * 0.07)}px sans-serif`; ctx.textBaseline = 'middle'
    let minx = 1, miny = 1, maxx = 0, maxy = 0
    const dm = inp.decor.print ? decorMap(inp.decor.spec, inp.wCm / inp.hCm, decorBBox(inp.decor.print)) : null
    pts.forEach(([fx0, fy0, fr], i) => {
      const fx = dm ? dm.toX(fx0) : fx0, fy = dm ? dm.toY(fy0) : fy0
      const x = fx * W, y = fy * H, r = Math.max(4, fr * W)
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e0197a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x - r * 1.8, y); ctx.lineTo(x + r * 1.8, y); ctx.moveTo(x, y - r * 1.8); ctx.lineTo(x, y + r * 1.8); ctx.stroke()
      ctx.fillStyle = '#e0197a'; ctx.textAlign = 'left'; ctx.fillText(`C${i + 1} · ${mm(fx, inp.wCm)},${mm(fy, inp.hCm)} · ø${Math.max(1, Math.round(fr * inp.wCm * 20))}`, x + r * 2, y)
      minx = Math.min(minx, fx - fr); maxx = Math.max(maxx, fx + fr); miny = Math.min(miny, fy - fr * W / H); maxy = Math.max(maxy, fy + fr * W / H)
    })
    layers.push({ name: `Cristalli Swarovski · ${pts.length} pezzi (centri e diametri in mm)`, canvas: c })
    positions.push({ label: `Cristalli (${pts.length})`, x: mm(minx, inp.wCm), y: mm(miny, inp.hCm), w: mm(maxx - minx, inp.wCm), h: mm(maxy - miny, inp.hCm) })
  }
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
  // 5) LA SCRITTA (nomi e data) dove l'ha messa la coppia nell'editor: un livello solo, alla sua misura
  if (inp.textPlace && (inp.names || inp.dateText)) {
    const tp = inp.textPlace
    const m = coverTextMetrics(inp.names, inp.dateText)
    const bw = Math.round(tp.w * W), bh = Math.max(1, Math.round((m.h / m.w) * bw))
    const [tc, tctx] = canvas(bw, bh)
    drawCoverText(tctx, { names: inp.names, date: inp.dateText }, bw / 2, 0, bw, ink)
    const bx = Math.round(tp.x * W - bw / 2), by = Math.round(tp.y * H)
    const what = [inp.names, inp.dateText].filter(Boolean).join(' · ')
    layers.push({ name: `Scritta «${what}» · larga ${mm(tp.w, inp.wCm)} mm`, canvas: tc, left: bx, top: by, right: bx + bw, bottom: by + bh })
    positions.push({ label: 'Scritta (nomi e data)', x: mm(bx / W, inp.wCm), y: mm(by / H, inp.hCm), w: mm(bw / W, inp.wCm), h: mm(bh / H, inp.hCm) })
    guides.push({ location: by, direction: 'horizontal' })
  }
  // 5b) senza posizionamento della coppia: i nomi dove li mette il decoro del modello (sotto i fiori,
  //     ai lati del tronco…) o il layout; col logo del catalogo i nomi sono già dentro il logo
  else if (inp.names && !inp.logo) {
    const sizeFr = inp.decor ? 0.045 : spec.names.size
    const size = Math.round(sizeFr * H)
    const font = `italic 400 ${size}px "Fraunces", "Cormorant Garamond", Georgia, serif`
    const [, mctx] = canvas(8, 8); mctx.font = font
    const places = namePlacements(inp.names, inp.logoPlace ? undefined : inp.decor?.spec, spec.names)
    places.forEach((pl, i) => {
      const tw = Math.ceil(mctx.measureText(pl.text).width) + Math.round(size * 0.4)
      const bw = tw, bh = Math.round(size * 1.4)
      const ax = pl.x * W
      const bx = Math.round(pl.align === 'left' ? ax - size * 0.2 : pl.align === 'right' ? ax - bw + size * 0.2 : ax - bw / 2), by = Math.round(pl.y * H - bh / 2)
      const [c, ctx] = canvas(bw, bh)
      ctx.fillStyle = ink; ctx.textAlign = pl.align; ctx.textBaseline = 'middle'; ctx.font = font
      ctx.fillText(pl.text, pl.align === 'left' ? size * 0.2 : pl.align === 'right' ? bw - size * 0.2 : bw / 2, bh / 2)
      layers.push({ name: `Nomi «${pl.text}»${places.length > 1 ? ` (${i === 0 ? 'sinistra' : 'destra'})` : ''} · corpo ${mm(sizeFr, inp.hCm)} mm`, canvas: c, left: bx, top: by, right: bx + bw, bottom: by + bh })
      positions.push({ label: places.length > 1 ? `Nomi ${i + 1}` : 'Nomi', x: mm(bx / W, inp.wCm), y: mm((pl.y * H - size / 2) / H, inp.hCm), w: mm(bw / W, inp.wCm), h: mm(size / H, inp.hCm) })
      guides.push({ location: Math.round(pl.y * H), direction: 'horizontal' })
    })
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
      ...(inp.decor ? [`Decoro del modello: ${inp.decor.family} · ${inp.decor.spec.color ? 'stampa a colori' : 'tratto monocromo'}${inp.decor.spec.stonesXY.length ? ` · ${inp.decor.spec.stonesXY.length} cristalli Swarovski (vedi livello)` : ''}`] : []),
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
