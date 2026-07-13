import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Paintbrush, Pencil, PenTool, Highlighter, Droplets, Brush, Feather, Flower2, SprayCan, Eraser,
  Minus, Square, Circle, ArrowUpRight, PaintBucket, Type, Pipette, Hand, Move,
  ZoomIn, ZoomOut, Maximize, Undo2, Redo2, Save, Download, FolderOpen, ImagePlus, Images, Plus, Trash2, Copy,
  Eye, EyeOff, ChevronUp, ChevronDown, FilePlus2, X, Expand, FileText, ArrowLeft, PanelRightClose, PanelRightOpen, Search,
  Fingerprint, Lock, Unlock, FlipHorizontal2, FlipVertical2, RotateCw, RotateCcw, SlidersHorizontal,
  Stamp, Home, Maximize2, Minimize2, AlignLeft, AlignCenter, AlignRight, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useDesigns, fetchDesign, useDesignMutations, useAttachableEvents, type DesignMeta } from '@/hooks/useDesignStudio'
import { FONTS, ensureFont, injectFontsStylesheet } from '@/lib/studioFonts'
import { BUILTIN_PRESETS, loadCustomPresets, saveCustomPreset, deleteCustomPreset, type BrushPreset } from '@/lib/studioBrushPresets'
import { STAMPS, STAMP_GROUPS, DEFAULT_STAMP, drawStamp } from '@/lib/studioStamps'
import { loadCustomFonts, importCustomFont } from '@/lib/studioCustomFonts'

// ── Studio disegno a mano libera (tavola grafica / tablet) — ispirato a Procreate ─────────────────
// Motore a LIVELLI raster + engine pennelli a "stamp" (acquarello/gessetto/pastello/floreale…),
// STABILIZZAZIONE del tratto (streamline), pressione e INCLINAZIONE (tilt) della penna, foto di
// riferimento da ricalcare in trasparenza, testo inline con 120+ font Google, export PNG/PDF,
// salvataggio riapribile e indirizzabile a un EVENTO.

type Tool =
  | 'brush' | 'pencil' | 'ink' | 'marker' | 'watercolor' | 'chalk' | 'pastel' | 'floral' | 'airbrush' | 'smudge' | 'eraser' | 'stamp'
  | 'line' | 'rect' | 'ellipse' | 'arrow' | 'fill' | 'text' | 'eyedropper' | 'hand' | 'move'
type LayerMeta = { id: string; name: string; visible: boolean; opacity: number; blend: GlobalCompositeOperation; alphaLock?: boolean }
type SymMode = 'off' | 'v' | 'h' | 'quad' | 'radial'
type Pt = { x: number; y: number }
type DabOpt = { color: string; size: number; opacity: number; press: number; tilt: number; motif?: string; softness?: number }
// Oggetto testo editabile (stile Photoshop): coord in spazio DOC (px canvas), larghezza box `w` con a-capo automatico.
type TextObj = { id: string; x: number; y: number; w: number; text: string; font: string; size: number; color: string; align: 'left' | 'center' | 'right' }
// a-capo per larghezza (rispetta i \n espliciti) — usato per rasterizzare il testo in export/salvataggio.
function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue }
    const words = para.split(' '); let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w } else line = test
    }
    out.push(line)
  }
  return out
}
function drawTextObj(ctx: CanvasRenderingContext2D, t: TextObj) {
  if (!t.text.trim()) return
  ctx.save(); ctx.fillStyle = t.color; ctx.textBaseline = 'top'; ctx.font = `${t.size}px "${t.font}"`; ctx.textAlign = t.align
  const lh = t.size * 1.25
  const ax = t.align === 'center' ? t.x + t.w / 2 : t.align === 'right' ? t.x + t.w : t.x
  wrapLines(ctx, t.text, t.w).forEach((ln, i) => ctx.fillText(ln, ax, t.y + i * lh))
  ctx.restore()
}

const PAINT = new Set<Tool>(['brush', 'pencil', 'ink', 'marker', 'watercolor', 'chalk', 'pastel', 'floral', 'airbrush', 'smudge', 'eraser', 'stamp'])
const LINE_TOOLS = new Set<Tool>(['brush', 'pencil', 'ink', 'marker', 'eraser'])
const MAXDIM = 2400
const PRESETS: Array<{ key: string; label: string; w: number; h: number }> = [
  { key: 'invito-a6', label: 'Invito A6 (10,5×14,8)', w: 1063, h: 1500 },
  { key: 'invito-quad', label: 'Invito quadrato 15×15', w: 1500, h: 1500 },
  { key: 'menu-a5', label: 'Menu A5 (14,8×21)', w: 1480, h: 2100 },
  { key: 'segnaposto', label: 'Segnaposto (9×5,5)', w: 1080, h: 660 },
  { key: 'tableau', label: 'Tableau 50×70', w: 1800, h: 2520 },
  { key: 'stationery-a4', label: 'Stationery A4', w: 1654, h: 2339 },
  { key: 'social', label: 'Social 1080×1080', w: 1080, h: 1080 },
]
const BLENDS: Array<{ v: GlobalCompositeOperation; l: string }> = [
  { v: 'source-over', l: 'Normale' }, { v: 'multiply', l: 'Moltiplica' }, { v: 'screen', l: 'Scherma' },
  { v: 'overlay', l: 'Sovrapponi' }, { v: 'darken', l: 'Scurisci' }, { v: 'lighten', l: 'Schiarisci' },
  { v: 'color-dodge', l: 'Scherma colori' }, { v: 'color-burn', l: 'Brucia colori' },
  { v: 'hard-light', l: 'Luce intensa' }, { v: 'soft-light', l: 'Luce soffusa' },
  { v: 'difference', l: 'Differenza' }, { v: 'exclusion', l: 'Esclusione' },
  { v: 'hue', l: 'Tonalità' }, { v: 'saturation', l: 'Saturazione' }, { v: 'color', l: 'Colore' }, { v: 'luminosity', l: 'Luminosità' },
]
const SWATCHES = ['#1a1a1a', '#ffffff', '#c8a24b', '#b08d3c', '#8a6d3b', '#c65d5d', '#d98c5f', '#6b8e6b', '#5f7d95', '#3a4a6b', '#7a5c8e', '#d9b8c4']

const uidgen = () => 'l' + Math.abs((Date.now() ^ (performance.now() * 1000)) | 0).toString(36) + Math.floor(performance.now() % 9999).toString(36)
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i); if (!m) return [0, 0, 0]
  const n = parseInt(m[1]!, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const rgba = (hex: string, a: number) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})` }
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const rgbToHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360; s = clamp01(s); v = clamp01(v)
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x } else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn
  let h = 0
  if (d) { if (mx === r) h = 60 * (((g - b) / d) % 6); else if (mx === g) h = 60 * ((b - r) / d + 2); else h = 60 * ((r - g) / d + 4) }
  if (h < 0) h += 360
  return [h, mx ? d / mx : 0, mx]
}
// vincola il punto finale: forme perfette (quadrato/cerchio) o angoli a 45° con Shift
function constrainEnd(a: Pt, b: Pt, tool: Tool, shift: boolean): Pt {
  if (!shift) return b
  const dx = b.x - a.x, dy = b.y - a.y
  if (tool === 'line' || tool === 'arrow') { const len = Math.hypot(dx, dy); const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len } }
  const side = Math.max(Math.abs(dx), Math.abs(dy)); return { x: a.x + Math.sign(dx || 1) * side, y: a.y + Math.sign(dy || 1) * side }
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.crossOrigin = 'anonymous'; i.src = src })
}
function newCanvas(w: number, h: number): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// ── TIMBRI decorativi: foglie, fiori, ghirigori (disegnati con path, colore = pennello). ──
// ── Engine pennelli (a stamp/linea) ─────────────────────────────────────────
function stamp(ctx: CanvasRenderingContext2D, tool: Tool, x: number, y: number, r: number, o: DabOpt) {
  if (tool === 'stamp') {
    // timbri decorativi vettoriali di qualità (foglie/fiori/ghirigori) — vedi lib/studioStamps
    drawStamp(ctx, o.motif || DEFAULT_STAMP, x, y, r, o.color, o.opacity)
    return
  }
  if (tool === 'watercolor') {
    for (let k = 0; k < 3; k++) {
      const rr = r * (0.7 + Math.random() * 0.6), ox = (Math.random() - 0.5) * r * 0.5, oy = (Math.random() - 0.5) * r * 0.5
      const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); const a = o.opacity * 0.09
      g.addColorStop(0, rgba(o.color, a)); g.addColorStop(0.7, rgba(o.color, a * 0.6)); g.addColorStop(1, rgba(o.color, 0))
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + ox, y + oy, rr, 0, 6.283); ctx.fill()
    }
  } else if (tool === 'chalk') {
    const n = Math.max(8, Math.floor(r * r * 0.5)); ctx.fillStyle = o.color
    for (let k = 0; k < n; k++) { const ang = Math.random() * 6.283, rad = Math.random() * r * (1 + o.tilt * 1.6); ctx.globalAlpha = o.opacity * (0.12 + Math.random() * 0.25); ctx.fillRect(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 1.2, 1.2) }
    ctx.globalAlpha = 1
  } else if (tool === 'pastel') {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, rgba(o.color, o.opacity * 0.45)); g.addColorStop(1, rgba(o.color, 0))
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill()
    const n = Math.floor(r); ctx.fillStyle = o.color
    for (let k = 0; k < n; k++) { const ang = Math.random() * 6.283, rad = Math.random() * r; ctx.globalAlpha = o.opacity * 0.12; ctx.fillRect(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 1, 1) }
    ctx.globalAlpha = 1
  } else if (tool === 'floral') {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.random() * 6.283); ctx.globalAlpha = o.opacity; ctx.fillStyle = o.color
    const pr = r * 0.6
    for (let p = 0; p < 5; p++) { ctx.rotate((Math.PI * 2) / 5); ctx.beginPath(); ctx.ellipse(0, -pr * 0.95, pr * 0.5, pr, 0, 0, 6.283); ctx.fill() }
    ctx.fillStyle = rgba('#f2d16b', Math.min(1, o.opacity * 1.1)); ctx.beginPath(); ctx.arc(0, 0, pr * 0.42, 0, 6.283); ctx.fill()
    ctx.restore(); ctx.globalAlpha = 1
  } else if (tool === 'airbrush') {
    ctx.fillStyle = o.color; const n = Math.max(6, Math.floor(r))
    for (let k = 0; k < n; k++) { const ang = Math.random() * 6.283, rad = Math.random() * r; ctx.globalAlpha = o.opacity * 0.10; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 1.1, 0, 6.283); ctx.fill() }
    ctx.globalAlpha = 1
  }
}
function paintSeg(ctx: CanvasRenderingContext2D, tool: Tool, a: Pt, b: Pt, o: DabOpt) {
  // SFUMATURA bordo (pennello/gomma): dab a gradiente radiale — centro pieno, bordo che sfuma.
  const soft = o.softness ?? 0
  if (soft > 0 && (tool === 'eraser' || tool === 'brush')) {
    const r = Math.max(1, o.size * o.press) / 2
    const spacing = Math.max(1, r * 0.35)
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / spacing))
    const inner = Math.max(0, 1 - soft)                 // quota di raggio ancora "piena"
    const erase = tool === 'eraser'
    const [rr, gg, bb] = hexToRgb(o.color); const col = erase ? '0,0,0' : `${rr},${gg},${bb}`
    ctx.save(); if (erase) ctx.globalCompositeOperation = 'destination-out'
    for (let i = 0; i <= steps; i++) {
      const t = steps ? i / steps : 0; const x = a.x + dx * t, y = a.y + dy * t
      const g = ctx.createRadialGradient(x, y, r * inner, x, y, r)
      g.addColorStop(0, `rgba(${col},${o.opacity})`); g.addColorStop(1, `rgba(${col},0)`)
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill()
    }
    ctx.restore()
    return
  }
  if (LINE_TOOLS.has(tool)) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = o.color
    let w = o.size * o.press
    if (tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = o.opacity }
    else if (tool === 'marker') { ctx.globalAlpha = o.opacity * 0.4 }
    else if (tool === 'pencil') { ctx.globalAlpha = o.opacity * 0.9; w = Math.max(0.6, o.size * 0.5 * o.press * (1 + o.tilt * 2.2)) }
    else if (tool === 'ink') { ctx.globalAlpha = o.opacity; w = o.size * (0.45 + 0.55 * o.press) }
    else { ctx.globalAlpha = o.opacity }
    ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore()
    return
  }
  const r = Math.max(1, o.size * o.press) / 2
  const spacing = tool === 'stamp' ? Math.max(10, r * 2.4) : tool === 'floral' ? Math.max(6, r * 1.6) : (tool === 'airbrush' ? Math.max(1, r * 0.25) : Math.max(1, r * 0.4))
  const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / spacing))
  for (let i = 0; i <= steps; i++) { const t = steps ? i / steps : 0; stamp(ctx, tool, a.x + dx * t, a.y + dy * t, r, o) }
}

function floodFill(ctx: CanvasRenderingContext2D, W: number, H: number, sx: number, sy: number, hex: string) {
  const x = Math.round(sx), y = Math.round(sy); if (x < 0 || y < 0 || x >= W || y >= H) return
  const img = ctx.getImageData(0, 0, W, H); const d = img.data
  const at = (px: number, py: number) => (py * W + px) * 4
  const s = at(x, y); const tr = d[s]!, tg = d[s + 1]!, tb = d[s + 2]!, ta = d[s + 3]!
  const [nr, ng, nb] = hexToRgb(hex); const na = 255
  if (tr === nr && tg === ng && tb === nb && ta === na) return
  const tol = 40
  const match = (i: number) => Math.abs(d[i]! - tr) <= tol && Math.abs(d[i + 1]! - tg) <= tol && Math.abs(d[i + 2]! - tb) <= tol && Math.abs(d[i + 3]! - ta) <= tol
  const stack: Array<[number, number]> = [[x, y]]
  while (stack.length) {
    const [cx, cy] = stack.pop()!; if (!match(at(cx, cy))) continue
    let top = cy; while (top > 0 && match(at(cx, top - 1))) top--
    let bot = cy; while (bot < H - 1 && match(at(cx, bot + 1))) bot++
    for (let yy = top; yy <= bot; yy++) { const j = at(cx, yy); d[j] = nr; d[j + 1] = ng; d[j + 2] = nb; d[j + 3] = na; if (cx > 0 && match(at(cx - 1, yy))) stack.push([cx - 1, yy]); if (cx < W - 1 && match(at(cx + 1, yy))) stack.push([cx + 1, yy]) }
  }
  ctx.putImageData(img, 0, 0)
}
function drawShape(ctx: CanvasRenderingContext2D, tool: Tool, a: Pt, b: Pt, o: { color: string; size: number; fill: boolean; alpha: number }) {
  ctx.save(); ctx.globalAlpha = o.alpha; ctx.strokeStyle = o.color; ctx.fillStyle = o.color; ctx.lineWidth = o.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (tool === 'line' || tool === 'arrow') {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    if (tool === 'arrow') { const ang = Math.atan2(b.y - a.y, b.x - a.x), h = Math.max(10, o.size * 3); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - h * Math.cos(ang - 0.4), b.y - h * Math.sin(ang - 0.4)); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - h * Math.cos(ang + 0.4), b.y - h * Math.sin(ang + 0.4)); ctx.stroke() }
  } else if (tool === 'rect') { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), hh = Math.abs(b.y - a.y); if (o.fill) ctx.fillRect(x, y, w, hh); else ctx.strokeRect(x, y, w, hh) }
  else if (tool === 'ellipse') { const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); if (o.fill) ctx.fill(); else ctx.stroke() }
  ctx.restore()
}

export default function DesignStudioPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const displayRef = useRef<HTMLCanvasElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const layerCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const fileRef = useRef<HTMLInputElement>(null)
  const refFileRef = useRef<HTMLInputElement>(null)

  const [dims, setDims] = useState({ w: 1500, h: 1500 })
  const [layers, setLayers] = useState<LayerMeta[]>([])
  const [activeId, setActiveId] = useState('')
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState('#1a1a1a')
  const [size, setSize] = useState(14)
  const [opacity, setOpacity] = useState(1)
  const [softness, setSoftness] = useState(0)   // sfumatura bordo pennello/gomma (0 = netto, 1 = molto morbido)
  // Preset pennello (disegnati a mano) + personalizzati salvabili, scegliibili da dropdown.
  const [customPresets, setCustomPresets] = useState<BrushPreset[]>([])
  const [presetSel, setPresetSel] = useState('')
  const [motif, setMotif] = useState(DEFAULT_STAMP)   // timbro decorativo selezionato (foglie/fiori/ghirigori)
  const [immersive, setImmersive] = useState(false)   // iPad "pagina piena": nasconde barra + strumenti + pannello
  useEffect(() => { setCustomPresets(loadCustomPresets()) }, [])
  const applyPreset = (p: BrushPreset) => { setTool(p.tool as Tool); setSize(p.size); setOpacity(p.opacity); if (p.color) setColor(p.color); setPresetSel(p.id) }

  const [streamline, setStreamline] = useState(0.4)
  const [sym, setSym] = useState<SymMode>('off')
  const [fill, setFill] = useState(false)
  const [font, setFont] = useState(FONTS[0]!.name)
  const [fontSize, setFontSize] = useState(64)
  const [fontQuery, setFontQuery] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [recent, setRecent] = useState<string[]>([])
  const [palette, setPalette] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('studio-palette') || '[]') as string[] } catch { return [] } })
  const [showWheel, setShowWheel] = useState(true)
  useEffect(() => { try { localStorage.setItem('studio-palette', JSON.stringify(palette)) } catch { /* no-op */ } }, [palette])
  const [title, setTitle] = useState('Senza titolo')
  const [docId, setDocId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rightOpen, setRightOpen] = useState(true)
  // TESTO come oggetti editabili (stile Photoshop): box allargabili/spostabili/ri-modificabili/eliminabili,
  // rasterizzati solo in export/salvataggio. + font importati dall'utente (persistono in IndexedDB).
  const [texts, setTexts] = useState<TextObj[]>([])
  const [activeTextId, setActiveTextId] = useState<string | null>(null)
  const [customFonts, setCustomFonts] = useState<string[]>([])
  const [sp] = useSearchParams(); const navigate = useNavigate()
  const entryId = sp.get('entry'); const openDocParam = sp.get('doc')
  const [assignEntry, setAssignEntry] = useState<string | null>(entryId)
  const { data: events } = useAttachableEvents()

  // ── TESTO (oggetti) + FONT importati ─────────────────────────────────────────
  useEffect(() => { void loadCustomFonts().then((names) => setCustomFonts(names)) }, [])
  const patchText = (id: string, patch: Partial<TextObj>) => setTexts((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  const removeText = (id: string) => { setTexts((ts) => ts.filter((t) => t.id !== id)); setActiveTextId((a) => (a === id ? null : a)) }
  const addText = (x: number, y: number) => {
    const id = uidgen()
    const w = Math.min(Math.max(160, dims.w * 0.5), dims.w - x - 8)
    setTexts((ts) => [...ts, { id, x, y, w: Math.max(80, w), text: '', font, size: fontSize, color, align: 'left' }])
    setActiveTextId(id); void ensureFont(font)
  }
  const importFont = async (file: File) => {
    try {
      const name = await importCustomFont(file)
      setCustomFonts((cf) => (cf.includes(name) ? cf : [name, ...cf]))
      setFont(name); if (activeTextId) patchText(activeTextId, { font: name })
      toast.success(`Font "${name}" importato — resta disponibile anche dopo`)
    } catch (e) { toast.error('Font non importato: ' + (e as Error).message) }
  }
  const activeText = texts.find((t) => t.id === activeTextId) ?? null
  // il colore della tavolozza aggiorna il testo selezionato (come in Photoshop)
  useEffect(() => { if (tool === 'text' && activeTextId) patchText(activeTextId, { color })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])

  const history = useRef<Array<{ layerId: string; before: string; after: string }>>([])
  const redo = useRef<Array<{ layerId: string; before: string; after: string }>>([])
  const draw = useRef<{ active: boolean; last: Pt; start: Pt; before: string; panning: boolean; panStart: Pt; panOrig: { x: number; y: number } } | null>(null)
  const spaceRef = useRef(false)
  const fontFileRef = useRef<HTMLInputElement>(null)
  const adjustSrc = useRef<HTMLCanvasElement | null>(null)
  const adjustBefore = useRef<string>('')
  const [adjust, setAdjust] = useState<{ b: number; c: number; s: number; h: number; blur: number } | null>(null)

  const getCtx = (id: string) => layerCanvases.current.get(id)?.getContext('2d') ?? null

  const composite = useCallback(() => {
    const disp = displayRef.current; if (!disp) return
    const ctx = disp.getContext('2d')!; const { w: W, h: H } = dims
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#3a3d44'; ctx.fillRect(0, 0, disp.width, disp.height)
    ctx.save(); ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom)
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    for (const l of layers) { if (!l.visible) continue; const c = layerCanvases.current.get(l.id); if (!c) continue; ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = l.blend; ctx.drawImage(c, 0, 0) }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.restore()
  }, [dims, layers, zoom, pan])

  const resize = useCallback(() => { const disp = displayRef.current, stage = stageRef.current; if (!disp || !stage) return; disp.width = stage.clientWidth; disp.height = stage.clientHeight; composite() }, [composite])
  const fitView = useCallback((w = dims.w, h = dims.h) => {
    const stage = stageRef.current; if (!stage) return
    const z = Math.min(stage.clientWidth / w, stage.clientHeight / h) * 0.9
    setZoom(z); setPan({ x: (stage.clientWidth - w * z) / 2, y: (stage.clientHeight - h * z) / 2 })
  }, [dims])

  const initDoc = useCallback((w: number, h: number) => {
    w = Math.min(MAXDIM, Math.max(64, Math.round(w))); h = Math.min(MAXDIM, Math.max(64, Math.round(h)))
    layerCanvases.current.clear()
    const bg = uidgen(), l1 = uidgen()
    const bgC = newCanvas(w, h); const bctx = bgC.getContext('2d')!; bctx.fillStyle = '#ffffff'; bctx.fillRect(0, 0, w, h)
    layerCanvases.current.set(bg, bgC); layerCanvases.current.set(l1, newCanvas(w, h))
    history.current = []; redo.current = []
    setTexts([]); setActiveTextId(null)
    setDims({ w, h })
    setLayers([{ id: bg, name: 'Sfondo', visible: true, opacity: 1, blend: 'source-over' }, { id: l1, name: 'Livello 1', visible: true, opacity: 1, blend: 'source-over' }])
    setActiveId(l1); setTimeout(() => fitView(w, h), 0)
  }, [fitView])

  useEffect(() => { injectFontsStylesheet(); if (openDocParam) void openDesign(openDocParam); else initDoc(1500, 1500) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])
  useEffect(() => { composite() }, [composite])
  useEffect(() => { resize(); const ro = new ResizeObserver(resize); if (stageRef.current) ro.observe(stageRef.current); return () => ro.disconnect() }, [resize])
  useEffect(() => { if (tool === 'text') void ensureFont(font) }, [font, tool])

  const pressureOf = (e: React.PointerEvent) => (e.pointerType === 'pen' ? Math.max(0.06, e.pressure || 0.5) : 1)
  const tiltOf = (e: React.PointerEvent) => (e.pointerType === 'pen' ? Math.min(1, Math.hypot((e as any).tiltX || 0, (e as any).tiltY || 0) / 54) : 0)
  const toDoc = (e: { clientX: number; clientY: number }): Pt => { const disp = displayRef.current!; const r = disp.getBoundingClientRect(); return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom } }

  const pushHistory = (layerId: string, before: string, after: string) => { history.current.push({ layerId, before, after }); if (history.current.length > 24) history.current.shift(); redo.current = [] }
  const applyUrl = async (layerId: string, url: string) => { const c = layerCanvases.current.get(layerId); if (!c) return; const ctx = c.getContext('2d')!; const img = await loadImage(url); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0); composite() }
  const undo = async () => { const h = history.current.pop(); if (!h) return; redo.current.push(h); await applyUrl(h.layerId, h.before) }
  const redoFn = async () => { const h = redo.current.pop(); if (!h) return; history.current.push(h); await applyUrl(h.layerId, h.after) }
  const pushColor = (c: string) => setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 10))

  // Simmetria: restituisce le trasformazioni dei punti (identità + specchi/rotazioni attorno al centro)
  const symTransforms = (): Array<(p: Pt) => Pt> => {
    const W = dims.w, H = dims.h, cx = W / 2, cy = H / 2
    const id = (p: Pt) => p
    const vx = (p: Pt) => ({ x: W - p.x, y: p.y })
    const hy = (p: Pt) => ({ x: p.x, y: H - p.y })
    const both = (p: Pt) => ({ x: W - p.x, y: H - p.y })
    const rot = (deg: number) => (p: Pt) => { const a = (deg * Math.PI) / 180, dx = p.x - cx, dy = p.y - cy; return { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) } }
    switch (sym) {
      case 'v': return [id, vx]; case 'h': return [id, hy]; case 'quad': return [id, vx, hy, both]
      case 'radial': return [id, rot(60), rot(120), rot(180), rot(240), rot(300)]; default: return [id]
    }
  }
  // disegna il tratto + tutte le copie simmetriche
  const paintM = (ctx: CanvasRenderingContext2D, a: Pt, b: Pt, o: DabOpt) => { for (const T of symTransforms()) paintSeg(ctx, tool, T(a), T(b), o) }
  // Sfumino: trascina i pixel sotto al pennello (self-draw clippato al cerchio)
  const smudge = (ctx: CanvasRenderingContext2D, a: Pt, b: Pt, press: number) => {
    const r = Math.max(2, size * press) / 2, canvas = ctx.canvas
    const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.floor(dist / Math.max(1, r * 0.3)))
    let lx = a.x, ly = a.y
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, cx = a.x + dx * t, cy = a.y + dy * t
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.clip(); ctx.globalAlpha = Math.min(0.92, opacity)
      ctx.drawImage(canvas, lx - r, ly - r, r * 2, r * 2, cx - r, cy - r, r * 2, r * 2); ctx.restore()
      lx = cx; ly = cy
    }
  }
  const startPaint = (ctx: CanvasRenderingContext2D) => {
    const al = layers.find((l) => l.id === activeId)?.alphaLock
    ctx.globalCompositeOperation = (al && tool !== 'eraser' && tool !== 'smudge') ? 'source-atop' : (tool === 'eraser' ? 'destination-out' : 'source-over')
  }

  // ── Pointer ──────────────────────────────────────────────────────────────
  function onDown(e: React.PointerEvent) {
    // TESTO (stile Photoshop): click a vuoto crea un nuovo box editabile. PRIMA del pointer-capture,
    // così su touch/iPad il tap dà fuoco (i box esistenti fermano l'evento e gestiscono da sé).
    if (tool === 'text') { const p = toDoc(e); addText(p.x, p.y); return }
    try { (e.target as HTMLElement).setPointerCapture?.(e.pointerId) } catch { /* pointer sintetico o non catturabile */ }
    if (tool === 'hand' || spaceRef.current || e.button === 1) { draw.current = { active: false, last: { x: 0, y: 0 }, start: { x: 0, y: 0 }, before: '', panning: true, panStart: { x: e.clientX, y: e.clientY }, panOrig: { ...pan } }; return }
    const p = toDoc(e); const ctx = getCtx(activeId); if (!ctx) return
    if (tool === 'eyedropper') { const disp = displayRef.current!; const r = disp.getBoundingClientRect(); const px = disp.getContext('2d')!.getImageData(Math.round(e.clientX - r.left), Math.round(e.clientY - r.top), 1, 1).data; const hex = '#' + [px[0], px[1], px[2]].map((n) => (n ?? 0).toString(16).padStart(2, '0')).join(''); setColor(hex); pushColor(hex); return }
    if (tool === 'fill') { const before = layerCanvases.current.get(activeId)!.toDataURL(); floodFill(ctx, dims.w, dims.h, p.x, p.y, color); composite(); pushHistory(activeId, before, layerCanvases.current.get(activeId)!.toDataURL()); pushColor(color); return }
    const before = layerCanvases.current.get(activeId)!.toDataURL()
    draw.current = { active: true, last: p, start: p, before, panning: false, panStart: { x: 0, y: 0 }, panOrig: { x: 0, y: 0 } }
    if (PAINT.has(tool)) { startPaint(ctx); if (tool === 'smudge') smudge(ctx, p, p, pressureOf(e)); else paintM(ctx, p, p, { color, size, opacity, press: pressureOf(e), tilt: tiltOf(e), motif, softness }); composite() }
  }
  function onMove(e: React.PointerEvent) {
    const ring = ringRef.current, disp = displayRef.current
    if (ring && disp) { const r = disp.getBoundingClientRect(); const d = size * zoom; ring.style.display = PAINT.has(tool) ? 'block' : 'none'; ring.style.width = ring.style.height = d + 'px'; ring.style.left = (e.clientX - r.left) + 'px'; ring.style.top = (e.clientY - r.top) + 'px' }
    const st = draw.current; if (!st) return
    if (st.panning) { setPan({ x: st.panOrig.x + (e.clientX - st.panStart.x), y: st.panOrig.y + (e.clientY - st.panStart.y) }); return }
    if (!st.active) return
    const ctx = getCtx(activeId); if (!ctx) return
    if (PAINT.has(tool)) {
      const raw = ((e.nativeEvent as any).getCoalescedEvents?.() as PointerEvent[] | undefined) ?? [e.nativeEvent as any as PointerEvent]
      let last = st.last
      for (const ce of raw) {
        const rp = toDoc(ce); const sm = { x: lerp(last.x, rp.x, 1 - streamline), y: lerp(last.y, rp.y, 1 - streamline) }
        const press = ce.pointerType === 'pen' ? Math.max(0.06, ce.pressure || 0.5) : 1
        const tilt = ce.pointerType === 'pen' ? Math.min(1, Math.hypot((ce as any).tiltX || 0, (ce as any).tiltY || 0) / 54) : 0
        if (tool === 'smudge') smudge(ctx, last, sm, press); else paintM(ctx, last, sm, { color, size, opacity, press, tilt, motif, softness }); last = sm
      }
      st.last = last; composite()
    } else if (tool === 'move') {
      const p = toDoc(e); const dx = p.x - st.start.x, dy = p.y - st.start.y
      void loadImage(st.before).then((img) => { ctx.clearRect(0, 0, dims.w, dims.h); ctx.drawImage(img, dx, dy); composite() })
    } else if (tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'arrow') {
      composite(); const c2 = displayRef.current!.getContext('2d')!; c2.save(); c2.translate(pan.x, pan.y); c2.scale(zoom, zoom); drawShape(c2, tool, st.start, constrainEnd(st.start, toDoc(e), tool, e.shiftKey), { color, size, fill, alpha: opacity }); c2.restore()
    }
  }
  function onUp(e: React.PointerEvent) {
    const st = draw.current; draw.current = null; if (!st || st.panning) return
    const ctx = getCtx(activeId); if (!ctx) return
    if (PAINT.has(tool)) { const end = toDoc(e); if (tool === 'smudge') smudge(ctx, st.last, end, pressureOf(e)); else { paintM(ctx, st.last, end, { color, size, opacity, press: pressureOf(e), tilt: tiltOf(e), motif, softness }); pushColor(color) } ctx.globalCompositeOperation = 'source-over'; composite() }
    if (tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'arrow') { drawShape(ctx, tool, st.start, constrainEnd(st.start, toDoc(e), tool, e.shiftKey), { color, size, fill, alpha: opacity }); composite() }
    pushHistory(activeId, st.before, layerCanvases.current.get(activeId)!.toDataURL())
  }
  function onWheel(e: React.WheelEvent) {
    e.preventDefault(); const disp = displayRef.current!; const r = disp.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top
    const nz = Math.min(8, Math.max(0.08, zoom * (e.deltaY < 0 ? 1.12 : 0.89)))
    setPan({ x: mx - (mx - pan.x) * (nz / zoom), y: my - (my - pan.y) * (nz / zoom) }); setZoom(nz)
  }

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceRef.current = true; return }
      const t = e.target as HTMLElement; if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? void redoFn() : void undo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void doSave(); return }
      const map: Record<string, Tool> = { b: 'brush', p: 'pencil', k: 'ink', m: 'marker', w: 'watercolor', c: 'chalk', s: 'smudge', e: 'eraser', g: 'fill', t: 'text', i: 'eyedropper', h: 'hand', v: 'move', l: 'line', r: 'rect', o: 'ellipse', f: 'floral' }
      if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]!)
      if (e.key === '[') setSize((s) => Math.max(1, s - 2)); if (e.key === ']') setSize((s) => Math.min(400, s + 2))
    }
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') spaceRef.current = false }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  })

  // ── Livelli ──────────────────────────────────────────────────────────────
  const addLayer = () => { const id = uidgen(); layerCanvases.current.set(id, newCanvas(dims.w, dims.h)); setLayers((ls) => [...ls, { id, name: `Livello ${ls.length}`, visible: true, opacity: 1, blend: 'source-over' }]); setActiveId(id) }
  const dupLayer = () => { const src = layerCanvases.current.get(activeId); if (!src) return; const id = uidgen(); const c = newCanvas(dims.w, dims.h); c.getContext('2d')!.drawImage(src, 0, 0); layerCanvases.current.set(id, c); setLayers((ls) => { const i = ls.findIndex((l) => l.id === activeId); const m = ls.find((l) => l.id === activeId)!; const n = [...ls]; n.splice(i + 1, 0, { ...m, id, name: m.name + ' copia' }); return n }); setActiveId(id) }
  const delLayer = () => { if (layers.length <= 1) return; layerCanvases.current.delete(activeId); setLayers((ls) => { const n = ls.filter((l) => l.id !== activeId); setActiveId(n[n.length - 1]!.id); return n }) }
  const moveLayer = (id: string, dir: -1 | 1) => setLayers((ls) => { const i = ls.findIndex((l) => l.id === id); const j = i + dir; if (j < 0 || j >= ls.length) return ls; const n = [...ls]; const [x] = n.splice(i, 1); n.splice(j, 0, x!); return n })
  const patchLayer = (id: string, p: Partial<LayerMeta>) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)))
  // Trasforma il livello attivo (rifletti / ruota) con undo
  const transformLayer = (fn: (ctx: CanvasRenderingContext2D, temp: HTMLCanvasElement, W: number, H: number) => void) => {
    const c = layerCanvases.current.get(activeId); if (!c) return
    const before = c.toDataURL()
    const temp = newCanvas(dims.w, dims.h); temp.getContext('2d')!.drawImage(c, 0, 0)
    const ctx = c.getContext('2d')!; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, dims.w, dims.h)
    fn(ctx, temp, dims.w, dims.h); ctx.restore()
    composite(); pushHistory(activeId, before, c.toDataURL())
  }
  const flipH = () => transformLayer((ctx, temp, W) => { ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(temp, 0, 0) })
  const flipV = () => transformLayer((ctx, temp, _W, H) => { ctx.translate(0, H); ctx.scale(1, -1); ctx.drawImage(temp, 0, 0) })
  const rot90 = (cw: boolean) => transformLayer((ctx, temp, W, H) => { ctx.translate(W / 2, H / 2); ctx.rotate((cw ? 90 : -90) * Math.PI / 180); ctx.drawImage(temp, -W / 2, -H / 2) })
  // Regolazioni (luminosità/contrasto/saturazione/tonalità/sfocatura) col filtro canvas
  const openAdjust = () => { const c = layerCanvases.current.get(activeId); if (!c) return; const src = newCanvas(dims.w, dims.h); src.getContext('2d')!.drawImage(c, 0, 0); adjustSrc.current = src; adjustBefore.current = c.toDataURL(); setAdjust({ b: 1, c: 1, s: 1, h: 0, blur: 0 }) }
  useEffect(() => {
    if (!adjust || !adjustSrc.current) return
    const ctx = getCtx(activeId); if (!ctx) return
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, dims.w, dims.h)
    ctx.filter = `brightness(${adjust.b}) contrast(${adjust.c}) saturate(${adjust.s}) hue-rotate(${adjust.h}deg) blur(${adjust.blur}px)`
    ctx.drawImage(adjustSrc.current, 0, 0); ctx.filter = 'none'; ctx.restore(); composite()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [adjust])
  const applyAdjust = () => { const c = layerCanvases.current.get(activeId); if (c) pushHistory(activeId, adjustBefore.current, c.toDataURL()); adjustSrc.current = null; setAdjust(null) }
  const cancelAdjust = () => { void applyUrl(activeId, adjustBefore.current); adjustSrc.current = null; setAdjust(null) }

  // ── Export / persistenza ──────────────────────────────────────────────────
  const flatten = (): HTMLCanvasElement => { const out = newCanvas(dims.w, dims.h); const ctx = out.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dims.w, dims.h); for (const l of layers) { if (!l.visible) continue; const c = layerCanvases.current.get(l.id); if (!c) continue; ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = l.blend; ctx.drawImage(c, 0, 0) } ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; for (const t of texts) drawTextObj(ctx, t); return out }
  const exportPNG = () => { const a = document.createElement('a'); a.href = flatten().toDataURL('image/png'); a.download = `${title || 'disegno'}.png`; a.click() }
  const exportPDF = async () => { const { default: JsPDF } = await import('jspdf'); const doc = new JsPDF({ unit: 'px', format: [dims.w, dims.h], orientation: dims.w > dims.h ? 'landscape' : 'portrait' }); doc.addImage(flatten().toDataURL('image/png'), 'PNG', 0, 0, dims.w, dims.h); doc.save(`${title || 'disegno'}.pdf`) }
  // VETTORIZZA: traccia il disegno (raster) in SVG con tracciati editabili → apribile in Illustrator
  // e in ogni programma vettoriale. 'color' = fedele ai colori; 'bw' = linea pulita (2 colori).
  const [vecBusy, setVecBusy] = useState(false)
  const vectorize = async (mode: 'color' | 'bw' = 'color') => {
    setVecBusy(true)
    try {
      const { default: ImageTracer } = await import('imagetracerjs')
      const c = flatten(); const imgd = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
      const opts = mode === 'bw'
        ? { numberofcolors: 2, colorquantcycles: 3, pathomit: 8, ltres: 1, qtres: 1, roundcoords: 1, scale: 1 }
        : { numberofcolors: 16, colorquantcycles: 3, pathomit: 4, ltres: 1, qtres: 1, roundcoords: 1, scale: 1 }
      const svg = (ImageTracer as any).imagedataToSVG(imgd, opts)
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
      a.download = `${title || 'disegno'}.svg`; a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
      toast.success('Vettorializzato in SVG — aprilo in Illustrator: i tracciati sono editabili con tutti gli strumenti.')
    } catch (e) { toast.error('Vettorializzazione non riuscita: ' + (e as Error).message) }
    finally { setVecBusy(false) }
  }
  const thumbOf = (): string => { const s = 320 / Math.max(dims.w, dims.h); const t = newCanvas(Math.round(dims.w * s), Math.round(dims.h * s)); t.getContext('2d')!.drawImage(flatten(), 0, 0, t.width, t.height); return t.toDataURL('image/png') }

  const { save, del } = useDesignMutations()
  async function doSave() {
    setSaving(true)
    try {
      const doc = JSON.stringify({ layers: layers.map((l) => ({ ...l, data: layerCanvases.current.get(l.id)!.toDataURL('image/png') })), texts })
      const id = await save.mutateAsync({ id: docId, title: title || 'Senza titolo', width: dims.w, height: dims.h, doc, thumbnail: thumbOf(), entry_id: assignEntry })
      setDocId(id); toast.success(assignEntry ? 'Progetto salvato e condiviso nell’evento' : 'Progetto salvato')
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
  }
  async function openDesign(id: string) {
    try {
      const d = await fetchDesign(id); if (!d || !d.doc) { toast.error('Progetto non leggibile'); return }
      const parsed = JSON.parse(d.doc) as { layers: Array<LayerMeta & { data: string }>; texts?: TextObj[] }
      layerCanvases.current.clear()
      for (const l of parsed.layers) { const c = newCanvas(d.width, d.height); const img = await loadImage(l.data); c.getContext('2d')!.drawImage(img, 0, 0); layerCanvases.current.set(l.id, c) }
      history.current = []; redo.current = []
      setTexts(parsed.texts ?? []); setActiveTextId(null)
      setDims({ w: d.width, h: d.height }); setLayers(parsed.layers.map(({ data: _d, ...m }) => m)); setActiveId(parsed.layers[parsed.layers.length - 1]!.id)
      setTitle(d.title); setDocId(d.id); setShowGallery(false); setTimeout(() => fitView(d.width, d.height), 0)
    } catch (e) { toast.error((e as Error).message) }
  }
  function importToActive(file: File) {
    const rd = new FileReader(); rd.onload = async () => { const img = await loadImage(String(rd.result)); const ctx = getCtx(activeId); if (!ctx) return; const s = Math.min(dims.w / img.width, dims.h / img.height, 1); const w = img.width * s, h = img.height * s; const before = layerCanvases.current.get(activeId)!.toDataURL(); ctx.drawImage(img, (dims.w - w) / 2, (dims.h - h) / 2, w, h); composite(); pushHistory(activeId, before, layerCanvases.current.get(activeId)!.toDataURL()) }; rd.readAsDataURL(file)
  }
  function importReference(file: File) {
    const rd = new FileReader(); rd.onload = async () => {
      const img = await loadImage(String(rd.result)); const id = uidgen(); const c = newCanvas(dims.w, dims.h); const ctx = c.getContext('2d')!
      const s = Math.min(dims.w / img.width, dims.h / img.height); const w = img.width * s, h = img.height * s
      ctx.drawImage(img, (dims.w - w) / 2, (dims.h - h) / 2, w, h); layerCanvases.current.set(id, c)
      setLayers((ls) => [{ id, name: 'Riferimento (ricalco)', visible: true, opacity: 0.35, blend: 'source-over' }, ...ls]); composite()
      toast.success('Foto di riferimento inserita al 35% — disegnaci sopra per ricalcare')
    }; rd.readAsDataURL(file)
  }
  const goFullscreen = () => { const el = rootRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.() }

  const TOOLS: Array<{ t: Tool; Icon: typeof Paintbrush; label: string }> = [
    { t: 'brush', Icon: Paintbrush, label: 'Pennello (B)' }, { t: 'pencil', Icon: Pencil, label: 'Matita — con inclinazione (P)' }, { t: 'ink', Icon: PenTool, label: 'Pennino a china (K)' },
    { t: 'marker', Icon: Highlighter, label: 'Pennarello (M)' }, { t: 'watercolor', Icon: Droplets, label: 'Acquarello (W)' }, { t: 'chalk', Icon: Brush, label: 'Gessetto / carboncino (C)' },
    { t: 'pastel', Icon: Feather, label: 'Pastello' }, { t: 'floral', Icon: Flower2, label: 'Texture floreale (F)' }, { t: 'airbrush', Icon: SprayCan, label: 'Aerografo' }, { t: 'stamp', Icon: Stamp, label: 'Timbri — foglie, fiori, ghirigori' }, { t: 'smudge', Icon: Fingerprint, label: 'Sfumino (S)' }, { t: 'eraser', Icon: Eraser, label: 'Gomma (E)' },
    { t: 'fill', Icon: PaintBucket, label: 'Riempimento (G)' }, { t: 'line', Icon: Minus, label: 'Linea (L)' }, { t: 'rect', Icon: Square, label: 'Rettangolo (R)' }, { t: 'ellipse', Icon: Circle, label: 'Ellisse (O)' }, { t: 'arrow', Icon: ArrowUpRight, label: 'Freccia' },
    { t: 'text', Icon: Type, label: 'Testo (T)' }, { t: 'eyedropper', Icon: Pipette, label: 'Contagocce (I)' }, { t: 'move', Icon: Move, label: 'Sposta livello (V)' }, { t: 'hand', Icon: Hand, label: 'Mano / pan (H)' },
  ]
  const ordered = [...layers].reverse()
  const filteredFonts = fontQuery ? FONTS.filter((f) => f.name.toLowerCase().includes(fontQuery.toLowerCase())) : FONTS

  return (
    <div ref={rootRef} className="fixed inset-0 z-40 flex flex-col bg-[rgb(var(--bg))] select-none" style={{ touchAction: 'none' }}>
      {!immersive && (
      <div className="flex items-center gap-2 px-3 h-12 border-b border-[rgb(var(--border))] shrink-0 overflow-x-auto">
        <button onClick={() => navigate(entryId ? `/weddings/${entryId}` : '/')} title={entryId ? "Torna all'evento" : 'Torna in Planfully'} className="h-8 w-8 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))] shrink-0">{entryId ? <ArrowLeft size={16} /> : <Home size={16} />}</button>
        {entryId && <button onClick={() => navigate('/')} title="Torna in Planfully" className="h-8 w-8 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))] shrink-0"><Home size={16} /></button>}
        <span className="font-semibold text-sm inline-flex items-center gap-1.5 shrink-0"><Paintbrush size={16} /> Studio</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 w-40 shrink-0" />
        <Select value={assignEntry ?? ''} onChange={(e) => setAssignEntry(e.target.value || null)} className="h-8 w-44 shrink-0" title="Indirizza il progetto a un evento">
          <option value="">— nessun evento —</option>
          {(events ?? []).map((ev) => <option key={ev.id} value={ev.id}>{ev.title ?? 'Evento'}{ev.date_from ? ` · ${new Date(ev.date_from).toLocaleDateString('it-IT')}` : ''}</option>)}
        </Select>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setShowNew(true)} title="Nuovo"><FilePlus2 size={14} /></Button>
          <Button size="sm" variant="outline" onClick={() => setShowGallery(true)} title="Apri"><FolderOpen size={14} /></Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} title="Importa immagine nel livello"><ImagePlus size={14} /></Button>
          <Button size="sm" variant="outline" onClick={() => refFileRef.current?.click()} title="Foto da ricalcare (sfondo trasparente)"><Images size={14} /> Ricalca</Button>
          <Button size="sm" variant="outline" onClick={openAdjust} title="Regolazioni del livello"><SlidersHorizontal size={14} /> Regola</Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importToActive(f) }} />
          <input ref={refFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importReference(f) }} />
        </div>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <Button size="sm" variant="outline" onClick={undo} title="Annulla (Ctrl+Z)"><Undo2 size={14} /></Button>
          <Button size="sm" variant="outline" onClick={redoFn} title="Ripeti"><Redo2 size={14} /></Button>
          <span className="w-px h-5 bg-[rgb(var(--border))] mx-1" />
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0.08, z * 0.85))}><ZoomOut size={14} /></Button>
          <span className="text-xs tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(8, z * 1.15))}><ZoomIn size={14} /></Button>
          <Button size="sm" variant="outline" onClick={() => fitView()}><Maximize size={14} /></Button>
          <Button size="sm" variant="outline" onClick={goFullscreen} title="Schermo intero"><Expand size={14} /></Button>
          <Button size="sm" variant="outline" onClick={() => setImmersive(true)} title="Pagina piena — nasconde gli strumenti (iPad)"><Maximize2 size={14} /></Button>
          <span className="w-px h-5 bg-[rgb(var(--border))] mx-1" />
          <Button size="sm" variant="outline" onClick={exportPNG}><Download size={14} /> PNG</Button>
          <Button size="sm" variant="outline" onClick={exportPDF}><FileText size={14} /> PDF</Button>
          <Button size="sm" variant="outline" disabled={vecBusy} onClick={() => vectorize('color')} title="Trasforma il disegno in vettoriale (SVG) — apribile e modificabile in Illustrator"><PenTool size={14} /> {vecBusy ? 'Vettorizzo…' : 'Vettorizza'}</Button>
          <Button size="sm" variant="outline" disabled={vecBusy} onClick={() => vectorize('bw')} title="Vettorizza in bianco/nero (linea pulita)">SVG b/n</Button>
          <Button size="sm" onClick={doSave} disabled={saving}><Save size={14} /> {saving ? '…' : 'Salva'}</Button>
        </div>
      </div>
      )}

      <div className="flex-1 flex min-h-0">
        {!immersive && (
        <div className="w-12 shrink-0 border-r border-[rgb(var(--border))] flex flex-col items-center gap-1 py-2 overflow-y-auto">
          {TOOLS.map(({ t, Icon, label }) => (
            <button key={t} title={label} onClick={() => setTool(t)} className={`h-9 w-9 grid place-items-center rounded-lg ${tool === t ? 'bg-[rgb(var(--gold-500))] text-white' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}><Icon size={17} /></button>
          ))}
        </div>
        )}

        <div ref={stageRef} className="flex-1 relative overflow-hidden bg-[#3a3d44]">
          {immersive && (
            <button onClick={() => setImmersive(false)} title="Mostra gli strumenti" className="absolute top-2 right-2 z-30 h-10 w-10 grid place-items-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60 shadow-lg"><Minimize2 size={18} /></button>
          )}
          <canvas ref={displayRef} className="absolute inset-0 touch-none" style={{ cursor: tool === 'hand' ? 'grab' : tool === 'eyedropper' ? 'crosshair' : tool === 'text' ? 'text' : 'crosshair' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { if (ringRef.current) ringRef.current.style.display = 'none' }} onWheel={onWheel} />
          <div ref={ringRef} className="pointer-events-none absolute rounded-full border border-white/80 mix-blend-difference -translate-x-1/2 -translate-y-1/2" style={{ display: 'none' }} />
          {/* TESTO: box editabili sovrapposti (spostabili/allargabili/ri-modificabili/eliminabili col tool Testo) */}
          {texts.map((t) => (
            <TextBox key={t.id} t={t} zoom={zoom} pan={pan} editable={tool === 'text'} active={tool === 'text' && activeTextId === t.id}
              onSelect={() => { setActiveTextId(t.id); setFont(t.font); setFontSize(t.size); setColor(t.color) }} onChange={(patch) => patchText(t.id, patch)} onDelete={() => removeText(t.id)}
              onCommitEmpty={() => { if (!t.text.trim()) removeText(t.id) }} />
          ))}
        </div>

        {!immersive && !rightOpen && <button onClick={() => setRightOpen(true)} title="Mostra strumenti" className="w-8 shrink-0 border-l border-[rgb(var(--border))] grid place-items-center hover:bg-[rgb(var(--bg-sunken))]"><PanelRightOpen size={16} /></button>}
        <div className={`${rightOpen && !immersive ? 'w-60' : 'hidden'} shrink-0 border-l border-[rgb(var(--border))] flex flex-col overflow-y-auto relative`}>
          <button onClick={() => setRightOpen(false)} title="Riduci pannello" className="absolute -left-3 top-2 z-20 h-6 w-6 grid place-items-center rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))] shadow-sm"><PanelRightClose size={13} /></button>

          <div className="p-3 border-b border-[rgb(var(--border))] space-y-2">
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => { setColor(e.target.value); pushColor(e.target.value) }} className="h-9 w-9 rounded cursor-pointer border border-[rgb(var(--border))]" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-8 flex-1" />
            </div>
            {showWheel && <ColorWheel color={color} onChange={(c) => { setColor(c); pushColor(c) }} />}
            <div className="flex items-center gap-2">
              <button onClick={() => setShowWheel((w) => !w)} className="text-[10px] text-[rgb(var(--gold-700))]">{showWheel ? '− Ruota colore' : '+ Ruota colore'}</button>
              <button onClick={() => setPalette((p) => (p.includes(color) ? p : [color, ...p].slice(0, 30)))} className="ml-auto text-[10px] text-[rgb(var(--gold-700))] inline-flex items-center gap-0.5"><Plus size={11} /> Salva in palette</button>
            </div>
            {palette.length > 0 && <div className="flex flex-wrap gap-1">{palette.map((c, i) => <button key={i} onClick={() => { setColor(c); pushColor(c) }} onContextMenu={(e) => { e.preventDefault(); setPalette((p) => p.filter((x) => x !== c)) }} title="Click = usa · tasto destro = rimuovi" className="h-5 w-5 rounded border border-[rgb(var(--border))]" style={{ background: c }} />)}</div>}
            <div className="flex flex-wrap gap-1">{SWATCHES.map((c) => <button key={c} onClick={() => { setColor(c); pushColor(c) }} className="h-5 w-5 rounded border border-[rgb(var(--border))]" style={{ background: c }} />)}</div>
            {recent.length > 0 && <div className="flex flex-wrap gap-1">{recent.map((c, i) => <button key={i} onClick={() => setColor(c)} className="h-4 w-4 rounded" style={{ background: c }} />)}</div>}
            {tool !== 'text' && <>
              {/* PRESET pennello: predefiniti "disegnati a mano" + i miei salvati */}
              <div>
                <div className="flex items-center gap-1">
                  <Select value={presetSel} onChange={(e) => { const id = e.target.value; const p = [...BUILTIN_PRESETS, ...customPresets].find((x) => x.id === id); if (p) applyPreset(p) }} className="h-8 text-xs flex-1">
                    <option value="">Preset pennello…</option>
                    <optgroup label="Predefiniti">
                      {BUILTIN_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                    {customPresets.length > 0 && <optgroup label="I miei">
                      {customPresets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>}
                  </Select>
                  <button title="Salva le impostazioni attuali come preset" onClick={() => { const name = window.prompt('Nome del preset:', ''); if (name && name.trim()) { setCustomPresets(saveCustomPreset({ name: name.trim(), tool: tool as any, size, opacity, color })); toast.success('Preset salvato') } }}
                    className="h-8 px-2 rounded-md border border-[rgb(var(--border))] text-xs hover:bg-[rgb(var(--bg-sunken))] shrink-0">Salva</button>
                  {presetSel.startsWith('custom-') && (
                    <button title="Elimina questo preset" onClick={() => { setCustomPresets(deleteCustomPreset(presetSel)); setPresetSel('') }} className="h-8 px-2 rounded-md border border-[rgb(var(--border))] text-xs text-[rgb(var(--rose-600,225_29_72))] hover:bg-[rgb(var(--bg-sunken))] shrink-0">✕</button>
                  )}
                </div>
              </div>
              {tool === 'stamp' && (
                <div>
                  <div className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Timbro — foglie, fiori, ghirigori</div>
                  {STAMP_GROUPS.map((g) => (
                    <div key={g} className="mb-2">
                      <div className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-0.5">{g}</div>
                      <div className="grid grid-cols-4 gap-1">
                        {STAMPS.filter((s) => s.group === g).map((s) => (
                          <button key={s.id} onClick={() => setMotif(s.id)} title={s.label}
                            className={`aspect-square grid place-items-center rounded-md border ${motif === s.id ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                            <MotifIcon motif={s.id} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">Trascina per timbrare in fila. La dimensione regola il timbro.</p>
                </div>
              )}
              <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Dimensione: {size}px<input type="range" min={1} max={200} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full" /></label>
              <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Opacità: {Math.round(opacity * 100)}%<input type="range" min={0.02} max={1} step={0.02} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full" /></label>
              {(tool === 'eraser' || tool === 'brush') && <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Sfumatura bordo: {softness === 0 ? 'netto' : Math.round(softness * 100) + '%'}<input type="range" min={0} max={1} step={0.02} value={softness} onChange={(e) => setSoftness(Number(e.target.value))} className="w-full" /></label>}
              {PAINT.has(tool) && <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Stabilizzazione: {Math.round(streamline * 100)}%<input type="range" min={0} max={0.9} step={0.05} value={streamline} onChange={(e) => setStreamline(Number(e.target.value))} className="w-full" /></label>}
              {PAINT.has(tool) && <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Simmetria<Select value={sym} onChange={(e) => setSym(e.target.value as SymMode)} className="h-8 mt-0.5"><option value="off">Nessuna</option><option value="v">Verticale</option><option value="h">Orizzontale</option><option value="quad">Quadrante (4)</option><option value="radial">Radiale (6)</option></Select></label>}
              {PAINT.has(tool) && <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Penna: pressione e inclinazione attive. Matita/gessetto sfumano con l'inclinazione.</p>}
              {(tool === 'rect' || tool === 'ellipse') && <label className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--fg-muted))]"><input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} /> Riempi forma</label>}
              {(tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'arrow') && <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Tieni <strong>Shift</strong> = forma perfetta (quadrato/cerchio) o angoli a 45°.</p>}
            </>}
            {tool === 'text' && <>
              <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Corpo: {fontSize}px<input type="range" min={8} max={400} value={fontSize} onChange={(e) => { const v = Number(e.target.value); setFontSize(v); if (activeTextId) patchText(activeTextId, { size: v }) }} className="w-full" /></label>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-[rgb(var(--fg-muted))] mr-auto">Allineamento</span>
                {(['left', 'center', 'right'] as const).map((al) => (
                  <button key={al} onClick={() => activeTextId && patchText(activeTextId, { align: al })} disabled={!activeTextId}
                    className={`h-7 w-7 grid place-items-center rounded border disabled:opacity-40 ${activeText?.align === al ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                    {al === 'left' ? <AlignLeft size={14} /> : al === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => fontFileRef.current?.click()} title="Carica un tuo font (.ttf/.otf/.woff) — resta disponibile" className="h-8 px-2 flex-1 inline-flex items-center justify-center gap-1 rounded-md border border-[rgb(var(--border))] text-xs hover:bg-[rgb(var(--bg-sunken))]"><Upload size={13} /> Importa font</button>
                {activeTextId && <button onClick={() => removeText(activeTextId)} title="Elimina il testo selezionato" className="h-8 px-2 rounded-md border border-[rgb(var(--border))] text-xs text-[rgb(var(--rose-600,225_29_72))] hover:bg-[rgb(var(--bg-sunken))]"><Trash2 size={13} /></button>}
              </div>
              <input ref={fontFileRef} type="file" accept=".ttf,.otf,.woff,.woff2,.ttc,font/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFont(f) }} />
              <div className="relative"><Search size={13} className="absolute left-2 top-2 text-[rgb(var(--fg-subtle))]" /><Input value={fontQuery} onChange={(e) => setFontQuery(e.target.value)} placeholder={`Cerca tra ${FONTS.length + customFonts.length} font…`} className="h-8 pl-7" /></div>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-[rgb(var(--border))]">
                {customFonts.filter((n) => !fontQuery || n.toLowerCase().includes(fontQuery.toLowerCase())).map((name) => (
                  <button key={'imp-' + name} onClick={() => { setFont(name); if (activeTextId) patchText(activeTextId, { font: name }) }} className={`w-full text-left px-2 py-1.5 border-b border-[rgb(var(--border))] last:border-0 ${font === name ? 'bg-[rgb(var(--gold-100))]' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
                    <span style={{ fontFamily: `"${name}"` }} className="text-base leading-none">{name}</span>
                    <span className="block text-[9px] text-[rgb(var(--gold-700))] uppercase tracking-wide">Importato</span>
                  </button>
                ))}
                {filteredFonts.map((f) => (
                  <button key={f.name} onClick={() => { setFont(f.name); void ensureFont(f.name); if (activeTextId) patchText(activeTextId, { font: f.name }) }} className={`w-full text-left px-2 py-1.5 border-b border-[rgb(var(--border))] last:border-0 ${font === f.name ? 'bg-[rgb(var(--gold-100))]' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
                    <span style={{ fontFamily: `"${f.name}"` }} className="text-base leading-none">{f.name}</span>
                    <span className="block text-[9px] text-[rgb(var(--fg-subtle))] uppercase tracking-wide">{f.cat}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[rgb(var(--fg-subtle))]">Clic sul foglio = nuovo testo. Trascina la barra in alto per spostarlo, la maniglia in basso a destra per allargarlo, la × per eliminarlo. Il colore usa la tavolozza in alto.</p>
            </>}
          </div>

          <div className="p-2 border-b border-[rgb(var(--border))] flex items-center gap-1">
            <span className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mr-auto">Trasforma livello</span>
            <button onClick={flipH} title="Rifletti orizzontale" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))]"><FlipHorizontal2 size={14} /></button>
            <button onClick={flipV} title="Rifletti verticale" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))]"><FlipVertical2 size={14} /></button>
            <button onClick={() => rot90(false)} title="Ruota 90° antioraria" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))]"><RotateCcw size={14} /></button>
            <button onClick={() => rot90(true)} title="Ruota 90° oraria" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))]"><RotateCw size={14} /></button>
          </div>
          <div className="p-2 border-b border-[rgb(var(--border))] flex items-center gap-1">
            <span className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mr-auto">Livelli</span>
            <button onClick={addLayer} title="Nuovo livello" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))]"><Plus size={14} /></button>
            <button onClick={dupLayer} title="Duplica" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))]"><Copy size={14} /></button>
            <button onClick={delLayer} title="Elimina" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--rose-500))]"><Trash2 size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ordered.map((l) => (
              <div key={l.id} onClick={() => setActiveId(l.id)} className={`px-2 py-1.5 border-b border-[rgb(var(--border))] cursor-pointer ${activeId === l.id ? 'bg-[rgb(var(--gold-100))]' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
                <div className="flex items-center gap-1.5">
                  <button onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { visible: !l.visible }) }} className="text-[rgb(var(--fg-muted))]">{l.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <span className="text-xs flex-1 truncate" onDoubleClick={() => { const n = window.prompt('Nome livello', l.name); if (n) patchLayer(l.id, { name: n }) }}>{l.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, 1) }} className="text-[rgb(var(--fg-subtle))]"><ChevronUp size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, -1) }} className="text-[rgb(var(--fg-subtle))]"><ChevronDown size={13} /></button>
                </div>
                {activeId === l.id && (
                  <div className="mt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => patchLayer(l.id, { alphaLock: !l.alphaLock })} title={l.alphaLock ? 'Alpha lock attivo (disegna solo sui pixel esistenti)' : 'Alpha lock'} className={l.alphaLock ? 'text-[rgb(var(--gold-600))]' : 'text-[rgb(var(--fg-subtle))]'}>{l.alphaLock ? <Lock size={13} /> : <Unlock size={13} />}</button>
                    <input type="range" min={0} max={1} step={0.02} value={l.opacity} onChange={(e) => patchLayer(l.id, { opacity: Number(e.target.value) })} className="flex-1" />
                    <Select value={l.blend} onChange={(e) => patchLayer(l.id, { blend: e.target.value as GlobalCompositeOperation })} className="h-6 text-[10px] w-20">{BLENDS.map((b) => <option key={b.v} value={b.v}>{b.l}</option>)}</Select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showNew && <NewDocModal onClose={() => setShowNew(false)} onCreate={(w, h) => { initDoc(w, h); setDocId(null); setTitle('Senza titolo'); setShowNew(false) }} />}
      {showGallery && <GalleryModal entryId={entryId} onClose={() => setShowGallery(false)} onOpen={openDesign} onDelete={(id) => del.mutate(id)} />}
      {adjust && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={cancelAdjust}>
          <div className="bg-[rgb(var(--bg))] rounded-2xl p-5 w-full max-w-sm space-y-2.5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm inline-flex items-center gap-1.5"><SlidersHorizontal size={15} /> Regolazioni livello</h3>
            <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Luminosità: {Math.round(adjust.b * 100)}%<input type="range" min={0} max={2} step={0.01} value={adjust.b} onChange={(e) => setAdjust((a) => a && { ...a, b: Number(e.target.value) })} className="w-full" /></label>
            <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Contrasto: {Math.round(adjust.c * 100)}%<input type="range" min={0} max={2} step={0.01} value={adjust.c} onChange={(e) => setAdjust((a) => a && { ...a, c: Number(e.target.value) })} className="w-full" /></label>
            <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Saturazione: {Math.round(adjust.s * 100)}%<input type="range" min={0} max={3} step={0.01} value={adjust.s} onChange={(e) => setAdjust((a) => a && { ...a, s: Number(e.target.value) })} className="w-full" /></label>
            <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Tonalità: {adjust.h}°<input type="range" min={-180} max={180} step={1} value={adjust.h} onChange={(e) => setAdjust((a) => a && { ...a, h: Number(e.target.value) })} className="w-full" /></label>
            <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Sfocatura: {adjust.blur}px<input type="range" min={0} max={30} step={0.5} value={adjust.blur} onChange={(e) => setAdjust((a) => a && { ...a, blur: Number(e.target.value) })} className="w-full" /></label>
            <div className="flex gap-2 justify-end pt-1"><Button size="sm" variant="outline" onClick={cancelAdjust}>Annulla</Button><Button size="sm" onClick={applyAdjust}>Applica</Button></div>
          </div>
        </div>
      )}
    </div>
  )
}

// Anteprima di un timbro nel pannello (mini canvas che riusa drawStamp)
function MotifIcon({ motif }: { motif: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    drawStamp(ctx, motif, c.width / 2, c.height / 2, 15, '#5b4636')
  }, [motif])
  return <canvas ref={ref} width={30} height={30} className="pointer-events-none" />
}

// Box di testo editabile sovrapposto al canvas (stile Photoshop): spostabile, allargabile,
// ri-modificabile, eliminabile. Interattivo solo col tool Testo; altrimenti mostra solo il testo.
function TextBox({ t, zoom, pan, editable, active, onSelect, onChange, onDelete, onCommitEmpty }: {
  t: TextObj; zoom: number; pan: { x: number; y: number }; editable: boolean; active: boolean
  onSelect: () => void; onChange: (patch: Partial<TextObj>) => void; onDelete: () => void; onCommitEmpty: () => void
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const drag = useRef<{ mode: 'move' | 'resize'; sx: number; sy: number; ox: number; oy: number; ow: number } | null>(null)
  useEffect(() => { const el = taRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }, [t.text, t.size, t.w, t.font, zoom])
  useEffect(() => { if (!active) return; const el = taRef.current; if (!el) return; const id = requestAnimationFrame(() => { try { el.focus({ preventScroll: true }) } catch { el.focus() } }); return () => cancelAnimationFrame(id) }, [active])

  const down = (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault()
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* */ }
    drag.current = { mode, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y, ow: t.w }; onSelect()
  }
  const move = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const dx = (e.clientX - d.sx) / zoom, dy = (e.clientY - d.sy) / zoom
    if (d.mode === 'move') onChange({ x: Math.round(d.ox + dx), y: Math.round(d.oy + dy) })
    else onChange({ w: Math.max(40, Math.round(d.ow + dx)) })
  }
  const up = (e: React.PointerEvent) => { drag.current = null; try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* */ } }

  const left = pan.x + t.x * zoom, top = pan.y + t.y * zoom, width = t.w * zoom
  return (
    <div className="absolute" style={{ left, top, width, pointerEvents: editable ? 'auto' : 'none' }}>
      {editable && active && (
        <>
          <div onPointerDown={down('move')} onPointerMove={move} onPointerUp={up} title="Trascina per spostare"
            className="absolute -top-4 left-0 right-0 h-4 rounded-t cursor-move flex items-center justify-center touch-none" style={{ background: 'rgba(197,160,80,0.85)' }}>
            <div className="w-6 h-0.5 bg-white/80 rounded" />
          </div>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete() }} title="Elimina testo"
            className="absolute -top-4 -right-5 h-5 w-5 grid place-items-center rounded-full bg-black/60 text-white text-[11px] leading-none">×</button>
          <div onPointerDown={down('resize')} onPointerMove={move} onPointerUp={up} title="Trascina per allargare il box"
            className="absolute -bottom-1.5 -right-1.5 h-3 w-3 border border-white rounded-sm cursor-nwse-resize touch-none" style={{ background: 'rgb(197,160,80)' }} />
        </>
      )}
      <textarea ref={taRef} value={t.text} readOnly={!editable} spellCheck={false} rows={1} placeholder={editable ? 'Scrivi…' : ''}
        onChange={(e) => onChange({ text: e.target.value })}
        onPointerDown={(e) => { if (editable) { e.stopPropagation(); onSelect() } }}
        onFocus={onSelect}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur() }}
        onBlur={onCommitEmpty}
        className={`block w-full bg-transparent outline-none resize-none overflow-hidden ${editable && active ? 'ring-1 ring-[rgb(var(--gold-400))]' : ''}`}
        style={{ color: t.color, fontFamily: `"${t.font}"`, fontSize: t.size * zoom, lineHeight: 1.25, textAlign: t.align, padding: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: editable ? 'text' : 'none', WebkitUserSelect: editable ? 'text' : 'none', touchAction: editable ? 'auto' : 'none', caretColor: t.color, cursor: editable ? 'text' : 'default' }} />
    </div>
  )
}

function ColorWheel({ color, onChange }: { color: string; onChange: (hex: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [hsv, setHsv] = useState<[number, number, number]>(() => { const [r, g, b] = hexToRgb(color); return rgbToHsv(r, g, b) })
  const [h, s, v] = hsv
  const R = 82
  useEffect(() => {
    const [r, g, b] = hexToRgb(color); const c = hsvToRgb(h, s, v)
    if (Math.round(c[0]) !== r || Math.round(c[1]) !== g || Math.round(c[2]) !== b) setHsv(rgbToHsv(r, g, b))
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [color])
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return; const ctx = cvs.getContext('2d')!; const D = R * 2; const img = ctx.createImageData(D, D); const d = img.data
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const dx = x - R, dy = y - R, rr = Math.hypot(dx, dy), i = (y * D + x) * 4
      if (rr <= R) { const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, sat = rr / R; const [cr, cg, cb] = hsvToRgb(hue, sat, v); d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = 255 } else d[i + 3] = 0
    }
    ctx.putImageData(img, 0, 0)
  }, [v])
  const pick = (e: React.PointerEvent) => {
    const cvs = ref.current!; const rect = cvs.getBoundingClientRect(); const x = e.clientX - rect.left - R, y = e.clientY - rect.top - R
    const rr = Math.min(R, Math.hypot(x, y)); const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, sat = rr / R
    setHsv([hue, sat, v]); const [cr, cg, cb] = hsvToRgb(hue, sat, v); onChange(rgbToHex(cr, cg, cb))
  }
  const mx = R + Math.cos((h * Math.PI) / 180) * s * R, my = R + Math.sin((h * Math.PI) / 180) * s * R
  return (
    <div>
      <div className="relative mx-auto" style={{ width: R * 2, height: R * 2 }}>
        <canvas ref={ref} width={R * 2} height={R * 2} className="rounded-full cursor-crosshair" style={{ touchAction: 'none' }} onPointerDown={pick} onPointerMove={(e) => { if (e.buttons) pick(e) }} />
        <div className="absolute w-3 h-3 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: mx, top: my, background: color }} />
      </div>
      <label className="block text-[11px] text-[rgb(var(--fg-muted))] mt-1">Luminosità<input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => { const nv = Number(e.target.value); setHsv([h, s, nv]); const [cr, cg, cb] = hsvToRgb(h, s, nv); onChange(rgbToHex(cr, cg, cb)) }} className="w-full" /></label>
    </div>
  )
}

function NewDocModal({ onClose, onCreate }: { onClose: () => void; onCreate: (w: number, h: number) => void }) {
  const [w, setW] = useState('1500'); const [h, setH] = useState('1500')
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--bg))] rounded-2xl p-5 w-full max-w-md space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="font-semibold">Nuovo progetto</h3><button onClick={onClose}><X size={18} /></button></div>
        <div className="grid grid-cols-2 gap-2">
          {PRESETS.map((p) => <button key={p.key} onClick={() => onCreate(p.w, p.h)} className="text-left px-3 py-2 rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--gold-400))]"><p className="text-sm font-medium">{p.label}</p><p className="text-[11px] text-[rgb(var(--fg-subtle))]">{p.w}×{p.h}px</p></button>)}
        </div>
        <div className="flex items-end gap-2 pt-2 border-t border-[rgb(var(--border))]">
          <label className="text-[11px] text-[rgb(var(--fg-muted))]">Largh.<Input value={w} onChange={(e) => setW(e.target.value)} className="h-8 w-24 mt-0.5" /></label>
          <label className="text-[11px] text-[rgb(var(--fg-muted))]">Alt.<Input value={h} onChange={(e) => setH(e.target.value)} className="h-8 w-24 mt-0.5" /></label>
          <Button size="sm" onClick={() => onCreate(Number(w) || 1500, Number(h) || 1500)}>Crea personalizzato</Button>
        </div>
      </div>
    </div>
  )
}

function GalleryModal({ entryId, onClose, onOpen, onDelete }: { entryId: string | null; onClose: () => void; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const { data: docs } = useDesigns(entryId)
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--bg))] rounded-2xl p-5 w-full max-w-3xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">I miei progetti{entryId ? ' · evento' : ''}</h3><button onClick={onClose}><X size={18} /></button></div>
        {(docs ?? []).length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))] py-8 text-center">Nessun progetto salvato.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {(docs ?? []).map((d: DesignMeta) => (
            <div key={d.id} className="rounded-lg border border-[rgb(var(--border))] overflow-hidden group">
              <button onClick={() => onOpen(d.id)} className="block w-full aspect-square bg-[rgb(var(--bg-sunken))]">{d.thumbnail ? <img src={d.thumbnail} alt={d.title} className="w-full h-full object-contain" /> : <div className="grid place-items-center h-full text-[rgb(var(--fg-subtle))] text-xs">—</div>}</button>
              <div className="px-2 py-1 flex items-center gap-1"><span className="text-xs truncate flex-1">{d.title}</span><button onClick={() => { if (confirm(`Eliminare "${d.title}"?`)) onDelete(d.id) }} className="text-[rgb(var(--rose-500))] opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
