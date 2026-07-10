import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, Loader2, Download, Plus, Minus, Trash2, Copy, ArrowUpToLine,
  ZoomIn, ZoomOut, ImagePlus, Sparkles, X, LayoutTemplate, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { coverImgStyle, DEFAULT_CELL } from '@/lib/albumGeometry'
import { moveEl, resizeEl, type FreeEl, type Corner } from '@/lib/albumFree'
import type { AlbumPage } from '@/lib/albumEngine'
import { CAROUSEL_FORMATS, getCarouselFormat, DEFAULT_CAROUSEL_FORMAT, CAROUSEL_MODELS, getModel } from '@/lib/caroselloModels'
import { exportCaroselloZip } from '@/lib/caroselloExport'
import { hiResProxyUrl } from '@/lib/albumExport'

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
  const [selId, setSelId] = useState<string | null>(null)
  const [modelKey, setModelKey] = useState<string | null>('one')
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
      const res = data as { exists?: boolean; format_key?: string; slides?: number; layout?: { strip?: AlbumPage } } | null
      if (res?.exists && res.layout?.strip) {
        setFormat(res.format_key || DEFAULT_CAROUSEL_FORMAT)
        setN(Math.min(20, Math.max(1, res.slides || 3)))
        setStrip({ ...res.layout.strip, mode: 'free', elements: res.layout.strip.elements ?? [] })
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
      p_entry: entryId, p_format: format, p_slides: n, p_status: 'DRAFT', p_layout: { strip },
    })
    if (!error) setSavedAt(Date.now())
  }, [entryId, format, n, strip])
  useEffect(() => {
    if (!loadedRef.current) return
    if (autoTimer.current) window.clearTimeout(autoTimer.current)
    autoTimer.current = window.setTimeout(() => { void save() }, 1500)
    return () => { if (autoTimer.current) window.clearTimeout(autoTimer.current) }
  }, [strip, format, n, save])

  // ── helpers editing ─────────────────────────────────────────────────────────
  const setElements = (els: FreeEl[]) => setStrip((s) => ({ ...s, elements: els }))
  const updateEl = (id: string, fn: (e: FreeEl) => FreeEl) => setElements(elements.map((e) => (e.id === id ? fn(e) : e)))
  const updateCell = (id: string, patch: Partial<FreeEl['cell']>) => updateEl(id, (e) => ({ ...e, cell: { ...e.cell, ...patch } }))

  function applyModel(key: string) {
    const model = getModel(key)
    setElements(model.build(n, keptIds))
    setModelKey(key)
    setSelId(null)
  }
  function changeN(next: number) {
    const nn = Math.min(20, Math.max(1, next))
    setN(nn)
    if (modelKey) setElements(getModel(modelKey).build(nn, keptIds)) // rebuild premodello sul nuovo N
    setSelId(null)
  }
  // assegna/sostituisci la foto: se c'è uno slot selezionato lo riempie; altrimenti il primo vuoto.
  function assignPhoto(mediaId: string) {
    if (sel) { updateEl(sel.id, (e) => ({ ...e, mediaId })); return }
    const empty = elements.find((e) => !e.mediaId)
    if (empty) { updateEl(empty.id, (e) => ({ ...e, mediaId })); setSelId(empty.id); return }
    // nessuno slot: aggiungi un elemento libero al centro della slide corrente
    const el: FreeEl = { id: uid(), mediaId, x: 0.3, y: 0.3, w: Math.min(0.4, 1 / n * 0.8), h: 0.4, rot: 0, cell: { ...DEFAULT_CELL } }
    setElements([...elements, el]); setSelId(el.id); setModelKey(null)
  }

  // ── drag / resize (pointer) ────────────────────────────────────────────────
  const drag = useRef<{ mode: 'move' | Corner; id: string; sx: number; sy: number; e0: FreeEl } | null>(null)
  const ptTo01 = (clientX: number, clientY: number) => {
    const r = stripRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)) }
  }
  function startDrag(e: React.PointerEvent, mode: 'move' | Corner, el: FreeEl) {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    const p = ptTo01(e.clientX, e.clientY)
    drag.current = { mode, id: el.id, sx: p.x, sy: p.y, e0: el }
    setSelId(el.id); setModelKey(null)
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current; if (!d) return
    const p = ptTo01(e.clientX, e.clientY)
    if (d.mode === 'move') { const e0 = d.e0, sx = d.sx, sy = d.sy; updateEl(d.id, () => moveEl(e0, e0.x + (p.x - sx), e0.y + (p.y - sy))) }
    else { const corner = d.mode, e0 = d.e0; updateEl(d.id, () => resizeEl(e0, corner, p.x, p.y)) }
  }
  function endDrag() { drag.current = null }

  function removeSel() { if (!sel) return; setElements(elements.filter((e) => e.id !== sel.id)); setSelId(null); setModelKey(null) }
  function duplicateSel() { if (!sel) return; const c = { ...sel, id: uid(), x: Math.min(0.9, sel.x + 0.02), y: Math.min(0.9, sel.y + 0.02) }; setElements([...elements, c]); setSelId(c.id); setModelKey(null) }
  function bringFront() { if (!sel) return; setElements([...elements.filter((e) => e.id !== sel.id), sel]); setModelKey(null) }

  // ── EXPORT seamless ─────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false)
  async function exportZip() {
    if (exporting) return
    if (elements.every((e) => !e.mediaId)) { toast.error('Aggiungi almeno una foto'); return }
    setExporting(true); setExportProg({ done: 0, total: n })
    try {
      const SB = import.meta.env.VITE_SUPABASE_URL, AK = import.meta.env.VITE_SUPABASE_ANON_KEY
      let grant: string | null = null
      try { const { data } = await (supabase.rpc as any)('album_export_grant', { p_entry: entryId }); grant = (data as string) ?? null } catch { grant = null }
      const resolve = (id: string) => { const m = mediaById.get(id); if (!m) return ''; return grant && isDrive(m) ? hiResProxyUrl(SB, AK, grant, id) : hiUrl(m) }
      await exportCaroselloZip(strip, fmt.w, fmt.h, n, resolve, {
        filename: `carosello-${n}slide.zip`,
        onProgress: (done, total) => setExportProg({ done, total }),
        onZip: (z) => setExportProg((p) => (p ? { ...p, zip: z } : { done: n, total: n, zip: z })),
      })
      toast.success(`${n} slide esportate: caricale su Instagram nell'ordine slide-01 → slide-${String(n).padStart(2, '0')} per lo swipe continuo.`, { duration: 9000 })
    } catch (e) { toast.error(`Export non riuscito: ${(e as Error).message}`) }
    finally { setExporting(false); setExportProg(null) }
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
          {/* formato */}
          <select value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 text-sm">
            {CAROUSEL_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          {/* numero slide */}
          <div className="flex items-center gap-1 h-9 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-1">
            <button onClick={() => changeN(n - 1)} disabled={n <= 1} className="p-1.5 disabled:opacity-30 hover:bg-[rgb(var(--bg-sunken))] rounded"><Minus size={14} /></button>
            <span className="text-sm tabular-nums w-16 text-center">{n} slide</span>
            <button onClick={() => changeN(n + 1)} disabled={n >= 20} className="p-1.5 disabled:opacity-30 hover:bg-[rgb(var(--bg-sunken))] rounded"><Plus size={14} /></button>
          </div>
          <Button variant="gold" size="sm" disabled={exporting} onClick={() => void exportZip()}>{exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Esporta per Instagram</Button>
        </div>
      </header>

      {/* PREMODELLI */}
      <div className="bg-[rgb(var(--bg))] border-b border-[rgb(var(--border))] px-3 sm:px-5 py-2 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] flex items-center gap-1 shrink-0"><LayoutTemplate size={13} /> Premodelli</span>
        {CAROUSEL_MODELS.map((m) => (
          <button key={m.key} title={m.hint} onClick={() => applyModel(m.key)}
            className={`shrink-0 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${modelKey === m.key ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}>{m.label}</button>
        ))}
        <span className="text-[11px] text-[rgb(var(--fg-subtle))] shrink-0 ml-1">oppure sposta/ridimensiona a mano</span>
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-[rgb(var(--fg-subtle))]">Sfondo</span>
          {BG_SWATCHES.map((c) => (
            <button key={c} onClick={() => setStrip((s) => ({ ...s, bg: c }))} title="Sfondo strip"
              className={`h-6 w-6 rounded-full border ${strip.bg === c ? 'ring-2 ring-[rgb(var(--gold-500))] border-transparent' : 'border-[rgb(var(--border))]'}`} style={{ background: c }} />
          ))}
        </div>
      </div>

      {/* STRIP EDITOR */}
      <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 flex items-start justify-center" onPointerDown={() => setSelId(null)}>
        <div className="inline-block">
          <div ref={stripRef} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag}
            className="relative shadow-2xl select-none touch-none"
            style={{ height: 'min(64vh, 620px)', aspectRatio: String(stripAspect), background: strip.bg ?? '#fff' }}
            onPointerDown={(e) => e.stopPropagation()}>
            {/* elementi */}
            {elements.map((el) => {
              const m = el.mediaId ? mediaById.get(el.mediaId) : null
              const active = el.id === selId
              return (
                <div key={el.id} onPointerDown={(e) => startDrag(e, 'move', el)}
                  className={`absolute overflow-hidden cursor-move ${active ? 'outline outline-2 outline-[rgb(var(--gold-500))] z-20' : 'z-10'}`}
                  style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, boxShadow: el.shadow ? '0 6px 18px rgba(0,0,0,.28)' : undefined, border: el.border ? `${el.border.w}px solid ${el.border.color}` : undefined }}>
                  {m ? <img src={thumbUrl(m)} alt="" draggable={false} style={coverImgStyle(el.cell)} />
                    : <div className="absolute inset-0 grid place-items-center bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-subtle))]"><ImagePlus size={20} /></div>}
                  {active && (['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                    <span key={c} onPointerDown={(e) => startDrag(e, c, el)}
                      className="absolute h-3.5 w-3.5 rounded-full bg-white border-2 border-[rgb(var(--gold-500))] z-30"
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

      {/* TRAY selezione foto */}
      <div className="sticky bottom-0 z-20 bg-[rgb(var(--bg))] border-t border-[rgb(var(--border))] px-3 py-2">
        <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1.5">{sel ? 'Tocca una foto per metterla nello slot selezionato' : 'Tocca una foto per riempire il primo slot vuoto'} · dalla selezione dell’album ({media.length})</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {media.length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))] py-2">Nessuna foto selezionata: scegli le foto nell’album (cuori) e torna qui.</p>}
          {media.map((m) => {
            const used = elements.some((e) => e.mediaId === m.id)
            return (
              <button key={m.id} onClick={() => assignPhoto(m.id)} className="relative shrink-0 h-16 w-16 rounded-md overflow-hidden border border-[rgb(var(--border))] hover:ring-2 hover:ring-[rgb(var(--gold-400))]">
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
