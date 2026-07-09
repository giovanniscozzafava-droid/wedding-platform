import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Paintbrush, Pencil, Highlighter, SprayCan, Eraser, Minus, Square, Circle, ArrowUpRight, PaintBucket, Type, Pipette,
  Hand, Move, ZoomIn, ZoomOut, Maximize, Undo2, Redo2, Save, Download, FolderOpen, ImagePlus, Plus, Trash2, Copy,
  Eye, EyeOff, ChevronUp, ChevronDown, FilePlus2, X, Expand, FileText, ArrowLeft, PanelRightClose, PanelRightOpen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useDesigns, fetchDesign, useDesignMutations, type DesignMeta } from '@/hooks/useDesignStudio'

// ── Studio disegno a mano libera (tavola grafica / tablet) ─────────────────────────────────────────
// Motore a LIVELLI raster: ogni livello è un canvas offscreen (W×H doc); il canvas visibile compone i
// livelli con opacità e blend, applicando zoom/pan. Disegno con pressione via Pointer Events (penna).
// Undo/redo con snapshot PNG (leggeri in RAM). Export PNG/PDF, salvataggio riapribile su design_docs.

type Tool = 'brush' | 'pencil' | 'marker' | 'airbrush' | 'eraser' | 'line' | 'rect' | 'ellipse' | 'arrow' | 'fill' | 'text' | 'eyedropper' | 'hand' | 'move'
type LayerMeta = { id: string; name: string; visible: boolean; opacity: number; blend: GlobalCompositeOperation }
type Pt = { x: number; y: number }

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
]
const SWATCHES = ['#1a1a1a', '#ffffff', '#c8a24b', '#b08d3c', '#8a6d3b', '#c65d5d', '#d98c5f', '#6b8e6b', '#5f7d95', '#3a4a6b', '#7a5c8e', '#d9b8c4']
const FONTS = ['Georgia, serif', 'Cormorant Garamond, serif', 'Helvetica, Arial, sans-serif', 'Courier New, monospace', 'Brush Script MT, cursive']

const uidgen = () => 'l' + Math.abs((Date.now() ^ (performance.now() * 1000)) | 0).toString(36) + Math.floor(performance.now() % 9999).toString(36)
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i)
  if (!m) return [0, 0, 0]
  const n = parseInt(m[1]!, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.crossOrigin = 'anonymous'; i.src = src })
}
function newCanvas(w: number, h: number): HTMLCanvasElement { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

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
    const [cx, cy] = stack.pop()!
    if (!match(at(cx, cy))) continue
    let top = cy; while (top > 0 && match(at(cx, top - 1))) top--
    let bot = cy; while (bot < H - 1 && match(at(cx, bot + 1))) bot++
    for (let yy = top; yy <= bot; yy++) {
      const j = at(cx, yy); d[j] = nr; d[j + 1] = ng; d[j + 2] = nb; d[j + 3] = na
      if (cx > 0 && match(at(cx - 1, yy))) stack.push([cx - 1, yy])
      if (cx < W - 1 && match(at(cx + 1, yy))) stack.push([cx + 1, yy])
    }
  }
  ctx.putImageData(img, 0, 0)
}

function drawShape(ctx: CanvasRenderingContext2D, tool: Tool, a: Pt, b: Pt, o: { color: string; size: number; fill: boolean; alpha: number }) {
  ctx.save(); ctx.globalAlpha = o.alpha; ctx.strokeStyle = o.color; ctx.fillStyle = o.color; ctx.lineWidth = o.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  if (tool === 'line' || tool === 'arrow') {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    if (tool === 'arrow') {
      const ang = Math.atan2(b.y - a.y, b.x - a.x); const h = Math.max(10, o.size * 3)
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - h * Math.cos(ang - 0.4), b.y - h * Math.sin(ang - 0.4))
      ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - h * Math.cos(ang + 0.4), b.y - h * Math.sin(ang + 0.4)); ctx.stroke()
    }
  } else if (tool === 'rect') {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), hh = Math.abs(b.y - a.y)
    if (o.fill) ctx.fillRect(x, y, w, hh); else ctx.strokeRect(x, y, w, hh)
  } else if (tool === 'ellipse') {
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); if (o.fill) ctx.fill(); else ctx.stroke()
  }
  ctx.restore()
}

export default function DesignStudioPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const displayRef = useRef<HTMLCanvasElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const layerCanvases = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const fileRef = useRef<HTMLInputElement>(null)

  const [dims, setDims] = useState({ w: 1500, h: 1500 })
  const [layers, setLayers] = useState<LayerMeta[]>([])
  const [activeId, setActiveId] = useState('')
  const [tool, setTool] = useState<Tool>('brush')
  const [color, setColor] = useState('#1a1a1a')
  const [size, setSize] = useState(12)
  const [opacity, setOpacity] = useState(1)
  const [fill, setFill] = useState(false)
  const [font, setFont] = useState(FONTS[0]!)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [recent, setRecent] = useState<string[]>([])
  const [title, setTitle] = useState('Senza titolo')
  const [docId, setDocId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showGallery, setShowGallery] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rightOpen, setRightOpen] = useState(true)
  const [sp] = useSearchParams(); const navigate = useNavigate()
  const entryId = sp.get('entry'); const openDocParam = sp.get('doc')

  const history = useRef<Array<{ layerId: string; before: string; after: string }>>([])
  const redo = useRef<Array<{ layerId: string; before: string; after: string }>>([])
  const draw = useRef<{ active: boolean; last: Pt; start: Pt; before: string; panning: boolean; panStart: Pt; panOrig: { x: number; y: number } } | null>(null)
  const spaceRef = useRef(false)

  const getCtx = (id: string) => layerCanvases.current.get(id)?.getContext('2d') ?? null

  // ── Compositing ──────────────────────────────────────────────────────────
  const composite = useCallback(() => {
    const disp = displayRef.current; if (!disp) return
    const ctx = disp.getContext('2d')!; const { w: W, h: H } = dims
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#3a3d44'; ctx.fillRect(0, 0, disp.width, disp.height)
    ctx.save(); ctx.translate(pan.x, pan.y); ctx.scale(zoom, zoom)
    ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    for (const l of layers) {
      if (!l.visible) continue
      const c = layerCanvases.current.get(l.id); if (!c) continue
      ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = l.blend
      ctx.drawImage(c, 0, 0)
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
    ctx.restore()
  }, [dims, layers, zoom, pan])

  const resize = useCallback(() => {
    const disp = displayRef.current, stage = stageRef.current; if (!disp || !stage) return
    disp.width = stage.clientWidth; disp.height = stage.clientHeight; composite()
  }, [composite])

  const fitView = useCallback((w = dims.w, h = dims.h) => {
    const stage = stageRef.current; if (!stage) return
    const z = Math.min(stage.clientWidth / w, stage.clientHeight / h) * 0.9
    setZoom(z); setPan({ x: (stage.clientWidth - w * z) / 2, y: (stage.clientHeight - h * z) / 2 })
  }, [dims])

  // ── Documento ────────────────────────────────────────────────────────────
  const initDoc = useCallback((w: number, h: number) => {
    w = Math.min(MAXDIM, Math.max(64, Math.round(w))); h = Math.min(MAXDIM, Math.max(64, Math.round(h)))
    layerCanvases.current.clear()
    const bg = uidgen(), l1 = uidgen()
    const bgC = newCanvas(w, h); const bctx = bgC.getContext('2d')!; bctx.fillStyle = '#ffffff'; bctx.fillRect(0, 0, w, h)
    layerCanvases.current.set(bg, bgC); layerCanvases.current.set(l1, newCanvas(w, h))
    history.current = []; redo.current = []
    setDims({ w, h })
    setLayers([
      { id: bg, name: 'Sfondo', visible: true, opacity: 1, blend: 'source-over' },
      { id: l1, name: 'Livello 1', visible: true, opacity: 1, blend: 'source-over' },
    ])
    setActiveId(l1)
    setTimeout(() => fitView(w, h), 0)
  }, [fitView])

  useEffect(() => { if (openDocParam) void openDesign(openDocParam); else initDoc(1500, 1500) /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])
  useEffect(() => { composite() }, [composite])
  useEffect(() => {
    resize(); const ro = new ResizeObserver(resize); if (stageRef.current) ro.observe(stageRef.current)
    return () => ro.disconnect()
  }, [resize])

  // pressione: penna → e.pressure, mouse → piena
  const pressureOf = (e: React.PointerEvent) => (e.pointerType === 'pen' ? Math.max(0.06, e.pressure || 0.5) : 1)
  const toDoc = (e: React.PointerEvent): Pt => {
    const disp = displayRef.current!; const r = disp.getBoundingClientRect()
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom }
  }

  const strokeSeg = (ctx: CanvasRenderingContext2D, a: Pt, b: Pt, press: number) => {
    const w = Math.max(0.5, size * press)
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = color; ctx.lineWidth = w
    if (tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = opacity }
    else if (tool === 'marker') { ctx.globalAlpha = opacity * 0.4; ctx.lineWidth = Math.max(2, size) * press }
    else if (tool === 'pencil') { ctx.globalAlpha = opacity; ctx.lineWidth = Math.max(0.5, size * 0.5 * press) }
    else if (tool === 'airbrush') {
      ctx.globalAlpha = 1; ctx.fillStyle = color
      const R = size * press, n = Math.max(6, Math.floor(size))
      for (let i = 0; i < n; i++) { const ang = Math.random() * 6.283, rr = Math.random() * R; ctx.globalAlpha = opacity * 0.12; ctx.beginPath(); ctx.arc(b.x + Math.cos(ang) * rr, b.y + Math.sin(ang) * rr, 1.1, 0, 6.283); ctx.fill() }
      ctx.restore(); return
    } else { ctx.globalAlpha = opacity }
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore()
  }

  const pushHistory = (layerId: string, before: string, after: string) => {
    history.current.push({ layerId, before, after }); if (history.current.length > 24) history.current.shift()
    redo.current = []
  }
  const applyUrl = async (layerId: string, url: string) => {
    const c = layerCanvases.current.get(layerId); if (!c) return
    const ctx = c.getContext('2d')!; const img = await loadImage(url); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0); composite()
  }
  const undo = async () => { const h = history.current.pop(); if (!h) return; redo.current.push(h); await applyUrl(h.layerId, h.before) }
  const redoFn = async () => { const h = redo.current.pop(); if (!h) return; history.current.push(h); await applyUrl(h.layerId, h.after) }

  const pushColor = (c: string) => setRecent((r) => [c, ...r.filter((x) => x !== c)].slice(0, 10))

  // ── Pointer ──────────────────────────────────────────────────────────────
  function onDown(e: React.PointerEvent) {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const isPan = tool === 'hand' || spaceRef.current || e.button === 1
    if (isPan) { draw.current = { active: false, last: { x: 0, y: 0 }, start: { x: 0, y: 0 }, before: '', panning: true, panStart: { x: e.clientX, y: e.clientY }, panOrig: { ...pan } }; return }
    const p = toDoc(e)
    const ctx = getCtx(activeId); if (!ctx) return
    if (tool === 'eyedropper') {
      const disp = displayRef.current!; const r = disp.getBoundingClientRect()
      const px = disp.getContext('2d')!.getImageData(Math.round(e.clientX - r.left), Math.round(e.clientY - r.top), 1, 1).data
      const hex = '#' + [px[0], px[1], px[2]].map((n) => (n ?? 0).toString(16).padStart(2, '0')).join(''); setColor(hex); pushColor(hex); return
    }
    if (tool === 'fill') { const before = layerCanvases.current.get(activeId)!.toDataURL(); floodFill(ctx, dims.w, dims.h, p.x, p.y, color); composite(); pushHistory(activeId, before, layerCanvases.current.get(activeId)!.toDataURL()); pushColor(color); return }
    if (tool === 'text') {
      const t = window.prompt('Testo:'); if (!t) return
      const before = layerCanvases.current.get(activeId)!.toDataURL()
      ctx.save(); ctx.globalAlpha = opacity; ctx.fillStyle = color; ctx.textBaseline = 'top'; ctx.font = `${Math.max(12, size * 3)}px ${font}`; ctx.fillText(t, p.x, p.y); ctx.restore()
      composite(); pushHistory(activeId, before, layerCanvases.current.get(activeId)!.toDataURL()); pushColor(color); return
    }
    const before = layerCanvases.current.get(activeId)!.toDataURL()
    draw.current = { active: true, last: p, start: p, before, panning: false, panStart: { x: 0, y: 0 }, panOrig: { x: 0, y: 0 } }
    if (tool === 'brush' || tool === 'pencil' || tool === 'marker' || tool === 'airbrush' || tool === 'eraser') { strokeSeg(ctx, p, p, pressureOf(e)); composite() }
  }

  function onMove(e: React.PointerEvent) {
    // anello pennello
    const ring = ringRef.current, disp = displayRef.current
    if (ring && disp) { const r = disp.getBoundingClientRect(); const d = size * zoom; ring.style.display = (tool === 'hand' || tool === 'eyedropper' || tool === 'text' || tool === 'fill') ? 'none' : 'block'; ring.style.width = ring.style.height = d + 'px'; ring.style.left = (e.clientX - r.left) + 'px'; ring.style.top = (e.clientY - r.top) + 'px' }
    const st = draw.current; if (!st) return
    if (st.panning) { setPan({ x: st.panOrig.x + (e.clientX - st.panStart.x), y: st.panOrig.y + (e.clientY - st.panStart.y) }); return }
    if (!st.active) return
    const p = toDoc(e); const ctx = getCtx(activeId); if (!ctx) return
    if (tool === 'brush' || tool === 'pencil' || tool === 'marker' || tool === 'airbrush' || tool === 'eraser') {
      // coalesced per tratti fluidi con la penna
      const evs = (e.nativeEvent as any).getCoalescedEvents?.() as PointerEvent[] | undefined
      if (evs && evs.length) { let last = st.last; for (const ce of evs) { const r = disp!.getBoundingClientRect(); const cp = { x: (ce.clientX - r.left - pan.x) / zoom, y: (ce.clientY - r.top - pan.y) / zoom }; strokeSeg(ctx, last, cp, ce.pointerType === 'pen' ? Math.max(0.06, ce.pressure || 0.5) : 1); last = cp } st.last = last }
      else { strokeSeg(ctx, st.last, p, pressureOf(e)); st.last = p }
      composite()
    } else if (tool === 'move') {
      const dx = p.x - st.start.x, dy = p.y - st.start.y
      loadImage(st.before).then((img) => { ctx.clearRect(0, 0, dims.w, dims.h); ctx.drawImage(img, dx, dy); composite() })
    } else if (tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'arrow') {
      composite(); const disp2 = displayRef.current!; const c2 = disp2.getContext('2d')!
      c2.save(); c2.translate(pan.x, pan.y); c2.scale(zoom, zoom); drawShape(c2, tool, st.start, p, { color, size, fill, alpha: opacity }); c2.restore()
    }
  }

  function onUp(e: React.PointerEvent) {
    const st = draw.current; draw.current = null; if (!st) return
    if (st.panning) return
    const ctx = getCtx(activeId); if (!ctx) return
    if (tool === 'line' || tool === 'rect' || tool === 'ellipse' || tool === 'arrow') { drawShape(ctx, tool, st.start, toDoc(e), { color, size, fill, alpha: opacity }); composite() }
    if (['brush', 'pencil', 'marker', 'airbrush', 'eraser'].includes(tool)) pushColor(color)
    pushHistory(activeId, st.before, layerCanvases.current.get(activeId)!.toDataURL())
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault(); const disp = displayRef.current!; const r = disp.getBoundingClientRect()
    const mx = e.clientX - r.left, my = e.clientY - r.top
    const factor = e.deltaY < 0 ? 1.12 : 0.89; const nz = Math.min(8, Math.max(0.08, zoom * factor))
    setPan({ x: mx - (mx - pan.x) * (nz / zoom), y: my - (my - pan.y) * (nz / zoom) }); setZoom(nz)
  }

  // scorciatoie
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.code === 'Space') { spaceRef.current = true; return }
      const t = e.target as HTMLElement; if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redoFn() : undo(); return }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void doSave(); return }
      const map: Record<string, Tool> = { b: 'brush', p: 'pencil', m: 'marker', a: 'airbrush', e: 'eraser', g: 'fill', t: 'text', i: 'eyedropper', h: 'hand', v: 'move', l: 'line', r: 'rect', o: 'ellipse' }
      if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]!)
      if (e.key === '[') setSize((s) => Math.max(1, s - 2))
      if (e.key === ']') setSize((s) => Math.min(400, s + 2))
    }
    const ku = (e: KeyboardEvent) => { if (e.code === 'Space') spaceRef.current = false }
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku)
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku) }
  })

  // ── Livelli ──────────────────────────────────────────────────────────────
  const addLayer = () => { const id = uidgen(); layerCanvases.current.set(id, newCanvas(dims.w, dims.h)); setLayers((ls) => [...ls, { id, name: `Livello ${ls.length}`, visible: true, opacity: 1, blend: 'source-over' }]); setActiveId(id) }
  const dupLayer = () => {
    const src = layerCanvases.current.get(activeId); if (!src) return; const id = uidgen(); const c = newCanvas(dims.w, dims.h); c.getContext('2d')!.drawImage(src, 0, 0); layerCanvases.current.set(id, c)
    setLayers((ls) => { const i = ls.findIndex((l) => l.id === activeId); const m = ls.find((l) => l.id === activeId)!; const copy = { ...m, id, name: m.name + ' copia' }; const n = [...ls]; n.splice(i + 1, 0, copy); return n }); setActiveId(id)
  }
  const delLayer = () => { if (layers.length <= 1) return; layerCanvases.current.delete(activeId); setLayers((ls) => { const n = ls.filter((l) => l.id !== activeId); setActiveId(n[n.length - 1]!.id); return n }); }
  const moveLayer = (id: string, dir: -1 | 1) => setLayers((ls) => { const i = ls.findIndex((l) => l.id === id); const j = i + dir; if (j < 0 || j >= ls.length) return ls; const n = [...ls]; const [x] = n.splice(i, 1); n.splice(j, 0, x!); return n })
  const patchLayer = (id: string, p: Partial<LayerMeta>) => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...p } : l)))

  // ── Export / persistenza ──────────────────────────────────────────────────
  const flatten = (): HTMLCanvasElement => {
    const out = newCanvas(dims.w, dims.h); const ctx = out.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dims.w, dims.h)
    for (const l of layers) { if (!l.visible) continue; const c = layerCanvases.current.get(l.id); if (!c) continue; ctx.globalAlpha = l.opacity; ctx.globalCompositeOperation = l.blend; ctx.drawImage(c, 0, 0) }
    return out
  }
  const exportPNG = () => { const a = document.createElement('a'); a.href = flatten().toDataURL('image/png'); a.download = `${title || 'disegno'}.png`; a.click() }
  const exportPDF = async () => {
    const { default: JsPDF } = await import('jspdf')
    const doc = new JsPDF({ unit: 'px', format: [dims.w, dims.h], orientation: dims.w > dims.h ? 'landscape' : 'portrait' })
    doc.addImage(flatten().toDataURL('image/png'), 'PNG', 0, 0, dims.w, dims.h); doc.save(`${title || 'disegno'}.pdf`)
  }
  const thumbOf = (): string => { const s = 320 / Math.max(dims.w, dims.h); const t = newCanvas(Math.round(dims.w * s), Math.round(dims.h * s)); t.getContext('2d')!.drawImage(flatten(), 0, 0, t.width, t.height); return t.toDataURL('image/png') }

  const { save, del } = useDesignMutations()
  async function doSave() {
    setSaving(true)
    try {
      const doc = JSON.stringify({ layers: layers.map((l) => ({ ...l, data: layerCanvases.current.get(l.id)!.toDataURL('image/png') })) })
      const id = await save.mutateAsync({ id: docId, title: title || 'Senza titolo', width: dims.w, height: dims.h, doc, thumbnail: thumbOf(), entry_id: entryId })
      setDocId(id); toast.success('Progetto salvato')
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
  }
  async function openDesign(id: string) {
    try {
      const d = await fetchDesign(id); if (!d || !d.doc) { toast.error('Progetto non leggibile'); return }
      const parsed = JSON.parse(d.doc) as { layers: Array<LayerMeta & { data: string }> }
      layerCanvases.current.clear()
      for (const l of parsed.layers) { const c = newCanvas(d.width, d.height); const img = await loadImage(l.data); c.getContext('2d')!.drawImage(img, 0, 0); layerCanvases.current.set(l.id, c) }
      history.current = []; redo.current = []
      setDims({ w: d.width, h: d.height }); setLayers(parsed.layers.map(({ data: _d, ...m }) => m)); setActiveId(parsed.layers[parsed.layers.length - 1]!.id)
      setTitle(d.title); setDocId(d.id); setShowGallery(false); setTimeout(() => fitView(d.width, d.height), 0)
    } catch (e) { toast.error((e as Error).message) }
  }
  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return
    const rd = new FileReader(); rd.onload = async () => {
      const img = await loadImage(String(rd.result)); const ctx = getCtx(activeId); if (!ctx) return
      const s = Math.min(dims.w / img.width, dims.h / img.height, 1); const w = img.width * s, h = img.height * s
      const before = layerCanvases.current.get(activeId)!.toDataURL()
      ctx.drawImage(img, (dims.w - w) / 2, (dims.h - h) / 2, w, h); composite(); pushHistory(activeId, before, layerCanvases.current.get(activeId)!.toDataURL())
    }; rd.readAsDataURL(f)
  }
  const goFullscreen = () => { const el = rootRef.current; if (!el) return; if (document.fullscreenElement) document.exitFullscreen(); else el.requestFullscreen?.() }

  // ── UI ─────────────────────────────────────────────────────────────────────
  const TOOLS: Array<{ t: Tool; Icon: typeof Paintbrush; label: string }> = [
    { t: 'brush', Icon: Paintbrush, label: 'Pennello (B)' }, { t: 'pencil', Icon: Pencil, label: 'Matita (P)' }, { t: 'marker', Icon: Highlighter, label: 'Pennarello (M)' },
    { t: 'airbrush', Icon: SprayCan, label: 'Aerografo (A)' }, { t: 'eraser', Icon: Eraser, label: 'Gomma (E)' }, { t: 'fill', Icon: PaintBucket, label: 'Riempimento (G)' },
    { t: 'line', Icon: Minus, label: 'Linea (L)' }, { t: 'rect', Icon: Square, label: 'Rettangolo (R)' }, { t: 'ellipse', Icon: Circle, label: 'Ellisse (O)' }, { t: 'arrow', Icon: ArrowUpRight, label: 'Freccia' },
    { t: 'text', Icon: Type, label: 'Testo (T)' }, { t: 'eyedropper', Icon: Pipette, label: 'Contagocce (I)' }, { t: 'move', Icon: Move, label: 'Sposta livello (V)' }, { t: 'hand', Icon: Hand, label: 'Mano / pan (H)' },
  ]
  const ordered = [...layers].reverse()

  return (
    <div ref={rootRef} className="fixed inset-0 z-40 flex flex-col bg-[rgb(var(--bg))] select-none" style={{ touchAction: 'none' }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 h-12 border-b border-[rgb(var(--border))] shrink-0">
        {entryId && <button onClick={() => navigate(`/weddings/${entryId}`)} title="Torna all'evento" className="h-8 w-8 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))]"><ArrowLeft size={16} /></button>}
        <span className="font-semibold text-sm inline-flex items-center gap-1.5"><Paintbrush size={16} /> Studio{entryId && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgb(var(--gold-100))] font-normal">evento</span>}</span>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 w-48" />
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => setShowNew(true)} title="Nuovo"><FilePlus2 size={14} /></Button>
          <Button size="sm" variant="outline" onClick={() => setShowGallery(true)} title="Apri"><FolderOpen size={14} /></Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} title="Importa immagine"><ImagePlus size={14} /></Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImportFile} />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={undo} title="Annulla (Ctrl+Z)"><Undo2 size={14} /></Button>
          <Button size="sm" variant="outline" onClick={redoFn} title="Ripeti (Ctrl+Shift+Z)"><Redo2 size={14} /></Button>
          <span className="w-px h-5 bg-[rgb(var(--border))] mx-1" />
          <Button size="sm" variant="outline" onClick={() => { const nz = Math.max(0.08, zoom * 0.85); setZoom(nz) }} title="Zoom -"><ZoomOut size={14} /></Button>
          <span className="text-xs tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(8, z * 1.15))} title="Zoom +"><ZoomIn size={14} /></Button>
          <Button size="sm" variant="outline" onClick={() => fitView()} title="Adatta"><Maximize size={14} /></Button>
          <Button size="sm" variant="outline" onClick={goFullscreen} title="Schermo intero"><Expand size={14} /></Button>
          <span className="w-px h-5 bg-[rgb(var(--border))] mx-1" />
          <Button size="sm" variant="outline" onClick={exportPNG} title="Esporta PNG"><Download size={14} /> PNG</Button>
          <Button size="sm" variant="outline" onClick={exportPDF} title="Esporta PDF"><FileText size={14} /> PDF</Button>
          <Button size="sm" onClick={doSave} disabled={saving}><Save size={14} /> {saving ? '…' : 'Salva'}</Button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Toolbar sinistra */}
        <div className="w-12 shrink-0 border-r border-[rgb(var(--border))] flex flex-col items-center gap-1 py-2 overflow-y-auto">
          {TOOLS.map(({ t, Icon, label }) => (
            <button key={t} title={label} onClick={() => setTool(t)}
              className={`h-9 w-9 grid place-items-center rounded-lg ${tool === t ? 'bg-[rgb(var(--gold-500))] text-white' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
              <Icon size={17} />
            </button>
          ))}
        </div>

        {/* Stage */}
        <div ref={stageRef} className="flex-1 relative overflow-hidden bg-[#3a3d44]">
          <canvas ref={displayRef} className="absolute inset-0 touch-none"
            style={{ cursor: tool === 'hand' ? 'grab' : tool === 'eyedropper' ? 'crosshair' : tool === 'text' ? 'text' : 'crosshair' }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { if (ringRef.current) ringRef.current.style.display = 'none' }} onWheel={onWheel} />
          <div ref={ringRef} className="pointer-events-none absolute rounded-full border border-white/80 mix-blend-difference -translate-x-1/2 -translate-y-1/2" style={{ display: 'none' }} />
        </div>

        {/* Pannello destro (riducibile) */}
        {!rightOpen && (
          <button onClick={() => setRightOpen(true)} title="Mostra strumenti" className="w-8 shrink-0 border-l border-[rgb(var(--border))] grid place-items-center hover:bg-[rgb(var(--bg-sunken))]"><PanelRightOpen size={16} /></button>
        )}
        <div className={`${rightOpen ? 'w-60' : 'hidden'} shrink-0 border-l border-[rgb(var(--border))] flex flex-col overflow-y-auto relative`}>
          <button onClick={() => setRightOpen(false)} title="Riduci pannello" className="absolute -left-3 top-2 z-20 h-6 w-6 grid place-items-center rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg))] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))] shadow-sm"><PanelRightClose size={13} /></button>
          {/* Colore + pennello */}
          <div className="p-3 border-b border-[rgb(var(--border))] space-y-2">
            <div className="flex items-center gap-2">
              <input type="color" value={color} onChange={(e) => { setColor(e.target.value); pushColor(e.target.value) }} className="h-9 w-9 rounded cursor-pointer border border-[rgb(var(--border))]" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="h-8 flex-1" />
            </div>
            <div className="flex flex-wrap gap-1">
              {SWATCHES.map((c) => <button key={c} onClick={() => { setColor(c); pushColor(c) }} className="h-5 w-5 rounded border border-[rgb(var(--border))]" style={{ background: c }} />)}
            </div>
            {recent.length > 0 && <div className="flex flex-wrap gap-1">{recent.map((c, i) => <button key={i} onClick={() => setColor(c)} className="h-4 w-4 rounded" style={{ background: c }} />)}</div>}
            <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Dimensione: {size}px
              <input type="range" min={1} max={200} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full" /></label>
            <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Opacità: {Math.round(opacity * 100)}%
              <input type="range" min={0.02} max={1} step={0.02} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full" /></label>
            {(tool === 'rect' || tool === 'ellipse') && <label className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--fg-muted))]"><input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} /> Riempi forma</label>}
            {tool === 'text' && <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Font<Select value={font} onChange={(e) => setFont(e.target.value)} className="h-8 mt-0.5">{FONTS.map((f) => <option key={f} value={f}>{f.split(',')[0]}</option>)}</Select></label>}
          </div>
          {/* Livelli */}
          <div className="p-2 border-b border-[rgb(var(--border))] flex items-center gap-1">
            <span className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mr-auto">Livelli</span>
            <button onClick={addLayer} title="Nuovo livello" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))]"><Plus size={14} /></button>
            <button onClick={dupLayer} title="Duplica" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))]"><Copy size={14} /></button>
            <button onClick={delLayer} title="Elimina" className="h-7 w-7 grid place-items-center rounded hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--rose-500))]"><Trash2 size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {ordered.map((l) => (
              <div key={l.id} onClick={() => setActiveId(l.id)}
                className={`px-2 py-1.5 border-b border-[rgb(var(--border))] cursor-pointer ${activeId === l.id ? 'bg-[rgb(var(--gold-100))]' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
                <div className="flex items-center gap-1.5">
                  <button onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { visible: !l.visible }) }} className="text-[rgb(var(--fg-muted))]">{l.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button>
                  <span className="text-xs flex-1 truncate" onDoubleClick={() => { const n = window.prompt('Nome livello', l.name); if (n) patchLayer(l.id, { name: n }) }}>{l.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, 1) }} className="text-[rgb(var(--fg-subtle))]"><ChevronUp size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); moveLayer(l.id, -1) }} className="text-[rgb(var(--fg-subtle))]"><ChevronDown size={13} /></button>
                </div>
                {activeId === l.id && (
                  <div className="mt-1 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
          {PRESETS.map((p) => <button key={p.key} onClick={() => onCreate(p.w, p.h)} className="text-left px-3 py-2 rounded-lg border border-[rgb(var(--border))] hover:border-[rgb(var(--gold-400))]">
            <p className="text-sm font-medium">{p.label}</p><p className="text-[11px] text-[rgb(var(--fg-subtle))]">{p.w}×{p.h}px</p></button>)}
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
        <div className="flex items-center justify-between mb-3"><h3 className="font-semibold">I miei progetti</h3><button onClick={onClose}><X size={18} /></button></div>
        {(docs ?? []).length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))] py-8 text-center">Nessun progetto salvato.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {(docs ?? []).map((d: DesignMeta) => (
            <div key={d.id} className="rounded-lg border border-[rgb(var(--border))] overflow-hidden group">
              <button onClick={() => onOpen(d.id)} className="block w-full aspect-square bg-[rgb(var(--bg-sunken))]">
                {d.thumbnail ? <img src={d.thumbnail} alt={d.title} className="w-full h-full object-contain" /> : <div className="grid place-items-center h-full text-[rgb(var(--fg-subtle))] text-xs">—</div>}
              </button>
              <div className="px-2 py-1 flex items-center gap-1">
                <span className="text-xs truncate flex-1">{d.title}</span>
                <button onClick={() => { if (confirm(`Eliminare "${d.title}"?`)) onDelete(d.id) }} className="text-[rgb(var(--rose-500))] opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
