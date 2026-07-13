import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Paintbrush, Pencil, PenTool, Highlighter, Droplets, Brush, Feather, Flower2, SprayCan, Eraser,
  Minus, Square, Circle, ArrowUpRight, PaintBucket, Type, Pipette, Hand, Move,
  ZoomIn, ZoomOut, Maximize, Undo2, Redo2, Save, Download, FolderOpen, ImagePlus, Images, Plus, Trash2, Copy,
  Eye, EyeOff, ChevronUp, ChevronDown, FilePlus2, X, Expand, FileText, ArrowLeft, PanelRightClose, PanelRightOpen, Search,
  Fingerprint, Lock, Unlock, FlipHorizontal2, FlipVertical2, RotateCw, RotateCcw, SlidersHorizontal,
  Stamp, Home, Maximize2, Minimize2, AlignLeft, AlignCenter, AlignRight, Upload, Ruler, Grid3x3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { fetchDesign, useDesignMutations, useAttachableEvents } from '@/hooks/useDesignStudio'
import { FONTS, ensureFont, injectFontsStylesheet } from '@/lib/studioFonts'
import { BUILTIN_PRESETS, loadCustomPresets, saveCustomPreset, deleteCustomPreset, type BrushPreset } from '@/lib/studioBrushPresets'
import { STAMPS, STAMP_GROUPS, DEFAULT_STAMP } from '@/lib/studioStamps'
import { loadCustomFonts, importCustomFont } from '@/lib/studioCustomFonts'
import { importCustomBrush, loadCustomBrushes, deleteCustomBrush, type CustomBrush } from '@/lib/studioCustomBrushes'
import {
  PAINT, MAXDIM, BLENDS, SWATCHES,
  uidgen, constrainEnd, loadImage, newCanvas, lerp, paintSeg, floodFill, drawShape, drawTextObj,
  type Tool, type LayerMeta, type SymMode, type Pt, type DabOpt, type TextObj,
} from '@/components/studio/engine'
import { TextBox } from '@/components/studio/TextLayer'
import { MotifIcon, CustomBrushIcon, ColorWheel } from '@/components/studio/StudioWidgets'
import { NewDocModal, GalleryModal } from '@/components/studio/Modals'

// ── Studio disegno a mano libera (tavola grafica / tablet) — ispirato a Procreate ─────────────────
// Motore a LIVELLI raster + engine pennelli a "stamp" (acquarello/gessetto/pastello/floreale…),
// STABILIZZAZIONE del tratto (streamline), pressione e INCLINAZIONE (tilt) della penna, foto di
// riferimento da ricalcare in trasparenza, testo inline con 120+ font Google, export PNG/PDF,
// salvataggio riapribile e indirizzabile a un EVENTO.


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
  const [customBrushes, setCustomBrushes] = useState<CustomBrush[]>([])   // pennelli importati dall'utente (punte raster)
  const [brushImportTint, setBrushImportTint] = useState(true)            // import: tinta col colore o colori originali
  const refBrushFile = useRef<HTMLInputElement | null>(null)
  const [immersive, setImmersive] = useState(false)   // iPad "pagina piena": nasconde barra + strumenti + pannello
  // Righelli + guide (linee automatiche) + griglia, come nell'impaginatore. Guide in coord DOC (px).
  const [rulersOn, setRulersOn] = useState(false)
  const [gridOn, setGridOn] = useState(false)
  const [guidesV, setGuidesV] = useState<number[]>([])
  const [guidesH, setGuidesH] = useState<number[]>([])
  const [selGuide, setSelGuide] = useState<{ axis: 'v' | 'h'; i: number } | null>(null)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const hRulerRef = useRef<HTMLCanvasElement>(null)
  const vRulerRef = useRef<HTMLCanvasElement>(null)
  const guideDrag = useRef<{ axis: 'v' | 'h'; i: number } | null>(null)
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
  useEffect(() => { void loadCustomBrushes().then(setCustomBrushes) }, [])
  async function onImportBrush(file: File) {
    try { const b = await importCustomBrush(file, brushImportTint); setCustomBrushes((cb) => [...cb.filter((x) => x.id !== b.id), b]); setTool('stamp'); setMotif('custom:' + b.id); toast.success('Pennello importato') }
    catch (e) { toast.error((e as Error).message) }
  }
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

  // ── RIGHELLI + GUIDE + GRIGLIA (stile impaginatore) ──────────────────────────
  const RUL = 18                                     // spessore righello (px schermo)
  useEffect(() => {
    const el = stageRef.current; if (!el) return
    const set = () => { const r = el.getBoundingClientRect(); setStageSize({ w: r.width, h: r.height }) }
    const ro = new ResizeObserver(set); ro.observe(el); set()
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (!rulersOn) return
    const drawRuler = (cv: HTMLCanvasElement | null, horiz: boolean) => {
      if (!cv) return
      const len = Math.max(1, horiz ? stageSize.w : stageSize.h)
      cv.width = horiz ? len : RUL; cv.height = horiz ? RUL : len
      const ctx = cv.getContext('2d'); if (!ctx) return
      ctx.fillStyle = 'rgba(24,26,31,0.92)'; ctx.fillRect(0, 0, cv.width, cv.height)
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px sans-serif'; ctx.lineWidth = 1
      let step = Math.pow(10, Math.floor(Math.log10(64 / zoom))); while (step * zoom < 46) step *= 2
      const panv = horiz ? pan.x : pan.y
      const start = Math.floor((-panv) / zoom / step) * step
      for (let d = start; d * zoom + panv < len; d += step) {
        const s = Math.round(d * zoom + panv); if (s < 0) continue
        ctx.beginPath()
        if (horiz) { ctx.moveTo(s, RUL); ctx.lineTo(s, RUL - 8); ctx.stroke(); ctx.fillText(String(Math.round(d)), s + 2, 9) }
        else { ctx.moveTo(RUL, s); ctx.lineTo(RUL - 8, s); ctx.stroke(); ctx.save(); ctx.translate(9, s + 2); ctx.rotate(-Math.PI / 2); ctx.fillText(String(Math.round(d)), 0, 0); ctx.restore() }
      }
    }
    drawRuler(hRulerRef.current, true); drawRuler(vRulerRef.current, false)
  }, [rulersOn, stageSize, pan, zoom, dims])
  const guidePosFromEvent = (e: { clientX: number; clientY: number }, axis: 'v' | 'h') => {
    const r = stageRef.current!.getBoundingClientRect()
    return axis === 'v' ? (e.clientX - r.left - pan.x) / zoom : (e.clientY - r.top - pan.y) / zoom
  }
  const rulerDown = (rulerHoriz: boolean) => (e: React.PointerEvent) => {
    const axis: 'v' | 'h' = rulerHoriz ? 'v' : 'h'         // righello orizzontale (in alto) crea guide VERTICALI
    const pos = guidePosFromEvent(e, axis)
    if (axis === 'v') { setGuidesV((g) => { guideDrag.current = { axis, i: g.length }; setSelGuide({ axis, i: g.length }); return [...g, pos] }) }
    else { setGuidesH((g) => { guideDrag.current = { axis, i: g.length }; setSelGuide({ axis, i: g.length }); return [...g, pos] }) }
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* */ }
  }
  const startGuideDrag = (e: React.PointerEvent, axis: 'v' | 'h', i: number) => {
    e.stopPropagation(); guideDrag.current = { axis, i }; setSelGuide({ axis, i })
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* */ }
  }
  const moveGuide = (e: React.PointerEvent) => {
    const d = guideDrag.current; if (!d) return
    const pos = guidePosFromEvent(e, d.axis)
    if (d.axis === 'v') setGuidesV((g) => g.map((v, i) => (i === d.i ? pos : v))); else setGuidesH((g) => g.map((v, i) => (i === d.i ? pos : v)))
  }
  const endGuide = () => { guideDrag.current = null }
  const removeGuide = (axis: 'v' | 'h', i: number) => {
    if (axis === 'v') setGuidesV((g) => g.filter((_, k) => k !== i)); else setGuidesH((g) => g.filter((_, k) => k !== i))
    setSelGuide(null)
  }
  // bersagli di aggancio per i testi (guide + bordi + centro tavola)
  const snapX = [...guidesV, 0, dims.w, dims.w / 2]
  const snapY = [...guidesH, 0, dims.h, dims.h / 2]

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
    setTexts([]); setActiveTextId(null); setGuidesV([]); setGuidesH([]); setSelGuide(null)
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
      // guida selezionata: Canc/Backspace la elimina, Esc la deseleziona
      if (selGuide && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); removeGuide(selGuide.axis, selGuide.i); return }
      if (selGuide && e.key === 'Escape') { setSelGuide(null); return }
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
      const doc = JSON.stringify({ layers: layers.map((l) => ({ ...l, data: layerCanvases.current.get(l.id)!.toDataURL('image/png') })), texts, guidesV, guidesH })
      const id = await save.mutateAsync({ id: docId, title: title || 'Senza titolo', width: dims.w, height: dims.h, doc, thumbnail: thumbOf(), entry_id: assignEntry })
      setDocId(id); toast.success(assignEntry ? 'Progetto salvato e condiviso nell’evento' : 'Progetto salvato')
    } catch (e) { toast.error((e as Error).message) } finally { setSaving(false) }
  }
  async function openDesign(id: string) {
    try {
      const d = await fetchDesign(id); if (!d || !d.doc) { toast.error('Progetto non leggibile'); return }
      const parsed = JSON.parse(d.doc) as { layers: Array<LayerMeta & { data: string }>; texts?: TextObj[]; guidesV?: number[]; guidesH?: number[] }
      layerCanvases.current.clear()
      for (const l of parsed.layers) { const c = newCanvas(d.width, d.height); const img = await loadImage(l.data); c.getContext('2d')!.drawImage(img, 0, 0); layerCanvases.current.set(l.id, c) }
      history.current = []; redo.current = []
      setTexts(parsed.texts ?? []); setActiveTextId(null); setGuidesV(parsed.guidesV ?? []); setGuidesH(parsed.guidesH ?? []); setSelGuide(null)
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
          <Button size="sm" variant={rulersOn ? 'default' : 'outline'} onClick={() => setRulersOn((v) => !v)} title="Righelli + guide (trascina dal righello; Canc per eliminare la guida)"><Ruler size={14} /></Button>
          <Button size="sm" variant={gridOn ? 'default' : 'outline'} onClick={() => setGridOn((v) => !v)} title="Griglia"><Grid3x3 size={14} /></Button>
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
          {/* GRIGLIA (non stampata) */}
          {gridOn && <div className="absolute inset-0 pointer-events-none z-[5]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.14) 1px, transparent 1px)', backgroundSize: `${50 * zoom}px ${50 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }} />}
          {/* TESTO: box editabili sovrapposti (spostabili/allargabili/ri-modificabili/eliminabili col tool Testo) */}
          {texts.map((t) => (
            <TextBox key={t.id} t={t} zoom={zoom} pan={pan} editable={tool === 'text'} active={tool === 'text' && activeTextId === t.id} snapX={snapX} snapY={snapY}
              onSelect={() => { setActiveTextId(t.id); setFont(t.font); setFontSize(t.size); setColor(t.color) }} onChange={(patch) => patchText(t.id, patch)} onDelete={() => removeText(t.id)}
              onCommitEmpty={() => { if (!t.text.trim()) removeText(t.id) }} />
          ))}
          {/* GUIDE trascinabili (linee automatiche) */}
          {guidesV.map((gx, i) => { const x = pan.x + gx * zoom; const on = selGuide?.axis === 'v' && selGuide.i === i; return (
            <div key={'gv' + i} onPointerDown={(e) => startGuideDrag(e, 'v', i)} onPointerMove={moveGuide} onPointerUp={endGuide} onDoubleClick={() => removeGuide('v', i)} title="Trascina · doppio clic per eliminare"
              className="absolute top-0 bottom-0 z-20 cursor-ew-resize touch-none" style={{ left: x - 4, width: 9 }}>
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2" style={{ width: on ? 2 : 1, background: on ? '#22d3ee' : 'rgba(34,211,238,0.8)' }} />
            </div>) })}
          {guidesH.map((gy, i) => { const y = pan.y + gy * zoom; const on = selGuide?.axis === 'h' && selGuide.i === i; return (
            <div key={'gh' + i} onPointerDown={(e) => startGuideDrag(e, 'h', i)} onPointerMove={moveGuide} onPointerUp={endGuide} onDoubleClick={() => removeGuide('h', i)} title="Trascina · doppio clic per eliminare"
              className="absolute left-0 right-0 z-20 cursor-ns-resize touch-none" style={{ top: y - 4, height: 9 }}>
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ height: on ? 2 : 1, background: on ? '#22d3ee' : 'rgba(34,211,238,0.8)' }} />
            </div>) })}
          {/* RIGHELLI (trascina dal righello per creare una guida) */}
          {rulersOn && <>
            <canvas ref={hRulerRef} onPointerDown={rulerDown(true)} onPointerMove={moveGuide} onPointerUp={endGuide} className="absolute top-0 left-0 z-30 touch-none cursor-ns-resize" style={{ height: RUL }} />
            <canvas ref={vRulerRef} onPointerDown={rulerDown(false)} onPointerMove={moveGuide} onPointerUp={endGuide} className="absolute top-0 left-0 z-30 touch-none cursor-ew-resize" style={{ width: RUL }} />
            <div className="absolute top-0 left-0 z-30" style={{ width: RUL, height: RUL, background: 'rgb(24,26,31)' }} />
          </>}
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
                  <div className="mt-2 pt-2 border-t border-[rgb(var(--border))]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Pennelli importati</span>
                      <label className="text-[9px] text-[rgb(var(--fg-muted))] inline-flex items-center gap-1"><input type="checkbox" checked={brushImportTint} onChange={(e) => setBrushImportTint(e.target.checked)} /> tinta col colore</label>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {customBrushes.map((b) => (
                        <div key={b.id} className="relative group">
                          <button onClick={() => setMotif('custom:' + b.id)} title={b.name}
                            className={`w-full aspect-square grid place-items-center rounded-md border overflow-hidden ${motif === 'custom:' + b.id ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
                            <CustomBrushIcon id={b.id} />
                          </button>
                          <button onClick={() => { void deleteCustomBrush(b.id); setCustomBrushes((cb) => cb.filter((x) => x.id !== b.id)) }} title="Elimina" className="absolute -top-1 -right-1 h-4 w-4 grid place-items-center rounded-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] text-[rgb(var(--rose-500))] opacity-0 group-hover:opacity-100"><X size={9} /></button>
                        </div>
                      ))}
                      <button onClick={() => refBrushFile.current?.click()} title="Importa pennello (immagine PNG con trasparenza)" className="aspect-square grid place-items-center rounded-md border border-dashed border-[rgb(var(--border))] text-[rgb(var(--fg-subtle))] hover:border-[rgb(var(--gold-400))]"><Upload size={14} /></button>
                    </div>
                    <input ref={refBrushFile} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void onImportBrush(f) }} />
                    <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">Carica una <strong>punta</strong> (PNG con trasparenza): diventa un pennello texturizzato. La punta si timbra fitta lungo il tratto.</p>
                  </div>
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

