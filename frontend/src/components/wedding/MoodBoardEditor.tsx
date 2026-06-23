// Editor libero della moodboard: una tela con immagini, testi, forme, icone e
// ghirigori. Si parte da uno stile automatico e poi ci si mette mano (trascina,
// ridimensiona, ruota). Persistenza condivisa su mood_boards (coppia + organizzatore + admin).
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Heart, Star, Leaf, Flower2, Sparkles, Sun, Moon, Music, Camera, Gem, Wine,
  Cake, Bird, Cloud, MapPin, Crown, Type, Image as ImageIcon, Shapes, Smile,
  Trash2, Copy, ArrowUp, ArrowDown, Plus, Wand2, X, Loader2, Save, RotateCw, Link2, Download, FileDown, Scissors, Undo2, Redo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  emptyBoard, addImage, addText, addShape, addIcon, moveEl, resizeEl, snapMove, snapAngle,
  updateEl, removeEl, bringFront, sendBack, duplicateEl, FLOURISHES, SHAPES, MOOD_PALETTE,
  MOOD_FONTS, PRESETS, LAYOUT_STYLES, GRADIENTS, emptyDoc, toDoc, type MoodBoard, type MoodDoc, type MoodEl, type Corner,
} from '@/lib/moodBoard'

// generatori di path per le forme "complesse"
function burstPath(points = 18, ro = 49, ri = 33, cx = 50, cy = 50): string {
  let d = ''
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? ro : ri
    const a = (Math.PI * i) / points - Math.PI / 2
    d += (i === 0 ? 'M' : 'L') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1) + ' '
  }
  return d + 'Z'
}
function scallopPath(bumps = 14, r = 44, br = 7, cx = 50, cy = 50): string {
  let d = ''
  for (let i = 0; i <= bumps; i++) {
    const a = (2 * Math.PI * i) / bumps - Math.PI / 2
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
    d += i === 0 ? `M${x.toFixed(1)} ${y.toFixed(1)} ` : `A ${br} ${br} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} `
  }
  return d + 'Z'
}
const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(new Error('read')); r.readAsDataURL(b) })

const ICONS: Record<string, any> = { Heart, Star, Leaf, Flower2, Sparkles, Sun, Moon, Music, Camera, Gem, Wine, Cake, Bird, Cloud, MapPin, Crown }
const ICON_NAMES = Object.keys(ICONS)

// Render di una forma/ghirigoro su un box w×h.
function ShapeView({ name, fill }: { name: string; fill: string }) {
  const fl = FLOURISHES.find((f) => f.name === name)
  if (fl) return <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="xMidYMid meet"><path d={fl.path} fill="none" stroke={fill} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></svg>
  if (name === 'circle') return <svg viewBox="0 0 100 100" className="w-full h-full"><circle cx="50" cy="50" r="48" fill={fill} /></svg>
  if (name === 'rounded') return <div className="w-full h-full rounded-2xl" style={{ background: fill }} />
  if (name === 'line') return <div className="w-full h-full" style={{ background: fill }} />
  if (name === 'heart') return <svg viewBox="0 0 100 100" className="w-full h-full"><path d="M50 86 C 10 56, 16 20, 50 36 C 84 20, 90 56, 50 86 Z" fill={fill} /></svg>
  if (name === 'arch') return <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none"><path d="M5 100 L5 45 C5 15 30 2 50 2 C70 2 95 15 95 45 L95 100 Z" fill={fill} /></svg>
  if (name === 'oval') return <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none"><ellipse cx="50" cy="50" rx="48" ry="34" fill={fill} /></svg>
  if (name === 'triangle') return <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none"><path d="M50 4 L96 96 L4 96 Z" fill={fill} /></svg>
  if (name === 'diamond') return <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none"><path d="M50 3 L97 50 L50 97 L3 50 Z" fill={fill} /></svg>
  if (name === 'starburst') return <svg viewBox="0 0 100 100" className="w-full h-full"><path d={burstPath()} fill={fill} /></svg>
  if (name === 'badge') return <svg viewBox="0 0 100 100" className="w-full h-full"><path d={scallopPath()} fill={fill} /></svg>
  if (name === 'banner') return <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none"><path d="M14 26 L86 26 L98 50 L86 74 L14 74 L2 50 Z" fill={fill} /></svg>
  if (name === 'frame') return <div className="w-full h-full" style={{ border: `2px solid ${fill}`, boxShadow: `inset 0 0 0 5px transparent, inset 0 0 0 6px ${fill}` }} />
  if (name === 'blob') return <svg viewBox="0 0 100 100" className="w-full h-full"><path d="M54 8 C 76 6 96 24 92 46 C 88 68 78 92 54 94 C 30 96 8 80 8 56 C 8 32 32 10 54 8 Z" fill={fill} /></svg>
  return <div className="w-full h-full rounded" style={{ background: fill }} /> // rect
}

function ElView({ el }: { el: MoodEl }) {
  if (el.kind === 'image') {
    const r = el.radius ? `${el.radius * 100}%` : undefined
    // scontornata: niente placeholder dietro (trasparente) e "contain" per vedere tutto il soggetto
    const img = el.cut
      ? <div className="w-full h-full bg-center bg-no-repeat" style={{ backgroundImage: el.src ? `url(${el.src})` : undefined, backgroundSize: 'contain', borderRadius: r }} />
      : <div className="w-full h-full bg-center bg-cover bg-[rgb(var(--bg-sunken))]" style={{ backgroundImage: el.src ? `url(${el.src})` : undefined, borderRadius: r }} />
    if (el.frame === 'polaroid') return <div className="w-full h-full bg-white shadow-md rounded-[2px] p-[7%] pb-[16%]">{img}</div>
    return img
  }
  if (el.kind === 'text') return (
    <div className="w-full h-full flex items-center px-1 overflow-hidden [container-type:size]" style={{ justifyContent: el.align === 'left' ? 'flex-start' : el.align === 'right' ? 'flex-end' : 'center' }}>
      <span style={{ color: el.color, fontFamily: el.font, fontWeight: el.weight ?? 600, fontStyle: el.italic ? 'italic' : undefined, textAlign: el.align, fontSize: '70cqh', lineHeight: 1.05, width: '100%', whiteSpace: 'nowrap' }}>{el.text || 'Testo'}</span>
    </div>
  )
  if (el.kind === 'icon') { const I = ICONS[el.name ?? 'Heart'] ?? Heart; return <I className="w-full h-full" style={{ color: el.fill }} strokeWidth={1.6} /> }
  return <ShapeView name={el.name ?? 'rect'} fill={el.fill ?? '#ccc'} />
}

export function MoodBoardEditor({ entryId, pins, readOnly, title, dateText, location, brandName, brandEmail }: {
  entryId: string; pins: string[]; readOnly?: boolean
  title?: string | null; dateText?: string | null; location?: string | null; brandName?: string | null; brandEmail?: string | null
}) {
  const [doc, setDoc] = useState<MoodDoc>(emptyDoc())
  const [cur, setCur] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [open, setOpen] = useState(false)         // editor a tutta larghezza
  const [tab, setTab] = useState<'preset' | 'img' | 'text' | 'shape' | 'icon'>('preset')
  const [imgUrl, setImgUrl] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const loadedRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const drag = useRef<{ kind: 'move' | 'resize' | 'rotate'; id: string; corner?: Corner; sx: number; sy: number; el: MoodEl } | null>(null)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })

  // cronologia Annulla/Ripeti (Cmd+Z) — tutto su refs così niente staleness nei listener
  const docRef = useRef(doc); docRef.current = doc
  const undoStack = useRef<MoodDoc[]>([])
  const redoStack = useRef<MoodDoc[]>([])
  const dragging = useRef(false)
  const pendingSnap = useRef<MoodDoc | null>(null)
  function pushHist() { undoStack.current.push(docRef.current); if (undoStack.current.length > 80) undoStack.current.shift(); redoStack.current = [] }
  function undo() { if (!undoStack.current.length) return; redoStack.current.push(docRef.current); setDoc(undoStack.current.pop()!); setSel(null) }
  function redo() { if (!redoStack.current.length) return; undoStack.current.push(docRef.current); setDoc(redoStack.current.pop()!); setSel(null) }

  const curIdx = Math.min(cur, doc.pages.length - 1)
  const board = doc.pages[curIdx] ?? emptyBoard()
  // ogni modifica discreta passa di qui e registra la cronologia; durante un drag no
  // (lo snapshot pre-drag è preso in down() e confermato in up()).
  function setBoard(u: MoodBoard | ((b: MoodBoard) => MoodBoard)) {
    if (!dragging.current) pushHist()
    setDoc((d) => { const pages = d.pages.slice(); const i = Math.min(curIdx, pages.length - 1); const prev = pages[i] ?? emptyBoard(); pages[i] = typeof u === 'function' ? (u as (b: MoodBoard) => MoodBoard)(prev) : u; return { ...d, pages } })
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase.from as any)('mood_boards').select('data').eq('entry_id', entryId).maybeSingle()
    setDoc(toDoc((data as { data?: unknown } | null)?.data))
    setCur(0); undoStack.current = []; redoStack.current = []
    setLoading(false); loadedRef.current = true
  }, [entryId])
  useEffect(() => { void load() }, [load])

  const persist = useCallback(async (d: MoodDoc, silent = true) => {
    setSaving(true)
    const { error } = await (supabase.from as any)('mood_boards').upsert({ entry_id: entryId, data: d }, { onConflict: 'entry_id' })
    setSaving(false)
    if (error && !silent) toast.error('Salvataggio non riuscito: ' + error.message)
    else if (!silent) toast.success('Moodboard salvato')
  }, [entryId])

  // autosave debounce
  useEffect(() => {
    if (!loadedRef.current || readOnly) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => { void persist(doc) }, 1200)
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current) }
  }, [doc, persist, readOnly])

  // tastiera: Cmd/Ctrl+Z annulla, +Shift redo (o Ctrl+Y). Non nei campi di testo.
  useEffect(() => {
    if (readOnly) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if (k === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly])

  // pagine
  function goPage(i: number) { setSel(null); setCur(i) }
  function addPage() { pushHist(); setDoc((d) => ({ ...d, pages: [...d.pages, emptyBoard()] })); setSel(null); setCur(doc.pages.length) }
  function dupPage() { pushHist(); setDoc((d) => { const pages = d.pages.slice(); const clone = JSON.parse(JSON.stringify(pages[curIdx] ?? emptyBoard())) as MoodBoard; pages.splice(curIdx + 1, 0, clone); return { ...d, pages } }); setSel(null); setCur(curIdx + 1) }
  function delPage() { if (doc.pages.length <= 1) return; pushHist(); setDoc((d) => ({ ...d, pages: d.pages.filter((_, i) => i !== curIdx) })); setSel(null); setCur(Math.max(0, curIdx - 1)) }

  const els = [...board.els].sort((a, b) => a.z - b.z)
  const selEl = board.els.find((e) => e.id === sel) ?? null
  function setEls(fn: (els: MoodEl[]) => MoodEl[]) { setBoard((b) => ({ ...b, els: fn(b.els) })) }

  function frac(e: React.PointerEvent) { const r = boxRef.current!.getBoundingClientRect(); return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) } }
  function down(e: React.PointerEvent, kind: 'move' | 'resize' | 'rotate', el: MoodEl, corner?: Corner) {
    if (readOnly) return
    e.stopPropagation(); setSel(el.id); const f = frac(e); drag.current = { kind, id: el.id, corner, sx: f.x, sy: f.y, el }
    dragging.current = true; pendingSnap.current = docRef.current // snapshot pre-drag per l'undo
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    const d = drag.current; if (!d) return; const f = frac(e)
    if (d.kind === 'move') {
      const moved = moveEl(d.el, d.el.x + (f.x - d.sx), d.el.y + (f.y - d.sy))
      const s = snapMove(moved, board.els.filter((x) => x.id !== d.id))
      setEls((arr) => updateEl(arr, d.id, { x: s.x, y: s.y })); setGuides({ v: s.vGuides, h: s.hGuides })
    } else if (d.kind === 'resize' && d.corner) { const r = resizeEl(d.el, d.corner, f.x, f.y); setEls((arr) => updateEl(arr, d.id, { x: r.x, y: r.y, w: r.w, h: r.h })) }
    else if (d.kind === 'rotate') { const cx = d.el.x + d.el.w / 2, cy = d.el.y + d.el.h / 2; const deg = (Math.atan2(f.y - cy, f.x - cx) * 180) / Math.PI + 90; setEls((arr) => updateEl(arr, d.id, { rot: snapAngle(deg) })) }
  }
  function up() {
    drag.current = null; setGuides({ v: [], h: [] })
    if (dragging.current) {
      if (pendingSnap.current && pendingSnap.current !== docRef.current) { undoStack.current.push(pendingSnap.current); if (undoStack.current.length > 80) undoStack.current.shift(); redoStack.current = [] }
      pendingSnap.current = null; dragging.current = false
    }
  }

  function applyPreset(i: number) { setBoard(PRESETS[i]!.build(pins.length ? pins : ['', '', ''])); setSel(null); setTab('img') }
  // stili d'impaginazione dinamici: dispongono TUTTE le foto del mood (ritagli/polaroid/moda)
  function applyStyle(key: string) {
    const st = LAYOUT_STYLES.find((s) => s.key === key); if (!st) return
    const imgs = pins.filter(Boolean)
    if (imgs.length === 0) { toast.error('Aggiungi prima qualche foto'); return }
    setBoard(st.build(imgs)); setSel(null)
  }
  async function exportPng() {
    if (!boxRef.current || board.els.length === 0) { toast.error('Aggiungi qualcosa prima'); return }
    setExporting(true)
    try {
      const html2canvas = (await import('html2canvas-pro')).default
      const canvas = await html2canvas(boxRef.current, { useCORS: true, backgroundColor: board.bg, scale: 2 })
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'moodboard.png'; a.click()
      toast.success('Moodboard scaricato')
    } catch { toast.error('Export non riuscito (alcune immagini bloccano il salvataggio: CORS).') }
    finally { setExporting(false) }
  }
  // PDF editoriale dalle foto del board (in ordine di lettura alto→basso, sinistra→destra)
  async function exportPdf() {
    const imgs = doc.pages.flatMap((p) => [...p.els].filter((e) => e.kind === 'image' && e.src).sort((a, b) => (a.y - b.y) || (a.x - b.x))).map((e) => ({ url: e.src as string }))
    if (!imgs.length) { toast.error('Aggiungi qualche foto'); return }
    setExporting(true)
    try {
      const { buildMoodboardPdf } = await import('@/lib/moodboardPdf')
      await buildMoodboardPdf({ images: imgs, coupleNames: title ?? null, dateText: dateText ?? null, location: location ?? null, brandName: brandName ?? null, brandEmail: brandEmail ?? null, palette: [] })
      toast.success('PDF editoriale pronto')
    } catch (e) { toast.error('PDF non riuscito: ' + ((e as Error).message || 'errore')) }
    finally { setExporting(false) }
  }
  // scontorno magico: rimuove lo sfondo dell'immagine selezionata (in-browser) e
  // sostituisce la sorgente con il PNG trasparente (data URL → resta nel board).
  async function cutout() {
    if (!selEl || selEl.kind !== 'image' || !selEl.src) return
    setProcessing(true)
    try {
      const { removeBackground } = await import('@imgly/background-removal')
      const blob = await removeBackground(selEl.src)
      patchSel({ src: await blobToDataUrl(blob), cut: true, frame: undefined })
      toast.success('Sfondo rimosso')
    } catch { toast.error('Scontorno non riuscito: immagine non accessibile (CORS) o troppo grande.') }
    finally { setProcessing(false) }
  }
  function patchSel(p: Partial<MoodEl>) { if (sel) setEls((arr) => updateEl(arr, sel, p)) }

  if (loading) return <div className="rounded-2xl border border-[rgb(var(--border))] p-8 flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  return (
    <div className="rounded-2xl border border-[rgb(var(--border))] overflow-hidden bg-[rgb(var(--bg))]">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[rgb(var(--border))]">
        <div>
          <p className="font-medium flex items-center gap-2"><Wand2 size={16} className="text-[rgb(var(--gold-600))]" /> Il vostro moodboard</p>
          <p className="text-xs text-[rgb(var(--fg-muted))]">Scegli uno stile (ritagli, polaroid, moda, tableau): si impagina da solo e poi ci metti mano.</p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[11px] text-[rgb(var(--fg-muted))] flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> salvo…</span>}
          {board.els.length > 0 && <Button size="sm" variant="outline" onClick={() => void exportPdf()} disabled={exporting}><FileDown size={14} /> PDF</Button>}
          {board.els.length > 0 && <Button size="sm" variant="outline" onClick={() => void exportPng()} disabled={exporting}><Download size={14} /> PNG</Button>}
          {!readOnly && <Button size="sm" variant="outline" onClick={() => void persist(doc, false)}><Save size={14} /> Salva</Button>}
          <Button size="sm" variant={open ? 'gold' : 'outline'} onClick={() => setOpen((v) => !v)}>{open ? 'Chiudi' : 'Apri e modifica'}</Button>
        </div>
      </div>

      {/* anteprima cliccabile da chiuso: clicchi sul moodboard e si apre l'editor (tipo Canva) */}
      {!open && els.length > 0 && (
        <button onClick={() => setOpen(true)} className="group block w-full p-4 bg-[rgb(var(--bg-sunken))]">
          <div className="relative mx-auto w-full max-w-[420px] shadow-[var(--shadow-lift)]" style={{ aspectRatio: '4 / 5', background: board.bg }}>
            {els.map((el) => (
              <div key={el.id} className="absolute" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, zIndex: el.z, opacity: el.opacity ?? 1, filter: el.blur ? `blur(${el.blur}px)` : undefined }}>
                <ElView el={el} />
              </div>
            ))}
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/15 transition">
              <span className="opacity-0 group-hover:opacity-100 transition inline-flex items-center gap-1 rounded-full bg-white/90 text-[rgb(var(--fg))] text-xs font-medium px-3 py-1.5"><Wand2 size={13} /> Apri e modifica a mano</span>
            </div>
          </div>
        </button>
      )}

      {open && (
        <>
        {/* barra pagine + annulla/ripeti */}
        <div className="flex items-center gap-1.5 px-4 pt-3 flex-wrap border-b border-[rgb(var(--border))] pb-3">
          {doc.pages.map((_, i) => (
            <button key={i} onClick={() => goPage(i)} title={`Pagina ${i + 1}`}
              className={`h-7 min-w-[28px] px-2 rounded-md text-xs font-medium ${i === curIdx ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>{i + 1}</button>
          ))}
          {!readOnly && <button onClick={addPage} title="Aggiungi pagina" className="h-7 px-2 rounded-md border border-dashed border-[rgb(var(--border))] text-xs inline-flex items-center gap-1 hover:bg-[rgb(var(--bg-sunken))]"><Plus size={12} /> Pagina</button>}
          {!readOnly && <span className="mx-0.5 h-4 w-px bg-[rgb(var(--border))]" />}
          {!readOnly && <button onClick={dupPage} title="Duplica pagina" className="h-7 w-7 rounded-md border border-[rgb(var(--border))] inline-flex items-center justify-center hover:bg-[rgb(var(--bg-sunken))]"><Copy size={12} /></button>}
          {!readOnly && doc.pages.length > 1 && <button onClick={delPage} title="Elimina pagina" className="h-7 w-7 rounded-md border border-[rgb(var(--border))] text-rose-500 inline-flex items-center justify-center hover:bg-[rgb(var(--bg-sunken))]"><Trash2 size={12} /></button>}
          {!readOnly && <span className="mx-0.5 h-4 w-px bg-[rgb(var(--border))]" />}
          {!readOnly && <button onClick={undo} title="Annulla (Cmd+Z)" className="h-7 w-7 rounded-md border border-[rgb(var(--border))] inline-flex items-center justify-center hover:bg-[rgb(var(--bg-sunken))]"><Undo2 size={13} /></button>}
          {!readOnly && <button onClick={redo} title="Ripeti (Cmd+Shift+Z)" className="h-7 w-7 rounded-md border border-[rgb(var(--border))] inline-flex items-center justify-center hover:bg-[rgb(var(--bg-sunken))]"><Redo2 size={13} /></button>}
          <span className="ml-auto text-[11px] text-[rgb(var(--fg-subtle))]">Pagina {curIdx + 1} di {doc.pages.length}</span>
        </div>
        <div className="lg:flex">
          {/* strumenti */}
          {!readOnly && (
            <div className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-[rgb(var(--border))] p-3 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {([['preset', 'Stili', Wand2], ['img', 'Foto', ImageIcon], ['text', 'Testo', Type], ['shape', 'Forme', Shapes], ['icon', 'Icone', Smile]] as const).map(([k, l, I]) => (
                  <button key={k} onClick={() => setTab(k)} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${tab === k ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg))]' : 'border border-[rgb(var(--border))]'}`}><I size={12} /> {l}</button>
                ))}
              </div>

              {tab === 'preset' && (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Stili d'impaginazione — dispongono tutte le foto</p>
                    <div className="grid grid-cols-2 gap-2">{LAYOUT_STYLES.map((s) => <button key={s.key} onClick={() => applyStyle(s.key)} className="rounded-lg border border-[rgb(var(--border))] p-2 text-[11px] hover:bg-[rgb(var(--bg-sunken))] hover:border-[rgb(var(--gold-500))]">{s.label}</button>)}</div>
                  </div>
                  <div>
                    <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Temi pronti</p>
                    <div className="grid grid-cols-3 gap-2">{PRESETS.map((p, i) => <button key={p.label} onClick={() => applyPreset(i)} className="rounded-lg border border-[rgb(var(--border))] p-2 text-[11px] hover:bg-[rgb(var(--bg-sunken))]">{p.label}</button>)}</div>
                  </div>
                </div>
              )}

              {tab === 'img' && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    <input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="Incolla URL immagine" className="flex-1 text-xs rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5" />
                    <Button size="sm" variant="outline" onClick={() => { if (/^https?:\/\//i.test(imgUrl)) { setBoard((b) => addImage(b, imgUrl.trim())); setImgUrl('') } else toast.error('URL non valido') }}><Link2 size={13} /></Button>
                  </div>
                  {pins.length > 0 && <div className="grid grid-cols-3 gap-1.5">{pins.map((u, i) => <button key={i} onClick={() => setBoard((b) => addImage(b, u))} className="aspect-square rounded-md overflow-hidden border border-[rgb(var(--border))]"><img src={u} alt="" className="w-full h-full object-cover" /></button>)}</div>}
                  {pins.length === 0 && <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Aggiungi ispirazioni dalla sezione qui sotto o incolla un URL.</p>}
                </div>
              )}

              {tab === 'text' && (
                <div className="space-y-2">
                  <Button size="sm" variant="gold" className="w-full" onClick={() => setBoard((b) => addText(b))}><Plus size={13} /> Aggiungi scritta</Button>
                  <div className="grid grid-cols-2 gap-1">{MOOD_FONTS.map((f) => <button key={f.label} onClick={() => setBoard((b) => addText({ ...b }, 'Il vostro mood'))} style={{ fontFamily: f.css }} className="rounded-lg border border-[rgb(var(--border))] py-1.5 text-xs">{f.label}</button>)}</div>
                </div>
              )}

              {tab === 'shape' && (
                <div className="space-y-2">
                  <p className="text-[11px] text-[rgb(var(--fg-muted))]">Forme</p>
                  <div className="grid grid-cols-3 gap-1.5">{SHAPES.map((s) => <button key={s} onClick={() => setBoard((b) => addShape(b, s))} className="aspect-square rounded-lg border border-[rgb(var(--border))] p-2 hover:bg-[rgb(var(--bg-sunken))]"><ShapeView name={s} fill="#b8923f" /></button>)}</div>
                  <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-1">Ghirigori</p>
                  <div className="grid grid-cols-4 gap-1.5">{FLOURISHES.map((f) => <button key={f.name} title={f.name} onClick={() => setBoard((b) => addShape(b, f.name, '#b8923f'))} className="aspect-square rounded-lg border border-[rgb(var(--border))] p-1 hover:bg-[rgb(var(--bg-sunken))]"><ShapeView name={f.name} fill="#b8923f" /></button>)}</div>
                </div>
              )}

              {tab === 'icon' && <div className="grid grid-cols-5 gap-1.5">{ICON_NAMES.map((n) => { const I = ICONS[n]; return <button key={n} title={n} onClick={() => setBoard((b) => addIcon(b, n))} className="aspect-square rounded-lg border border-[rgb(var(--border))] flex items-center justify-center hover:bg-[rgb(var(--bg-sunken))]"><I size={18} className="text-[rgb(var(--gold-600))]" /></button> })}</div>}

              <div className="border-t border-[rgb(var(--border))] pt-2">
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Sfondo</p>
                <div className="flex flex-wrap gap-1">{MOOD_PALETTE.map((c) => <button key={c} onClick={() => setBoard((b) => ({ ...b, bg: c }))} className={`h-5 w-5 rounded-full border ${board.bg === c ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`} style={{ background: c }} />)}</div>
                <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-2 mb-1">Sfumature</p>
                <div className="flex flex-wrap gap-1">{GRADIENTS.map((g) => <button key={g.label} title={g.label} onClick={() => setBoard((b) => ({ ...b, bg: g.css }))} className={`h-6 w-9 rounded border ${board.bg === g.css ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`} style={{ background: g.css }} />)}</div>
              </div>
            </div>
          )}

          {/* tela */}
          <div className="flex-1 min-w-0 p-4 flex items-start justify-center bg-[rgb(var(--bg-sunken))]">
            <div ref={boxRef} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onClick={(e) => { if (e.target === e.currentTarget) setSel(null) }}
              className="relative shadow-[var(--shadow-lift)] w-full max-w-[520px]" style={{ aspectRatio: '4 / 5', background: board.bg }}>
              {els.map((el) => {
                const isSel = sel === el.id
                return (
                  <div key={el.id} className="absolute" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, zIndex: el.z }}>
                    <div onPointerDown={(e) => down(e, 'move', el)} style={{ opacity: el.opacity ?? 1, filter: el.blur ? `blur(${el.blur}px)` : undefined }} className={`w-full h-full ${readOnly ? '' : 'cursor-move'} ${isSel ? 'outline outline-2 outline-[rgb(var(--gold-500))]' : ''}`}><ElView el={el} /></div>
                    {isSel && !readOnly && (
                      <>
                        {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => <div key={c} onPointerDown={(e) => down(e, 'resize', el, c)} className="absolute h-3 w-3 bg-white border border-[rgb(var(--gold-500))] rounded-sm" style={{ left: c.includes('w') ? -6 : undefined, right: c.includes('e') ? -6 : undefined, top: c.includes('n') ? -6 : undefined, bottom: c.includes('s') ? -6 : undefined, cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />)}
                        <div onPointerDown={(e) => down(e, 'rotate', el)} className="absolute left-1/2 -top-6 -translate-x-1/2 h-4 w-4 bg-white border border-[rgb(var(--gold-500))] rounded-full flex items-center justify-center cursor-grab"><RotateCw size={9} /></div>
                      </>
                    )}
                  </div>
                )
              })}
              {guides.v.map((g, i) => <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none" style={{ left: `${g * 100}%` }} />)}
              {guides.h.map((g, i) => <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-rose-500 pointer-events-none" style={{ top: `${g * 100}%` }} />)}
              {els.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-[rgb(var(--fg-subtle))] px-6 text-center">Parti da uno <strong className="mx-1">stile</strong> o aggiungi foto, scritte e decori.</div>}
              {processing && <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.3)' }}><span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow"><Loader2 size={14} className="animate-spin" /> Rimuovo lo sfondo…</span></div>}
            </div>
          </div>

          {/* pannello elemento selezionato */}
          {selEl && !readOnly && (
            <div className="lg:w-56 shrink-0 border-t lg:border-t-0 lg:border-l border-[rgb(var(--border))] p-3 space-y-3 text-sm">
              <div className="flex items-center justify-between"><p className="font-medium capitalize">{selEl.kind === 'image' ? 'Foto' : selEl.kind === 'text' ? 'Scritta' : selEl.kind === 'icon' ? 'Icona' : 'Forma'}</p><button onClick={() => setSel(null)}><X size={15} /></button></div>
              {selEl.kind === 'text' && (
                <>
                  <textarea value={selEl.text ?? ''} onChange={(e) => patchSel({ text: e.target.value })} rows={2} className="w-full text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5" />
                  <div className="grid grid-cols-2 gap-1">{MOOD_FONTS.map((f) => <button key={f.label} onClick={() => patchSel({ font: f.css })} style={{ fontFamily: f.css }} className={`rounded-lg border py-1 text-xs ${selEl.font === f.css ? 'border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`}>{f.label}</button>)}</div>
                  <div className="flex gap-1">{(['left', 'center', 'right'] as const).map((a) => <button key={a} onClick={() => patchSel({ align: a })} className={`flex-1 rounded border py-1 text-xs ${selEl.align === a ? 'border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`}>{a === 'left' ? '⬅' : a === 'center' ? '⬌' : '➡'}</button>)}</div>
                </>
              )}
              {(selEl.kind === 'text' || selEl.kind === 'shape' || selEl.kind === 'icon') && (
                <div>
                  <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1">Colore</p>
                  <div className="flex flex-wrap gap-1">{MOOD_PALETTE.map((c) => <button key={c} onClick={() => patchSel(selEl.kind === 'text' ? { color: c } : { fill: c })} className="h-5 w-5 rounded-full border border-[rgb(var(--border))]" style={{ background: c }} />)}</div>
                </div>
              )}
              {selEl.kind === 'image' && (
                <div className="space-y-2 border-t border-[rgb(var(--border))] pt-2">
                  <Button size="sm" variant="gold" className="w-full" disabled={processing} onClick={() => void cutout()}>
                    {processing ? <Loader2 size={13} className="animate-spin" /> : <Scissors size={13} />} {processing ? 'Scontorno…' : 'Togli sfondo'}
                  </Button>
                  <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Angoli (anche cerchio)
                    <input type="range" min={0} max={0.5} step={0.02} value={selEl.radius ?? 0} onChange={(e) => patchSel({ radius: parseFloat(e.target.value) })} className="w-full accent-[rgb(var(--gold-600))]" />
                  </label>
                </div>
              )}
              <div className="space-y-1.5 border-t border-[rgb(var(--border))] pt-2">
                <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Sfocatura
                  <input type="range" min={0} max={12} step={0.5} value={selEl.blur ?? 0} onChange={(e) => patchSel({ blur: parseFloat(e.target.value) })} className="w-full accent-[rgb(var(--gold-600))]" />
                </label>
                <label className="block text-[11px] text-[rgb(var(--fg-muted))]">Opacità
                  <input type="range" min={0.1} max={1} step={0.05} value={selEl.opacity ?? 1} onChange={(e) => patchSel({ opacity: parseFloat(e.target.value) })} className="w-full accent-[rgb(var(--gold-600))]" />
                </label>
              </div>
              <div className="flex flex-wrap gap-1 border-t border-[rgb(var(--border))] pt-2">
                <Button size="sm" variant="outline" onClick={() => setEls((arr) => bringFront(arr, selEl.id))}><ArrowUp size={13} /> Su</Button>
                <Button size="sm" variant="outline" onClick={() => setEls((arr) => sendBack(arr, selEl.id))}><ArrowDown size={13} /> Giù</Button>
                <Button size="sm" variant="outline" onClick={() => { const r = duplicateEl(board.els, selEl.id); setBoard((b) => ({ ...b, els: r.els })); setSel(r.newId) }}><Copy size={13} /></Button>
                <Button size="sm" variant="outline" className="text-rose-500" onClick={() => { setEls((arr) => removeEl(arr, selEl.id)); setSel(null) }}><Trash2 size={13} /></Button>
              </div>
            </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}
