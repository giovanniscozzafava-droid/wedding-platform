import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Wand2, Save, Plus, Trash2, ChevronLeft, ChevronRight, Heart, Loader2, LayoutGrid, FileImage, FileText, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ALBUM_FORMATS, DEFAULT_FORMAT, getFormat, pageAspect } from '@/lib/albumFormats'
import { MOMENTS, getMoment, ALBUM_MIN_PHOTOS, ALBUM_MAX_PHOTOS } from '@/lib/albumMoments'
import { autoLayout, framesForPage, newPage, templatesFor, cycleTemplate, MAX_PER_PAGE, type AlbumPage, type TemplateKey } from '@/lib/albumEngine'
import { exportAlbumPdf, exportAlbumJpgZip, hiResProxyUrl } from '@/lib/albumExport'
import { coverImgStyle, slotAspectOf, cellToCrop, cropToCell, CROP_ANCHORS, DEFAULT_CELL, MARGIN_MM, type Cell } from '@/lib/albumGeometry'
import { placeInPage, clearSlotInPage, setCell, setPageTemplate, insertPageAfter, removePage } from '@/lib/albumOps'
import { toFreeElements, newFreeEl, moveEl, resizeEl, snapMove, snapAngle, spacingSnap, neighborGaps, moveManyBy, removeFreeEl, removeManyFree, updateFreeEl, bringToFront, type FreeEl, type Corner, type GapMark } from '@/lib/albumFree'
import { listLayouts, saveLayout, deleteLayout, applyLayout, pageToFrames, type SavedLayout } from '@/lib/albumLayouts'
import { albumRoleOf, primaryAction, statusLabel } from '@/lib/albumWorkflow'
import { Crop, Maximize, Grid3x3, Frame, Scissors, RotateCw, Move, Square, MessageSquare, Check, Shuffle, Copy, Sliders, Undo2, Redo2, Hash, ZoomIn, ZoomOut, Eye, Ruler, Maximize2, Minimize2, ChevronLeft as ChevLeft, ChevronRight as ChevRight } from 'lucide-react'

type M = {
  id: string; drive_file_id: string; thumbnail_link: string | null
  media_type: 'PHOTO' | 'VIDEO'; guest_tag_name: string | null
  album_choice: 'KEPT' | 'DISCARDED' | null; album_moment: string | null
}

const isDrive = (m: M) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-') && !m.drive_file_id.startsWith('guest:')
const thumbUrl = (m: M) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w800` : (m.thumbnail_link ?? ''))
const hiUrl = (m: M) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

// Cornice della foto a piena tavola (frame 0..1 dello spread); assente = piena tavola.
function spreadFrameOf(sp?: { frame?: { x: number; y: number; w: number; h: number } } | null) {
  return sp?.frame ?? { x: 0, y: 0, w: 1, h: 1 }
}
// Render della foto-spread alla sua cornice (riusato in miniature/anteprima/cliente).
function SpreadImg({ src, cell, frame, pointerNone }: { src: string; cell: Cell; frame: { x: number; y: number; w: number; h: number }; pointerNone?: boolean }) {
  return (
    <div className={`absolute overflow-hidden ${pointerNone ? 'pointer-events-none' : ''}`} style={{ left: `${frame.x * 100}%`, top: `${frame.y * 100}%`, width: `${frame.w * 100}%`, height: `${frame.h * 100}%` }}>
      <img src={src} alt="" draggable={false} style={coverImgStyle(cell)} />
    </div>
  )
}

function AlbumDesignerInner() {
  const { entryId } = useParams<{ entryId: string }>()
  const { profile } = useAuth()
  const isCouple = profile?.role === 'COUPLE'

  const [media, setMedia] = useState<M[]>([])
  const [format, setFormat] = useState<string>(DEFAULT_FORMAT)
  const [status, setStatus] = useState<string>('DRAFT')
  const [pages, setPages] = useState<AlbumPage[]>([])
  const [title, setTitle] = useState('')
  const [step, setStep] = useState<'select' | 'design'>('select')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [activePage, setActivePage] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [bleed, setBleed] = useState(false)            // abbondanza per la stampa
  const [aspects, setAspects] = useState<Record<string, number>>({}) // aspetto naturale per crop
  const [currentPageId, setCurrentPageId] = useState<string | null>(null) // pagina aperta nel canvas grande
  const [gridOn, setGridOn] = useState(false)          // griglia stile Photoshop
  const [marginsOn, setMarginsOn] = useState(true)     // guide margini
  const [pageNums, setPageNums] = useState(false)      // numeri di pagina
  const [zoom, setZoom] = useState(1)                  // zoom del canvas
  const [rulerOn, setRulerOn] = useState(false)        // righello (cm) attorno alla tavola
  const [guidesV, setGuidesV] = useState<number[]>([]) // guide verticali (frazione larghezza tavola) stile Photoshop
  const [guidesH, setGuidesH] = useState<number[]>([]) // guide orizzontali (frazione altezza tavola)
  const [fullscreen, setFullscreen] = useState(false)  // lavoro a piena pagina (nasconde la barra menu)
  const rootRef = useRef<HTMLDivElement>(null)
  const spreadRef = useRef<HTMLDivElement>(null)
  const guideDrag = useRef<{ axis: 'v' | 'h'; index: number } | null>(null)
  const [selGuide, setSelGuide] = useState<{ axis: 'v' | 'h'; index: number } | null>(null) // righello selezionato (Canc per eliminarlo)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasBox, setCanvasBox] = useState({ w: 0, h: 0 }) // area disponibile per la tavola (per il fit)
  const [previewOpen, setPreviewOpen] = useState(false) // anteprima sfogliabile
  const [previewIdx, setPreviewIdx] = useState(0)
  // vista cliente mobile-first
  const [clientIdx, setClientIdx] = useState(0)
  const [clientReqOpen, setClientReqOpen] = useState(false)
  const [zoomSpread, setZoomSpread] = useState<number | null>(null)
  const [reqListOpen, setReqListOpen] = useState(false)
  const [cropFor, setCropFor] = useState<number | null>(null) // slot in ritaglio
  const [selEl, setSelEl] = useState<string | null>(null)      // elemento libero "primario" (pannello/crop)
  const [multiSel, setMultiSel] = useState<string[]>([])        // selezione multipla (Shift) sulla tavola
  const [layouts, setLayouts] = useState<SavedLayout[]>(() => listLayouts()) // layout personalizzati salvati
  const [cropElId, setCropElId] = useState<string | null>(null) // elemento libero in ritaglio
  const [cropSpread, setCropSpread] = useState<string | null>(null) // id pagina-sx in ritaglio foto a piena tavola
  // move/resize della cornice spread (trasformazione libera su due tavole)
  const spreadDrag = useRef<{ kind: 'move' | 'nw' | 'ne' | 'sw' | 'se'; sx: number; sy: number; w: number; h: number; id: string; f: { x: number; y: number; w: number; h: number } } | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)   // indicatore autosave
  const loadedRef = useRef(false)
  const autoTimer = useRef<number | null>(null)
  const [revOpen, setRevOpen] = useState(false)                 // popup richieste modifiche
  const [revList, setRevList] = useState<Array<{ id: string; author_name: string | null; page_index: number | null; body: string; status: string; created_at: string }>>([])
  const [revBody, setRevBody] = useState('')
  const [revPageRef, setRevPageRef] = useState(false)

  const role = albumRoleOf(profile?.role)
  const action = primaryAction(role, status as never)
  const lite = role === 'couple' // il cliente vede la versione light (non decide la struttura)
  const [exportOpen, setExportOpen] = useState(false)   // dialogo qualità di stampa
  const [exportDpi, setExportDpi] = useState(300)
  const [cutMarks, setCutMarks] = useState(false)

  const mediaById = useMemo(() => new Map(media.map((m) => [m.id, m])), [media])
  const photos = useMemo(() => media.filter((m) => m.media_type === 'PHOTO'), [media])
  const kept = useMemo(() => photos.filter((m) => m.album_choice === 'KEPT'), [photos])

  const load = useCallback(async () => {
    if (!entryId) return
    setLoading(true)
    try {
      const [pr, mr, er] = await Promise.all([
        (supabase.from as any)('album_projects').select('format_key, status, layout').eq('entry_id', entryId).maybeSingle(),
        (supabase.from as any)('gallery_media').select('id, drive_file_id, thumbnail_link, media_type, guest_tag_name, album_choice, album_moment').eq('entry_id', entryId),
        (supabase.from as any)('calendar_entries').select('title').eq('id', entryId).maybeSingle(),
      ])
      const proj = (pr as any)?.data, med = (mr as any)?.data, ent = (er as any)?.data
      setMedia((med as M[]) ?? [])
      setTitle((ent as { title?: string } | null)?.title ?? 'Album')
      if (proj) {
        setFormat((proj as any).format_key ?? DEFAULT_FORMAT)
        setStatus((proj as any).status ?? 'DRAFT')
        const lay = (proj as any).layout as { pages?: AlbumPage[]; bleed?: boolean } | null
        if (typeof lay?.bleed === 'boolean') setBleed(lay.bleed)
        if (lay?.pages?.length) { setPages(lay.pages); setStep('design') }
      }
    } catch (e) { console.error('album load', e) } finally { setLoading(false) }
  }, [entryId])
  useEffect(() => { void load() }, [load])

  // Misura l'aspetto naturale delle foto KEPT (serve al crop fedele in anteprima).
  useEffect(() => {
    for (const m of kept) {
      if (aspects[m.id]) continue
      const url = m.thumbnail_link && !m.drive_file_id.startsWith('demo-') ? thumbUrl(m) : (m.thumbnail_link ?? thumbUrl(m))
      if (!url) continue
      const img = new Image()
      img.onload = () => setAspects((a) => (a[m.id] ? a : { ...a, [m.id]: img.naturalWidth / Math.max(1, img.naturalHeight) }))
      img.src = url
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kept])

  // Pagina aperta nel canvas grande: default alla prima, sempre valida.
  useEffect(() => {
    if (step !== 'design') return
    if (currentPageId && pages.some((p) => p.id === currentPageId)) return
    setCurrentPageId(pages[0]?.id ?? null)
  }, [step, pages, currentPageId])

  useEffect(() => { if (!loading) loadedRef.current = true }, [loading])

  // ── UNDO / REDO (cronologia delle pagine) ──────────────────────────────────
  const histPast = useRef<AlbumPage[][]>([])
  const histFuture = useRef<AlbumPage[][]>([])
  const prevPagesRef = useRef<AlbumPage[]>([])
  const skipHist = useRef(false)
  const [, forceHist] = useState(0)
  useEffect(() => {
    if (skipHist.current) { skipHist.current = false; prevPagesRef.current = pages; return }
    if (loadedRef.current && prevPagesRef.current !== pages && prevPagesRef.current.length) {
      histPast.current.push(prevPagesRef.current)
      if (histPast.current.length > 60) histPast.current.shift()
      histFuture.current = []
    }
    prevPagesRef.current = pages
    forceHist((n) => n + 1)
  }, [pages])
  function undo() { if (!histPast.current.length) return; histFuture.current.push(pages); const p = histPast.current.pop()!; skipHist.current = true; setPages(p); forceHist((n) => n + 1) }
  function redo() { if (!histFuture.current.length) return; histPast.current.push(pages); const p = histFuture.current.pop()!; skipHist.current = true; setPages(p); forceHist((n) => n + 1) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      const k = e.key.toLowerCase()
      const mod = e.metaKey || e.ctrlKey
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (mod && k === 'y') { e.preventDefault(); redo(); return }
      // ── scorciatoie editor (stile Canva) ──
      const cur = pages.find((p) => p.id === currentPageId)
      const free = cur?.mode === 'free'
      if (mod && k === 'a' && free) { e.preventDefault(); selectAllFree(); return }
      if (mod && k === 'd') { e.preventDefault(); duplicateSel(); return }
      const sel = multiSel.length || selEl
      if (k === 'delete' || k === 'backspace') {
        // priorità al RIGHELLO selezionato (linea guida blu): Canc lo elimina
        if (selGuide) { e.preventDefault(); removeGuide(selGuide.axis, selGuide.index); setSelGuide(null); return }
        if (sel) { e.preventDefault(); deleteSel(); return }
      }
      // ESC: prima deseleziona il righello; poi cancella la/e foto selezionata/e
      if (k === 'escape') { if (selGuide) { setSelGuide(null); return } if (sel) { e.preventDefault(); deleteSel() } else { selectEl(null) }; return }
      // frecce: sposta la selezione (Shift = passo grande). 1 cella griglia ≈ 0.04
      if (free && sel && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) {
        e.preventDefault(); const s = e.shiftKey ? 0.04 : 0.005
        nudgeSel(k === 'arrowleft' ? -s : k === 'arrowright' ? s : 0, k === 'arrowup' ? -s : k === 'arrowdown' ? s : 0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, currentPageId, multiSel, selEl, selGuide])
  // AUTOSAVE: i lavori di impaginazione si salvano da soli (debounce 1.5s dopo ogni modifica).
  useEffect(() => {
    if (!loadedRef.current || step !== 'design' || !entryId) return
    if (autoTimer.current) window.clearTimeout(autoTimer.current)
    autoTimer.current = window.setTimeout(() => { void save(undefined, true) }, 1500)
    return () => { if (autoTimer.current) window.clearTimeout(autoTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages, format, bleed, step, entryId])

  // ── selezione guidata ──────────────────────────────────────────────────────
  async function toggleKeep(m: M) {
    const next = m.album_choice === 'KEPT' ? 'DISCARDED' : 'KEPT'
    setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, album_choice: next } : x)))
    await (supabase.rpc as any)('set_album_choice', { p_media: m.id, p_choice: next })
  }
  async function setMoment(m: M, moment: string) {
    setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, album_moment: moment || null } : x)))
    await (supabase.rpc as any)('album_set_moments', { p_items: [{ id: m.id, moment }] })
  }

  const perMoment = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of kept) { const k = m.album_moment ?? '_'; map.set(k, (map.get(k) ?? 0) + 1) }
    return map
  }, [kept])
  const missingMin = MOMENTS.filter((mm) => (perMoment.get(mm.key) ?? 0) < mm.min)
  const untagged = kept.filter((m) => !m.album_moment).length
  const total = kept.length
  const okRange = total >= ALBUM_MIN_PHOTOS && total <= ALBUM_MAX_PHOTOS

  function generate() {
    const sel = kept.map((m) => ({ id: m.id, moment: m.album_moment }))
    if (sel.length === 0) { toast.error('Seleziona prima le foto'); return }
    setPages(autoLayout(sel, format).pages)
    setStep('design')
    toast.success('Impaginazione generata — ora puoi rifinirla')
  }

  // ── editor pagine ───────────────────────────────────────────────────────────
  // CONTEGGIO PRECISO delle foto usate (badge ×N + sfumatura "già inserita").
  // Regole per non sbagliare il conto:
  //  • si conta per TAVOLA: una foto a piena tavola COPRE lo spread → conta solo lei,
  //    non gli slot/elementi sottostanti (che non si vedono).
  //  • si conta solo il contenuto REALE di ogni pagina secondo la sua modalità:
  //    free → gli elementi liberi; template → gli slot (mediaIds). Così una pagina
  //    convertita in libera non conta due volte la stessa foto (mediaIds "stantii").
  const usageCount = useMemo(() => {
    const c = new Map<string, number>()
    const bump = (id?: string | null) => { if (id) c.set(id, (c.get(id) ?? 0) + 1) }
    for (let k = 0; k < pages.length; k += 2) {
      const left = pages[k], right = pages[k + 1]
      const spreadMid = left?.spreadImage?.mediaId ?? right?.spreadImage?.mediaId
      if (spreadMid) { bump(spreadMid); continue }
      for (const pg of [left, right]) {
        if (!pg) continue
        if (pg.mode === 'free') { for (const e of pg.elements ?? []) bump(e.mediaId) }
        else { for (const id of pg.mediaIds) bump(id) }
      }
    }
    return c
  }, [pages])
  // tutte le foto già piazzate = chiavi del conteggio (coerente al 100% col badge)
  const placedIds = useMemo(() => new Set(usageCount.keys()), [usageCount])
  // a sinistra: TUTTE le foto del progetto — opache se già usate, nitide se ancora da usare
  const trayMedia = useMemo(() => {
    const map = new Map(kept.map((m) => [m.id, m]))
    for (const id of placedIds) { if (!map.has(id)) { const m = mediaById.get(id); if (m) map.set(id, m) } }
    return [...map.values()]
  }, [kept, placedIds, mediaById])

  function updatePage(id: string, fn: (p: AlbumPage) => AlbumPage) {
    setPages((arr) => arr.map((p) => (p.id === id ? fn(p) : p)))
  }
  function placeInto(pageId: string, slot: number | null, mediaId: string) { updatePage(pageId, (p) => placeInPage(p, slot, mediaId)) }
  // Scambia le foto di due riquadri (template). Le CELLE (ritaglio) restano sui rispettivi
  // slot → ogni foto eredita il ritaglio del riquadro in cui finisce.
  function swapSlots(pageId: string, a: number, b: number) {
    updatePage(pageId, (p) => { const ids = [...p.mediaIds]; const t = ids[a]; ids[a] = ids[b]!; ids[b] = t!; return { ...p, mediaIds: ids } })
  }
  function clearSlot(pageId: string, slot: number) { updatePage(pageId, (p) => clearSlotInPage(p, slot)) }
  function updateCell(pageId: string, slot: number, partial: Partial<Cell>) { updatePage(pageId, (p) => setCell(p, slot, partial)) }
  function setTemplate(pageId: string, t: TemplateKey) { updatePage(pageId, (p) => ({ ...setPageTemplate(p, t), mode: 'template' as const })) }
  function cycleLayout(pageId: string) { updatePage(pageId, (p) => ({ ...setPageTemplate(p, cycleTemplate(p.template, p.mediaIds.length)), mode: 'template' as const })) }
  function duplicatePage(pageId: string) {
    const src = pages.find((p) => p.id === pageId); if (!src) return
    const copy: AlbumPage = { ...src, id: newPage().id, cells: src.cells ? src.cells.map((c) => (c ? { ...c } : c)) : undefined, elements: src.elements ? src.elements.map((e) => ({ ...e, id: newPage().id, cell: { ...e.cell } })) : undefined }
    setPages((a) => insertPageAfter(a, pageId, () => copy)); setCurrentPageId(copy.id)
  }
  // ── TAVOLE (spread = 2 pagine affiancate, come in stampa) ───────────────────
  function addSpread() { const a = newPage(), b = newPage(); setPages((arr) => [...arr, a, b]); setCurrentPageId(a.id) }
  function delSpread(si: number) { setPages((arr) => arr.filter((_, i) => i !== si * 2 && i !== si * 2 + 1)); setCurrentPageId(null) }
  function moveSpread(si: number, dir: -1 | 1) {
    setPages((arr) => { const blocks: AlbumPage[][] = []; for (let k = 0; k < arr.length; k += 2) blocks.push(arr.slice(k, k + 2)); const j = si + dir; if (j < 0 || j >= blocks.length) return arr; const t = blocks[si]!; blocks[si] = blocks[j]!; blocks[j] = t; return blocks.flat() })
  }
  // ── FOTO A PIENA TAVOLA (una foto su entrambe le pagine, attraversa il dorso) ──
  // Vive sulla pagina SINISTRA dello spread. `leftId` = id pagina sinistra (indice pari).
  function setSpreadImg(leftId: string, mediaId: string, cell?: Cell) {
    updatePage(leftId, (p) => ({ ...p, spreadImage: { mediaId, cell: cell ?? DEFAULT_CELL } }))
  }
  function clearSpreadImg(leftId: string) { updatePage(leftId, (p) => ({ ...p, spreadImage: null })) }
  function updateSpreadCell(leftId: string, patch: Partial<Cell>) {
    updatePage(leftId, (p) => (p.spreadImage ? { ...p, spreadImage: { ...p.spreadImage, cell: { ...p.spreadImage.cell, ...patch } } } : p))
  }
  // trasformazione libera (frame 0..1 dello spread): sposta/ridimensiona su due tavole
  function updateSpreadFrame(leftId: string, frame: { x: number; y: number; w: number; h: number }) {
    updatePage(leftId, (p) => (p.spreadImage ? { ...p, spreadImage: { ...p.spreadImage, frame } } : p))
  }
  // Estende su due pagine la foto selezionata (o la prima foto della tavola corrente).
  function makeSpreadFromActive(leftId: string, pair: AlbumPage[]) {
    let mediaId: string | undefined; let cell: Cell | undefined
    if (selEl) { const e = pair.flatMap((p) => p.elements ?? []).find((x) => x.id === selEl); if (e) { mediaId = e.mediaId; cell = e.cell } }
    if (!mediaId) for (const p of pair) {
      const e = (p.elements ?? []).find((x) => x.mediaId); if (e) { mediaId = e.mediaId; cell = e.cell; break }
      const idx = (p.mediaIds ?? []).findIndex(Boolean); if (idx >= 0) { mediaId = p.mediaIds[idx]; cell = p.cells?.[idx] ?? undefined; break }
    }
    if (!mediaId) { toast.error('Aggiungi prima una foto nella tavola, poi premi “Doppia pagina”.'); return }
    setSpreadImg(leftId, mediaId, cell); toast.success('Foto estesa su entrambe le pagine.')
  }
  // ── elementi liberi (stile Canva) ──────────────────────────────────────────
  function convertToFree(pageId: string) { updatePage(pageId, (p) => ({ ...p, mode: 'free' as const, bg: p.bg ?? '#ffffff', elements: (p.elements && p.elements.length ? p.elements : toFreeElements(p, format)) })) }
  function freeUpdate(pageId: string, id: string, patch: Partial<FreeEl>) { updatePage(pageId, (p) => ({ ...p, elements: updateFreeEl(p.elements ?? [], id, patch) })) }
  function freeAdd(pageId: string, mediaId: string) { updatePage(pageId, (p) => ({ ...p, mode: 'free' as const, bg: p.bg ?? '#ffffff', elements: bringToFront([...(p.elements ?? []), newFreeEl(mediaId)], 'x') })) }
  function freeRemove(pageId: string, id: string) { updatePage(pageId, (p) => ({ ...p, elements: removeFreeEl(p.elements ?? [], id) })); if (selEl === id) setSelEl(null); setMultiSel((s) => s.filter((x) => x !== id)) }
  function freeDuplicate(pageId: string, id: string) {
    const src = pages.find((p) => p.id === pageId)?.elements?.find((e) => e.id === id); if (!src) return
    const copy = { ...src, id: newPage().id, x: Math.min(0.9, src.x + 0.04), y: Math.min(0.9, src.y + 0.04), cell: { ...src.cell } }
    updatePage(pageId, (p) => ({ ...p, elements: bringToFront([...(p.elements ?? []), copy], copy.id) })); setSelEl(copy.id)
  }
  function setPageBg(pageId: string, color: string) { updatePage(pageId, (p) => ({ ...p, bg: color })) }
  // ── layout personalizzati (salva la disposizione corrente, riapplicala dove vuoi) ──
  function saveCurLayout() {
    const page = pages.find((p) => p.id === currentPageId); if (!page) { toast.error('Apri prima una pagina'); return }
    const frames = pageToFrames(page); if (!frames.length) { toast.error('La pagina è vuota'); return }
    setLayouts(saveLayout(`Layout ${frames.length} foto`, frames)); toast.success('Layout salvato tra i tuoi')
  }
  function applyLayoutCur(l: SavedLayout) { if (currentPageId) updatePage(currentPageId, (p) => applyLayout(p, l.frames)) }
  function removeLayout(id: string) { setLayouts(deleteLayout(id)) }
  // ── selezione multipla (Shift) + scorciatoie tastiera stile Canva ───────────
  function selectEl(id: string | null, additive = false) {
    setSelGuide(null) // selezionando/deselezionando una foto, il righello non è più "armato"
    if (id == null) { setSelEl(null); setMultiSel([]); return }
    if (additive) { setMultiSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); setSelEl(id) }
    else { setSelEl(id); setMultiSel([id]) }
  }
  function freeUpdateMany(pageId: string, patches: { id: string; patch: Partial<FreeEl> }[]) {
    updatePage(pageId, (p) => { let els = p.elements ?? []; for (const { id, patch } of patches) els = updateFreeEl(els, id, patch); return { ...p, elements: els } })
  }
  const selIds = () => (multiSel.length ? multiSel : selEl ? [selEl] : [])
  function nudgeSel(dx: number, dy: number) {
    if (!currentPageId) return; const ids = selIds(); if (!ids.length) return
    updatePage(currentPageId, (p) => ({ ...p, elements: moveManyBy(p.elements ?? [], ids, dx, dy) }))
  }
  function deleteSel() {
    if (!currentPageId) return; const ids = selIds(); if (!ids.length) return
    updatePage(currentPageId, (p) => ({ ...p, elements: removeManyFree(p.elements ?? [], ids) })); setSelEl(null); setMultiSel([])
  }
  function duplicateSel() {
    if (!currentPageId) return; const ids = selIds(); if (!ids.length) return
    const page = pages.find((p) => p.id === currentPageId); if (!page) return
    const copies = (page.elements ?? []).filter((e) => ids.includes(e.id)).map((e) => ({ ...e, id: newPage().id, x: Math.min(0.92, e.x + 0.03), y: Math.min(0.92, e.y + 0.03), cell: { ...e.cell } }))
    if (!copies.length) return
    updatePage(currentPageId, (p) => ({ ...p, elements: [...(p.elements ?? []), ...copies] })); setMultiSel(copies.map((c) => c.id)); setSelEl(copies[copies.length - 1]!.id)
  }
  function selectAllFree() {
    if (!currentPageId) return; const page = pages.find((p) => p.id === currentPageId); if (!page || page.mode !== 'free') return
    const ids = (page.elements ?? []).map((e) => e.id); setMultiSel(ids); setSelEl(ids[ids.length - 1] ?? null)
  }
  // riordino libero delle TAVOLE: inserimento alla posizione esatta indicata dal drop
  // (sinistra/destra della tavola di destinazione).
  function moveSpreadInsert(from: number, to: number) {
    setPages((arr) => {
      const blocks: AlbumPage[][] = []; for (let k = 0; k < arr.length; k += 2) blocks.push(arr.slice(k, k + 2))
      if (from < 0 || from >= blocks.length) return arr
      const [moved] = blocks.splice(from, 1)
      const adj = to > from ? to - 1 : to
      blocks.splice(Math.max(0, Math.min(blocks.length, adj)), 0, moved!)
      return blocks.flat()
    })
  }
  function delPage(id: string) { setPages((a) => removePage(a, id)); if (activePage === id) setActivePage(null) }

  async function save(nextStatus?: string, silent = false) {
    if (!entryId) return
    if (!silent) setBusy(true)
    try {
      const st = nextStatus ?? status
      const { data, error } = await (supabase.rpc as any)('album_project_save', {
        p_entry: entryId, p_gallery: null, p_format: format, p_status: st, p_layout: { pages, bleed },
      })
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message ?? 'errore')
      if (nextStatus) setStatus(nextStatus)
      setSavedAt(Date.now())
      if (!silent) toast.success('Album salvato')
    } catch (e) { if (!silent) toast.error((e as Error).message) } finally { if (!silent) setBusy(false) }
  }

  // ── richieste di modifica (cliente ↔ fotografo) ────────────────────────────
  const loadRevs = useCallback(async () => {
    if (!entryId) return
    const { data } = await (supabase.from as any)('album_revision_requests').select('id, author_name, page_index, body, status, created_at').eq('entry_id', entryId).order('created_at', { ascending: false })
    setRevList((data as typeof revList) ?? [])
  }, [entryId])
  useEffect(() => { void loadRevs() }, [loadRevs])
  const openRevs = revList.filter((r) => r.status === 'OPEN').length
  async function sendRev() {
    if (!revBody.trim() || !entryId) return
    const pageNum = revPageRef && currentPageId ? (pages.findIndex((p) => p.id === currentPageId) + 1) : null
    const { error } = await (supabase.from as any)('album_revision_requests').insert({ entry_id: entryId, body: revBody.trim(), page_index: pageNum })
    if (error) { toast.error(error.message); return }
    toast.success('Richiesta inviata al fotografo'); setRevBody(''); setRevPageRef(false); await loadRevs()
  }
  async function resolveRev(id: string) { await (supabase.from as any)('album_revision_requests').update({ status: 'DONE' }).eq('id', id); await loadRevs() }
  async function sendClientReq() {
    if (!revBody.trim() || !entryId) return
    const { error } = await (supabase.from as any)('album_revision_requests').insert({ entry_id: entryId, body: revBody.trim(), page_index: clientIdx * 2 + 1 })
    if (error) { toast.error(error.message); return }
    toast.success('Richiesta inviata al fotografo'); setRevBody(''); setClientReqOpen(false); await loadRevs()
  }

  const exportRef = useRef<HTMLDivElement>(null)
  async function doExport(kind: 'pdf' | 'spread' | 'jpg' | 'jpgspread') {
    if (pages.length === 0) { toast.error('Nessuna pagina da esportare'); return }
    setExporting(true)
    try {
      // Alta risoluzione: chiediamo un "grant" e tiriamo l'ORIGINALE da Drive via proxy
      // (in app si lavora a bassa qualità; in export si stampa in alta). Fallback ai thumbnail.
      let grant: string | null = null
      try { const { data } = await (supabase.rpc as any)('album_export_grant', { p_entry: entryId }); grant = (data as string) ?? null } catch { grant = null }
      const placedDrive = pages.some((p) => p.mediaIds.concat((p.elements ?? []).map((e) => e.mediaId)).some((id) => { const m = mediaById.get(id); return m && isDrive(m) }))
      if (placedDrive && !grant) toast.message('Per la massima qualità collega Google Drive: senza, esporto dalle anteprime.')
      const SB = import.meta.env.VITE_SUPABASE_URL
      const AK = import.meta.env.VITE_SUPABASE_ANON_KEY
      const resolve = (id: string) => {
        const m = mediaById.get(id); if (!m) return ''
        if (grant && isDrive(m)) return hiResProxyUrl(SB, AK, grant, id)
        return hiUrl(m)
      }
      const base = (title || 'album').toLowerCase().replace(/\s+/g, '-')
      // con l'originale Drive possiamo stampare in alta: 300 dpi per le pagine, 220 per JPG/spread
      if (kind === 'jpg' || kind === 'jpgspread') await exportAlbumJpgZip(pages, format, resolve, { filename: `${base}-${kind === 'jpgspread' ? 'tavole' : 'pagine'}-jpg.zip`, dpi: Math.min(exportDpi, 240), pageNumbers: pageNums, mode: kind === 'jpgspread' ? 'spreads' : 'pages' })
      else await exportAlbumPdf(pages, format, resolve, { mode: kind === 'spread' ? 'spreads' : 'pages', filename: `${base}-${kind === 'spread' ? 'tavole' : 'pagine'}.pdf`, bleed: kind === 'pdf' && bleed, dpi: kind === 'spread' ? Math.min(exportDpi, 200) : exportDpi, cutMarks: kind === 'pdf' && cutMarks && bleed, pageNumbers: pageNums })
      toast.success('Export pronto')
    } catch (e) { toast.error('Export non riuscito: ' + (e as Error).message) } finally { setExporting(false) }
  }

  // ── piena pagina (nasconde la barra menu a sinistra) ────────────────────────
  function toggleFullscreen() {
    const el = rootRef.current; if (!el) return
    if (!document.fullscreenElement) void el.requestFullscreen?.().catch(() => setFullscreen((v) => !v))
    else void document.exitFullscreen?.()
  }
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])
  // misura l'area canvas così la tavola può FITTARE (zoom 100% = adattata; filmstrip e strumenti sempre visibili)
  useEffect(() => {
    const el = canvasRef.current; if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => setCanvasBox({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure); ro.observe(el); measure()
    return () => ro.disconnect()
  }, [step, lite])

  // ── guide righello (stile Photoshop): clic sul righello = nuova guida; trascina per spostare; doppio clic = rimuovi ──
  function addGuide(axis: 'v' | 'h', pos: number) {
    const p = Math.min(1, Math.max(0, pos))
    if (axis === 'v') setGuidesV((g) => [...g, p]); else setGuidesH((g) => [...g, p])
  }
  function startGuideDrag(e: React.PointerEvent, axis: 'v' | 'h', index: number) {
    e.stopPropagation(); guideDrag.current = { axis, index }; setSelGuide({ axis, index })
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function moveGuideDrag(e: React.PointerEvent) {
    const d = guideDrag.current; const el = spreadRef.current; if (!d || !el) return
    const r = el.getBoundingClientRect()
    const pos = Math.min(1, Math.max(0, d.axis === 'v' ? (e.clientX - r.left) / Math.max(1, r.width) : (e.clientY - r.top) / Math.max(1, r.height)))
    if (d.axis === 'v') setGuidesV((g) => g.map((v, i) => (i === d.index ? pos : v)))
    else setGuidesH((g) => g.map((v, i) => (i === d.index ? pos : v)))
  }
  function endGuideDrag() { guideDrag.current = null }
  function removeGuide(axis: 'v' | 'h', index: number) {
    if (axis === 'v') setGuidesV((g) => g.filter((_, i) => i !== index)); else setGuidesH((g) => g.filter((_, i) => i !== index))
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>

  const asp = pageAspect(format)
  const fmt = getFormat(format)
  const currentPage = pages.find((p) => p.id === currentPageId) ?? null
  // TAVOLE: lavoriamo a spread (2 pagine). La tavola corrente contiene la pagina selezionata.
  const curIdx = currentPage ? pages.findIndex((p) => p.id === currentPage.id) : -1
  const spreadStart = curIdx >= 0 ? curIdx - (curIdx % 2) : 0
  const spreadPages = (curIdx >= 0 ? [pages[spreadStart], pages[spreadStart + 1]] : []).filter(Boolean) as AlbumPage[]
  const spreads: AlbumPage[][] = []
  for (let i = 0; i < pages.length; i += 2) spreads.push(pages.slice(i, i + 2))
  const activeSpread = Math.floor(spreadStart / 2)
  // altezza della tavola che FITTA l'area disponibile (sia in larghezza che in altezza), poi scalata dallo zoom
  const spreadCount = spreadPages.length || 1
  const fitH = canvasBox.h && canvasBox.w ? Math.min(canvasBox.h, canvasBox.w / (asp * spreadCount)) * 0.96 : 0
  const spreadHpx = Math.max(180, (fitH || 560) * zoom)

  // ── VISTA CLIENTE (mobile-first, stile Canva mobile): sfoglia le tavole grandi, zoom a tutto
  //    schermo, richiedi modifiche. Sola lettura: il cliente non modifica per sbaglio la struttura. ──
  if (lite) {
    const myOpen = revList.filter((r) => r.status === 'OPEN').length
    const SpreadView = ({ pair, max }: { pair: AlbumPage[]; max: string }) => (
      <div className="relative flex bg-white shadow-xl mx-auto" style={{ aspectRatio: String(asp * pair.length), width: max }}>
        {pair.map((p) => <div key={p.id} className="h-full" style={{ aspectRatio: String(asp) }}><MiniPage page={p} formatKey={format} mediaById={mediaById} thumb={hiUrl} /></div>)}
        {pair[0]?.spreadImage && (() => { const m = mediaById.get(pair[0]!.spreadImage!.mediaId); return m ? <SpreadImg src={hiUrl(m)} cell={pair[0]!.spreadImage!.cell} frame={spreadFrameOf(pair[0]!.spreadImage)} /> : null })()}
        {pair.length === 2 && <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-black/10 pointer-events-none" />}
      </div>
    )
    return (
      <div className="min-h-screen flex flex-col bg-[rgb(var(--bg-sunken))]">
        <header className="sticky top-0 z-20 bg-[rgb(var(--bg))] border-b border-[rgb(var(--border))] px-3 py-2 flex items-center gap-2">
          <Link to="/couple" className="p-1.5 -ml-1 text-[rgb(var(--fg-muted))]"><ArrowLeft size={20} /></Link>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base truncate leading-tight">{title}</p>
            <p className="text-[11px] text-[rgb(var(--fg-muted))]">Il tuo album · {statusLabel(status)}</p>
          </div>
          <button onClick={() => setReqListOpen(true)} className="relative text-xs px-2.5 py-1.5 rounded-full border border-[rgb(var(--border))] flex items-center gap-1"><MessageSquare size={13} /> Richieste{myOpen ? <span className="ml-0.5 h-4 min-w-4 px-1 rounded-full bg-[rgb(var(--gold-500))] text-white text-[10px] flex items-center justify-center">{myOpen}</span> : null}</button>
        </header>

        {spreads.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-[rgb(var(--fg-muted))]">
            <Eye size={40} className="opacity-30" />
            <p className="mt-3 font-medium text-[rgb(var(--fg))]">L'album non è ancora pronto</p>
            <p className="text-sm mt-1">Appena il fotografo condivide le tavole, le vedrai qui e potrai chiedere le modifiche che vuoi.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory"
              onScroll={(e) => { const el = e.currentTarget; setClientIdx(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))) }}>
              {spreads.map((pair, si) => (
                <div key={si} className="shrink-0 w-full snap-center flex items-center justify-center p-4">
                  <button onClick={() => setZoomSpread(si)} className="w-full" title="Tocca per ingrandire"><SpreadView pair={pair} max="min(94vw, 680px)" /></button>
                </div>
              ))}
            </div>
            <div className="sticky bottom-0 bg-[rgb(var(--bg))] border-t border-[rgb(var(--border))] px-4 py-2.5 flex items-center gap-3">
              <span className="text-xs text-[rgb(var(--fg-muted))] tabular-nums w-20">Tav. {clientIdx + 1}/{spreads.length}</span>
              <div className="flex-1 flex justify-center gap-1">{spreads.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === clientIdx ? 'w-4 bg-[rgb(var(--gold-500))]' : 'w-1.5 bg-[rgb(var(--border))]'}`} />)}</div>
              <Button variant="gold" size="sm" onClick={() => setClientReqOpen(true)}><MessageSquare size={14} /> Richiedi modifica</Button>
            </div>
          </>
        )}

        {/* zoom a tutto schermo della tavola */}
        {zoomSpread != null && spreads[zoomSpread] && (
          <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col" onClick={() => setZoomSpread(null)}>
            <div className="flex items-center justify-between px-4 py-2 text-white" onClick={(e) => e.stopPropagation()}>
              <span className="text-sm">Tavola {zoomSpread + 1}</span>
              <div className="flex items-center gap-2">
                <Button variant="gold" size="sm" onClick={() => { setClientIdx(zoomSpread); setZoomSpread(null); setClientReqOpen(true) }}><MessageSquare size={14} /> Modifica</Button>
                <button onClick={() => setZoomSpread(null)} className="p-1.5 rounded hover:bg-white/10"><X size={20} className="text-white" /></button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <SpreadView pair={spreads[zoomSpread]!} max="min(180vw, 1400px)" />
            </div>
            <p className="text-center text-white/60 text-xs pb-3">Scorri per vedere i dettagli · tocca fuori per chiudere</p>
          </div>
        )}

        {/* foglio "richiedi modifica" */}
        {clientReqOpen && (
          <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setClientReqOpen(false)}>
            <div className="bg-[rgb(var(--bg))] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <p className="font-medium flex items-center gap-2"><MessageSquare size={16} /> Richiedi una modifica</p>
              <p className="text-xs text-[rgb(var(--fg-muted))]">Riferita alla <strong>Tavola {clientIdx + 1}</strong>. Scrivi cosa vorresti cambiare (foto, posizione, ritaglio…): il fotografo la sistema.</p>
              <textarea value={revBody} onChange={(e) => setRevBody(e.target.value)} rows={4} autoFocus placeholder="Es. Nella tavola 3, sposterei la foto grande a sinistra…" className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setClientReqOpen(false)}>Annulla</Button>
                <Button variant="gold" size="sm" disabled={!revBody.trim()} onClick={() => void sendClientReq()}>Invia al fotografo</Button>
              </div>
            </div>
          </div>
        )}

        {/* le mie richieste */}
        {reqListOpen && (
          <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setReqListOpen(false)}>
            <div className="bg-[rgb(var(--bg))] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[75vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]"><p className="font-medium">Le tue richieste</p><button onClick={() => setReqListOpen(false)}><X size={18} /></button></div>
              <div className="overflow-y-auto p-3 space-y-2">
                {revList.length === 0 ? <p className="text-sm text-[rgb(var(--fg-muted))] text-center py-6">Non hai ancora chiesto modifiche.</p>
                  : revList.map((r) => (
                    <div key={r.id} className="rounded-lg border border-[rgb(var(--border))] p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-[11px] text-[rgb(var(--fg-muted))]">{r.page_index ? `Tavola ${Math.ceil(r.page_index / 2)}` : 'Generale'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.status === 'OPEN' ? 'In attesa' : 'Fatto'}</span>
                      </div>
                      <p className="text-sm">{r.body}</p>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={rootRef} className="min-h-screen bg-[rgb(var(--bg-sunken))] overflow-auto">
      {/* header */}
      <div className="sticky top-0 z-20 bg-[rgb(var(--bg))] border-b border-[rgb(var(--border))]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link to={isCouple ? '/couple' : `/weddings/${entryId}`} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><ArrowLeft size={18} /></Link>
          <div className="min-w-0">
            <h1 className="font-display text-lg truncate">{isCouple ? 'Album' : 'Impaginatore'} — {title}</h1>
            <p className="text-[11px] text-[rgb(var(--fg-muted))]">{isCouple ? 'Visualizza l’album e richiedi le modifiche che vuoi' : 'Bozza album, rifinibile pagina per pagina'} · {statusLabel(status)}</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {!lite && <select value={format} onChange={(e) => setFormat(e.target.value)} className="text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5">
              {ALBUM_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>}
            <div className="hidden sm:flex rounded-lg border border-[rgb(var(--border))] overflow-hidden">
              <button onClick={() => setStep('select')} className={`px-3 py-1.5 text-xs ${step === 'select' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : ''}`}>1 · Selezione</button>
              <button onClick={() => setStep('design')} className={`px-3 py-1.5 text-xs ${step === 'design' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : ''}`}>2 · Impagina</button>
            </div>
          </div>
        </div>
      </div>

      {step === 'select' ? (
        <div className="max-w-7xl mx-auto px-4 py-5">
          <SelectStep
            photos={photos} kept={kept} total={total} okRange={okRange} untagged={untagged}
            missingMin={missingMin} perMoment={perMoment}
            onToggle={toggleKeep} onMoment={setMoment} onGenerate={generate} thumb={thumbUrl}
          />
        </div>
      ) : (
        <>
          {/* barra strumenti impaginatore */}
          <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 flex items-center gap-2 flex-wrap text-sm">
            {lite && <span className="text-[11px] px-2 py-1 rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]">Versione cliente · sposta/cambia le foto e scrivi le modifiche</span>}
            {!lite && <Button variant="gold" size="sm" disabled={busy} onClick={() => setPages(autoLayout(kept.map((m) => ({ id: m.id, moment: m.album_moment })), format).pages)}><Wand2 size={14} /> Auto-impagina</Button>}
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void save()}><Save size={14} /> Salva</Button>
            <span className="text-[11px] text-[rgb(var(--emerald-600))]">{savedAt ? '✓ salvato' : ''}</span>
            <Button variant="outline" size="sm" disabled={!histPast.current.length} onClick={undo} title="Annulla (⌘Z)"><Undo2 size={14} /></Button>
            <Button variant="outline" size="sm" disabled={!histFuture.current.length} onClick={redo} title="Ripeti (⌘⇧Z)"><Redo2 size={14} /></Button>
            <div className="h-5 w-px bg-[rgb(var(--border))] mx-0.5" />
            <ToolToggle on={gridOn} onClick={() => setGridOn((v) => !v)} icon={<Grid3x3 size={14} />} label="Griglia" />
            <ToolToggle on={marginsOn} onClick={() => setMarginsOn((v) => !v)} icon={<Frame size={14} />} label="Margini" />
            <ToolToggle on={pageNums} onClick={() => setPageNums((v) => !v)} icon={<Hash size={14} />} label="Numeri" />
            <ToolToggle on={rulerOn} onClick={() => setRulerOn((v) => !v)} icon={<Ruler size={14} />} label="Righello" />
            {!lite && <ToolToggle on={bleed} onClick={() => setBleed((v) => !v)} icon={<Scissors size={14} />} label="Abbondanza" />}
            {/* "Libera" è a senso unico: una volta entrati, la composizione costruita a mano
                RESTA com'è — togliendo la libera NON si torna più al preset (niente perdita
                del lavoro). Per ripartire da una griglia si usa "Nuova tavola". */}
            {!lite && currentPage && <ToolToggle on={currentPage.mode === 'free'} onClick={() => { if (currentPage.mode !== 'free') convertToFree(currentPage.id); else toast('Sei in modalità libera: la composizione resta come l’hai fatta.') }} icon={<Move size={14} />} label="Libera" />}
            {!lite && spreadPages[0] && <ToolToggle on={!!spreadPages[0]?.spreadImage} onClick={() => { const lp = spreadPages[0]!; if (lp.spreadImage) clearSpreadImg(lp.id); else makeSpreadFromActive(lp.id, spreadPages) }} icon={<Maximize size={14} />} label="Doppia pagina" />}
            <div className="inline-flex items-center gap-0.5 ml-0.5">
              <button title="Riduci" className="p-1 rounded border border-[rgb(var(--border))]" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}><ZoomOut size={13} /></button>
              <span className="text-[11px] w-9 text-center text-[rgb(var(--fg-muted))]">{Math.round(zoom * 100)}%</span>
              <button title="Ingrandisci" className="p-1 rounded border border-[rgb(var(--border))]" onClick={() => setZoom((z) => Math.min(2.5, +(z + 0.1).toFixed(2)))}><ZoomIn size={13} /></button>
            </div>
            <div className="h-5 w-px bg-[rgb(var(--border))] mx-0.5" />
            <ToolToggle on={fullscreen} onClick={toggleFullscreen} icon={fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />} label={fullscreen ? 'Esci pieno' : 'Piena pagina'} />
            <Button variant="outline" size="sm" onClick={() => { setPreviewIdx(0); setPreviewOpen(true) }}><Eye size={14} /> Anteprima</Button>
            {!lite && <Button variant="outline" size="sm" disabled={exporting} onClick={() => setExportOpen(true)}>{exporting ? <Loader2 size={14} className="animate-spin" /> : <Sliders size={14} />} Esporta…</Button>}
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void save(action.next)}>{action.label}</Button>
            <Button variant={openRevs ? 'gold' : 'outline'} size="sm" onClick={() => setRevOpen(true)}><MessageSquare size={14} /> Modifiche{openRevs ? ` (${openRevs})` : ''}</Button>
            <span className="text-xs text-[rgb(var(--fg-muted))] ml-auto">{pages.length} pag · {fmt.label} · <span className="px-1.5 py-0.5 rounded bg-[rgb(var(--bg-sunken))]">{statusLabel(status)}</span></span>
          </div>

          {/* workspace a 3 colonne + filmstrip */}
          <div className="flex h-[calc(100vh-104px)]">
            {/* foto */}
            <aside className="w-40 shrink-0 border-r border-[rgb(var(--border))] overflow-auto p-2">
              <p className="text-[11px] font-medium mb-1.5 text-[rgb(var(--fg-muted))]">Foto ({kept.length})</p>
              <div className="grid grid-cols-2 gap-1.5">
                {trayMedia.map((m) => (
                  <button key={m.id}
                    draggable onDragStart={(e) => e.dataTransfer.setData('text/media', m.id)}
                    onClick={() => { if (!currentPageId) return; if (currentPage?.mode === 'free') freeAdd(currentPageId, m.id); else placeInto(currentPageId, activeSlot, m.id) }}
                    title={getMoment(m.album_moment)?.label ?? 'senza momento'}
                    className={`relative aspect-square rounded overflow-hidden border ${placedIds.has(m.id) ? 'border-[rgb(var(--border))]' : 'border-[rgb(var(--gold-400))] ring-1 ring-[rgb(var(--gold-400))]'}`}>
                    {/* SEMPRE a colori. INSERITE: sfumate (opacità) → si capisce che sono a posto.
                        NON inserite: piene e nitide, con bordino dorato → le foto che MANCANO
                        saltano subito all'occhio. (niente bianco/nero) */}
                    <img src={thumbUrl(m)} alt="" loading="lazy"
                      className={`w-full h-full object-cover ${placedIds.has(m.id) ? 'opacity-40' : ''}`} />
                    {(() => { const n = usageCount.get(m.id) ?? 0; return n >= 1 ? (
                      <span title={n > 1 ? `Usata ${n} volte` : 'Usata 1 volta'}
                        className={`absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-bold leading-[15px] text-center text-white ${n > 1 ? 'bg-[rgb(var(--rose-500))] ring-1 ring-white' : 'bg-black/55'}`}>{n > 1 ? `×${n}` : '✓'}</span>
                    ) : null })()}
                  </button>
                ))}
              </div>
            </aside>

            {/* canvas + filmstrip */}
            <main className="flex-1 flex flex-col min-w-0 relative">
              <div ref={canvasRef} className="flex-1 min-h-0 flex p-5 overflow-auto bg-[rgb(var(--bg-sunken))]">
                <div className="m-auto">
                {spreadPages.length ? (
                  <div ref={spreadRef} onPointerMove={moveGuideDrag} onPointerUp={endGuideDrag} onPointerLeave={endGuideDrag}
                    className="relative flex items-stretch shadow-[var(--shadow-lift)] bg-[rgb(var(--border))] gap-px transition-[height]" style={{ height: `${spreadHpx.toFixed(0)}px` }}>
                    {rulerOn && <SpreadRuler cmX={(fmt.w * spreadPages.length) / 10} cmY={fmt.h / 10} onAddGuide={addGuide} />}
                    {/* guide Photoshop: linee precise trascinabili (doppio clic per rimuoverle) */}
                    {guidesV.map((g, i) => { const on = selGuide?.axis === 'v' && selGuide.index === i; return <div key={`gv${i}`} onPointerDown={(e) => startGuideDrag(e, 'v', i)} onDoubleClick={() => removeGuide('v', i)} className="absolute top-0 bottom-0 z-[45] -ml-1 w-2 cursor-ew-resize group/guide" style={{ left: `${g * 100}%` }} title="Trascina per spostare · Canc/doppio-clic per eliminare"><div className={`absolute left-1/2 -translate-x-1/2 top-0 bottom-0 ${on ? 'w-0.5 bg-rose-500' : 'w-px bg-cyan-500 group-hover/guide:w-0.5'}`} /></div> })}
                    {guidesH.map((g, i) => { const on = selGuide?.axis === 'h' && selGuide.index === i; return <div key={`gh${i}`} onPointerDown={(e) => startGuideDrag(e, 'h', i)} onDoubleClick={() => removeGuide('h', i)} className="absolute left-0 right-0 z-[45] -mt-1 h-2 cursor-ns-resize group/guide" style={{ top: `${g * 100}%` }} title="Trascina per spostare · Canc/doppio-clic per eliminare"><div className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 ${on ? 'h-0.5 bg-rose-500' : 'h-px bg-cyan-500 group-hover/guide:h-0.5'}`} /></div> })}
                    {spreadPages.map((p) => {
                      const isAct = p.id === currentPageId
                      const pnum = pageNums ? pages.findIndex((x) => x.id === p.id) + 1 : null
                      const activate = () => { if (p.id !== currentPageId) { setCurrentPageId(p.id); setActiveSlot(null); setSelEl(null); setMultiSel([]) } }
                      return (
                        <div key={p.id} onPointerDownCapture={activate} className="relative h-full" style={{ aspectRatio: String(asp) }}>
                          {p.mode === 'free' ? (
                            <FreeStage page={p} formatKey={format} bleed={bleed} gridOn={gridOn} marginsOn={marginsOn} pageNum={pnum}
                              aspects={aspects} mediaById={mediaById} thumb={thumbUrl} selEl={isAct ? selEl : null} multiSel={isAct ? multiSel : []}
                              onSelect={(id, additive) => selectEl(id, additive)} onUpdateEl={(id, patch) => freeUpdate(p.id, id, patch)}
                              onUpdateMany={(patches) => freeUpdateMany(p.id, patches)}
                              onCrop={(id) => setCropElId(id)} onRemove={(id) => freeRemove(p.id, id)} onDuplicateEl={(id) => freeDuplicate(p.id, id)}
                              onDropMedia={(id) => freeAdd(p.id, id)} />
                          ) : (
                            <PageStage page={p} formatKey={format} bleed={bleed} gridOn={gridOn} marginsOn={marginsOn} pageNum={pnum}
                              aspects={aspects} mediaById={mediaById} thumb={thumbUrl} activeSlot={isAct ? activeSlot : null}
                              onSlot={setActiveSlot} onDropMedia={(s, id) => placeInto(p.id, s, id)}
                              onClearSlot={(s) => clearSlot(p.id, s)} onCell={(s, partial) => updateCell(p.id, s, partial)} onCrop={(s) => setCropFor(s)}
                              onFree={() => convertToFree(p.id)} onSwap={(a, b) => swapSlots(p.id, a, b)} />
                          )}
                          {isAct && <div className="absolute inset-0 ring-2 ring-[rgb(var(--gold-500))] pointer-events-none" />}
                        </div>
                      )
                    })}
                    {/* FOTO A PIENA TAVOLA — LIBERA: sposta + ridimensiona (accorcia/alza) + ritaglia, sulle due tavole */}
                    {(() => {
                      const lp = spreadPages[0]; const sp = lp?.spreadImage
                      if (!lp || !sp) return null
                      const m = mediaById.get(sp.mediaId)
                      const fr = spreadFrameOf(sp)
                      const startDrag = (e: React.PointerEvent, kind: 'move' | 'nw' | 'ne' | 'sw' | 'se') => {
                        if (lite) return; e.stopPropagation(); const r = spreadRef.current!.getBoundingClientRect()
                        spreadDrag.current = { kind, sx: e.clientX, sy: e.clientY, w: r.width, h: r.height, id: lp.id, f: fr }
                        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
                      }
                      const onMove = (e: React.PointerEvent) => {
                        const d = spreadDrag.current; if (!d) return
                        const dx = (e.clientX - d.sx) / Math.max(1, d.w), dy = (e.clientY - d.sy) / Math.max(1, d.h)
                        let { x, y, w, h } = d.f; const MIN = 0.12
                        if (d.kind === 'move') { x = Math.min(1.05 - w, Math.max(-0.05, d.f.x + dx)); y = Math.min(1.05 - h, Math.max(-0.05, d.f.y + dy)) }
                        else {
                          if (d.kind.includes('e')) w = Math.max(MIN, d.f.w + dx)
                          if (d.kind.includes('s')) h = Math.max(MIN, d.f.h + dy)
                          if (d.kind.includes('w')) { w = Math.max(MIN, d.f.w - dx); x = d.f.x + (d.f.w - w) }
                          if (d.kind.includes('n')) { h = Math.max(MIN, d.f.h - dy); y = d.f.y + (d.f.h - h) }
                        }
                        updateSpreadFrame(d.id, { x, y, w, h })
                      }
                      const onUp = () => { spreadDrag.current = null }
                      return (
                        <div className="absolute inset-0 z-[44]" onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
                          onDragOver={(e) => { if (!lite && e.dataTransfer.types.includes('text/media')) e.preventDefault() }}
                          onDrop={(e) => { if (lite) return; const mid = e.dataTransfer.getData('text/media'); if (mid) { e.preventDefault(); setSpreadImg(lp.id, mid) } }}>
                          <div className="absolute" style={{ left: `${fr.x * 100}%`, top: `${fr.y * 100}%`, width: `${fr.w * 100}%`, height: `${fr.h * 100}%` }}>
                            <div className={`absolute inset-0 overflow-hidden bg-white ${lite ? '' : 'outline outline-2 outline-[rgb(var(--gold-500))]'}`}>
                              {m ? <img src={thumbUrl(m)} alt="" draggable={false} onPointerDown={(e) => startDrag(e, 'move')} className={lite ? '' : 'cursor-move touch-none'} style={coverImgStyle(sp.cell)} />
                                 : <div className="absolute inset-0 flex items-center justify-center text-sm text-[rgb(var(--fg-subtle))]">foto non disponibile</div>}
                            </div>
                            {!lite && (['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                              <div key={c} onPointerDown={(e) => startDrag(e, c)} className="absolute h-3.5 w-3.5 bg-white border border-[rgb(var(--gold-500))] rounded-sm touch-none z-[47]"
                                style={{ left: c.includes('w') ? -7 : undefined, right: c.includes('e') ? -7 : undefined, top: c.includes('n') ? -7 : undefined, bottom: c.includes('s') ? -7 : undefined, cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />
                            ))}
                          </div>
                          {!lite && (
                            <div className="absolute top-2 right-2 z-[46] flex items-center gap-1 rounded-full bg-black/60 backdrop-blur px-1 py-1">
                              <button title="Restringi (zoom foto)" onPointerDown={(e) => e.stopPropagation()} onClick={() => updateSpreadCell(lp.id, { z: Math.max(1, +(sp.cell.z - 0.1).toFixed(2)) })} className="h-6 w-6 rounded-full text-white flex items-center justify-center hover:bg-white/20"><ZoomOut size={13} /></button>
                              <button title="Ingrandisci (zoom foto)" onPointerDown={(e) => e.stopPropagation()} onClick={() => updateSpreadCell(lp.id, { z: Math.min(4, +(sp.cell.z + 0.1).toFixed(2)) })} className="h-6 w-6 rounded-full text-white flex items-center justify-center hover:bg-white/20"><ZoomIn size={13} /></button>
                              <button title="Ritaglia" onPointerDown={(e) => e.stopPropagation()} onClick={() => setCropSpread(lp.id)} className="h-6 w-6 rounded-full text-white flex items-center justify-center hover:bg-white/20"><Crop size={13} /></button>
                              <button title="Piena tavola" onPointerDown={(e) => e.stopPropagation()} onClick={() => updateSpreadFrame(lp.id, { x: 0, y: 0, w: 1, h: 1 })} className="h-6 w-6 rounded-full text-white flex items-center justify-center hover:bg-white/20"><Maximize size={13} /></button>
                              <button title="Rimuovi foto a doppia pagina" onPointerDown={(e) => e.stopPropagation()} onClick={() => clearSpreadImg(lp.id)} className="h-6 w-6 rounded-full text-white flex items-center justify-center hover:bg-white/20"><X size={14} /></button>
                            </div>
                          )}
                          {!lite && <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[46] text-[10px] text-white/90 bg-black/50 rounded px-2 py-0.5 pointer-events-none">Doppia pagina libera · trascina per spostare, angoli per ridimensionare</div>}
                        </div>
                      )
                    })()}
                    {/* filigrana del dorso (solo editor, non in stampa) */}
                    {spreadPages.length === 2 && <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-[rgba(184,146,63,.55)] pointer-events-none z-50" title="Dorso (non viene stampato)" />}
                  </div>
                ) : (
                  <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">
                    Nessuna tavola. Premi <strong>Auto-impagina</strong> o aggiungi una tavola.
                    <div className="mt-3"><Button variant="outline" size="sm" onClick={addSpread}><Plus size={14} /> Tavola vuota</Button></div>
                  </Card>
                )}
                </div>
              </div>
              {/* NAVIGATORE tavola: scorri le tavole e allarga/restringi la pagina come serve */}
              {spreads.length > 0 && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-[92px] z-30 flex items-center gap-1 rounded-full bg-[rgb(var(--bg))]/95 backdrop-blur border border-[rgb(var(--border))] shadow-lg px-1.5 py-1">
                  <button title="Tavola precedente" disabled={activeSpread <= 0} onClick={() => { const j = activeSpread - 1; if (j >= 0) setCurrentPageId((spreads[j]![0] ?? spreads[j]![1])!.id) }} className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-30"><ChevLeft size={16} /></button>
                  <span className="text-[11px] text-[rgb(var(--fg-muted))] w-16 text-center tabular-nums">Tav. {activeSpread + 1}/{spreads.length}</span>
                  <button title="Tavola successiva" disabled={activeSpread >= spreads.length - 1} onClick={() => { const j = activeSpread + 1; if (j < spreads.length) setCurrentPageId((spreads[j]![0] ?? spreads[j]![1])!.id) }} className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-sunken))] disabled:opacity-30"><ChevRight size={16} /></button>
                  <div className="h-5 w-px bg-[rgb(var(--border))] mx-0.5" />
                  <button title="Restringi" onClick={() => setZoom((z) => Math.max(0.3, +(z - 0.15).toFixed(2)))} className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-sunken))]"><ZoomOut size={16} /></button>
                  <button title="Adatta" onClick={() => setZoom(1)} className="text-[11px] w-10 text-center tabular-nums hover:underline">{Math.round(zoom * 100)}%</button>
                  <button title="Allarga" onClick={() => setZoom((z) => Math.min(3, +(z + 0.15).toFixed(2)))} className="p-1.5 rounded-full hover:bg-[rgb(var(--bg-sunken))]"><ZoomIn size={16} /></button>
                </div>
              )}
              {/* filmstrip TAVOLE (doppia pagina, come in stampa) */}
              <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 flex items-center gap-3 overflow-x-auto">
                {spreads.map((pair, si) => (
                  <SpreadThumb key={si} pair={pair} index={si} aspect={asp} active={si === activeSpread} lite={lite}
                    mediaById={mediaById} thumb={thumbUrl} formatKey={format} aspects={aspects}
                    onSelect={() => { setCurrentPageId((pair[0] ?? pair[1])!.id); setActiveSlot(null); setSelEl(null); setMultiSel([]) }}
                    onDropMedia={(pageId, id) => placeInto(pageId, null, id)}
                    onMove={(d) => moveSpread(si, d)} onDelete={() => delSpread(si)} onReorder={(from, to) => moveSpreadInsert(from, to)} />
                ))}
                {!lite && <button onClick={addSpread} className="shrink-0 h-16 rounded-lg border-2 border-dashed border-[rgb(var(--border))] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))] flex items-center justify-center px-3" style={{ aspectRatio: String(asp * 2) }} title="Aggiungi tavola"><Plus size={16} className="mr-1" /> Tavola</button>}
              </div>
            </main>

            {/* pannello proprietà */}
            <aside className="w-56 shrink-0 border-l border-[rgb(var(--border))] overflow-auto p-3">
              {currentPage && (currentPage.mode === 'free' ? (
                <FreePanel
                  page={currentPage} selEl={selEl} lite={lite}
                  onBg={(c) => setPageBg(currentPage.id, c)}
                  onElUpdate={(id, patch) => freeUpdate(currentPage.id, id, patch)}
                  onElCrop={(id) => setCropElId(id)} onElRemove={(id) => freeRemove(currentPage.id, id)}
                  onAddPage={() => addSpread()} onDelPage={() => delPage(currentPage.id)} onDuplicate={() => duplicatePage(currentPage.id)}
                  crop={(() => {
                    const el = (currentPage.elements ?? []).find((e) => e.id === selEl)
                    const m = el ? mediaById.get(el.mediaId) : undefined
                    if (!el || !m) return null
                    const fmt = getFormat(format)
                    return { src: hiUrl(m), aspect: (el.w / Math.max(0.001, el.h)) * (fmt.w / fmt.h), cell: el.cell,
                      onChange: (c) => freeUpdate(currentPage.id, el.id, { cell: c }),
                      onRotate90: (dir) => freeUpdate(currentPage.id, el.id, { rot: (((el.rot + dir * 90) % 360) + 360) % 360 }) }
                  })()}
                />
              ) : (
                <PropsPanel
                  page={currentPage} activeSlot={activeSlot} mediaById={mediaById} formatKey={format} aspects={aspects} lite={lite}
                  onTemplate={(t) => setTemplate(currentPage.id, t)} onCycle={() => cycleLayout(currentPage.id)}
                  onCell={(s, partial) => updateCell(currentPage.id, s, partial)}
                  onClearSlot={(s) => { clearSlot(currentPage.id, s); setActiveSlot(null) }}
                  onCrop={(s) => setCropFor(s)} onFree={() => convertToFree(currentPage.id)}
                  onAddPage={() => addSpread()} onDelPage={() => delPage(currentPage.id)} onDuplicate={() => duplicatePage(currentPage.id)}
                  savedLayouts={layouts} onSaveLayout={saveCurLayout} onApplyLayout={applyLayoutCur} onDeleteLayout={removeLayout}
                  crop={(() => {
                    if (activeSlot == null) return null
                    const fr = framesForPage(currentPage)[activeSlot]
                    const mid = currentPage.mediaIds[activeSlot]
                    const m = mid ? mediaById.get(mid) : undefined
                    if (!fr || !m) return null
                    const fmt = getFormat(format)
                    // template: rotazione 90° non disponibile (geometria slot) → per ruotare,
                    // doppio clic sulla foto = modalità libera (lì si ruota).
                    return { src: hiUrl(m), aspect: slotAspectOf(fr, fmt.w, fmt.h), cell: currentPage.cells?.[activeSlot] ?? DEFAULT_CELL,
                      onChange: (c) => updateCell(currentPage.id, activeSlot, c) }
                  })()}
                />
              ))}
            </aside>
          </div>

          {/* Strumento RITAGLIO: vedi tutta la foto e scegli il rettangolo */}
          {currentPage && cropFor != null && (() => {
            const fr = framesForPage(currentPage)[cropFor]
            const mid = currentPage.mediaIds[cropFor]
            const m = mid ? mediaById.get(mid) : undefined
            if (!fr || !m) return null
            return (
              <CropModal
                src={hiUrl(m)} imgAspect={aspects[m.id] ?? 1.5} slotAspect={slotAspectOf(fr, fmt.w, fmt.h)}
                cell={currentPage.cells?.[cropFor] ?? DEFAULT_CELL}
                onApply={(c) => { updateCell(currentPage.id, cropFor, c); setCropFor(null) }}
                onClose={() => setCropFor(null)}
              />
            )
          })()}

          {/* Ritaglio di un elemento libero */}
          {currentPage && cropElId && (() => {
            const el = (currentPage.elements ?? []).find((x) => x.id === cropElId)
            const m = el ? mediaById.get(el.mediaId) : undefined
            if (!el || !m) return null
            return (
              <CropModal
                src={hiUrl(m)} imgAspect={aspects[m.id] ?? 1.5} slotAspect={(el.w * fmt.w) / (el.h * fmt.h)}
                cell={el.cell}
                onApply={(c) => { freeUpdate(currentPage.id, el.id, { cell: c }); setCropElId(null) }}
                onClose={() => setCropElId(null)}
              />
            )
          })()}

          {/* Ritaglio della foto a PIENA TAVOLA (slot = 2 pagine affiancate) */}
          {cropSpread && (() => {
            const lp = pages.find((p) => p.id === cropSpread); const sp = lp?.spreadImage
            const m = sp ? mediaById.get(sp.mediaId) : undefined
            if (!lp || !sp || !m) return null
            return (
              <CropModal
                src={hiUrl(m)} imgAspect={aspects[m.id] ?? 1.5} slotAspect={(fmt.w * 2) / fmt.h}
                cell={sp.cell}
                onApply={(c) => { updateSpreadCell(lp.id, c); setCropSpread(null) }}
                onClose={() => setCropSpread(null)}
              />
            )
          })()}

          {/* Richieste di modifica: il cliente scrive, il fotografo le segna fatte */}
          {revOpen && (
            <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setRevOpen(false)}>
              <div className="bg-[rgb(var(--bg))] w-full max-w-lg rounded-2xl shadow-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
                  <h3 className="font-medium flex items-center gap-2"><MessageSquare size={16} /> Richieste di modifica</h3>
                  <button onClick={() => setRevOpen(false)} className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
                </div>
                <div className="p-4 space-y-2 border-b border-[rgb(var(--border))]">
                  <textarea value={revBody} onChange={(e) => setRevBody(e.target.value)} rows={3} placeholder={isCouple ? 'Scrivi cosa vorresti cambiare nell’album…' : 'Annota una modifica da fare…'} className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm" />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                      <input type="checkbox" checked={revPageRef} onChange={(e) => setRevPageRef(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--gold-600))]" /> Riferito alla pagina aperta{currentPageId ? ` (${pages.findIndex((p) => p.id === currentPageId) + 1})` : ''}
                    </label>
                    <Button variant="gold" size="sm" disabled={!revBody.trim()} onClick={() => void sendRev()}>Invia richiesta</Button>
                  </div>
                </div>
                <div className="p-4 overflow-auto space-y-2">
                  {revList.length === 0 && <p className="text-xs text-[rgb(var(--fg-subtle))] italic">Nessuna richiesta ancora.</p>}
                  {revList.map((r) => (
                    <div key={r.id} className={`rounded-lg border p-2.5 text-sm ${r.status === 'DONE' ? 'opacity-50 border-[rgb(var(--border))]' : 'border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))]/30'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p>{r.body}</p>
                          <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">— {r.author_name ?? 'Cliente'}{r.page_index ? ` · pag. ${r.page_index}` : ''}{r.status === 'DONE' ? ' · fatto ✓' : ''}</p>
                        </div>
                        {r.status === 'OPEN' && <button onClick={() => void resolveRev(r.id)} title="Segna fatto" className="shrink-0 inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]"><Check size={12} /> Fatto</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* Dialogo QUALITÀ DI STAMPA: DPI + abbondanza + crocini di taglio */}
          {exportOpen && (
            <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" onClick={() => setExportOpen(false)}>
              <div className="bg-[rgb(var(--bg))] w-full max-w-md rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-[rgb(var(--border))]">
                  <h3 className="font-medium flex items-center gap-2"><Sliders size={16} /> Qualità di stampa</h3>
                  <button onClick={() => setExportOpen(false)} className="p-1 rounded hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
                </div>
                <div className="p-4 space-y-4">
                  <div>
                    <p className="text-xs font-medium mb-1.5">Risoluzione (DPI)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ d: 150, l: 'Web', s: 'leggero' }, { d: 240, l: 'Buona', s: 'foto-libro' }, { d: 300, l: 'Stampa', s: 'professionale' }].map((o) => (
                        <button key={o.d} onClick={() => setExportDpi(o.d)} className={`rounded-lg border p-2 text-center ${exportDpi === o.d ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))]'}`}>
                          <p className="text-sm font-semibold">{o.d}</p><p className="text-[10px] text-[rgb(var(--fg-muted))]">{o.l} · {o.s}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none"><input type="checkbox" checked={bleed} onChange={(e) => setBleed(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--gold-600))]" /> Abbondanza <span className="text-xs text-[rgb(var(--fg-muted))]">(3 mm a filo bordo, per il taglio)</span></label>
                  <label className={`flex items-center gap-2 text-sm cursor-pointer select-none ${!bleed ? 'opacity-40' : ''}`}><input type="checkbox" disabled={!bleed} checked={cutMarks} onChange={(e) => setCutMarks(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--gold-600))]" /> Crocini di taglio <span className="text-xs text-[rgb(var(--fg-muted))]">(segni dove tagliare)</span></label>
                  <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Le foto su Drive vengono scaricate in originale ad alta risoluzione durante l'export.</p>
                  <div className="pt-1 space-y-2">
                    <div>
                      <p className="text-[11px] font-medium text-[rgb(var(--fg-muted))] mb-1 flex items-center gap-1.5"><FileText size={12} /> PDF</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="gold" size="sm" disabled={exporting} onClick={() => { setExportOpen(false); void doExport('spread') }}><LayoutGrid size={14} /> Tavola intera</Button>
                        <Button variant="outline" size="sm" disabled={exporting} onClick={() => { setExportOpen(false); void doExport('pdf') }}><FileText size={14} /> Pagine divise</Button>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-[rgb(var(--fg-muted))] mb-1 flex items-center gap-1.5"><FileImage size={12} /> JPG (una immagine per…)</p>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" size="sm" disabled={exporting} onClick={() => { setExportOpen(false); void doExport('jpgspread') }}><LayoutGrid size={14} /> Tavola intera</Button>
                        <Button variant="outline" size="sm" disabled={exporting} onClick={() => { setExportOpen(false); void doExport('jpg') }}><FileImage size={14} /> Pagine divise</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Anteprima sfogliabile (spread) */}
          {previewOpen && pages.length > 0 && (() => {
            const left = Math.min(previewIdx - (previewIdx % 2), Math.max(0, pages.length - 1))
            const lp = pages[left]; const rp = pages[left + 1]
            const Mini = ({ p }: { p: AlbumPage }) => {
              const frames = framesForPage(p)
              return (
                <div className="relative bg-white shadow-xl shrink-0 overflow-hidden" style={{ aspectRatio: String(asp), height: `min(74vh, ${(46 / asp).toFixed(2)}vw)`, background: p.mode === 'free' ? (p.bg ?? '#fff') : '#fff' }}>
                  {p.mode === 'free'
                    ? (p.elements ?? []).map((el) => { const m = mediaById.get(el.mediaId); return <div key={el.id} className="absolute overflow-hidden" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, boxShadow: el.shadow ? '0 6px 18px rgba(0,0,0,.28)' : undefined, border: el.border ? `${el.border.w}px solid ${el.border.color}` : undefined }}>{m && <img src={hiUrl(m)} alt="" draggable={false} style={coverImgStyle(el.cell)} />}</div> })
                    : frames.map((fr, i) => { const id = p.mediaIds[i]; const m = id ? mediaById.get(id) : undefined; return <div key={i} className="absolute bg-[rgb(var(--bg-sunken))] overflow-hidden" style={{ left: `${fr.x * 100}%`, top: `${fr.y * 100}%`, width: `${fr.w * 100}%`, height: `${fr.h * 100}%` }}>{m && <img src={hiUrl(m)} alt="" draggable={false} style={coverImgStyle(p.cells?.[i] ?? DEFAULT_CELL)} />}</div> })}
                </div>
              )
            }
            return (
              <div className="fixed inset-0 z-[80] bg-black/85 flex flex-col items-center justify-center p-6" onClick={() => setPreviewOpen(false)}>
                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                  <button disabled={left <= 0} onClick={() => setPreviewIdx(Math.max(0, left - 2))} className="p-2 rounded-full bg-white/10 disabled:opacity-30"><ChevLeft size={24} className="text-white" /></button>
                  <div className="relative flex gap-1">{lp && <Mini p={lp} />}{rp && <Mini p={rp} />}
                    {lp?.spreadImage && (() => { const m = mediaById.get(lp.spreadImage!.mediaId); return m ? <SpreadImg src={hiUrl(m)} cell={lp.spreadImage!.cell} frame={spreadFrameOf(lp.spreadImage)} /> : null })()}
                  </div>
                  <button disabled={left + 2 >= pages.length} onClick={() => setPreviewIdx(left + 2)} className="p-2 rounded-full bg-white/10 disabled:opacity-30"><ChevRight size={24} className="text-white" /></button>
                </div>
                <p className="text-white/70 text-xs mt-3">Spread {Math.floor(left / 2) + 1} · pag. {left + 1}{rp ? `–${left + 2}` : ''} di {pages.length}</p>
                <button onClick={() => setPreviewOpen(false)} className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={22} /></button>
              </div>
            )
          })()}
        </>
      )}
      <div ref={exportRef} className="sr-only" aria-hidden />
    </div>
  )
}

// ── step 1: selezione guidata ────────────────────────────────────────────────
function SelectStep(props: {
  photos: M[]; kept: M[]; total: number; okRange: boolean; untagged: number
  missingMin: typeof MOMENTS; perMoment: Map<string, number>
  onToggle: (m: M) => void; onMoment: (m: M, moment: string) => void; onGenerate: () => void; thumb: (m: M) => string
}) {
  const { photos, total, okRange, untagged, missingMin, perMoment, onToggle, onMoment, onGenerate, thumb } = props
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5">
      <div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {photos.map((m) => {
            const keptOn = m.album_choice === 'KEPT'
            return (
              <Card key={m.id} className={`overflow-hidden ${keptOn ? 'ring-2 ring-[rgb(var(--gold-500))]' : ''}`}>
                <button onClick={() => onToggle(m)} className="relative block w-full aspect-square">
                  <img src={thumb(m)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <span className={`absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center ${keptOn ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-black/40 text-white'}`}><Heart size={13} className={keptOn ? 'fill-current' : ''} /></span>
                </button>
                <select value={m.album_moment ?? ''} onChange={(e) => onMoment(m, e.target.value)} disabled={!keptOn}
                  className="w-full text-xs px-2 py-1.5 bg-[rgb(var(--bg))] border-t border-[rgb(var(--border))] disabled:opacity-50">
                  <option value="">— momento —</option>
                  {MOMENTS.map((mm) => <option key={mm.key} value={mm.key}>{mm.label}</option>)}
                </select>
              </Card>
            )
          })}
        </div>
        {photos.length === 0 && <Card className="p-8 text-center text-sm text-[rgb(var(--fg-muted))]">Nessuna foto nella galleria. Caricale dalla scheda Foto.</Card>}
      </div>

      {/* riepilogo selezione */}
      <div className="lg:sticky lg:top-20 self-start space-y-3">
        <Card className="p-4">
          <p className="text-sm font-medium">Selezione album</p>
          <p className={`text-3xl font-display mt-1 ${okRange ? 'text-[rgb(var(--emerald-600))]' : 'text-[rgb(var(--fg))]'}`}>{total}<span className="text-base text-[rgb(var(--fg-muted))]"> / {ALBUM_MIN_PHOTOS}–{ALBUM_MAX_PHOTOS}</span></p>
          <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">{total < ALBUM_MIN_PHOTOS ? `Aggiungi almeno ${ALBUM_MIN_PHOTOS - total} foto` : total > ALBUM_MAX_PHOTOS ? `Togli ${total - ALBUM_MAX_PHOTOS} foto` : 'Numero perfetto ✓'}</p>
          {untagged > 0 && <p className="text-[11px] text-amber-600 mt-1">{untagged} foto senza momento</p>}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium mb-2">Minimi per momento</p>
          <ul className="space-y-1.5">
            {MOMENTS.map((mm) => {
              const n = perMoment.get(mm.key) ?? 0; const ok = n >= mm.min
              return (
                <li key={mm.key} className="flex items-center justify-between text-xs">
                  <span className={`px-1.5 py-0.5 rounded ${mm.color}`}>{mm.label}</span>
                  <span className={ok ? 'text-[rgb(var(--emerald-600))]' : 'text-[rgb(var(--fg-muted))]'}>{n}/{mm.min}</span>
                </li>
              )
            })}
          </ul>
        </Card>
        <Button variant="gold" className="w-full" disabled={total === 0} onClick={onGenerate}><Wand2 size={15} /> Genera impaginazione</Button>
        {!okRange && total > 0 && <p className="text-[11px] text-center text-[rgb(var(--fg-muted))]">Puoi generare comunque: l'ideale è {ALBUM_MIN_PHOTOS}–{ALBUM_MAX_PHOTOS}{missingMin.length ? `, mancano minimi: ${missingMin.map((x) => x.label).join(', ')}` : ''}.</p>}
      </div>
    </div>
  )
}

// ── elementi del workspace ───────────────────────────────────────────────────
const TPL_LABEL: Record<TemplateKey, string> = { '1': '1', '2h': '2 │', '2hL': '2 ◧', '2v': '2 ─', '2vT': '2 ⊟', '3l': '3 ◧', '3t': '3 ⊟', '3r': '3 ◨', '3col': '3 │││', '3v': '3 ☰', '4': '4 ⊞', '4l': '4 ◧', '4r': '4 ◨', '4row': '4 ││││', '4col': '4 ☰', '5l': '5 ◧', '5t': '5 ⊟', '6band': '6 ▤', grid: 'griglia', custom: 'salvato' }
function clampN(v: number) { return Math.min(1, Math.max(0, v)) }

function ToolToggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: ReactNode; label: string }) {
  return (
    <button onClick={onClick} title={label}
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${on ? 'bg-[rgb(var(--gold-100))] border-[rgb(var(--gold-300))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-muted))]'}`}>
      {icon} {label}
    </button>
  )
}

// Canvas grande: una pagina, con modifica libera della foto (drag = sposta, rotella/zoom = scala),
// griglia stile Photoshop, guide margini e abbondanza.
function PageStage(props: {
  page: AlbumPage; formatKey: string; bleed: boolean; gridOn: boolean; marginsOn: boolean; pageNum?: number | null
  aspects: Record<string, number>; mediaById: Map<string, M>; thumb: (m: M) => string; activeSlot: number | null
  onSlot: (s: number | null) => void; onDropMedia: (s: number, id: string) => void
  onClearSlot: (s: number) => void; onCell: (s: number, partial: Partial<Cell>) => void; onCrop: (s: number) => void
  onFree?: () => void; onSwap?: (a: number, b: number) => void
}) {
  const { page, formatKey, bleed, gridOn, marginsOn, pageNum, mediaById, thumb, activeSlot, onSlot, onDropMedia, onClearSlot, onCell, onCrop, onFree, onSwap } = props
  const fmt = getFormat(formatKey)
  const aspect = fmt.w / fmt.h
  const frames = framesForPage(page)
  const drag = useRef<{ slot: number; x: number; y: number; cell: Cell } | null>(null)
  const mx = (MARGIN_MM / fmt.w) * 100, my = (MARGIN_MM / fmt.h) * 100

  function startPan(e: React.PointerEvent, i: number, cell: Cell) {
    e.stopPropagation(); drag.current = { slot: i, x: e.clientX, y: e.clientY, cell }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function movePan(e: React.PointerEvent) {
    const d = drag.current; if (!d) return
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dx = (e.clientX - d.x) / Math.max(1, box.width)
    const dy = (e.clientY - d.y) / Math.max(1, box.height)
    onCell(d.slot, { fx: clampN(d.cell.fx - dx * 0.9), fy: clampN(d.cell.fy - dy * 0.9) })
  }
  function endPan() { drag.current = null }

  return (
    <div className="relative bg-white shadow-[var(--shadow-lift)] h-full max-h-full max-w-full" style={{ aspectRatio: String(aspect) }} onClick={() => onSlot(null)}>
      {frames.map((fr, i) => {
        const id = page.mediaIds[i]; const m = id ? mediaById.get(id) : undefined
        const sel = activeSlot === i
        const cell = page.cells?.[i] ?? DEFAULT_CELL
        return (
          <div key={i}
            onClick={(e) => { e.stopPropagation(); onSlot(i) }}
            onDoubleClick={(e) => { if (m) { e.stopPropagation(); onFree?.() } }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const sl = e.dataTransfer.getData('text/slot'); if (sl !== '') { const from = Number(sl); if (!Number.isNaN(from) && from !== i) onSwap?.(from, i); return } const mid = e.dataTransfer.getData('text/media'); if (mid) onDropMedia(i, mid) }}
            onWheel={(e) => { if (!m) return; e.preventDefault(); const nz = Math.min(4, Math.max(1, +(cell.z + (e.deltaY < 0 ? 0.12 : -0.12)).toFixed(2))); onCell(i, { z: nz }) }}
            className={`group/slot absolute overflow-hidden ${sel ? 'outline outline-2 outline-[rgb(var(--gold-500))] z-10' : 'outline outline-1 outline-black/5'}`}
            style={{ left: `${fr.x * 100}%`, top: `${fr.y * 100}%`, width: `${fr.w * 100}%`, height: `${fr.h * 100}%`, padding: '1px' }}>
            {m ? (
              <div className="relative w-full h-full">
                <div onPointerDown={(e) => startPan(e, i, cell)} onPointerMove={movePan} onPointerUp={endPan} onPointerLeave={endPan}
                  className="w-full h-full touch-none cursor-move relative overflow-hidden">
                  <img src={thumb(m)} alt="" draggable={false} style={coverImgStyle(cell)} />
                </div>
                {/* maniglia per SCAMBIARE la foto con un altro riquadro (trascina e rilascia
                    su un altro slot). Le foto si scambiano e ognuna eredita il ritaglio del
                    riquadro in cui finisce. */}
                {onSwap && (
                  <span draggable title="Trascina su un altro riquadro per scambiare le foto"
                    onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}
                    onDragStart={(e) => { e.dataTransfer.setData('text/slot', String(i)); e.dataTransfer.effectAllowed = 'move' }}
                    className="absolute top-0.5 left-0.5 z-20 h-5 w-5 rounded bg-black/55 text-white items-center justify-center cursor-grab active:cursor-grabbing hidden group-hover/slot:flex">
                    <Move size={11} />
                  </span>
                )}
                {sel && (
                  <>
                    <span className="absolute -top-px -left-px h-2 w-2 border-t-2 border-l-2 border-[rgb(var(--gold-500))]" />
                    <span className="absolute -top-px -right-px h-2 w-2 border-t-2 border-r-2 border-[rgb(var(--gold-500))]" />
                    <span className="absolute -bottom-px -left-px h-2 w-2 border-b-2 border-l-2 border-[rgb(var(--gold-500))]" />
                    <span className="absolute -bottom-px -right-px h-2 w-2 border-b-2 border-r-2 border-[rgb(var(--gold-500))]" />
                    <div className="absolute top-1 right-1 flex gap-1">
                      <button title="Ritaglia" onClick={(e) => { e.stopPropagation(); onCrop(i) }} className="h-6 w-6 rounded-full bg-black/55 text-white flex items-center justify-center"><Crop size={12} /></button>
                      <button title="Togli foto" onClick={(e) => { e.stopPropagation(); onClearSlot(i) }} className="h-6 w-6 rounded-full bg-black/55 text-white flex items-center justify-center"><Trash2 size={12} /></button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="w-full h-full bg-[rgb(var(--bg-sunken))] flex items-center justify-center text-[11px] text-[rgb(var(--fg-subtle))]">trascina una foto</div>
            )}
          </div>
        )
      })}

      {/* guide margini */}
      {marginsOn && <div className="absolute border border-dashed border-sky-400/70 pointer-events-none" style={{ left: `${mx}%`, right: `${mx}%`, top: `${my}%`, bottom: `${my}%` }} title="Area di sicurezza (margini)" />}
      {/* numero di pagina */}
      {pageNum != null && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-[rgb(var(--fg-muted))] pointer-events-none z-40">{pageNum}</div>}
      {/* abbondanza: bordo di taglio */}
      {bleed && <div className="absolute inset-0 border-2 border-rose-400/70 pointer-events-none" title="Linea di taglio (abbondanza attiva)" />}
      {/* griglia stile Photoshop: terzi + reticolo fine */}
      {gridOn && (
        <div className="absolute inset-0 pointer-events-none z-30">
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.18) 1px, transparent 1px)', backgroundSize: '12.5% 12.5%' }} />
          <div className="absolute top-0 bottom-0 border-l border-[rgba(0,120,255,.5)]" style={{ left: '33.33%' }} />
          <div className="absolute top-0 bottom-0 border-l border-[rgba(0,120,255,.5)]" style={{ left: '66.66%' }} />
          <div className="absolute left-0 right-0 border-t border-[rgba(0,120,255,.5)]" style={{ top: '33.33%' }} />
          <div className="absolute left-0 right-0 border-t border-[rgba(0,120,255,.5)]" style={{ top: '66.66%' }} />
        </div>
      )}
    </div>
  )
}

// Canvas LIBERO stile Canva: elementi che sposti/ridimensioni/ruoti con smart-guides.
function FreeStage(props: {
  page: AlbumPage; formatKey: string; bleed: boolean; gridOn: boolean; marginsOn: boolean; pageNum?: number | null
  aspects: Record<string, number>; mediaById: Map<string, M>; thumb: (m: M) => string; selEl: string | null; multiSel: string[]
  onSelect: (id: string | null, additive?: boolean) => void; onUpdateEl: (id: string, patch: Partial<FreeEl>) => void
  onUpdateMany: (patches: { id: string; patch: Partial<FreeEl> }[]) => void
  onCrop: (id: string) => void; onRemove: (id: string) => void; onDuplicateEl: (id: string) => void; onDropMedia: (id: string) => void
}) {
  const { page, formatKey, bleed, gridOn, marginsOn, pageNum, mediaById, thumb, selEl, multiSel, onSelect, onUpdateEl, onUpdateMany, onCrop, onRemove, onDuplicateEl, onDropMedia } = props
  const fmt = getFormat(formatKey)
  const aspect = fmt.w / fmt.h
  const mx = MARGIN_MM / fmt.w, my = MARGIN_MM / fmt.h
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ kind: 'move' | 'resize' | 'rotate' | 'gresize'; id: string; corner?: Corner; sx: number; sy: number; el: FreeEl; group: FreeEl[]; anchor?: { x: number; y: number }; h0?: { x: number; y: number } } | null>(null)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const [gapMarks, setGapMarks] = useState<GapMark[]>([])
  const els = page.elements ?? []

  function frac(e: React.PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) }
  }
  function down(e: React.PointerEvent, kind: 'move' | 'resize' | 'rotate', el: FreeEl, corner?: Corner) {
    e.stopPropagation()
    if (kind === 'move' && e.shiftKey) { onSelect(el.id, true) } else if (!multiSel.includes(el.id)) { onSelect(el.id) }
    const inGroup = kind === 'move' && multiSel.length > 1 && multiSel.includes(el.id)
    const group = inGroup ? els.filter((x) => multiSel.includes(x.id)) : [el]
    const f = frac(e); drag.current = { kind, id: el.id, corner, sx: f.x, sy: f.y, el, group }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  // Resize di GRUPPO: scala insieme tutte le foto selezionate, attorno all'angolo opposto
  // (uniforme, stile Canva). Lo snapshot del gruppo è preso all'inizio del drag.
  function downGroup(e: React.PointerEvent, corner: Corner) {
    e.stopPropagation()
    const g = els.filter((x) => multiSel.includes(x.id))
    if (g.length < 2) return
    const bx = Math.min(...g.map((x) => x.x)), by = Math.min(...g.map((x) => x.y))
    const ex = Math.max(...g.map((x) => x.x + x.w)), ey = Math.max(...g.map((x) => x.y + x.h))
    const anchor = { x: corner.includes('e') ? bx : ex, y: corner.includes('s') ? by : ey }
    const h0 = { x: corner.includes('e') ? ex : bx, y: corner.includes('s') ? ey : by }
    const f = frac(e)
    drag.current = { kind: 'gresize', id: '__group__', corner, sx: f.x, sy: f.y, el: g[0]!, group: g, anchor, h0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    const d = drag.current; if (!d) return
    const f = frac(e)
    if (d.kind === 'move') {
      const nx = d.el.x + (f.x - d.sx), ny = d.el.y + (f.y - d.sy)
      const moved = moveEl(d.el, nx, ny)
      const otherEls = els.filter((x) => !d.group.some((g) => g.id === x.id))
      const snap = snapMove(moved, otherEls, mx, my)
      // se nessun aggancio ai bordi su un asse, prova la spaziatura uguale tra foto
      const spaced = { ...moved, x: snap.x, y: snap.y }
      const sp = spacingSnap(spaced, otherEls)
      const fx = snap.vGuides.length ? snap.x : sp.x
      const fy = snap.hGuides.length ? snap.y : sp.y
      const dx = fx - d.el.x, dy = fy - d.el.y
      if (d.group.length > 1) onUpdateMany(d.group.map((g) => ({ id: g.id, patch: moveEl(g, g.x + dx, g.y + dy) })))
      else onUpdateEl(d.id, { x: fx, y: fy })
      setGuides({ v: snap.vGuides, h: snap.hGuides })
      // righelli di distanza SEMPRE visibili verso i vicini (+ evidenzia la spaziatura uguale quando aggancia)
      const finalEl = { ...moved, x: fx, y: fy }
      const eq = new Set(sp.marks.map((mk) => `${mk.axis}:${mk.a.toFixed(3)}:${mk.b.toFixed(3)}`))
      const live = neighborGaps(finalEl, otherEls)
      setGapMarks([...sp.marks, ...live.filter((mk) => !eq.has(`${mk.axis}:${mk.a.toFixed(3)}:${mk.b.toFixed(3)}`))])
    } else if (d.kind === 'resize' && d.corner) {
      const r = resizeEl(d.el, d.corner, f.x, f.y); onUpdateEl(d.id, { x: r.x, y: r.y, w: r.w, h: r.h })
      // RIGHELLI AUTOMATICI anche in resize: allineamenti bordi/centri + distanze in cm
      const otherEls = els.filter((x) => x.id !== d.id)
      const snap = snapMove(r, otherEls, mx, my)
      setGuides({ v: snap.vGuides, h: snap.hGuides })
      setGapMarks(neighborGaps(r, otherEls))
    } else if (d.kind === 'gresize' && d.anchor && d.h0) {
      const a = d.anchor, h0 = d.h0
      const dist = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y)
      const d0 = dist(h0, a); if (d0 < 1e-4) return
      // limite per non far uscire il gruppo dalla tavola
      const lim = (av: number, hv: number) => { const dd = hv - av; if (Math.abs(dd) < 1e-6) return Infinity; return dd > 0 ? (1 - av) / dd : (0 - av) / dd }
      const maxS = Math.max(0.2, Math.min(lim(a.x, h0.x), lim(a.y, h0.y)))
      const s = Math.max(0.15, Math.min(dist(f, a) / d0, maxS, 6))
      onUpdateMany(d.group.map((g) => ({ id: g.id, patch: { x: a.x + (g.x - a.x) * s, y: a.y + (g.y - a.y) * s, w: Math.max(0.02, g.w * s), h: Math.max(0.02, g.h * s) } })))
      // righelli automatici per il BOX di gruppo scalato verso le foto esterne
      const others = els.filter((x) => !d.group.some((gg) => gg.id === x.id))
      const nx = a.x + (h0.x - a.x) * s, ny = a.y + (h0.y - a.y) * s
      const bb = { ...d.el, x: Math.min(a.x, nx), y: Math.min(a.y, ny), w: Math.abs(nx - a.x), h: Math.abs(ny - a.y) }
      const snap = snapMove(bb, others, mx, my)
      setGuides({ v: snap.vGuides, h: snap.hGuides })
      setGapMarks(neighborGaps(bb, others))
    } else if (d.kind === 'rotate') {
      const cx = d.el.x + d.el.w / 2, cy = d.el.y + d.el.h / 2
      const deg = (Math.atan2(f.y - cy, f.x - cx) * 180) / Math.PI + 90
      onUpdateEl(d.id, { rot: snapAngle(deg) })
    }
  }
  function up() { drag.current = null; setGuides({ v: [], h: [] }); setGapMarks([]) }

  return (
    <div ref={boxRef} className="relative shadow-[var(--shadow-lift)] h-full max-h-full max-w-full overflow-hidden"
      style={{ aspectRatio: String(aspect), background: page.bg ?? '#ffffff' }}
      onPointerMove={move} onPointerUp={up} onPointerLeave={up}
      onClick={(e) => { if (e.target === e.currentTarget) onSelect(null) }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const mid = e.dataTransfer.getData('text/media'); if (mid) onDropMedia(mid) }}>
      {els.map((el) => {
        const m = mediaById.get(el.mediaId)
        const sel = selEl === el.id
        const inSel = multiSel.includes(el.id)
        return (
          <div key={el.id} className="absolute" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, zIndex: sel ? 20 : inSel ? 10 : 1 }}>
            <div
              onPointerDown={(e) => down(e, 'move', el)}
              onDoubleClick={(e) => { e.stopPropagation(); onCrop(el.id) }}
              className={`w-full h-full touch-none cursor-move relative overflow-hidden ${sel ? 'outline outline-2 outline-[rgb(var(--gold-500))]' : inSel ? 'outline outline-2 outline-dashed outline-[rgb(var(--gold-400))]' : ''}`}
              style={{ backgroundColor: m ? undefined : 'rgba(0,0,0,.06)', boxShadow: el.shadow ? '0 6px 18px rgba(0,0,0,.28)' : undefined, border: el.border ? `${Math.max(1, el.border.w)}px solid ${el.border.color}` : undefined }}>
              {m && <img src={thumb(m)} alt="" draggable={false} style={coverImgStyle(el.cell)} />}
            </div>
            {sel && multiSel.length <= 1 && (
              <>
                {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                  <div key={c} onPointerDown={(e) => down(e, 'resize', el, c)}
                    className="absolute h-3 w-3 bg-white border border-[rgb(var(--gold-500))] rounded-sm touch-none"
                    style={{ left: c.includes('w') ? -6 : undefined, right: c.includes('e') ? -6 : undefined, top: c.includes('n') ? -6 : undefined, bottom: c.includes('s') ? -6 : undefined, cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />
                ))}
                <div onPointerDown={(e) => down(e, 'rotate', el)} className="absolute left-1/2 -top-6 -translate-x-1/2 h-4 w-4 bg-white border border-[rgb(var(--gold-500))] rounded-full touch-none cursor-grab flex items-center justify-center"><RotateCw size={9} /></div>
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex gap-1" style={{ transform: `rotate(${-el.rot}deg)` }}>
                  <button title="Ritaglia" className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onCrop(el.id) }}><Crop size={12} /></button>
                  <button title="Duplica" className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDuplicateEl(el.id) }}><Copy size={12} /></button>
                  <button title="Elimina" className="h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onRemove(el.id) }}><Trash2 size={12} /></button>
                </div>
              </>
            )}
          </div>
        )
      })}

      {/* BOX DI GRUPPO: con più foto selezionate, le maniglie le ridimensionano INSIEME */}
      {multiSel.length > 1 && (() => {
        const g = els.filter((x) => multiSel.includes(x.id)); if (g.length < 2) return null
        const bx = Math.min(...g.map((x) => x.x)), by = Math.min(...g.map((x) => x.y))
        const ex = Math.max(...g.map((x) => x.x + x.w)), ey = Math.max(...g.map((x) => x.y + x.h))
        return (
          <div className="absolute z-30 pointer-events-none" style={{ left: `${bx * 100}%`, top: `${by * 100}%`, width: `${(ex - bx) * 100}%`, height: `${(ey - by) * 100}%` }}>
            <div className="absolute inset-0 border-2 border-dashed border-[rgb(var(--gold-500))]" />
            {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
              <div key={c} onPointerDown={(e) => downGroup(e, c)}
                className="absolute h-3.5 w-3.5 bg-white border-2 border-[rgb(var(--gold-500))] rounded-sm touch-none pointer-events-auto"
                style={{ left: c.includes('w') ? -7 : undefined, right: c.includes('e') ? -7 : undefined, top: c.includes('n') ? -7 : undefined, bottom: c.includes('s') ? -7 : undefined, cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />
            ))}
            <span className="absolute -top-5 left-0 text-[9px] px-1 rounded bg-[rgb(var(--gold-500))] text-white pointer-events-none">{g.length} foto · ridimensiona insieme</span>
          </div>
        )
      })()}

      {/* smart guides (allineamento bordi/centri) */}
      {guides.v.map((g, i) => <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none" style={{ left: `${g * 100}%` }} />)}
      {guides.h.map((g, i) => <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-rose-500 pointer-events-none" style={{ top: `${g * 100}%` }} />)}
      {/* righelli viola di distanza/margine verso le altre foto, con misura in cm */}
      {gapMarks.map((mk, i) => {
        const cm = (Math.abs(mk.b - mk.a) * (mk.axis === 'x' ? fmt.w : fmt.h) / 10)
        const lbl = <span className="absolute bg-fuchsia-600 text-white text-[8px] leading-none px-1 py-0.5 rounded -translate-x-1/2 -translate-y-1/2 z-40">{cm.toFixed(1)}</span>
        return mk.axis === 'x'
          ? <div key={`gx${i}`} className="absolute pointer-events-none z-30" style={{ left: `${Math.min(mk.a, mk.b) * 100}%`, width: `${Math.abs(mk.b - mk.a) * 100}%`, top: `${mk.cross * 100}%` }}><div className="h-0.5 bg-fuchsia-500" style={{ boxShadow: '0 0 0 1px white' }} /><div className="absolute left-1/2 top-0">{lbl}</div></div>
          : <div key={`gy${i}`} className="absolute pointer-events-none z-30" style={{ top: `${Math.min(mk.a, mk.b) * 100}%`, height: `${Math.abs(mk.b - mk.a) * 100}%`, left: `${mk.cross * 100}%` }}><div className="w-0.5 h-full bg-fuchsia-500" style={{ boxShadow: '0 0 0 1px white' }} /><div className="absolute top-1/2 left-0">{lbl}</div></div>
      })}
      {/* margini / abbondanza / griglia (come nello stage template) */}
      {marginsOn && <div className="absolute border border-dashed border-sky-400/70 pointer-events-none" style={{ left: `${mx * 100}%`, right: `${mx * 100}%`, top: `${my * 100}%`, bottom: `${my * 100}%` }} />}
      {bleed && <div className="absolute inset-0 border-2 border-rose-400/70 pointer-events-none" />}
      {gridOn && (
        <div className="absolute inset-0 pointer-events-none z-30">
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(to right, rgba(0,0,0,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,.18) 1px, transparent 1px)', backgroundSize: '12.5% 12.5%' }} />
        </div>
      )}
      {pageNum != null && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-[rgb(var(--fg-muted))] pointer-events-none z-40">{pageNum}</div>}
      {els.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-sm text-[rgb(var(--fg-subtle))]">Trascina o clicca le foto a sinistra per aggiungerle</div>}
    </div>
  )
}

// Miniatura nella filmstrip in basso.
// rendering compatto di una pagina (per le miniature delle tavole)
function MiniPage({ page, formatKey, mediaById, thumb }: { page: AlbumPage; formatKey: string; aspects?: Record<string, number>; mediaById: Map<string, M>; thumb: (m: M) => string }) {
  const fmt = getFormat(formatKey); const frames = framesForPage(page)
  return (
    <div className="relative h-full overflow-hidden" style={{ aspectRatio: String(fmt.w / fmt.h), background: page.mode === 'free' ? (page.bg ?? '#fff') : '#fff' }}>
      {page.mode === 'free'
        ? (page.elements ?? []).map((el) => { const m = mediaById.get(el.mediaId); return <div key={el.id} className="absolute bg-black/5 overflow-hidden" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)` }}>{m && <img src={thumb(m)} alt="" draggable={false} style={coverImgStyle(el.cell)} />}</div> })
        : frames.map((fr, i) => { const id = page.mediaIds[i]; const m = id ? mediaById.get(id) : undefined; return <div key={i} className="absolute bg-[rgb(var(--bg-sunken))] overflow-hidden" style={{ left: `${fr.x * 100}%`, top: `${fr.y * 100}%`, width: `${fr.w * 100}%`, height: `${fr.h * 100}%` }}>{m && <img src={thumb(m)} alt="" draggable={false} style={coverImgStyle(page.cells?.[i] ?? DEFAULT_CELL)} />}</div> })}
    </div>
  )
}

// Miniatura di una TAVOLA (2 pagine) con la filigrana del dorso al centro.
function SpreadThumb(props: {
  pair: AlbumPage[]; index: number; aspect: number; active: boolean; lite?: boolean; formatKey: string
  aspects: Record<string, number>; mediaById: Map<string, M>; thumb: (m: M) => string
  onSelect: () => void; onMove: (d: -1 | 1) => void; onDelete: () => void; onDropMedia: (pageId: string, id: string) => void
  onReorder: (from: number, to: number) => void
}) {
  const { pair, index, aspect, active, lite, formatKey, aspects, mediaById, thumb, onSelect, onMove, onDelete, onDropMedia, onReorder } = props
  const w = aspect * pair.length
  const [over, setOver] = useState<false | 'l' | 'r'>(false)
  return (
    <div className="shrink-0 group relative"
      draggable={!lite}
      onDragStart={(e) => { e.dataTransfer.setData('text/spread', String(index)); e.dataTransfer.effectAllowed = 'move' }}
      onDragOver={(e) => { if (lite) return; const hasSpread = e.dataTransfer.types.includes('text/spread'); if (!hasSpread) return; e.preventDefault(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setOver(e.clientX < r.left + r.width / 2 ? 'l' : 'r') }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { const side = over; setOver(false); const raw = e.dataTransfer.getData('text/spread'); if (raw === '') return; e.preventDefault(); e.stopPropagation(); const from = Number(raw); if (Number.isNaN(from)) return; const to = side === 'r' ? index + 1 : index; if (to !== from && to !== from + 1) onReorder(from, to) }}>
      {over && <div className={`absolute top-0 bottom-0 w-1 rounded bg-[rgb(var(--gold-500))] z-10 ${over === 'l' ? '-left-1.5' : '-right-1.5'}`} />}
      <button onClick={onSelect} className={`relative flex h-16 overflow-hidden border bg-white ${active ? 'ring-2 ring-[rgb(var(--gold-500))] border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'} ${!lite ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ aspectRatio: String(w) }}>
        {pair.map((p) => (
          <div key={p.id} className="h-full" style={{ aspectRatio: String(aspect) }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('text/media')) e.preventDefault() }} onDrop={(e) => { const mid = e.dataTransfer.getData('text/media'); if (mid) { e.preventDefault(); e.stopPropagation(); onDropMedia(p.id, mid) } }}>
            <MiniPage page={p} formatKey={formatKey} aspects={aspects} mediaById={mediaById} thumb={thumb} />
          </div>
        ))}
        {pair[0]?.spreadImage && (() => { const m = mediaById.get(pair[0]!.spreadImage!.mediaId); return m ? <SpreadImg src={thumb(m)} cell={pair[0]!.spreadImage!.cell} frame={spreadFrameOf(pair[0]!.spreadImage)} pointerNone /> : null })()}
        {pair.length === 2 && <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-[rgba(184,146,63,.5)] pointer-events-none" />}
      </button>
      <span className="absolute -top-1.5 left-1 text-[9px] bg-black/60 text-white rounded px-1">Tav. {index + 1}</span>
      {!lite && (
        <div className="absolute inset-x-0 -bottom-1 hidden group-hover:flex items-center justify-center gap-0.5">
          <button title="Sposta a sinistra" className="h-4 w-4 rounded bg-[rgb(var(--bg))] border border-[rgb(var(--border))] flex items-center justify-center" onClick={onMove.bind(null, -1)}><ChevronLeft size={10} /></button>
          <button title="Elimina tavola" className="h-4 w-4 rounded bg-[rgb(var(--bg))] border border-[rgb(var(--border))] flex items-center justify-center text-rose-500" onClick={onDelete}><Trash2 size={9} /></button>
          <button title="Sposta a destra" className="h-4 w-4 rounded bg-[rgb(var(--bg))] border border-[rgb(var(--border))] flex items-center justify-center" onClick={onMove.bind(null, 1)}><ChevronRight size={10} /></button>
        </div>
      )}
    </div>
  )
}

// Righello in centimetri attorno alla tavola (come Photoshop). cmX = larghezza tavola, cmY = altezza.
function SpreadRuler({ cmX, cmY, onAddGuide }: { cmX: number; cmY: number; onAddGuide: (axis: 'v' | 'h', pos: number) => void }) {
  const xs = Array.from({ length: Math.floor(cmX) + 1 }, (_, i) => i)
  const ys = Array.from({ length: Math.floor(cmY) + 1 }, (_, i) => i)
  const evX = cmX > 20 ? 5 : cmX > 12 ? 2 : 1
  const evY = cmY > 20 ? 5 : cmY > 12 ? 2 : 1
  // clic sul righello = nuova guida, agganciata al mezzo-centimetro più vicino
  const addFrom = (axis: 'v' | 'h', e: React.MouseEvent, cm: number) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const raw = axis === 'v' ? (e.clientX - r.left) / Math.max(1, r.width) : (e.clientY - r.top) / Math.max(1, r.height)
    onAddGuide(axis, Math.round(raw * cm * 2) / (cm * 2)) // snap a 0.5 cm
  }
  return (
    <>
      <div onClick={(e) => addFrom('v', e, cmX)} title="Clic per aggiungere una guida verticale" className="absolute left-0 right-0 -top-[18px] h-[18px] bg-[rgb(var(--bg))] border border-[rgb(var(--border))] text-[7px] text-[rgb(var(--fg-muted))] select-none z-50 overflow-hidden cursor-ew-resize">
        {xs.map((i) => (
          <div key={i} className="absolute top-0 bottom-0 pointer-events-none" style={{ left: `${(i / cmX) * 100}%` }}>
            <div className={`absolute top-0 ${i % evX === 0 ? 'h-full' : 'h-1/2'} w-px bg-[rgb(var(--fg-subtle))]`} />
            {i % evX === 0 && i > 0 && <span className="absolute top-px left-0.5 leading-none">{i}</span>}
          </div>
        ))}
      </div>
      <div onClick={(e) => addFrom('h', e, cmY)} title="Clic per aggiungere una guida orizzontale" className="absolute top-0 bottom-0 -left-[18px] w-[18px] bg-[rgb(var(--bg))] border border-[rgb(var(--border))] text-[7px] text-[rgb(var(--fg-muted))] select-none z-50 overflow-hidden cursor-ns-resize">
        {ys.map((i) => (
          <div key={i} className="absolute left-0 right-0 pointer-events-none" style={{ top: `${(i / cmY) * 100}%` }}>
            <div className={`absolute left-0 ${i % evY === 0 ? 'w-full' : 'w-1/2'} h-px bg-[rgb(var(--fg-subtle))]`} />
            {i % evY === 0 && i > 0 && <span className="absolute left-px top-0 leading-none">{i}</span>}
          </div>
        ))}
      </div>
      <div className="absolute -top-[18px] -left-[18px] w-[18px] h-[18px] bg-[rgb(var(--bg))] border border-[rgb(var(--border))] z-50 pointer-events-none flex items-center justify-center text-[6px] text-[rgb(var(--fg-subtle))]">cm</div>
    </>
  )
}

// Pannello proprietà a destra: foto selezionata (crop/zoom) + strumenti pagina.
// diagramma di un set di frame arbitrari (per i layout salvati)
function FramesDiagram({ frames, active }: { frames: { x: number; y: number; w: number; h: number }[]; active?: boolean }) {
  return (
    <div className={`relative h-10 w-12 rounded border ${active ? 'border-[rgb(var(--gold-500))] ring-1 ring-[rgb(var(--gold-300))]' : 'border-[rgb(var(--border))]'} bg-white`}>
      {frames.map((f, i) => <div key={i} className="absolute bg-[rgb(var(--gold-200))]" style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.w * 100}%`, height: `${f.h * 100}%`, outline: '1px solid white' }} />)}
    </div>
  )
}

// Navigatore di RITAGLIO inline (nel pannello): trascina per spostare il fuoco, slider
// per lo zoom, Riempi per azzerare, ±90° per ruotare. Usa lo stesso Cell del rendering
// → l'anteprima coincide col PDF. Compare cliccando una foto.
function InlineCrop({ src, aspect, cell, onChange, onRotate90 }: {
  src: string; aspect: number; cell: Cell; onChange: (c: Cell) => void; onRotate90?: (dir: -1 | 1) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null)
  const z = Math.max(1, cell.z || 1)
  function down(e: React.PointerEvent) { drag.current = { x: e.clientX, y: e.clientY, fx: cell.fx ?? 0.5, fy: cell.fy ?? 0.5 }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId) }
  function move(e: React.PointerEvent) {
    const d = drag.current; if (!d) return
    const r = ref.current!.getBoundingClientRect()
    const nfx = Math.min(1, Math.max(0, d.fx - (e.clientX - d.x) / Math.max(1, r.width) / z))
    const nfy = Math.min(1, Math.max(0, d.fy - (e.clientY - d.y) / Math.max(1, r.height) / z))
    onChange({ ...cell, fx: nfx, fy: nfy })
  }
  function up() { drag.current = null }
  return (
    <div className="space-y-1.5">
      <div ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        className="relative w-full overflow-hidden rounded border border-[rgb(var(--border))] cursor-move touch-none bg-black/5"
        style={{ aspectRatio: String(aspect > 0 ? aspect : 1) }}>
        <img src={src} alt="" draggable={false} style={coverImgStyle(cell)} />
        <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/55 text-white rounded px-1 pointer-events-none">trascina · zoom</span>
      </div>
      <div className="flex items-center gap-1.5">
        <ZoomOut size={13} className="text-[rgb(var(--fg-subtle))] shrink-0" />
        <input type="range" min={1} max={4} step={0.05} value={z} onChange={(e) => onChange({ ...cell, z: +e.target.value })} className="flex-1 accent-[rgb(var(--gold-600))]" />
        <ZoomIn size={13} className="text-[rgb(var(--fg-subtle))] shrink-0" />
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange({ z: 1, fx: 0.5, fy: 0.5 })} className="text-[11px] px-2 py-1 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]">Riempi</button>
        {onRotate90 && <>
          <button title="Ruota a sinistra 90°" onClick={() => onRotate90(-1)} className="text-[11px] px-2 py-1 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))] inline-flex items-center gap-1"><RotateCw size={11} className="-scale-x-100" /> 90°</button>
          <button title="Ruota a destra 90°" onClick={() => onRotate90(1)} className="text-[11px] px-2 py-1 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))] inline-flex items-center gap-1"><RotateCw size={11} /> 90°</button>
        </>}
      </div>
    </div>
  )
}

function PropsPanel(props: {
  page: AlbumPage; activeSlot: number | null; mediaById: Map<string, M>; formatKey: string; aspects: Record<string, number>; lite?: boolean
  onTemplate: (t: TemplateKey) => void; onCycle: () => void; onCell: (s: number, partial: Partial<Cell>) => void
  onClearSlot: (s: number) => void; onCrop: (s: number) => void; onFree: () => void
  onAddPage: () => void; onDelPage: () => void; onDuplicate: () => void
  savedLayouts: SavedLayout[]; onSaveLayout: () => void; onApplyLayout: (l: SavedLayout) => void; onDeleteLayout: (id: string) => void
  crop?: { src: string; aspect: number; cell: Cell; onChange: (c: Cell) => void; onRotate90?: (dir: -1 | 1) => void } | null
}) {
  const { page, activeSlot, mediaById, formatKey, lite, onTemplate, onCycle, onCell, onClearSlot, onCrop, onFree, onAddPage, onDelPage, onDuplicate, savedLayouts, onSaveLayout, onApplyLayout, onDeleteLayout, crop } = props
  const moment = getMoment(page.moment)
  const alts = templatesFor(Math.max(1, page.mediaIds.length))
  const slotMediaId = activeSlot != null ? page.mediaIds[activeSlot] : undefined
  const slotMedia = slotMediaId ? mediaById.get(slotMediaId) : undefined
  const cell = activeSlot != null ? (page.cells?.[activeSlot] ?? DEFAULT_CELL) : DEFAULT_CELL
  const anchorGrid: Array<[string, string]> = [['tl', '↖'], ['tc', '↑'], ['tr', '↗'], ['cl', '←'], ['cc', '•'], ['cr', '→'], ['bl', '↙'], ['bc', '↓'], ['br', '↘']]
  return (
    <div className="space-y-4 text-sm">
      {slotMedia ? (
        <div>
          <p className="font-medium flex items-center gap-1.5 mb-2"><Crop size={14} /> Foto</p>
          <img src={slotMedia.thumbnail_link ?? ''} alt="" className="w-full rounded-lg mb-2 object-cover max-h-28" />
          <Button variant="gold" size="sm" className="w-full mb-2" onClick={() => onCrop(activeSlot!)}><Crop size={14} /> Ritaglia foto</Button>
          <label className="text-xs text-[rgb(var(--fg-muted))]">Zoom <strong>{Math.round(cell.z * 100)}%</strong></label>
          <input type="range" min={100} max={400} value={Math.round(cell.z * 100)} onChange={(e) => onCell(activeSlot!, { z: +e.target.value / 100 })} className="w-full accent-[rgb(var(--gold-600))]" />
          <p className="text-xs text-[rgb(var(--fg-muted))] mt-2 mb-1">Allinea nello slot</p>
          <div className="grid grid-cols-3 gap-1 w-24">
            {anchorGrid.map(([k, sym]) => (
              <button key={k} title="allinea" onClick={() => onCell(activeSlot!, CROP_ANCHORS[k] ?? {})}
                className="h-6 rounded border border-[rgb(var(--border))] text-[11px] hover:bg-[rgb(var(--bg-sunken))]">{sym}</button>
            ))}
          </div>
          <div className="flex gap-1.5 mt-3">
            <Button variant="outline" size="sm" onClick={() => onCell(activeSlot!, { z: 1, fx: 0.5, fy: 0.5 })}><Maximize size={13} /> Riempi</Button>
            <Button variant="outline" size="sm" onClick={() => onClearSlot(activeSlot!)}><Trash2 size={13} /> Togli</Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[rgb(var(--fg-subtle))]">Seleziona una foto: poi <strong>Ritaglia</strong>, sposta, zooma o allinea.</p>
      )}

      <div className="border-t border-[rgb(var(--border))] pt-3">
        <p className="font-medium mb-2 flex items-center gap-1.5"><LayoutGrid size={14} /> Layout pagina {moment && <span className={`text-[10px] px-1.5 py-0.5 rounded ${moment.color}`}>{moment.label}</span>}</p>
        <p className="text-xs text-[rgb(var(--fg-muted))] mb-1.5">Preset per {page.mediaIds.length || 1} foto — tocca per applicare</p>
        <div className="grid grid-cols-3 gap-1.5">
          {alts.map((t) => {
            const tp: AlbumPage = { ...page, template: t, mode: 'template' }
            return (
              <button key={t} title={TPL_LABEL[t]} onClick={() => onTemplate(t)}
                className={`relative rounded-md overflow-hidden border transition ${page.template === t ? 'border-[rgb(var(--gold-500))] ring-1 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--gold-400))]'}`}>
                <div className="w-full bg-white" style={{ aspectRatio: String(getFormat(formatKey).w / getFormat(formatKey).h) }}>
                  <MiniPage page={tp} formatKey={formatKey} mediaById={mediaById} thumb={(m) => m.thumbnail_link ?? ''} />
                </div>
                {page.template === t && <span className="absolute top-0.5 right-0.5 h-3.5 w-3.5 rounded-full bg-[rgb(var(--gold-500))] text-white text-[9px] leading-[14px] text-center">✓</span>}
              </button>
            )
          })}
        </div>
        <Button variant="outline" size="sm" className="w-full mt-2" onClick={onCycle}><Shuffle size={13} /> Mescola disposizione</Button>
        {!lite && <Button variant="outline" size="sm" className="w-full mt-1.5" onClick={onFree}><Move size={13} /> Modifica libera (Canva)</Button>}
        {/* I TUOI LAYOUT: salva la disposizione corrente e riusala su qualsiasi pagina */}
        <div className="mt-3 border-t border-[rgb(var(--border))] pt-2">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-medium text-[rgb(var(--fg-muted))]">I tuoi layout</p>
            {!lite && <button onClick={onSaveLayout} className="text-[11px] inline-flex items-center gap-1 text-[rgb(var(--gold-700))] hover:underline"><Save size={12} /> Salva questo</button>}
          </div>
          {savedLayouts.length === 0
            ? <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Nessun layout salvato.{!lite && ' Disponi la pagina e premi “Salva questo”.'}</p>
            : <div className="flex flex-wrap gap-1.5">
                {savedLayouts.map((l) => (
                  <div key={l.id} className="relative group/lay">
                    <button title={`${l.name} · applica`} onClick={() => onApplyLayout(l)}><FramesDiagram frames={l.frames} active={page.template === 'custom'} /></button>
                    {!lite && <button title="Elimina layout" onClick={() => onDeleteLayout(l.id)} className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-500 text-white text-[10px] leading-none hidden group-hover/lay:flex items-center justify-center">×</button>}
                  </div>
                ))}
              </div>}
        </div>
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">{page.mediaIds.length}/{MAX_PER_PAGE} foto in pagina</p>
        {!lite && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onAddPage}><Plus size={13} /> Tavola</Button>
            <Button variant="outline" size="sm" onClick={onDuplicate}><Copy size={13} /> Duplica</Button>
            <Button variant="outline" size="sm" className="text-rose-500" onClick={onDelPage}><Trash2 size={13} /> Elimina</Button>
          </div>
        )}
        {/* NAVIGATORE DI RITAGLIO inline: appare cliccando una foto dello slot */}
        {crop && (
          <div className="mt-3 border-t border-[rgb(var(--border))] pt-3">
            <p className="text-[11px] font-medium mb-1.5 flex items-center gap-1"><Crop size={12} /> Ritaglia la foto</p>
            <InlineCrop src={crop.src} aspect={crop.aspect} cell={crop.cell} onChange={crop.onChange} onRotate90={crop.onRotate90} />
          </div>
        )}
      </div>
    </div>
  )
}

// Pannello proprietà in modalità LIBERA (Canva): sfondo pagina + trasformazioni elemento.
function FreePanel(props: {
  page: AlbumPage; selEl: string | null; lite?: boolean
  onBg: (c: string) => void; onElUpdate: (id: string, patch: Partial<FreeEl>) => void
  onElCrop: (id: string) => void; onElRemove: (id: string) => void
  onAddPage: () => void; onDelPage: () => void; onDuplicate: () => void
  crop?: { src: string; aspect: number; cell: Cell; onChange: (c: Cell) => void; onRotate90?: (dir: -1 | 1) => void } | null
}) {
  const { page, selEl, lite, onBg, onElUpdate, onElCrop, onElRemove, onAddPage, onDelPage, onDuplicate, crop } = props
  const el = (page.elements ?? []).find((e) => e.id === selEl)
  const SWATCHES = ['#ffffff', '#f7f3ee', '#1a1714', '#0a0a0a', '#e8d9c4', '#c9a87c', '#2b3a4a', '#d8a7b1']
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium mb-2 flex items-center gap-1.5"><Square size={14} /> Sfondo pagina</p>
        <div className="flex items-center gap-2 flex-wrap">
          {SWATCHES.map((c) => <button key={c} onClick={() => onBg(c)} title={c} className={`h-6 w-6 rounded-full border ${page.bg === c ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'}`} style={{ background: c }} />)}
          <input type="color" value={page.bg ?? '#ffffff'} onChange={(e) => onBg(e.target.value)} className="h-7 w-7 rounded cursor-pointer" title="Colore personalizzato" />
        </div>
      </div>

      {el ? (
        <div className="border-t border-[rgb(var(--border))] pt-3 space-y-2">
          <p className="font-medium flex items-center gap-1.5"><Move size={14} /> Foto</p>
          <Button variant="gold" size="sm" className="w-full" onClick={() => onElCrop(el.id)}><Crop size={14} /> Ritaglia</Button>
          <label className="text-xs text-[rgb(var(--fg-muted))] flex items-center gap-1"><RotateCw size={12} /> Rotazione <strong>{Math.round(el.rot)}°</strong></label>
          <input type="range" min={0} max={360} value={Math.round(el.rot)} onChange={(e) => onElUpdate(el.id, { rot: +e.target.value })} className="w-full accent-[rgb(var(--gold-600))]" />
          <div className="flex gap-1.5">
            <button onClick={() => onElUpdate(el.id, { rot: 0 })} className="text-[11px] px-2 py-1 rounded border border-[rgb(var(--border))]">0°</button>
            <button onClick={() => onElUpdate(el.id, { rot: 90 })} className="text-[11px] px-2 py-1 rounded border border-[rgb(var(--border))]">90°</button>
            <button onClick={() => onElUpdate(el.id, { rot: (el.rot + 90) % 360 })} className="text-[11px] px-2 py-1 rounded border border-[rgb(var(--border))]">+90°</button>
          </div>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none mt-1">
            <input type="checkbox" checked={!!el.border} onChange={(e) => onElUpdate(el.id, { border: e.target.checked ? { w: 2, color: '#ffffff' } : null })} className="h-4 w-4 accent-[rgb(var(--gold-600))]" /> Bordo
          </label>
          {el.border && (
            <div className="flex items-center gap-2 pl-6">
              <input type="color" value={el.border.color} onChange={(e) => onElUpdate(el.id, { border: { w: el.border!.w, color: e.target.value } })} className="h-6 w-6 rounded cursor-pointer" />
              <input type="range" min={1} max={12} value={el.border.w} onChange={(e) => onElUpdate(el.id, { border: { w: +e.target.value, color: el.border!.color } })} className="flex-1 accent-[rgb(var(--gold-600))]" />
            </div>
          )}
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input type="checkbox" checked={!!el.shadow} onChange={(e) => onElUpdate(el.id, { shadow: e.target.checked })} className="h-4 w-4 accent-[rgb(var(--gold-600))]" /> Ombra
          </label>
          <Button variant="outline" size="sm" className="w-full text-rose-500 mt-1" onClick={() => onElRemove(el.id)}><Trash2 size={13} /> Rimuovi foto</Button>
        </div>
      ) : (
        <p className="text-xs text-[rgb(var(--fg-subtle))] border-t border-[rgb(var(--border))] pt-3">Clicca una foto per spostarla (compaiono le guide), ridimensionarla, ruotarla. Doppio click = ritaglia.</p>
      )}

      {!lite && (
        <div className="border-t border-[rgb(var(--border))] pt-3 flex gap-1.5 flex-wrap">
          <Button variant="outline" size="sm" onClick={onAddPage}><Plus size={13} /> Tavola</Button>
          <Button variant="outline" size="sm" onClick={onDuplicate}><Copy size={13} /> Duplica</Button>
          <Button variant="outline" size="sm" className="text-rose-500" onClick={onDelPage}><Trash2 size={13} /> Elimina</Button>
        </div>
      )}
      {/* NAVIGATORE DI RITAGLIO inline (sotto i pulsanti): clic sulla foto → ritagli qui */}
      {crop && (
        <div className="border-t border-[rgb(var(--border))] pt-3">
          <p className="text-[11px] font-medium mb-1.5 flex items-center gap-1"><Crop size={12} /> Ritaglia la foto</p>
          <InlineCrop src={crop.src} aspect={crop.aspect} cell={crop.cell} onChange={crop.onChange} onRotate90={crop.onRotate90} />
        </div>
      )}
    </div>
  )
}

// ── Modale RITAGLIO: vedi tutta la foto + rettangolo di crop (sposta/ridimensiona) ──
function CropModal(props: { src: string; imgAspect: number; slotAspect: number; cell: Cell; onApply: (c: Cell) => void; onClose: () => void }) {
  const { src, imgAspect, slotAspect, cell: initial, onApply, onClose } = props
  const [cell, setCell] = useState<Cell>(initial)
  // aspetto REALE della foto: misurato al load (il default passato può essere sbagliato → ritaglio storto)
  const [asp, setAsp] = useState(imgAspect)
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ mode: 'move' | 'resize'; x: number; y: number; cell: Cell } | null>(null)

  // rettangolo immagine renderizzata (object-contain) dentro il box
  function imgRect() {
    const el = boxRef.current; if (!el) return { x: 0, y: 0, w: 1, h: 1 }
    const W = el.clientWidth, H = el.clientHeight
    let w = W, h = W / asp
    if (h > H) { h = H; w = H * asp }
    return { x: (W - w) / 2, y: (H - h) / 2, w, h }
  }

  const crop = cellToCrop(asp, slotAspect, cell) // cx,cy,w,h in frazioni immagine
  const ir = imgRect()
  const boxStyle = {
    left: ir.x + (crop.cx - crop.w / 2) * ir.w, top: ir.y + (crop.cy - crop.h / 2) * ir.h,
    width: crop.w * ir.w, height: crop.h * ir.h,
  }

  function onDown(e: React.PointerEvent, mode: 'move' | 'resize') {
    e.stopPropagation(); dragRef.current = { mode, x: e.clientX, y: e.clientY, cell }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onMove(e: React.PointerEvent) {
    const d = dragRef.current; if (!d) return
    const r = imgRect()
    if (d.mode === 'move') {
      const dfx = (e.clientX - d.x) / Math.max(1, r.w), dfy = (e.clientY - d.y) / Math.max(1, r.h)
      setCell(cropToCell(asp, slotAspect, clampN(d.cell.fx + dfx), clampN(d.cell.fy + dfy), cellToCrop(asp, slotAspect, d.cell).w))
    } else {
      // ridimensiona attorno al centro: nuovo semilato = distanza dal centro
      const cxpx = r.x + d.cell.fx * r.w, cypx = r.y + d.cell.fy * r.h
      const halfW = Math.abs(e.clientX - cxpx), halfH = Math.abs(e.clientY - cypx)
      const wFrac = Math.max((halfW * 2) / r.w, ((halfH * 2) / r.h) * (asp / slotAspect))
      setCell(cropToCell(asp, slotAspect, d.cell.fx, d.cell.fy, wFrac))
    }
  }
  function onUp() { dragRef.current = null }

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-2 text-white" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm font-medium flex items-center gap-2"><Crop size={16} /> Ritaglia</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="!text-white !border-white/30" onClick={() => setCell({ z: 1, fx: 0.5, fy: 0.5 })}>Riempi</Button>
          <Button variant="gold" size="sm" onClick={() => onApply(cell)}>Applica</Button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-white/10"><X size={18} className="text-white" /></button>
        </div>
      </div>
      <div className="flex-1 min-h-0 p-4 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <div ref={boxRef} className="relative max-w-full max-h-full" style={{ width: '90vw', height: '78vh' }}>
          <img src={src} alt="" onLoad={(e) => { const t = e.currentTarget; if (t.naturalWidth && t.naturalHeight) setAsp(t.naturalWidth / t.naturalHeight) }} className="absolute inset-0 w-full h-full object-contain select-none pointer-events-none opacity-50" />
          {/* finestra di ritaglio: parte luminosa */}
          <div className="absolute overflow-hidden ring-2 ring-white shadow-[0_0_0_9999px_rgba(0,0,0,.5)] cursor-move touch-none"
            style={boxStyle} onPointerDown={(e) => onDown(e, 'move')} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
            <img src={src} alt="" className="absolute select-none pointer-events-none max-w-none"
              style={{ left: -((boxStyle.left as number) - ir.x), top: -((boxStyle.top as number) - ir.y), width: ir.w, height: ir.h }} />
            {/* terzi */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 bottom-0 left-1/3 border-l border-white/40" />
              <div className="absolute top-0 bottom-0 left-2/3 border-l border-white/40" />
              <div className="absolute left-0 right-0 top-1/3 border-t border-white/40" />
              <div className="absolute left-0 right-0 top-2/3 border-t border-white/40" />
            </div>
            {/* maniglia ridimensiona (basso-destra) */}
            <div className="absolute -bottom-1.5 -right-1.5 h-4 w-4 bg-white rounded-sm border border-black/20 cursor-nwse-resize"
              onPointerDown={(e) => onDown(e, 'resize')} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} />
          </div>
        </div>
      </div>
      <div className="text-center text-white/70 text-xs pb-3" onClick={(e) => e.stopPropagation()}>Trascina il riquadro per spostarlo · trascina l'angolo per ingrandirlo/rimpicciolirlo</div>
    </div>
  )
}

// Cattura eventuali errori di render: invece di white-screen mostra un messaggio + l'errore.
class AlbumBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error) { console.error('AlbumDesigner crash', err) }
  render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-[rgb(var(--bg-sunken))]">
          <p className="font-display text-xl mb-2">Qualcosa è andato storto nell'album</p>
          <p className="text-sm text-[rgb(var(--fg-muted))] max-w-md">Ricarica la pagina. Se continua, mostra questo messaggio al fotografo:</p>
          <pre className="mt-3 text-[11px] text-rose-500 max-w-md overflow-auto whitespace-pre-wrap">{this.state.err.message}</pre>
          <button onClick={() => location.reload()} className="mt-5 px-4 py-2 rounded-lg bg-[rgb(var(--gold-500))] text-white text-sm">Ricarica</button>
        </div>
      )
    }
    return this.props.children
  }
}

export default function AlbumDesignerPage() {
  return <AlbumBoundary><AlbumDesignerInner /></AlbumBoundary>
}
