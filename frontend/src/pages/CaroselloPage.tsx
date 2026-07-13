import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Loader2, Download, Plus, Minus, Trash2, Copy, ArrowUpToLine,
  ZoomIn, ZoomOut, ImagePlus, Sparkles, X, Check,
  Type, AlignLeft, AlignCenter, AlignRight, Bold, Italic, Upload, FolderUp, Undo2, Redo2, ArrowLeftRight,
  ChevronDown, LayoutGrid, Newspaper, Palette, Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { coverImgStyle, DEFAULT_CELL } from '@/lib/albumGeometry'
import { type FreeEl, type Corner } from '@/lib/albumFree'
import type { AlbumPage } from '@/lib/albumEngine'
import { CAROUSEL_FORMATS, getCarouselFormat, DEFAULT_CAROUSEL_FORMAT, CAROUSEL_MODELS, getModel, CAROUSEL_FONTS, getFontFamily, TEXT_PRESETS, newText, CAROUSEL_PRESETS, getPreset, type TextEl } from '@/lib/caroselloModels'
import { exportCaroselloZip } from '@/lib/caroselloExport'
import { hiResProxyUrl } from '@/lib/albumExport'
import { getDriveToken, ensureDriveFolder, uploadAnyToDrive, driveDownloadUrl } from '@/lib/driveUpload'

const isDirectSrc = (id: string) => id.startsWith('data:') || id.startsWith('http')

// Dropdown riutilizzabile: bottone + pannello che si chiude cliccando fuori o su una voce.
function Menu({ label, icon: Ic, width = 'w-60', children }: { label: string; icon?: typeof Type; width?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className={`h-9 inline-flex items-center gap-1.5 px-2.5 rounded-md border text-sm transition-colors ${open ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))] bg-[rgb(var(--bg))] hover:bg-[rgb(var(--bg-sunken))]'}`}>
        {Ic && <Ic size={14} />} {label} <ChevronDown size={14} className="opacity-60" />
      </button>
      {open && (
        <div className={`absolute left-0 z-50 mt-1 max-h-[70vh] overflow-auto rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-xl p-2 ${width}`} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

type Geo = { x: number; y: number; w: number; h: number }
const clampN = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
function gMove<T extends Geo>(e: T, x: number, y: number): T { return { ...e, x: clampN(x, -e.w + 0.02, 1 - 0.02), y: clampN(y, -e.h + 0.02, 1 - 0.02) } }
function gResize<T extends Geo>(e: T, c: Corner, nx: number, ny: number): T {
  const right = e.x + e.w, bottom = e.y + e.h, MIN = 0.03
  let x = e.x, y = e.y, w = e.w, h = e.h
  if (c === 'se') { w = nx - e.x; h = ny - e.y }
  else if (c === 'ne') { w = nx - e.x; y = Math.min(ny, bottom - MIN); h = bottom - y }
  else if (c === 'sw') { x = Math.min(nx, right - MIN); w = right - x; h = ny - e.y }
  else { x = Math.min(nx, right - MIN); w = right - x; y = Math.min(ny, bottom - MIN); h = bottom - y }
  return { ...e, x, y, w: Math.max(MIN, w), h: Math.max(MIN, h) }
}
// Aggancio (durante lo spostamento) ai confini delle slide (k/n), al centro strip e ai bordi:
// così è facile allineare le foto ai tagli e ottenere il seamless pulito.
function snapGeo<T extends Geo>(e: T, n: number): T {
  const thr = 0.006
  const xb: number[] = [0.5]; for (let k = 0; k <= n; k++) xb.push(k / n)
  const yb = [0, 0.5, 1]
  let nx = e.x, ny = e.y, bdx = thr, bdy = thr
  for (const a of [e.x, e.x + e.w, e.x + e.w / 2]) for (const b of xb) { const d = Math.abs(a - b); if (d < bdx) { bdx = d; nx = b - (a - e.x) } }
  for (const a of [e.y, e.y + e.h, e.y + e.h / 2]) for (const b of yb) { const d = Math.abs(a - b); if (d < bdy) { bdy = d; ny = b - (a - e.y) } }
  return { ...e, x: nx, y: ny }
}

type M = {
  id: string; drive_file_id: string; thumbnail_link: string | null
  media_type: 'PHOTO' | 'VIDEO'; album_choice: 'KEPT' | 'DISCARDED' | null
}
const isDrive = (m: M) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-') && !m.drive_file_id.startsWith('guest:') && !m.drive_file_id.startsWith('album:')
const thumbUrl = (m: M) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w800` : (m.thumbnail_link ?? ''))
const hiUrl = (m: M) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

const uid = () => { try { return crypto.randomUUID() } catch { return `c-${Date.now()}-${Math.floor(Math.random() * 1e9)}` } }
const BG_SWATCHES = ['#ffffff', '#faf7f2', '#111111', '#0b1f3a', '#e9d9c3']

export default function CaroselloPage() {
  const { entryId } = useParams<{ entryId: string }>()
  const [media, setMedia] = useState<M[]>([])
  const [loading, setLoading] = useState(true)
  const [format, setFormat] = useState(DEFAULT_CAROUSEL_FORMAT)
  const [n, setN] = useState(3)
  const [strip, setStrip] = useState<AlbumPage>({ id: 'strip', moment: null, template: '1', mediaIds: [], mode: 'free', elements: [], bg: '#ffffff' })
  const [texts, setTexts] = useState<TextEl[]>([])
  const [selId, setSelId] = useState<string | null>(null)
  const [selText, setSelText] = useState<string | null>(null)
  const [modelKey, setModelKey] = useState<string | null>('one')
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [exportProg, setExportProg] = useState<{ done: number; total: number; zip?: number } | null>(null)
  const loadedRef = useRef(false)
  const stripRef = useRef<HTMLDivElement>(null)
  const autoTimer = useRef<number | undefined>(undefined)

  const fmt = getCarouselFormat(format)
  const stripAspect = (fmt.w * n) / fmt.h
  const keptIds = useMemo(() => media.map((m) => m.id), [media])
  const mediaById = useMemo(() => new Map(media.map((m) => [m.id, m] as const)), [media])
  const elements = strip.elements ?? []
  const sel = elements.find((e) => e.id === selId) ?? null
  const selT = texts.find((t) => t.id === selText) ?? null

  // ── LOAD: selezione foto (KEPT) + progetto carosello salvato ────────────────
  useEffect(() => {
    if (!entryId) return
    void (async () => {
      const { data: gm } = await (supabase.from as any)('gallery_media')
        .select('id, drive_file_id, thumbnail_link, media_type, album_choice')
        .eq('entry_id', entryId).eq('media_type', 'PHOTO').eq('album_choice', 'KEPT')
      const list = (gm as M[] | null) ?? []
      setMedia(list)
      const { data } = await (supabase.rpc as any)('carousel_project_get', { p_entry: entryId })
      const res = data as { exists?: boolean; format_key?: string; slides?: number; layout?: { strip?: AlbumPage; texts?: TextEl[] } } | null
      if (res?.exists && res.layout?.strip) {
        setFormat(res.format_key || DEFAULT_CAROUSEL_FORMAT)
        setN(Math.min(20, Math.max(1, res.slides || 3)))
        setStrip({ ...res.layout.strip, mode: 'free', elements: res.layout.strip.elements ?? [] })
        setTexts(res.layout.texts ?? [])
        setModelKey(null)
      } else {
        // primo avvio: applica il premodello "una foto per slide" con le prime foto
        const nn = Math.min(3, Math.max(1, list.length || 3))
        setN(nn)
        setStrip((s) => ({ ...s, elements: getModel('one').build(nn, list.map((m) => m.id)) }))
      }
      setLoading(false)
      loadedRef.current = true
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId])

  // ── AUTOSAVE (debounce 1.5s), come l'album ──────────────────────────────────
  const save = useCallback(async () => {
    if (!entryId) return
    const { error } = await (supabase.rpc as any)('carousel_project_save', {
      p_entry: entryId, p_format: format, p_slides: n, p_status: 'DRAFT', p_layout: { strip, texts },
    })
    if (!error) setSavedAt(Date.now())
  }, [entryId, format, n, strip, texts])
  useEffect(() => {
    if (!loadedRef.current) return
    if (autoTimer.current) window.clearTimeout(autoTimer.current)
    autoTimer.current = window.setTimeout(() => { void save() }, 1500)
    return () => { if (autoTimer.current) window.clearTimeout(autoTimer.current) }
  }, [strip, texts, format, n, save])

  // ── tasto CANC/Backspace: elimina l'elemento selezionato ────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
      const meta = e.metaKey || e.ctrlKey
      if (meta && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (meta && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selId) { e.preventDefault(); snapshot(); setStrip((s) => ({ ...s, elements: (s.elements ?? []).filter((x) => x.id !== selId) })); setSelId(null); setModelKey(null) }
        else if (selText) { e.preventDefault(); snapshot(); setTexts((ts) => ts.filter((t) => t.id !== selText)); setSelText(null) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, selText])

  // ── helpers editing ─────────────────────────────────────────────────────────
  const setElements = (els: FreeEl[]) => setStrip((s) => ({ ...s, elements: els }))
  const updateEl = (id: string, fn: (e: FreeEl) => FreeEl) => setElements(elements.map((e) => (e.id === id ? fn(e) : e)))
  const updateCell = (id: string, patch: Partial<FreeEl['cell']>) => updateEl(id, (e) => ({ ...e, cell: { ...e.cell, ...patch } }))
  const updateText = (id: string, fn: (t: TextEl) => TextEl) => setTexts((ts) => ts.map((t) => (t.id === id ? fn(t) : t)))
  const patchText = (id: string, patch: Partial<TextEl>) => updateText(id, (t) => ({ ...t, ...patch }))
  function addText(patch: Partial<TextEl>) { snapshot(); const t = newText(patch); setTexts((ts) => [...ts, t]); setSelText(t.id); setSelId(null); setModelKey(null) }

  // ── UNDO / REDO (snapshot su azioni discrete) ────────────────────────────────
  const cur = useRef<{ strip: AlbumPage; texts: TextEl[] }>({ strip, texts })
  cur.current = { strip, texts }
  const histRef = useRef<{ strip: AlbumPage; texts: TextEl[] }[]>([])
  const futRef = useRef<{ strip: AlbumPage; texts: TextEl[] }[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const syncUR = () => { setCanUndo(histRef.current.length > 0); setCanRedo(futRef.current.length > 0) }
  function snapshot() { histRef.current.push(cur.current); if (histRef.current.length > 60) histRef.current.shift(); futRef.current = []; syncUR() }
  function undo() { const h = histRef.current.pop(); if (!h) return; futRef.current.push(cur.current); setStrip(h.strip); setTexts(h.texts); setSelId(null); setSelText(null); setModelKey(null); syncUR() }
  function redo() { const f = futRef.current.pop(); if (!f) return; histRef.current.push(cur.current); setStrip(f.strip); setTexts(f.texts); setSelId(null); setSelText(null); syncUR() }

  function applyModel(key: string) {
    snapshot()
    const model = getModel(key)
    setElements(model.build(n, keptIds))
    setModelKey(key)
    setSelId(null); setSelText(null)
  }
  // Preset PRONTO: mette foto + testi già composti (sostituisci solo le foto / cambia i testi).
  function applyPreset(key: string) {
    const preset = getPreset(key); if (!preset) return
    snapshot()
    const built = preset.build(n, keptIds)
    setElements(built.elements); setTexts(built.texts); setModelKey(null); setSelId(null); setSelText(null)
    toast.success(`Preset "${preset.label}" applicato · sostituisci le foto e cambia i testi`)
  }
  function changeN(next: number) {
    snapshot()
    const nn = Math.min(20, Math.max(1, next))
    setN(nn)
    if (modelKey) setElements(getModel(modelKey).build(nn, keptIds)) // rebuild premodello sul nuovo N
    setSelId(null); setSelText(null)
  }
  // assegna/sostituisci la foto: se c'è uno slot selezionato lo riempie; altrimenti il primo vuoto.
  function assignPhoto(mediaId: string) {
    snapshot()
    if (sel) { updateEl(sel.id, (e) => ({ ...e, mediaId })); return }
    const empty = elements.find((e) => !e.mediaId)
    if (empty) { updateEl(empty.id, (e) => ({ ...e, mediaId })); setSelId(empty.id); return }
    // nessuno slot: aggiungi un elemento libero al centro della slide corrente
    const el: FreeEl = { id: uid(), mediaId, x: 0.3, y: 0.3, w: Math.min(0.4, 1 / n * 0.8), h: 0.4, rot: 0, cell: { ...DEFAULT_CELL } }
    setElements([...elements, el]); setSelId(el.id); setModelKey(null)
  }

  // ── drag / resize (pointer) — generico per foto (el) e testo (text) ─────────
  const drag = useRef<{ mode: 'move' | Corner; id: string; sx: number; sy: number; e0: Geo; arr: 'el' | 'text'; moved: boolean } | null>(null)
  const ptTo01 = (clientX: number, clientY: number) => {
    const r = stripRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)) }
  }
  function startDrag(e: React.PointerEvent, mode: 'move' | Corner, item: Geo & { id: string }, arr: 'el' | 'text') {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const p = ptTo01(e.clientX, e.clientY)
    drag.current = { mode, id: item.id, sx: p.x, sy: p.y, e0: item, arr, moved: false }
    if (arr === 'el') { setSelId(item.id); setSelText(null) } else { setSelText(item.id); setSelId(null) }
    setModelKey(null)
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return
    if (!d.moved) { d.moved = true; snapshot() }
    const p = ptTo01(e.clientX, e.clientY)
    if (d.arr === 'el') { const b = d.e0 as FreeEl; updateEl(d.id, () => (d.mode === 'move' ? snapGeo(gMove(b, b.x + (p.x - d.sx), b.y + (p.y - d.sy)), n) : gResize(b, d.mode as Corner, p.x, p.y))) }
    else { const b = d.e0 as TextEl; updateText(d.id, () => (d.mode === 'move' ? snapGeo(gMove(b, b.x + (p.x - d.sx), b.y + (p.y - d.sy)), n) : gResize(b, d.mode as Corner, p.x, p.y))) }
  }
  function endDrag() { drag.current = null }

  function removeSel() { if (!sel) return; snapshot(); setElements(elements.filter((e) => e.id !== sel.id)); setSelId(null); setModelKey(null) }
  function duplicateSel() { if (!sel) return; snapshot(); const c = { ...sel, id: uid(), x: Math.min(0.9, sel.x + 0.02), y: Math.min(0.9, sel.y + 0.02) }; setElements([...elements, c]); setSelId(c.id); setModelKey(null) }
  function bringFront() { if (!sel) return; snapshot(); setElements([...elements.filter((e) => e.id !== sel.id), sel]); setModelKey(null) }
  // Riordino: scambia il CONTENUTO di due slide adiacenti. Sposta gli elementi il cui centro cade
  // nella slide a↔b; quelli che ATTRAVERSANO il confine (seamless) restano dove sono.
  function swapSlides(a: number, b: number) {
    if (a < 0 || b < 0 || a >= n || b >= n) return
    snapshot()
    const slideOf = (e: Geo) => Math.min(n - 1, Math.max(0, Math.floor((e.x + e.w / 2) * n)))
    const shift = <T extends Geo>(e: T, from: number, to: number): T => ({ ...e, x: e.x + (to - from) / n })
    const move = <T extends Geo>(arr: T[]) => arr.map((e) => { const s = slideOf(e); return s === a ? shift(e, a, b) : s === b ? shift(e, b, a) : e })
    setElements(move(elements)); setTexts(move(texts)); setModelKey(null); setSelId(null); setSelText(null)
  }

  // ── LOGO / grafica (data-URL: vive nel layout, niente upload) ────────────────
  const logoInputRef = useRef<HTMLInputElement>(null)
  function addLogoFile(file: File) {
    const r = new FileReader()
    r.onload = () => { snapshot(); const url = String(r.result); const el: FreeEl = { id: uid(), mediaId: url, x: 0.02, y: 0.04, w: Math.min(0.14, 1 / n * 0.5), h: 0.14, rot: 0, cell: { ...DEFAULT_CELL } }; setElements([...elements, el]); setSelId(el.id); setSelText(null); setModelKey(null) }
    r.readAsDataURL(file)
  }

  // ── EXPORT / SALVA ──────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false)
  const [driveBusy, setDriveBusy] = useState(false)
  async function buildResolver(): Promise<(id: string) => string> {
    const SB = import.meta.env.VITE_SUPABASE_URL, AK = import.meta.env.VITE_SUPABASE_ANON_KEY
    let grant: string | null = null
    try { const { data } = await (supabase.rpc as any)('album_export_grant', { p_entry: entryId }); grant = (data as string) ?? null } catch { grant = null }
    return (id: string) => { if (isDirectSrc(id)) return id; const m = mediaById.get(id); if (!m) return ''; return grant && isDrive(m) ? hiResProxyUrl(SB, AK, grant, id) : hiUrl(m) }
  }
  const onZipProg = (z: number) => setExportProg((p) => (p ? { ...p, zip: z } : { done: n, total: n, zip: z }))
  async function exportZip() {
    if (exporting || driveBusy) return
    if (elements.every((e) => !e.mediaId)) { toast.error('Aggiungi almeno una foto'); return }
    setExporting(true); setExportProg({ done: 0, total: n })
    try {
      const resolve = await buildResolver()
      await exportCaroselloZip(strip, fmt.w, fmt.h, n, resolve, {
        texts, filename: `carosello-${n}slide.zip`,
        onProgress: (done, total) => setExportProg({ done, total }), onZip: onZipProg,
      })
      toast.success(`${n} slide esportate: caricale su Instagram nell'ordine slide-01 → slide-${String(n).padStart(2, '0')} per lo swipe continuo.`, { duration: 9000 })
    } catch (e) { toast.error(`Export non riuscito: ${(e as Error).message}`) }
    finally { setExporting(false); setExportProg(null) }
  }
  async function saveToDrive() {
    if (exporting || driveBusy) return
    if (elements.every((e) => !e.mediaId)) { toast.error('Aggiungi almeno una foto'); return }
    setDriveBusy(true); setExportProg({ done: 0, total: n })
    try {
      const resolve = await buildResolver()
      const blob = await exportCaroselloZip(strip, fmt.w, fmt.h, n, resolve, { texts, returnBlob: true, onProgress: (done, total) => setExportProg({ done, total }), onZip: onZipProg }) as Blob
      setExportProg(null)
      const token = await getDriveToken()
      const folder = await ensureDriveFolder(token, 'Planfully - Caroselli', null)
      const file = new File([blob], `carosello-${n}slide.zip`, { type: 'application/zip' })
      const { id } = await uploadAnyToDrive(token, folder, file)
      const link = driveDownloadUrl(id)
      try { await navigator.clipboard.writeText(link); toast.success('Salvato sul tuo Drive · link copiato negli appunti', { duration: 8000 }) } catch { toast.success('Salvato sul tuo Drive') }
    } catch (e) { toast.error(`Salvataggio su Drive non riuscito: ${(e as Error).message}`.slice(0, 160)) }
    finally { setDriveBusy(false); setExportProg(null) }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[rgb(var(--fg-muted))]" /></div>

  return (
    <div className="min-h-screen flex flex-col bg-[rgb(var(--bg-sunken))]">
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-[rgb(var(--bg))] border-b border-[rgb(var(--border))] px-3 sm:px-5 py-2 flex items-center gap-3 flex-wrap">
        <Link to={`/album/${entryId}`} className="p-1.5 -ml-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><ArrowLeft size={20} /></Link>
        <div className="min-w-0">
          <p className="font-display text-lg leading-tight flex items-center gap-2"><Sparkles size={16} className="text-[rgb(var(--gold-600))]" /> Carosello</p>
          <p className="text-[11px] text-[rgb(var(--fg-muted))]">{savedAt ? '✓ salvato' : 'Slide Instagram collegate · flusso unico'}</p>
        </div>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <div className="flex items-center gap-0.5">
            <button onClick={undo} disabled={!canUndo} title="Annulla (Cmd/Ctrl+Z)" className="p-1.5 rounded-md disabled:opacity-30 hover:bg-[rgb(var(--bg-sunken))]"><Undo2 size={16} /></button>
            <button onClick={redo} disabled={!canRedo} title="Ripeti (Cmd/Ctrl+Shift+Z)" className="p-1.5 rounded-md disabled:opacity-30 hover:bg-[rgb(var(--bg-sunken))]"><Redo2 size={16} /></button>
          </div>
          <Button variant="outline" size="sm" disabled={exporting || driveBusy} onClick={() => void saveToDrive()} title="Salva le slide sul tuo Google Drive e copia il link">{driveBusy ? <Loader2 size={14} className="animate-spin" /> : <FolderUp size={14} />} Drive</Button>
          <Button variant="gold" size="sm" disabled={exporting || driveBusy} onClick={() => void exportZip()}>{exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Esporta per Instagram</Button>
        </div>
      </header>

      {/* CONTROLLI (dropdown) */}
      <div className="bg-[rgb(var(--bg))] border-b border-[rgb(var(--border))] px-3 sm:px-5 py-2 flex items-center gap-2 flex-wrap relative z-20">
        {/* formato */}
        <select value={format} onChange={(e) => setFormat(e.target.value)} title="Formato slide" className="h-9 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 text-sm">
          {CAROUSEL_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        {/* numero slide */}
        <div className="flex items-center gap-1 h-9 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-1">
          <button onClick={() => changeN(n - 1)} disabled={n <= 1} className="p-1.5 disabled:opacity-30 hover:bg-[rgb(var(--bg-sunken))] rounded"><Minus size={14} /></button>
          <span className="text-sm tabular-nums w-16 text-center">{n} slide</span>
          <button onClick={() => changeN(n + 1)} disabled={n >= 20} className="p-1.5 disabled:opacity-30 hover:bg-[rgb(var(--bg-sunken))] rounded"><Plus size={14} /></button>
        </div>
        <span className="mx-0.5 h-5 w-px bg-[rgb(var(--border))]" />

        {/* MODELLI (solo disposizione foto) */}
        <Menu label="Modelli" icon={LayoutGrid} width="w-[min(92vw,440px)]">
          <p className="px-1 pt-0.5 pb-1 text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Impaginazioni</p>
          <div className="grid grid-cols-2 gap-0.5">
            {CAROUSEL_MODELS.filter((m) => (m.group ?? 'base') === 'base').map((m) => (
              <button key={m.key} title={m.hint} onClick={() => applyModel(m.key)} className={`text-xs text-left px-2 py-1.5 rounded-md hover:bg-[rgb(var(--bg-sunken))] ${modelKey === m.key ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : ''}`}>{m.label}</button>
            ))}
          </div>
          <p className="px-1 pt-2 pb-1 text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Editoriale</p>
          <div className="grid grid-cols-2 gap-0.5">
            {CAROUSEL_MODELS.filter((m) => m.group === 'editoriale').map((m) => (
              <button key={m.key} title={m.hint} onClick={() => applyModel(m.key)} className={`text-xs text-left px-2 py-1.5 rounded-md hover:bg-[rgb(var(--bg-sunken))] ${modelKey === m.key ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : ''}`}>{m.label}</button>
            ))}
          </div>
        </Menu>

        {/* PRESET PRONTI (foto + testo già composti) */}
        <Menu label="Preset pronti" icon={Newspaper} width="w-[min(92vw,380px)]">
          {CAROUSEL_PRESETS.map((p) => (
            <button key={p.key} onClick={() => applyPreset(p.key)} className="w-full text-left px-2 py-1.5 rounded-md hover:bg-[rgb(var(--bg-sunken))]">
              <span className="text-sm font-medium block">{p.label}</span>
              <span className="text-[11px] text-[rgb(var(--fg-muted))] block">{p.hint}</span>
            </button>
          ))}
        </Menu>

        {/* TESTO */}
        <Menu label="Testo" icon={Type} width="w-64">
          {TEXT_PRESETS.map((p) => (
            <button key={p.label} onClick={() => addText(p.patch)} className="w-full text-left px-2 py-1.5 rounded-md hover:bg-[rgb(var(--bg-sunken))] text-sm">＋ {p.label}</button>
          ))}
          <p className="px-2 pt-1.5 text-[11px] text-[rgb(var(--fg-subtle))]">Appena inserito, il testo è selezionato: sotto compaiono <strong>font</strong>, <strong>grandezza</strong>, colore e allineamento.</p>
        </Menu>

        {/* AGGIUNGI (logo/grafica) */}
        <Menu label="Aggiungi" icon={ImageIcon} width="w-64">
          <button onClick={() => logoInputRef.current?.click()} className="w-full text-left px-2 py-1.5 rounded-md hover:bg-[rgb(var(--bg-sunken))] text-sm inline-flex items-center gap-2"><Upload size={14} /> Logo / grafica…</button>
          <p className="px-2 pt-1.5 text-[11px] text-[rgb(var(--fg-subtle))]">Le <strong>foto</strong> si aggiungono dalla striscia in basso: tocca o trascina su uno slot.</p>
        </Menu>

        {/* SFONDO */}
        <Menu label="Sfondo" icon={Palette} width="w-56">
          <div className="flex items-center gap-1.5 px-1 py-1">
            {BG_SWATCHES.map((c) => (
              <button key={c} onClick={() => setStrip((s) => ({ ...s, bg: c }))} className={`h-7 w-7 rounded-full border ${strip.bg === c ? 'ring-2 ring-[rgb(var(--gold-500))] border-transparent' : 'border-[rgb(var(--border))]'}`} style={{ background: c }} />
            ))}
          </div>
          <p className="px-2 pt-1 text-[11px] text-[rgb(var(--fg-subtle))]">Sfondo di tutta la striscia (si vede dove non ci sono foto).</p>
        </Menu>

        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) addLogoFile(f); e.currentTarget.value = '' }} />
        <span className="ml-auto text-[11px] text-[rgb(var(--fg-subtle))]">{savedAt ? '✓ salvato' : 'bozza'}</span>
      </div>

      {/* STRIP EDITOR */}
      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 flex items-start justify-center" onPointerDown={() => { setSelId(null); setSelText(null) }}>
        <div className="inline-block">
          <div ref={stripRef} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
            className="relative shadow-2xl select-none touch-none"
            style={{ height: 'min(64vh, 620px)', aspectRatio: String(stripAspect), background: strip.bg ?? '#fff', containerType: 'size' }}
            onPointerDown={(e) => e.stopPropagation()}>
            {/* elementi foto */}
            {elements.map((el) => {
              const direct = !!el.mediaId && isDirectSrc(el.mediaId)
              const m = el.mediaId && !direct ? mediaById.get(el.mediaId) : null
              const src = direct ? el.mediaId : (m ? thumbUrl(m) : null)
              const active = el.id === selId
              return (
                <div key={el.id} onPointerDown={(e) => startDrag(e, 'move', el, 'el')}
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOverId(el.id) }}
                  onDragLeave={() => setDragOverId((d) => (d === el.id ? null : d))}
                  onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setDragOverId(null); if (id) { updateEl(el.id, (x) => ({ ...x, mediaId: id })); setSelId(el.id); setModelKey(null) } }}
                  className={`absolute overflow-hidden cursor-move ${active ? 'outline outline-2 outline-[rgb(var(--gold-500))] z-20' : 'z-10'} ${dragOverId === el.id ? 'ring-4 ring-[rgb(var(--gold-500))]' : ''}`}
                  style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, boxShadow: el.shadow ? '0 6px 18px rgba(0,0,0,.28)' : undefined, border: el.border ? `${el.border.w}px solid ${el.border.color}` : undefined }}>
                  {src ? <img src={src} alt="" draggable={false} style={coverImgStyle(el.cell)} />
                    : <div className="absolute inset-0 grid place-items-center bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))]"><ImagePlus size={20} /></div>}
                  {active && (['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                    <span key={c} onPointerDown={(e) => startDrag(e, c, el, 'el')}
                      className="absolute h-3.5 w-3.5 rounded-full bg-white border-2 border-[rgb(var(--gold-500))] z-30"
                      style={{ left: c.includes('w') ? -7 : undefined, right: c.includes('e') ? -7 : undefined, top: c.includes('n') ? -7 : undefined, bottom: c.includes('s') ? -7 : undefined, cursor: `${c}-resize` }} />
                  ))}
                </div>
              )
            })}
            {/* blocchi di testo */}
            {texts.map((t) => {
              const active = t.id === selText
              const valign = t.valign === 'middle' ? 'center' : t.valign === 'bottom' ? 'flex-end' : 'flex-start'
              return (
                <div key={t.id} onPointerDown={(e) => startDrag(e, 'move', t, 'text')}
                  className={`absolute flex cursor-move ${active ? 'outline outline-2 outline-[rgb(var(--gold-500))] z-30' : 'z-20'}`}
                  style={{ left: `${t.x * 100}%`, top: `${t.y * 100}%`, width: `${t.w * 100}%`, height: `${t.h * 100}%`, transform: `rotate(${t.rot}deg)`, alignItems: valign, background: t.bg ?? undefined, padding: t.bg ? '2%' : undefined }}>
                  <div style={{ width: '100%', fontFamily: getFontFamily(t.font), fontSize: `${(t.size * 100).toFixed(2)}cqh`, fontWeight: t.weight, fontStyle: t.italic ? 'italic' : 'normal', color: t.color, textAlign: t.align, lineHeight: t.line ?? 1.15, letterSpacing: `${t.letter ?? 0}em`, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{t.text || ' '}</div>
                  {active && (['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                    <span key={c} onPointerDown={(e) => startDrag(e, c, t, 'text')}
                      className="absolute h-3.5 w-3.5 rounded-full bg-white border-2 border-[rgb(var(--gold-500))] z-40"
                      style={{ left: c.includes('w') ? -7 : undefined, right: c.includes('e') ? -7 : undefined, top: c.includes('n') ? -7 : undefined, bottom: c.includes('s') ? -7 : undefined, cursor: `${c}-resize` }} />
                  ))}
                </div>
              )
            })}
            {/* divisori slide (dove Instagram taglia) */}
            {Array.from({ length: n - 1 }, (_, i) => (
              <div key={i} className="absolute top-0 bottom-0 w-px bg-white/70 mix-blend-difference pointer-events-none z-40" style={{ left: `${((i + 1) / n) * 100}%` }} />
            ))}
            {/* etichette slide */}
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className="absolute top-1 text-[10px] font-medium text-white mix-blend-difference pointer-events-none z-40" style={{ left: `${(i / n) * 100 + 0.5}%` }}>{i + 1}</span>
            ))}
          </div>
          <p className="text-center text-[11px] text-[rgb(var(--fg-muted))] mt-2">Le linee segnano dove Instagram taglia le slide · trascina/ridimensiona le foto · quello che attraversa una linea resta continuo nello swipe</p>
          {n > 1 && (
            <div className="mt-2 flex items-center justify-center gap-0.5 flex-wrap">
              <span className="text-[11px] text-[rgb(var(--fg-subtle))] mr-1">Riordina:</span>
              {Array.from({ length: n }, (_, i) => (
                <span key={i} className="inline-flex items-center">
                  <span className="text-[11px] tabular-nums px-1.5 py-0.5 rounded bg-[rgb(var(--bg-sunken))] border border-[rgb(var(--border))]">{i + 1}</span>
                  {i < n - 1 && <button onClick={() => swapSlides(i, i + 1)} title={`Scambia il contenuto delle slide ${i + 1} e ${i + 2}`} className="mx-0.5 p-0.5 rounded hover:bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]"><ArrowLeftRight size={12} /></button>}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TOOLBAR elemento selezionato */}
      {sel && (
        <div className="sticky bottom-[76px] z-30 mx-auto mb-1 flex items-center gap-1.5 rounded-full bg-[rgb(var(--bg))] border border-[rgb(var(--border))] shadow-lg px-2 py-1.5">
          <button title="Zoom -" onClick={() => updateCell(sel.id, { z: Math.max(1, +(sel.cell.z - 0.1).toFixed(2)) })} className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-sunken))]"><ZoomOut size={16} /></button>
          <span className="text-[11px] tabular-nums w-9 text-center">{Math.round((sel.cell.z || 1) * 100)}%</span>
          <button title="Zoom +" onClick={() => updateCell(sel.id, { z: Math.min(3, +(sel.cell.z + 0.1).toFixed(2)) })} className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-sunken))]"><ZoomIn size={16} /></button>
          <div className="h-5 w-px bg-[rgb(var(--border))] mx-0.5" />
          <button title="Ombra" onClick={() => updateEl(sel.id, (e) => ({ ...e, shadow: !e.shadow }))} className={`text-[11px] px-2 py-1 rounded-full ${sel.shadow ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>Ombra</button>
          <button title="Porta avanti" onClick={bringFront} className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-sunken))]"><ArrowUpToLine size={16} /></button>
          <button title="Duplica" onClick={duplicateSel} className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-sunken))]"><Copy size={16} /></button>
          <button title="Elimina" onClick={removeSel} className="p-1.5 rounded-full text-rose-500 hover:bg-rose-50"><Trash2 size={16} /></button>
          <button title="Chiudi" onClick={() => setSelId(null)} className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-sunken))]"><X size={16} /></button>
        </div>
      )}

      {/* TOOLBAR testo selezionato */}
      {selT && (
        <div className="sticky bottom-[76px] z-30 mx-auto mb-1 w-[min(96vw,760px)] rounded-2xl bg-[rgb(var(--bg))] border border-[rgb(var(--border))] shadow-lg px-3 py-2 space-y-2">
          <div className="flex items-center gap-2"><Type size={13} className="text-[rgb(var(--gold-600))]" /><span className="text-[11px] font-medium text-[rgb(var(--fg-muted))]">Testo selezionato</span></div>
          <textarea value={selT.text} onChange={(e) => patchText(selT.id, { text: e.target.value })} rows={2} placeholder="Scrivi qui il testo…" className="w-full text-sm rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5 outline-none focus:border-[rgb(var(--gold-500))]" />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[rgb(var(--fg-subtle))]">Font</span>
            <select value={selT.font} onChange={(e) => patchText(selT.id, { font: e.target.value })} className="h-8 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-1.5 text-xs">
              {CAROUSEL_FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <span className="text-[11px] text-[rgb(var(--fg-subtle))] ml-1">Grandezza</span>
            <div className="flex items-center h-8 rounded-md border border-[rgb(var(--border))]">
              <button title="Più piccolo" onClick={() => patchText(selT.id, { size: Math.max(0.02, +(selT.size - 0.008).toFixed(3)) })} className="px-2 hover:bg-[rgb(var(--bg-sunken))]"><Minus size={13} /></button>
              <span className="text-[11px] w-7 text-center tabular-nums">{Math.round(selT.size * 100)}</span>
              <button title="Più grande" onClick={() => patchText(selT.id, { size: Math.min(0.4, +(selT.size + 0.008).toFixed(3)) })} className="px-2 hover:bg-[rgb(var(--bg-sunken))]"><Plus size={13} /></button>
            </div>
            <button title="Grassetto" onClick={() => patchText(selT.id, { weight: selT.weight >= 700 ? 400 : 700 })} className={`h-8 w-8 grid place-items-center rounded-md border ${selT.weight >= 700 ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] border-[rgb(var(--gold-300))]' : 'border-[rgb(var(--border))]'}`}><Bold size={14} /></button>
            <button title="Corsivo" onClick={() => patchText(selT.id, { italic: !selT.italic })} className={`h-8 w-8 grid place-items-center rounded-md border ${selT.italic ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] border-[rgb(var(--gold-300))]' : 'border-[rgb(var(--border))]'}`}><Italic size={14} /></button>
            <div className="flex items-center h-8 rounded-md border border-[rgb(var(--border))] overflow-hidden">
              {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Ic]) => (
                <button key={a} onClick={() => patchText(selT.id, { align: a })} className={`h-full px-1.5 hover:bg-[rgb(var(--bg-sunken))] ${selT.align === a ? 'text-[rgb(var(--gold-700))] bg-[rgb(var(--gold-100))]' : ''}`}><Ic size={14} /></button>
              ))}
            </div>
            {['#111111', '#ffffff', '#b8923f', '#7e6633', '#c0392b'].map((c) => (
              <button key={c} onClick={() => patchText(selT.id, { color: c })} title="Colore testo" className={`h-7 w-7 rounded-full border ${selT.color === c ? 'ring-2 ring-[rgb(var(--gold-500))] border-transparent' : 'border-[rgb(var(--border))]'}`} style={{ background: c }} />
            ))}
            <button title="Sfondo dietro il testo" onClick={() => patchText(selT.id, { bg: selT.bg ? null : '#ffffff' })} className={`text-[11px] px-2 h-8 rounded-md border ${selT.bg ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] border-[rgb(var(--gold-300))]' : 'border-[rgb(var(--border))]'}`}>Box</button>
            <div className="ml-auto flex items-center gap-1">
              <button title="Elimina (o Canc)" onClick={() => { setTexts((ts) => ts.filter((t) => t.id !== selT.id)); setSelText(null) }} className="p-1.5 rounded-md text-rose-500 hover:bg-rose-50"><Trash2 size={16} /></button>
              <button title="Chiudi" onClick={() => setSelText(null)} className="p-1.5 rounded-md hover:bg-[rgb(var(--bg-sunken))]"><X size={16} /></button>
            </div>
          </div>
        </div>
      )}

      {/* TRAY selezione foto */}
      <div className="sticky bottom-0 z-20 bg-[rgb(var(--bg))] border-t border-[rgb(var(--border))] px-3 py-2">
        <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1.5">Trascina una foto su uno slot per metterla lì (o toccala) · seleziona uno slot e premi <kbd className="px-1 rounded bg-[rgb(var(--bg-sunken))] border border-[rgb(var(--border))]">Canc</kbd> per eliminarlo · dalla selezione dell’album ({media.length})</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {media.length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))] py-2">Nessuna foto selezionata: scegli le foto nell’album (cuori) e torna qui.</p>}
          {media.map((m) => {
            const used = elements.some((e) => e.mediaId === m.id)
            return (
              <button key={m.id} onClick={() => assignPhoto(m.id)} draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', m.id); e.dataTransfer.effectAllowed = 'copy' }}
                title="Trascinala su uno slot per metterla lì · o tocca"
                className="relative shrink-0 h-16 w-16 rounded-md overflow-hidden border border-[rgb(var(--border))] hover:ring-2 hover:ring-[rgb(var(--gold-400))] cursor-grab active:cursor-grabbing">
                <img src={thumbUrl(m)} alt="" className="h-full w-full object-cover" draggable={false} />
                {used && <span className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-[rgb(var(--gold-500))] text-white grid place-items-center"><Check size={11} /></span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* BARRA export */}
      {exportProg && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
          <div className="w-[min(92vw,380px)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5 shadow-2xl">
            <div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin text-[rgb(var(--gold-600))]" /> <p className="font-display text-base">Esporto le slide…</p></div>
            <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">{exportProg.zip != null ? <>Comprimo lo ZIP… <span className="tabular-nums">{exportProg.zip}%</span></> : <>Ritaglio le slide. <span className="tabular-nums">{exportProg.done}/{exportProg.total}</span></>}</p>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-sunken))]">
              <div className="h-full rounded-full bg-[rgb(var(--gold-500))] transition-[width] duration-200" style={{ width: `${exportProg.zip != null ? exportProg.zip : Math.round((exportProg.done / Math.max(1, exportProg.total)) * 100)}%` }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
