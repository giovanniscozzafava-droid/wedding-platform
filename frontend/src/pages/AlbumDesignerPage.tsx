import { Component, Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import HTMLFlipBook from 'react-pageflip'
import { RotateScreenGate } from '@/components/ui/RotateScreenGate'
import { useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Wand2, Sparkles, Save, Plus, Trash2, ChevronLeft, ChevronRight, Heart, Loader2, LayoutGrid, FileImage, FileText, X, FlipHorizontal2, FlipVertical2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ALBUM_FORMATS, DEFAULT_FORMAT, getFormat, pageAspect, isCustomFormat, listCustomFormats, saveCustomFormat, deleteCustomFormat, customFormatKey, type AlbumFormat } from '@/lib/albumFormats'
import { MOMENTS, getMoment, ALBUM_MIN_PHOTOS, ALBUM_MAX_PHOTOS } from '@/lib/albumMoments'
import { autoLayout, framesForPage, newPage, templatesFor, cycleTemplate, MAX_PER_PAGE, type AlbumPage, type TemplateKey } from '@/lib/albumEngine'
import { exportAlbumPdf, exportAlbumJpgZip, hiResProxyUrl, ExportCancelled } from '@/lib/albumExport'
import { coverImgStyle, slotAspectOf, cellToCrop, cropToCell, coverWindow, CROP_ANCHORS, DEFAULT_CELL, MARGIN_MM, type Cell } from '@/lib/albumGeometry'

// Ritaglio TESTA-SAFE + aureo: orizzontalmente mette il volto su una linea aurea; verticalmente
// GARANTISCE che la testa (ht = top testa) resti nell'inquadratura — MAI teste tagliate. z=1 (nessuno
// zoom che tagli). Se il soggetto è più alto della finestra, priorità alla testa.
function goldenCell(imgAspect: number, slotAspect: number, fx: number, fy: number, ht?: number, hb?: number, hasFace?: boolean, sx?: number, sr?: number): Cell {
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  const w = coverWindow(imgAspect > 0 ? imgAspect : 1, slotAspect > 0 ? slotAspect : 1, { z: 1, fx: 0.5, fy: 0.5 })
  const hWin = w.sh > 0 ? w.wh / w.sh : 1 // altezza finestra (frazione altezza immagine)
  const wWin = w.ww                        // larghezza finestra (frazione larghezza immagine)
  // RIQUADRO DI TUTTI I SOGGETTI (se ci sono persone) da tenere dentro
  const bx0 = hasFace ? (typeof sx === 'number' ? sx : clamp(fx - 0.15)) : fx
  const bx1 = hasFace ? (typeof sr === 'number' ? sr : clamp(fx + 0.15)) : fx
  const by0 = typeof ht === 'number' ? ht : (hasFace ? Math.max(0, fy - hWin * 0.28) : fy) // top testa
  const by1 = typeof hb === 'number' ? hb : (hasFace ? Math.min(1, fy + hWin * 0.28) : fy) // basso corpo
  const m = 0.02
  // ORIZZONTALE: paesaggi → aureo; persone → includi TUTTO il riquadro (nessuno escluso ai lati)
  let cx: number
  if (!hasFace) { const t = fx <= 0.5 ? 0.382 : 0.618; cx = fx + wWin * (0.5 - t) }
  else {
    cx = (bx0 + bx1) / 2                                                    // centra il riquadro soggetti
    if (bx1 - bx0 <= wWin) { if (cx - wWin / 2 > bx0 - m) cx = bx0 - m + wWin / 2; if (cx + wWin / 2 < bx1 + m) cx = bx1 + m - wWin / 2 }
  }
  // VERTICALE: se testa+corpo entrano li centro; poi ALZO per garantire SEMPRE la testa
  let cy = fy
  if (by1 - by0 <= hWin) cy = (by0 + by1) / 2
  if (cy - hWin / 2 > by0 - m) cy = by0 - m + hWin / 2
  return { z: 1, fx: clamp(cx), fy: clamp(cy) }
}

// Griglia ordinata per tavole con TANTE foto (fino a 24): righe/colonne bilanciate su un'area.
function gridSlots(n: number, areaAspect: number): { x: number; y: number; w: number; h: number }[] {
  if (n <= 0) return []
  const cols = Math.max(1, Math.min(n, Math.round(Math.sqrt(n * Math.max(0.2, areaAspect)))))
  const rows = Math.max(1, Math.ceil(n / cols))
  const out: { x: number; y: number; w: number; h: number }[] = []
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols)
    const cnt = r === rows - 1 ? n - cols * (rows - 1) : cols // ultima riga: distribuisci ciò che resta
    const c = i - cols * r
    out.push({ x: c / cnt, y: r / rows, w: 1 / cnt, h: 1 / rows })
  }
  return out
}

// Disposizione GIUSTIFICATA (stile galleria): ogni foto tiene le sue proporzioni reali (verticali
// restano strette/alte, orizzontali larghe). Righe che riempiono la larghezza; slot[i] è della foto i.
// Trascinamento di foto GIÀ piazzate tra le tavole (sposta / crea nuova tavola prima-dopo).
type MovePayload = { fromPageId: string; elIds: string[]; mediaIds: string[] }

function justifiedSlots(aspectsArr: number[], spreadAspect: number): { x: number; y: number; w: number; h: number }[] {
  const n = aspectsArr.length
  if (!n) return []
  const a = aspectsArr.map((x) => (x > 0 ? x : 1))
  const T = a.reduce((s, x) => s + x, 0)
  // NUMERO DI RIGHE OTTIMALE per NON distorcere: con R=√(ΣAspetti/aspettoTavola) l'altezza naturale
  // totale delle righe ≈ 1, quindi la normalizzazione è ≈ identità → gli slot hanno l'aspetto REALE
  // delle foto → object-cover NON taglia (verticali restano verticali, orizzontali orizzontali).
  const R = Math.max(1, Math.min(n, Math.round(Math.sqrt(T / Math.max(0.3, spreadAspect)))))
  const target = T / R // somma-aspetti per riga
  const rows: number[][] = []; let cur: number[] = []; let sum = 0
  for (let i = 0; i < n; i++) { cur.push(i); sum += a[i]!; if (sum >= target && rows.length < R - 1) { rows.push(cur); cur = []; sum = 0 } }
  if (cur.length) rows.push(cur)
  const rowSums = rows.map((r) => r.reduce((s, i) => s + a[i]!, 0))
  const heights = rowSums.map((rs) => spreadAspect / rs) // altezza NATURALE riga (aspetto esatto delle foto)
  const H = heights.reduce((s, h) => s + h, 0) || 1
  // SCALA UNIFORME (w e h insieme → preserva gli aspetti = NESSUN taglio) per stare nella tavola, e centra.
  const sc = Math.min(1, 1 / H)
  const totW = sc, totH = sc * H
  const offX = (1 - totW) / 2, offY = (1 - totH) / 2
  const out: { x: number; y: number; w: number; h: number }[] = new Array(n)
  let y = offY
  rows.forEach((r, ri) => {
    const rs = rowSums[ri]!; const h = heights[ri]! * sc
    let x = offX
    r.forEach((i) => { const w = (a[i]! / rs) * sc; out[i] = { x, y, w, h }; x += w })
    y += h
  })
  return out
}
import { placeInPage, clearSlotInPage, setCell, setPageTemplate, insertPageAfter, removePage } from '@/lib/albumOps'
import { toFreeElements, newFreeEl, moveEl, resizeEl, snapMove, snapAngle, spacingSnap, neighborGaps, moveManyBy, removeFreeEl, removeManyFree, updateFreeEl, bringToFront, type FreeEl, type Corner, type GapMark } from '@/lib/albumFree'
import { listLayouts, saveLayout, deleteLayout, applyLayout, pageToFrames, pageToFreeEls, type SavedLayout } from '@/lib/albumLayouts'
import { genTavolaLayouts, assignPhotos, gutterSlot, classifyAspect, type Orient, type Slot, type GenLayout } from '@/lib/albumPresetGen'
import { albumRoleOf, primaryAction, statusLabel } from '@/lib/albumWorkflow'
import { Crop, Maximize, Grid3x3, Frame, Scissors, RotateCw, Move, Square, MessageSquare, Check, Shuffle, Copy, Sliders, Undo2, Redo2, Hash, ZoomIn, ZoomOut, Eye, Ruler, Maximize2, Minimize2, AlertTriangle, ChevronLeft as ChevLeft, ChevronRight as ChevRight } from 'lucide-react'
import { photoQuality, qualityHint, countLowRes, elPrintMm, HIURL_CAP, type RealDim, type Quality } from '@/lib/albumQuality'
import { MyStylePanel } from '@/components/album/MyStylePanel'
import { FunnelSteps } from '@/components/album/FunnelSteps'
import { ObjectRemoveModal } from '@/components/album/ObjectRemoveModal'

type M = {
  id: string; drive_file_id: string; thumbnail_link: string | null
  media_type: 'PHOTO' | 'VIDEO'; guest_tag_name: string | null
  album_choice: 'KEPT' | 'DISCARDED' | null; album_moment: string | null
}

// POST-IT: richiesta di modifica del cliente appuntata in un punto della tavola (anchor 0..1) ed
// eventualmente su una foto (media_id). page_index/tavola_index per retro-compatibilità.
type Postit = {
  id: string; author_name: string | null; page_index: number | null
  tavola_index: number | null; anchor_x: number | null; anchor_y: number | null; media_id: string | null
  kind?: string | null; replace_media_id?: string | null // 'REPLACE' = sostituisci la foto
  body: string; status: string; created_at: string
  reply?: string | null; reply_reason?: string | null; reply_at?: string | null // risposta del fotografo ("perché meglio di no")
}

// Motivazioni tecniche con cui il fotografo può rispondere "perché meglio di no" a una richiesta
// del cliente: ognuna precompila una spiegazione (modificabile) e resta come tag rapido.
const ALBUM_REPLY_REASONS: { key: string; label: string; hint: string }[] = [
  { key: 'proporzioni', label: 'Proporzioni', hint: 'La foto è verticale: ingrandirla per riempire lo spazio orizzontale la taglierebbe troppo. Così mantiene le giuste proporzioni.' },
  { key: 'pagine', label: 'Numero pagine', hint: 'Aggiungere altre foto qui sfora il numero di pagine concordato del libro (e ne aumenta il costo). Le ho selezionate per restare nel formato.' },
  { key: 'qualita', label: 'Qualità / risoluzione', hint: 'Questo scatto è a risoluzione più bassa: ingrandito in stampa risulterebbe sgranato. Meglio tenerlo a questa dimensione.' },
  { key: 'ritaglio', label: 'Taglio / inquadratura', hint: 'Spostando o ritagliando come chiesto si perderebbe parte del soggetto (testa/piedi). L’inquadratura attuale è più equilibrata.' },
  { key: 'dorso', label: 'Dorso / piega', hint: 'In quel punto cadrebbe la piega centrale del libro: un viso sul dorso si rovinerebbe. L’ho spostato apposta.' },
  { key: 'stampa', label: 'Margini di stampa', hint: 'È troppo vicino al bordo di taglio: in stampa si rischia di tagliare il soggetto. Ho lasciato l’abbondanza di sicurezza.' },
  { key: 'estetica', label: 'Equilibrio impaginazione', hint: 'La doppia pagina perderebbe equilibrio visivo. La disposizione attuale fa respirare meglio le foto.' },
  { key: 'racconto', label: 'Coerenza del racconto', hint: 'Spostarla qui rompe la sequenza cronologica del racconto. L’ho messa dov’è per far filare la storia.' },
  { key: 'altro', label: 'Altro', hint: '' },
]

const isDrive = (m: M) => !!m.drive_file_id && !m.drive_file_id.startsWith('demo-') && !m.drive_file_id.startsWith('guest:') && !m.drive_file_id.startsWith('album:')
const thumbUrl = (m: M) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w800` : (m.thumbnail_link ?? ''))
const hiUrl = (m: M) => (isDrive(m) ? `https://drive.google.com/thumbnail?id=${m.drive_file_id}&sz=w1600` : (m.thumbnail_link ?? ''))

// Stili di impaginazione che l'AI può seguire (li sceglie il fotografo prima di comporre).
const AI_STYLES: { key: string; label: string; desc: string }[] = [
  { key: 'fotografo',     label: 'Il mio stile',  desc: 'Come i tuoi album: poche foto per pagina, tanto respiro, foto intere; doppia pagina solo sugli orizzontali forti; gruppi in mosaico.' },
  { key: 'narrativo',     label: 'Narrativo',     desc: 'Racconto cronologico, tante foto che scorrono. Stile reportage.' },
  { key: 'editoriale',    label: 'Editoriale',    desc: 'Stile magazine: molto respiro, pochi scatti forti per tavola.' },
  { key: 'ritrattistico', label: 'Ritrattistico', desc: 'Ritratti e persone protagonisti, primi piani e coppie in grande.' },
  { key: 'dettaglio',     label: 'Dettaglio',     desc: 'Dettagli e allestimenti in evidenza: bouquet, fedi, close-up.' },
]

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

// TAVOLA UNICA (sola lettura): rende gli elementi liberi su tutta la superficie. Il contenitore
// padre deve avere l'aspetto della tavola (2×W × H). Usato in anteprima, vista cliente, miniatura.
function FreeSurface({ page, mediaById, thumb }: { page: AlbumPage; mediaById: Map<string, M>; thumb: (m: M) => string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: page.bg ?? '#ffffff' }}>
      {(page.elements ?? []).map((el) => {
        const m = mediaById.get(el.mediaId)
        return (
          <div key={el.id} className="absolute overflow-hidden" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, boxShadow: el.shadow ? '0 6px 18px rgba(0,0,0,.28)' : undefined, border: el.border ? `${el.border.w}px solid ${el.border.color}` : undefined }}>
            {m && <img src={thumb(m)} alt="" draggable={false} style={coverImgStyle(el.cell)} />}
          </div>
        )
      })}
    </div>
  )
}

// MEZZA tavola (pagina SINISTRA o DESTRA) della superficie unica: renderizza l'intera tavola (2W)
// in un wrapper largo il doppio e ne clippa la metà richiesta → usata come "foglio" del libro
// sfogliabile lato cliente (react-pageflip), così lo sfoglio è pagina-per-pagina come un vero album.
function HalfSurface({ page, side, mediaById, thumb }: { page: AlbumPage; side: 'L' | 'R'; mediaById: Map<string, M>; thumb: (m: M) => string }) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: page.bg ?? '#ffffff' }}>
      <div className="absolute top-0 h-full" style={{ width: '200%', left: side === 'L' ? '0%' : '-100%' }}>
        <FreeSurface page={page} mediaById={mediaById} thumb={thumb} />
      </div>
    </div>
  )
}

// Miniatura SCHEMATICA di una disposizione (solo griglia/riquadri vuoti, niente foto). aspect = 2W/H.
function Wireframe({ slots, aspect }: { slots: { x: number; y: number; w: number; h: number; rot?: number }[]; aspect: number }) {
  return (
    <div className="relative w-full overflow-hidden bg-[rgb(var(--bg-sunken))]" style={{ aspectRatio: String(aspect) }}>
      {slots.map((s, i) => (
        <div key={i} className="absolute rounded-[1px] border border-[rgb(var(--fg-muted))] bg-[rgb(var(--bg))]"
          style={{ left: `${(s.x + 0.015) * 100}%`, top: `${(s.y + 0.02) * 100}%`, width: `${(s.w - 0.03) * 100}%`, height: `${(s.h - 0.04) * 100}%`, transform: s.rot ? `rotate(${s.rot}deg)` : undefined }} />
      ))}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[rgba(184,146,63,.35)]" />
    </div>
  )
}

// POST-IT layer: overlay trasparente sopra la TAVOLA (coord. 0..1) con le puntine delle richieste
// di modifica. Il cliente tocca un punto → onPlaceAt(x,y) (con la foto sotto il dito). Cliccando
// una puntina si apre la sua bolla (renderBubble). Stesso componente per cliente (posa) e fotografo
// (legge/segna fatto). Va dentro un contenitore `relative` esattamente grande come la tavola.
function PostitLayer({ pins, openId, onOpen, canPlace, onPlaceAt, placing, composer, renderBubble }: {
  pins: Postit[]; openId: string | null; onOpen: (id: string | null) => void
  canPlace?: boolean; onPlaceAt?: (x: number, y: number) => void
  placing?: { x: number; y: number } | null; composer?: ReactNode
  renderBubble?: (pin: Postit) => ReactNode
}) {
  // canPlace → il layer cattura i tocchi (per posare). Altrimenti è "trasparente" (pointer-events
  // none) così sotto resta interagibile (il fotografo trascina le foto in FreeStage); solo puntine
  // e bolle restano cliccabili (pointer-events auto su di esse).
  return (
    <div className="absolute inset-0 z-[55]" style={{ pointerEvents: canPlace ? 'auto' : 'none' }}
      onPointerDown={(e) => {
        if (!canPlace || !onPlaceAt || e.target !== e.currentTarget) return // solo tocco sul vuoto del layer
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
        const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
        onOpen(null); onPlaceAt(x, y)
      }}>
      {pins.map((p, i) => {
        if (p.anchor_x == null || p.anchor_y == null) return null
        const open = openId === p.id, done = p.status === 'DONE'
        return (
          <div key={p.id} className="absolute" style={{ left: `${p.anchor_x * 100}%`, top: `${p.anchor_y * 100}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'auto' }}>
            <button onPointerDown={(e) => { e.stopPropagation(); onOpen(open ? null : p.id) }}
              className={`grid place-items-center h-6 w-6 rounded-full rounded-bl-none shadow-md ring-2 ring-white text-[11px] font-bold text-white transition-transform ${open ? 'scale-125' : ''} ${done ? 'bg-emerald-500' : 'bg-[rgb(var(--gold-500))]'}`}
              title={p.body}>{done ? '✓' : i + 1}</button>
            {open && renderBubble && (
              <div className="absolute left-1/2 top-7 -translate-x-1/2 z-[60] w-60 max-w-[70vw]" onPointerDown={(e) => e.stopPropagation()}>{renderBubble(p)}</div>
            )}
          </div>
        )
      })}
      {placing && (
        <div className="absolute" style={{ left: `${placing.x * 100}%`, top: `${placing.y * 100}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'auto' }}>
          <div className="grid h-6 w-6 place-items-center rounded-full rounded-bl-none bg-[rgb(var(--gold-500))] ring-2 ring-white shadow-md text-white text-sm">＋</div>
          {composer && <div className="absolute left-1/2 top-7 -translate-x-1/2 z-[60] w-64 max-w-[78vw]" onPointerDown={(e) => e.stopPropagation()}>{composer}</div>}
        </div>
      )}
    </div>
  )
}

// Aggiunge alla lista `els` le foto di una pagina (template o libera) mappate in coord. tavola.
function addPageEls(els: FreeEl[], p: AlbumPage | undefined, xOff: number, formatKey: string) {
  if (!p) return
  const src = p.mode === 'free' ? (p.elements ?? []) : toFreeElements(p, formatKey)
  for (const e of src) els.push({ ...newFreeEl(e.mediaId), x: xOff + e.x * 0.5, y: e.y, w: e.w * 0.5, h: e.h, rot: e.rot, cell: { ...e.cell }, border: e.border, shadow: e.shadow })
}
// Elementi di una TAVOLA UNICA (coord. 0..1 dell'intera tavola) dalle due pagine. spreadImage =
// foto sulla pagina sinistra: se NON copre tutto, aggiunge SOLO la pagina destra (niente overlap).
function buildTavolaElsPure(left: AlbumPage, right: AlbumPage | undefined, formatKey: string): FreeEl[] {
  if (left.tavolaFree) return (left.elements ?? []).map((e) => ({ ...e }))
  const els: FreeEl[] = []
  if (left.spreadImage) {
    const fr = spreadFrameOf(left.spreadImage)
    const full = fr.x <= 0.001 && fr.y <= 0.001 && fr.w >= 0.999 && fr.h >= 0.999
    els.push({ ...newFreeEl(left.spreadImage.mediaId), x: fr.x, y: fr.y, w: fr.w, h: fr.h, cell: { ...left.spreadImage.cell } })
    if (!full) addPageEls(els, right, 0.5, formatKey)
  } else {
    addPageEls(els, left, 0, formatKey); addPageEls(els, right, 0.5, formatKey)
  }
  return els
}
// MIGRAZIONE: "esiste solo la tavola". Converte ogni tavola con foto in TAVOLA UNICA (tavolaFree),
// così sono attive ovunque sostituisci-foto, disposizioni, riempi-tavola, resize gruppo. Le tavole
// vuote restano template (mostrano gli slot da riempire). Visivamente identica.
function migrateTavoleToFree(pages: AlbumPage[], formatKey: string): AlbumPage[] {
  // NORMALIZZA il dato persistito: pagine vecchie/corrotte possono avere mediaIds/cells/elements
  // assenti o null → senza questo, `for (const id of pg.mediaIds)` e simili crashano l'INTERA
  // pagina (vista cliente compresa). Qui garantiamo che siano sempre array.
  const out = pages.map((p) => ({ ...p, mediaIds: p.mediaIds ?? [], cells: p.cells ?? [], elements: p.elements ?? [] }))
  for (let i = 0; i < out.length; i += 2) {
    const left = out[i]; if (!left || left.tavolaFree) continue
    const right = out[i + 1]
    // SEMPRE tavola unica: anche le tavole vuote diventano una superficie unica (vuota), così
    // l'editor apre OGNI tavola intera e mai a due pagine separate.
    const els = buildTavolaElsPure(left, right, formatKey)
    out[i] = { ...left, mode: 'free', frozen: false, tavolaFree: true, bg: left.bg ?? '#ffffff', elements: els, mediaIds: [], cells: [], spreadImage: null }
    if (right) out[i + 1] = { ...right, mode: 'template', mediaIds: [], cells: [], elements: [], tavolaFree: false, spreadImage: null }
  }
  return out
}

// MARGINI UGUALI: ricostruisce la struttura a tagli "guillotine" delle foto (ricava i tagli
// verticali/orizzontali netti) e la riemette dentro `region` con lo STESSO margine (gx/gy) ovunque
// → tutti gli spazi bianchi tra le foto diventano uguali (in mm). Ritorna id→rettangolo, o null se
// le foto si sovrappongono e non sono separabili in modo netto.
type GRect = { id: string; x: number; y: number; w: number; h: number }
function gqCut(rs: GRect[], axis: 'V' | 'H'): { L: GRect[]; R: GRect[]; gap: number } | null {
  const lo = (e: GRect) => (axis === 'V' ? e.x : e.y)
  const hi = (e: GRect) => (axis === 'V' ? e.x + e.w : e.y + e.h)
  const sorted = [...rs].sort((a, b) => lo(a) - lo(b))
  let best: { L: GRect[]; R: GRect[]; gap: number } | null = null
  for (let i = 1; i < sorted.length; i++) {
    const L = sorted.slice(0, i), R = sorted.slice(i)
    const lMax = Math.max(...L.map(hi)), rMin = Math.min(...R.map(lo))
    if (lMax <= rMin + 1e-6) { const gap = rMin - lMax; if (!best || gap > best.gap) best = { L, R, gap } }
  }
  return best
}
function gqSpan(rs: GRect[], axis: 'V' | 'H'): number {
  const lo = (e: GRect) => (axis === 'V' ? e.x : e.y), hi = (e: GRect) => (axis === 'V' ? e.x + e.w : e.y + e.h)
  return Math.max(...rs.map(hi)) - Math.min(...rs.map(lo))
}
function guillotineLayout(rs: GRect[], region: { x: number; y: number; w: number; h: number }, gx: number, gy: number): Map<string, { x: number; y: number; w: number; h: number }> | null {
  if (rs.length === 1) { const m = new Map(); m.set(rs[0]!.id, { ...region }); return m }
  const v = gqCut(rs, 'V'), h = gqCut(rs, 'H')
  let cut: { L: GRect[]; R: GRect[]; gap: number } | null = null, dir: 'V' | 'H' = 'V'
  if (v && h) { if (v.gap >= h.gap) { cut = v; dir = 'V' } else { cut = h; dir = 'H' } }
  else if (v) { cut = v; dir = 'V' } else if (h) { cut = h; dir = 'H' }
  if (!cut) return null
  const out = new Map<string, { x: number; y: number; w: number; h: number }>()
  if (dir === 'V') {
    const aw = gqSpan(cut.L, 'V'), bw = gqSpan(cut.R, 'V'), tot = aw + bw || 1
    const avail = Math.max(0.001, region.w - gx)
    const wa = avail * aw / tot
    const ma = guillotineLayout(cut.L, { x: region.x, y: region.y, w: wa, h: region.h }, gx, gy)
    const mb = guillotineLayout(cut.R, { x: region.x + wa + gx, y: region.y, w: avail - wa, h: region.h }, gx, gy)
    if (!ma || !mb) return null
    ma.forEach((val, k) => out.set(k, val)); mb.forEach((val, k) => out.set(k, val))
  } else {
    const ah = gqSpan(cut.L, 'H'), bh = gqSpan(cut.R, 'H'), tot = ah + bh || 1
    const avail = Math.max(0.001, region.h - gy)
    const ha = avail * ah / tot
    const ma = guillotineLayout(cut.L, { x: region.x, y: region.y, w: region.w, h: ha }, gx, gy)
    const mb = guillotineLayout(cut.R, { x: region.x, y: region.y + ha + gy, w: region.w, h: avail - ha }, gx, gy)
    if (!ma || !mb) return null
    ma.forEach((val, k) => out.set(k, val)); mb.forEach((val, k) => out.set(k, val))
  }
  return out
}

function AlbumDesignerInner() {
  const { entryId } = useParams<{ entryId: string }>()
  const { profile } = useAuth()
  const isCouple = profile?.role === 'COUPLE'

  const [media, setMedia] = useState<M[]>([])
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [format, setFormat] = useState<string>(DEFAULT_FORMAT)
  // formati personalizzati (W×H pagina, salvati in locale e riusabili)
  const [customFmts, setCustomFmts] = useState<AlbumFormat[]>(() => listCustomFormats())
  const [fmtPanel, setFmtPanel] = useState(false)
  const [cfW, setCfW] = useState(''); const [cfH, setCfH] = useState(''); const [cfName, setCfName] = useState('')
  function saveCustom() {
    const w = Math.round(parseFloat(cfW.replace(',', '.')) * 10)
    const h = Math.round(parseFloat(cfH.replace(',', '.')) * 10)
    if (!(w >= 50 && w <= 2000) || !(h >= 50 && h <= 2000)) { toast.error('Largh./alt. pagina in cm, tra 5 e 200.'); return }
    setCustomFmts(saveCustomFormat(w, h, cfName))
    setFormat(customFormatKey(w, h)); setFmtPanel(false); setCfName('')
    toast.success('Formato salvato')
  }
  const [status, setStatus] = useState<string>('DRAFT')
  const [pages, setPages] = useState<AlbumPage[]>([])
  const [title, setTitle] = useState('')
  const [step, setStep] = useState<'select' | 'design'>('select')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportProg, setExportProg] = useState<{ done: number; total: number; zip?: number } | null>(null) // barra avanzamento export (zip = % compressione finale)
  const aiCancel = useRef(false); const qualityCancel = useRef(false); const exportCancel = useRef(false) // flag "Interrompi"
  const [activePage, setActivePage] = useState<string | null>(null)
  const [activeSlot, setActiveSlot] = useState<number | null>(null)
  const [bleed, setBleed] = useState(false)            // abbondanza per la stampa
  const [aspects, setAspects] = useState<Record<string, number>>({}) // aspetto naturale per crop
  const [realDims, setRealDims] = useState<Record<string, RealDim>>({}) // px reali (per avviso bassa risoluzione)
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
  const filmstripRef = useRef<HTMLDivElement>(null) // navigatore tavole (per auto-scroll durante il drag)
  const [canvasBox, setCanvasBox] = useState({ w: 0, h: 0 }) // area disponibile per la tavola (per il fit)
  const [previewOpen, setPreviewOpen] = useState(false) // anteprima sfogliabile
  const [previewIdx, setPreviewIdx] = useState(0)
  // vista cliente mobile-first
  const [clientIdx, setClientIdx] = useState(0)
  const bookRef = useRef<any>(null) // react-pageflip: per flipNext/flipPrev dai pulsanti freccia
  const [readerBox, setReaderBox] = useState({ w: 0, h: 0 }) // area disponibile per il libro sfogliabile (lite)
  // callback-ref: misura il contenitore del reader anche quando gli spread compaiono in modo async
  const readerRoRef = useRef<ResizeObserver | null>(null)
  const setReaderEl = useCallback((el: HTMLDivElement | null) => {
    readerRoRef.current?.disconnect(); readerRoRef.current = null
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => setReaderBox({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure); ro.observe(el); measure(); readerRoRef.current = ro
  }, [])
  const [clientReqOpen, setClientReqOpen] = useState(false)
  const [zoomSpread, setZoomSpread] = useState<number | null>(null)
  const [reqListOpen, setReqListOpen] = useState(false)
  const [cropFor, setCropFor] = useState<number | null>(null) // slot in ritaglio
  const [selEl, setSelEl] = useState<string | null>(null)      // elemento libero "primario" (pannello/crop)
  const [multiSel, setMultiSel] = useState<string[]>([])        // selezione multipla (Shift) sulla tavola
  const [layouts, setLayouts] = useState<SavedLayout[]>(() => listLayouts()) // layout personalizzati salvati
  const [gutterMm, setGutterMm] = useState(3) // margine (mm) tra le foto quando si applica una disposizione
  const [momentFilter, setMomentFilter] = useState<string>('') // filtro libreria per "momento" (tag); '' = tutti
  // PANNELLI RIDIMENSIONABILI (persistiti): libreria sx, pannello funzioni dx, striscia tavole.
  const lsNum = (k: string, def: number, min: number) => { try { const v = Number(localStorage.getItem(k)); return v >= min ? v : def } catch { return def } }
  const [libW, setLibW] = useState(() => lsNum('albumLibW', 160, 120))
  const [panelW, setPanelW] = useState(() => lsNum('albumPanelW', 224, 180))
  const [stripH, setStripH] = useState(() => lsNum('albumStripH', 64, 48))
  useEffect(() => { try { localStorage.setItem('albumLibW', String(libW)); localStorage.setItem('albumPanelW', String(panelW)); localStorage.setItem('albumStripH', String(stripH)) } catch { /* no-op */ } }, [libW, panelW, stripH])
  const [cropSpread, setCropSpread] = useState<string | null>(null) // id pagina-sx in ritaglio foto a piena tavola
  const [photoPreview, setPhotoPreview] = useState<string | null>(null) // mediaId in anteprima grande (barra spaziatrice sul canvas)
  // move/resize della cornice spread (trasformazione libera su due tavole)
  const spreadDrag = useRef<{ kind: 'move' | 'nw' | 'ne' | 'sw' | 'se'; sx: number; sy: number; w: number; h: number; id: string; f: { x: number; y: number; w: number; h: number } } | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)   // indicatore autosave
  const loadedRef = useRef(false)
  const autoTimer = useRef<number | null>(null)
  const [revOpen, setRevOpen] = useState(false)                 // popup richieste modifiche
  const [revList, setRevList] = useState<Postit[]>([])
  const [replyFor, setReplyFor] = useState<string | null>(null) // richiesta a cui il fotografo risponde
  const [replyText, setReplyText] = useState('')
  const [replyReason, setReplyReason] = useState<string>('')
  const [revBody, setRevBody] = useState('')
  const [revPageRef, setRevPageRef] = useState(false)
  // POST-IT ancorati: il cliente tocca una foto/punto → bigliettino appuntato lì (lo vede anche il
  // fotografo). `placing` = post-it in composizione (coord. tavola 0..1 + foto toccata); `openPin`
  // = post-it aperto (per leggerlo/segnarlo fatto).
  const [placing, setPlacing] = useState<{ tav: number; x: number; y: number; mediaId: string | null } | null>(null)
  const [openPin, setOpenPin] = useState<string | null>(null)
  const [replaceMode, setReplaceMode] = useState(false)          // post-it "sostituisci la foto"
  const [replaceId, setReplaceId] = useState<string | null>(null) // foto scelta per la sostituzione

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
      // ORDINE STABILE (created_at, poi id): così la griglia di Selezione e il cassetto NON
      // si rimescolano ad ogni apertura → i "cuori" restano dove sono, selezione stabile.
      // PAGINAZIONE: gallery_media può superare il cap di 1000 righe di PostgREST. Senza paginare,
      // su gallerie grandi (>1000) le foto oltre la millesima — inclusi i "cuori" KEPT — sparivano
      // dall'impaginatore (es. 102 scelte in galleria → solo 84 qui). Prendo TUTTE le righe a blocchi.
      const fetchAllMedia = async () => {
        const PAGE = 1000; const out: M[] = []
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await (supabase.from as any)('gallery_media')
            .select('id, drive_file_id, thumbnail_link, media_type, guest_tag_name, album_choice, album_moment')
            .eq('entry_id', entryId)
            .order('created_at', { ascending: true }).order('id', { ascending: true })
            .range(from, from + PAGE - 1)
          if (error) throw error
          const batch = (data ?? []) as M[]
          out.push(...batch)
          if (batch.length < PAGE) break
        }
        return out
      }
      const [pr, med, er, lr] = await Promise.all([
        (supabase.from as any)('album_projects').select('format_key, status, layout').eq('entry_id', entryId).maybeSingle(),
        fetchAllMedia(),
        (supabase.from as any)('calendar_entries').select('title').eq('id', entryId).maybeSingle(),
        (supabase as any).rpc('gallery_like_counts', { p_entry: entryId }),
      ])
      const proj = (pr as any)?.data, ent = (er as any)?.data
      const lcMap: Record<string, number> = {}
      for (const r of ((lr as any)?.data ?? []) as { media_id: string; n: number }[]) lcMap[r.media_id] = r.n
      setLikeCounts(lcMap)
      setMedia((med as M[]) ?? [])
      setTitle((ent as { title?: string } | null)?.title ?? 'Album')
      if (proj) {
        setFormat((proj as any).format_key ?? DEFAULT_FORMAT)
        setStatus((proj as any).status ?? 'DRAFT')
        const lay = (proj as any).layout as { pages?: AlbumPage[]; bleed?: boolean } | null
        if (typeof lay?.bleed === 'boolean') setBleed(lay.bleed)
        // MIGRA a TAVOLA UNICA: ogni tavola con foto diventa tavolaFree (così sostituisci-foto,
        // disposizioni, riempi-tavola e resize gruppo sono attivi ovunque, senza premere "Libera"
        // tavola per tavola). Visivamente identica; le tavole vuote restano template.
        if (lay?.pages?.length) { setPages(migrateTavoleToFree(lay.pages, (proj as any).format_key ?? DEFAULT_FORMAT)); setStep('design') }
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
  const lastHistTs = useRef(0)
  const [, forceHist] = useState(0)
  useEffect(() => {
    if (skipHist.current) { skipHist.current = false; prevPagesRef.current = pages; return }
    if (loadedRef.current && prevPagesRef.current !== pages && prevPagesRef.current.length) {
      // COALESCING: un trascinamento genera decine di setPages. Registriamo UN solo checkpoint
      // (lo stato PRIMA del gesto) e ignoriamo i cambi rapidi successivi → un undo = un'azione.
      const now = Date.now()
      if (now - lastHistTs.current > 450) {
        histPast.current.push(prevPagesRef.current)
        if (histPast.current.length > 80) histPast.current.shift()
        histFuture.current = []
      }
      lastHistTs.current = now
    }
    prevPagesRef.current = pages
    forceHist((n) => n + 1)
  }, [pages])
  function undo() {
    if (!histPast.current.length) return
    histFuture.current.push(pages); const p = histPast.current.pop()!
    skipHist.current = true; lastHistTs.current = 0
    setSelEl(null); setMultiSel([]); setActiveSlot(null)
    setPages(p); forceHist((n) => n + 1)
  }
  function redo() {
    if (!histFuture.current.length) return
    histPast.current.push(pages); const p = histFuture.current.pop()!
    skipHist.current = true; lastHistTs.current = 0
    setSelEl(null); setMultiSel([]); setActiveSlot(null)
    setPages(p); forceHist((n) => n + 1)
  }
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
      // CLIPBOARD stile Illustrator/InDesign: Cmd+C copia, Cmd+X taglia, Cmd+V incolla
      if (mod && k === 'c' && free && (multiSel.length || selEl)) { e.preventDefault(); copySelToast(); return }
      if (mod && k === 'x' && free && (multiSel.length || selEl)) { e.preventDefault(); cutSel(); return }
      if (mod && k === 'v' && free && clipboard.current.length) { e.preventDefault(); pasteSel(); return }
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
    const prev = m.album_choice
    const next = m.album_choice === 'KEPT' ? 'DISCARDED' : 'KEPT'
    setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, album_choice: next } : x)))
    // VERIFICA il salvataggio: se la RPC fallisce (es. permessi), ANNULLA l'ottimistico e avvisa,
    // così il cuore non resta "acceso" a vuoto e poi sparisce al reload.
    const { data, error } = await (supabase.rpc as any)('set_album_choice', { p_media: m.id, p_choice: next })
    if (error || (data && (data as { error?: string }).error)) {
      setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, album_choice: prev } : x)))
      toast.error(`Non riesco a salvare il like: ${error?.message ?? (data as { error?: string }).error}`)
    }
  }
  // ELIMINA una foto DALLA SELEZIONE (non dal disco): la toglie da TUTTE le tavole, dalla memoria
  // libreria e la scarta (KEPT→DISCARDED). Così sparisce dal cassetto e TUTTI i numeri si aggiornano
  // (Usate, ×N, selezione album, minimi per momento, avviso risoluzione). Vale sia per le foto che ho
  // caricato io sia per quelle scelte dalla coppia. Reversibile dal passo "Selezione" (ri-metti il cuore).
  async function removeFromSelection(m: M) {
    const n = usageCount.get(m.id) ?? 0
    if (n > 0 && !window.confirm(`Questa foto è ${n > 1 ? `usata ${n} volte` : 'usata'} nell'album: toglierla dalla selezione la rimuoverà anche dalle tavole. Procedere?`)) return
    // 1) via da tutte le tavole (elementi liberi, slot template, foto a doppia pagina)
    setPages((prev) => prev.map((p) => {
      let np: AlbumPage = p
      const els = p.elements ?? []
      if (els.some((e) => e.mediaId === m.id)) np = { ...np, elements: els.filter((e) => e.mediaId !== m.id) }
      const mids = p.mediaIds ?? []
      if (mids.includes(m.id)) {
        const keep = mids.map((id, i) => (id === m.id ? -1 : i)).filter((i) => i >= 0)
        np = { ...np, mediaIds: keep.map((i) => mids[i]!), cells: p.cells ? keep.map((i) => p.cells![i] ?? null) : np.cells }
      }
      if (p.spreadImage?.mediaId === m.id) np = { ...np, spreadImage: null }
      return np
    }))
    // 2) togli dalla memoria libreria + eventuali selezioni attive
    setEverPlaced((prev) => { if (!prev.has(m.id)) return prev; const nx = new Set(prev); nx.delete(m.id); return nx })
    setSelEl((s) => (s === m.id ? null : s))
    setMultiSel((s) => s.filter((x) => x !== m.id))
    // 3) scarta dalla selezione album (soft, NON da disco). Se era già DISCARDED, basta il passo 1-2.
    if (m.album_choice === 'KEPT') {
      setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, album_choice: 'DISCARDED' } : x)))
      const { data, error } = await (supabase.rpc as any)('set_album_choice', { p_media: m.id, p_choice: 'DISCARDED' })
      if (error || (data && (data as { error?: string }).error)) {
        setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, album_choice: 'KEPT' } : x)))
        toast.error('Non sono riuscito a togliere la foto dalla selezione'); return
      }
    }
    toast.success('Foto tolta dalla selezione')
  }
  // Seleziona/deseleziona TUTTI i cuori in UN colpo (RPC atomica: niente fallimenti parziali).
  async function setKeepAll(choice: 'KEPT' | 'DISCARDED') {
    const changing = photos.filter((m) => (m.album_choice ?? 'DISCARDED') !== choice)
    if (!changing.length) { toast(choice === 'KEPT' ? 'Sono già tutte selezionate' : 'Nessun cuore da togliere'); return }
    const toChange = changing.map((m) => m.id); const ids = new Set(toChange)
    const before = new Map(changing.map((m) => [m.id, m.album_choice] as const))
    setMedia((arr) => arr.map((x) => (ids.has(x.id) ? { ...x, album_choice: choice } : x)))
    const { data, error } = await (supabase.rpc as any)('album_set_choices', { p_ids: toChange, p_choice: choice })
    if (error || (data && (data as { error?: string }).error)) {
      setMedia((arr) => arr.map((x) => (before.has(x.id) ? { ...x, album_choice: before.get(x.id) ?? null } : x)))
      toast.error(`Selezione non salvata: ${error?.message ?? (data as { error?: string }).error}`)
    } else toast.success(choice === 'KEPT' ? `${toChange.length} foto selezionate per l'album` : `${toChange.length} foto deselezionate`)
  }

  // Seleziona (cuore KEPT) tutte le foto a cui gli sposi hanno messo "mi piace".
  async function keepLiked() {
    const liked = photos.filter((m) => (likeCounts[m.id] ?? 0) > 0 && (m.album_choice ?? 'DISCARDED') !== 'KEPT')
    if (!liked.length) { toast('Nessuna foto con like da aggiungere'); return }
    const toChange = liked.map((m) => m.id); const ids = new Set(toChange)
    const before = new Map(liked.map((m) => [m.id, m.album_choice] as const))
    setMedia((arr) => arr.map((x) => (ids.has(x.id) ? { ...x, album_choice: 'KEPT' } : x)))
    const { data, error } = await (supabase.rpc as any)('album_set_choices', { p_ids: toChange, p_choice: 'KEPT' })
    if (error || (data && (data as { error?: string }).error)) {
      setMedia((arr) => arr.map((x) => (before.has(x.id) ? { ...x, album_choice: before.get(x.id) ?? null } : x)))
      toast.error('Selezione non salvata')
    } else toast.success(`${toChange.length} preferite dagli sposi aggiunte all'album`)
  }
  async function setMoment(m: M, moment: string) {
    // Il momento si assegna SOLO alle foto già scelte (cuore). NIENTE auto-cuore: aggiungeva per
    // sbaglio all'album le foto che si taggavano fuori dalla selezione della coppia. La select è
    // comunque usabile perché di default si vedono solo le foto scelte (vista "Solo selezionate").
    setMedia((arr) => arr.map((x) => (x.id === m.id ? { ...x, album_moment: moment || null } : x)))
    await (supabase.rpc as any)('album_set_moments', { p_items: [{ id: m.id, moment }] })
  }
  // IMPORT FOTO: l'utente aggiunge altre foto all'album (upload diretto su storage →
  // RPC album_add_media → entrano KEPT nella selezione). Niente Drive.
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null)
  const trayFileRef = useRef<HTMLInputElement>(null)
  async function importPhotos(files: File[]) {
    if (!entryId || !files.length) return
    const list = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'))
    if (!list.length) { toast.error('Seleziona immagini o video'); return }
    setImporting({ done: 0, total: list.length })
    let ok = 0; const fails: string[] = []
    for (let i = 0; i < list.length; i++) {
      const file = list[i]!; setImporting({ done: i, total: list.length })
      try {
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
        const path = `${entryId}/album/${crypto.randomUUID()}.${ext}`
        const up = await supabase.storage.from('event-guest-uploads').upload(path, file, { upsert: false, contentType: file.type || undefined })
        if (up.error) throw up.error
        const pub = supabase.storage.from('event-guest-uploads').getPublicUrl(path).data.publicUrl
        const mt: 'PHOTO' | 'VIDEO' = file.type.startsWith('video/') ? 'VIDEO' : 'PHOTO'
        const { data, error } = await (supabase.rpc as any)('album_add_media', { p_entry: entryId, p_storage_path: path, p_thumb: pub, p_media_type: mt, p_moment: null })
        if (error) throw error
        const newId = (data as { id?: string } | null)?.id
        if (newId) {
          setMedia((arr) => [...arr, { id: newId, drive_file_id: `album:${path}`, thumbnail_link: pub, media_type: mt, guest_tag_name: null, album_choice: 'KEPT', album_moment: null }])
          ok++
        }
      } catch (e) { fails.push(`${file.name}: ${(e as Error).message}`) }
    }
    setImporting(null)
    if (ok) toast.success(`${ok} foto aggiunte all'album`)
    if (fails.length) toast.error(`${fails.length} non caricate — ${fails[0]}`)
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
  // SPOSI: confermano la selezione e danno il via libera al fotografo per impaginare la bozza.
  async function coupleReadyToLayout() {
    if (kept.length === 0) { toast.error('Seleziona prima le foto col cuore'); return }
    await save('PHOTOGRAPHER_EDIT', true)
    toast.success('Perfetto! Selezione confermata: il fotografo può impaginare la bozza.')
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
      const sp = left?.spreadImage ?? right?.spreadImage
      if (sp) {
        bump(sp.mediaId)
        const fr = sp.frame
        const full = !fr || (fr.x <= 0.001 && fr.y <= 0.001 && fr.w >= 0.999 && fr.h >= 0.999)
        if (full) continue // copre TUTTA la tavola: le foto sotto sono nascoste, non si contano
        // spreadImage PARZIALE: le foto delle pagine restano visibili → vanno contate anch'esse
      }
      for (const pg of [left, right]) {
        if (!pg) continue
        if (pg.mode === 'free') { for (const e of pg.elements ?? []) bump(e.mediaId) }
        else { for (const id of pg.mediaIds ?? []) bump(id) }
      }
    }
    return c
  }, [pages])
  // tutte le foto già piazzate = chiavi del conteggio (coerente al 100% col badge)
  const placedIds = useMemo(() => new Set(usageCount.keys()), [usageCount])

  // AVVISO BASSA RISOLUZIONE: misura i pixel REALI (via hiUrl w1600) delle SOLE foto piazzate.
  // Drive non ingrandisce: thumb < 1600px ⇒ originale piccolo certo; cappata a 1600 ⇒ grande/ignoto.
  // Misuriamo solo le piazzate per non scaricare a vuoto tutta la libreria a piena risoluzione.
  useEffect(() => {
    for (const id of placedIds) {
      if (realDims[id]) continue
      const m = mediaById.get(id)
      if (!m || m.media_type !== 'PHOTO') continue
      const url = hiUrl(m)
      if (!url) continue
      const img = new Image()
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight
        if (!w || !h) return
        const capped = isDrive(m) && Math.max(w, h) >= HIURL_CAP - 10 // Drive ha cappato → originale ≥1600, ignoto
        setRealDims((d) => (d[id] ? d : { ...d, [id]: { w, h, capped } }))
      }
      img.src = url
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placedIds, mediaById])

  // Foto piazzate a rischio stampa (per il chip globale in toolbar).
  const lowResFlags = useMemo(() => countLowRes(pages, format, realDims), [pages, format, realDims])
  // MEMORIA della libreria: l'insieme delle foto piazzate cresce in modo monotòno e NON si
  // svuota quando tolgo una foto dalla tavola → così la foto torna disponibile a sinistra
  // (nitida) invece di sparire. I "cuori" (KEPT) sono già persistiti in DB; questo evita il
  // caos di vedere sparire dalla libreria una foto solo perché l'ho rimossa dall'impaginato.
  const [everPlaced, setEverPlaced] = useState<Set<string>>(() => new Set())
  const [photoAspect, setPhotoAspect] = useState<Map<string, number>>(() => new Map()) // aspect nativo foto (per preset intelligenti)
  // ── DISPOSIZIONI (preset) INTELLIGENTI per la TAVOLA UNICA ── (hook PRIMA di ogni return!) ──
  const curTavLeft = useMemo<AlbumPage | null>(() => {
    const i = pages.findIndex((p) => p.id === currentPageId); if (i < 0) return null
    const lp = pages[i - (i % 2)]; return lp?.tavolaFree ? lp : null
  }, [pages, currentPageId])
  const tavEls = useMemo(() => curTavLeft?.elements ?? [], [curTavLeft])
  const tavMediaKey = tavEls.map((e) => e.mediaId).join(',')
  useEffect(() => {
    if (!curTavLeft) return
    for (const e of tavEls) {
      const id = e.mediaId; if (photoAspect.has(id)) continue
      const m = mediaById.get(id); if (!m) continue
      const img = new Image()
      img.onload = () => setPhotoAspect((prev) => (prev.has(id) ? prev : new Map(prev).set(id, img.naturalWidth / Math.max(1, img.naturalHeight))))
      img.src = thumbUrl(m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tavMediaKey, mediaById])
  const tavOrients = useMemo<Orient[]>(() => tavEls.map((e) => classifyAspect(photoAspect.get(e.mediaId) ?? 1)), [tavMediaKey, photoAspect]) // eslint-disable-line react-hooks/exhaustive-deps
  const tavPresets = useMemo<GenLayout[]>(() => { const f = getFormat(format); return tavMediaKey ? genTavolaLayouts(tavOrients, f.w * 2, f.h, 48) : [] }, [tavOrients, format, tavMediaKey]) // eslint-disable-line react-hooks/exhaustive-deps
  // I TUOI preset applicabili alla tavola corrente: SOLO quelli con lo STESSO numero di foto della
  // tavola (3 foto → preset da 3, 10 foto → preset da 10). Le disposizioni devono combaciare col
  // numero di foto sulla tavola, sempre.
  const myTavPresets = useMemo(() => layouts.filter((l) => (l.els?.length ?? 0) === tavEls.length && tavEls.length > 0), [layouts, tavEls.length])
  useEffect(() => {
    setEverPlaced((prev) => {
      let changed = false; const next = new Set(prev)
      for (const id of placedIds) if (!next.has(id)) { next.add(id); changed = true }
      return changed ? next : prev
    })
  }, [placedIds])
  // a sinistra: TUTTE le foto del progetto — opache se già usate, nitide se ancora da usare.
  // Ordine: prima i cuori (selezione), poi eventuali extra mai tolti dalla memoria.
  const trayMedia = useMemo(() => {
    const out: M[] = []; const seen = new Set<string>()
    for (const m of kept) { if (!seen.has(m.id)) { seen.add(m.id); out.push(m) } }
    for (const id of everPlaced) { if (!seen.has(id)) { const m = mediaById.get(id); if (m) { seen.add(id); out.push(m) } } }
    return out
  }, [kept, everPlaced, mediaById])
  // FILTRO "momento" della libreria (legge il tag album_moment). '' = tutti, '_none' = senza momento.
  const trayMoments = useMemo(() => { const c = new Map<string, number>(); for (const m of trayMedia) c.set(m.album_moment ?? '_none', (c.get(m.album_moment ?? '_none') ?? 0) + 1); return c }, [trayMedia])
  const trayFiltered = useMemo(() => {
    if (!momentFilter) return trayMedia
    if (momentFilter === '_none') return trayMedia.filter((m) => !m.album_moment)
    return trayMedia.filter((m) => m.album_moment === momentFilter)
  }, [trayMedia, momentFilter])

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
  // Da pagina LIBERA (anche congelata) → dati template: le foto degli elementi liberi
  // diventano mediaIds/cells (la rotazione/posizione si perdono perché un preset le SOVRASCRIVE).
  function materializeFree(p: AlbumPage): AlbumPage {
    if (p.mode !== 'free') return p
    const photos = (p.elements ?? []).filter((e) => e.mediaId)
    return { ...p, mode: 'template' as const, frozen: false, tavolaFree: false, elements: [], mediaIds: photos.map((e) => e.mediaId), cells: photos.map((e) => e.cell ?? DEFAULT_CELL) }
  }
  function setTemplate(pageId: string, t: TemplateKey) { updatePage(pageId, (p) => ({ ...setPageTemplate(materializeFree(p), t), mode: 'template' as const })) }
  function cycleLayout(pageId: string) { updatePage(pageId, (p) => { const mp = materializeFree(p); return { ...setPageTemplate(mp, cycleTemplate(mp.template, mp.mediaIds.length)), mode: 'template' as const } }) }
  function duplicatePage(pageId: string) {
    const src = pages.find((p) => p.id === pageId); if (!src) return
    const copy: AlbumPage = { ...src, id: newPage().id, cells: src.cells ? src.cells.map((c) => (c ? { ...c } : c)) : undefined, elements: src.elements ? src.elements.map((e) => ({ ...e, id: newPage().id, cell: { ...e.cell } })) : undefined }
    setPages((a) => insertPageAfter(a, pageId, () => copy)); setCurrentPageId(copy.id)
  }
  // ── TAVOLE (spread = 2 pagine affiancate, come in stampa) ───────────────────
  function addSpread() {
    // nuova tavola = superficie UNICA vuota (tavolaFree) + pagina destra svuotata: si apre intera.
    const a: AlbumPage = { ...newPage(), mode: 'free', tavolaFree: true, bg: '#ffffff', elements: [], mediaIds: [], cells: [] }
    const b: AlbumPage = { ...newPage(), tavolaFree: false }
    setPages((arr) => [...arr, a, b]); setCurrentPageId(a.id)
  }
  // Inserisce una tavola vuota nel GAP `si` (prima della tavola si): clic tra due tavole nel navigatore.
  function insertEmptyTavola(si: number) {
    const a: AlbumPage = { ...newPage(), mode: 'free', tavolaFree: true, bg: '#ffffff', elements: [], mediaIds: [], cells: [] }
    const b: AlbumPage = { ...newPage(), tavolaFree: false }
    setPages((arr) => { const at = Math.min(arr.length, Math.max(0, si) * 2); return [...arr.slice(0, at), a, b, ...arr.slice(at)] })
    setCurrentPageId(a.id); toast.success('Nuova tavola inserita')
  }
  // Inserisce una tavola vuota SUBITO DOPO la tavola `si` (in sequenza), non in fondo.
  function addSpreadAfter(si: number) {
    const a: AlbumPage = { ...newPage(), mode: 'free', tavolaFree: true, bg: '#ffffff', elements: [], mediaIds: [], cells: [] }
    const b: AlbumPage = { ...newPage(), tavolaFree: false }
    setPages((arr) => { const at = Math.min(arr.length, (si + 1) * 2); return [...arr.slice(0, at), a, b, ...arr.slice(at)] })
    setCurrentPageId(a.id)
  }
  // Trascini una foto NELLO SPAZIO TRA due tavole (navigatore) → crea una NUOVA tavola in quel punto
  // con quella foto (a piena tavola, entro i margini). si = indice di tavola dove inserire.
  function insertTavolaWithPhotoAt(si: number, mediaId: string, mode: 'single' | 'double' | 'full' = 'full') {
    if (!mediaById.has(mediaId)) return
    const f = getFormat(format)
    const mx = MARGIN_MM / (f.w * 2), my = MARGIN_MM / f.h
    let a: AlbumPage
    if (mode === 'double') {
      // DOPPIA PAGINA: foto full-bleed su entrambe le pagine
      a = { ...newPage(), mode: 'template', tavolaFree: false, spreadImage: { mediaId, cell: { ...DEFAULT_CELL } } }
    } else {
      // SINGOLA = una pagina (metà sx); PIENA TAVOLA = tutto lo spread. Entro i margini.
      const el: FreeEl = mode === 'single'
        ? { ...newFreeEl(mediaId), x: mx, y: my, w: 0.5 - mx * 1.5, h: 1 - 2 * my, rot: 0, cell: { ...DEFAULT_CELL } }
        : { ...newFreeEl(mediaId), x: mx, y: my, w: 1 - 2 * mx, h: 1 - 2 * my, rot: 0, cell: { ...DEFAULT_CELL } }
      a = { ...newPage(), mode: 'free', tavolaFree: true, bg: '#ffffff', elements: [el], mediaIds: [], cells: [] }
    }
    const b: AlbumPage = { ...newPage(), tavolaFree: false }
    setPages((arr) => { const at = Math.min(arr.length, Math.max(0, si) * 2); return [...arr.slice(0, at), a, b, ...arr.slice(at)] })
    setCurrentPageId(a.id); toast.success('Nuova tavola inserita')
  }
  // Elementi liberi di una tavola per N foto: disposizione GIUSTIFICATA (rispetta gli orientamenti,
  // niente tagli) con gutter. È la ricomposizione automatica quando cambia il numero di foto.
  function freeElsForTavola(mediaIds: string[]): FreeEl[] {
    const ids = mediaIds.filter((id) => mediaById.has(id))
    if (!ids.length) return []
    const f = getFormat(format)
    const spreadAspect = (f.w * 2) / f.h
    const mx = MARGIN_MM / (f.w * 2), my = MARGIN_MM / f.h
    const gx = gutterMm / (f.w * 2), gy = gutterMm / f.h
    const slots = justifiedSlots(ids.map((id) => aspects[id] ?? photoAspect.get(id) ?? 1), spreadAspect)
    return ids.map((id, i) => { const s = slots[i] ?? { x: mx, y: my, w: 0.4, h: 0.4 }; const g = gutterSlot(s, gx, gy); return { ...newFreeEl(id), x: g.x, y: g.y, w: g.w, h: g.h, rot: 0, cell: { ...DEFAULT_CELL } } })
  }
  // Nuova tavola libera con le foto disposte (justified). Ritorna l'id della pagina creata.
  function insertTavolaWithPhotosAt(si: number, mediaIds: string[]): string | null {
    const els = freeElsForTavola(mediaIds)
    if (!els.length) return null
    const a: AlbumPage = { ...newPage(), mode: 'free', tavolaFree: true, bg: '#ffffff', elements: els, mediaIds: [], cells: [] }
    const b: AlbumPage = { ...newPage(), tavolaFree: false }
    setPages((arr) => { const at = Math.min(arr.length, Math.max(0, si) * 2); return [...arr.slice(0, at), a, b, ...arr.slice(at)] })
    setCurrentPageId(a.id)
    return a.id
  }
  // SPOSTA una o più foto in una tavola ESISTENTE e la RICOMPONE per il nuovo numero di foto:
  // se da 3 si passa a 4, la tavola si ridispone automaticamente per 4 (ingloba la foto, niente
  // scarabocchio). Le foto già presenti restano, la/le nuove entrano nella disposizione giustificata.
  function movePhotosToTavola(targetPageId: string, move: MovePayload) {
    const ti = pages.findIndex((p) => p.id === targetPageId), si = pages.findIndex((p) => p.id === move.fromPageId)
    if (ti < 0) return
    if (si >= 0 && (ti - (ti % 2)) === (si - (si % 2))) { toast.message('È già in questa tavola'); return }
    const mids = move.mediaIds.filter((id) => mediaById.has(id))
    if (!mids.length) return
    const tStart = ti - (ti % 2)
    const targetLeftId = pages[tStart]!.id
    const existing = tavolaMediaIds(targetLeftId).filter((id) => !mids.includes(id)) // già sulla tavola
    const allIds = [...existing, ...mids]                                            // le nuove in coda
    const els = freeElsForTavola(allIds)
    setPages((arr) => arr.map((p, idx) => {
      if (p.id === move.fromPageId) return { ...p, elements: (p.elements ?? []).filter((e) => !move.elIds.includes(e.id)) }
      if (idx === tStart) return { ...p, mode: 'free' as const, tavolaFree: true, frozen: false, bg: p.bg ?? '#ffffff', elements: els, mediaIds: [], cells: [], spreadImage: null }
      if (idx === tStart + 1) return { ...p, mode: 'template' as const, tavolaFree: false, elements: [], mediaIds: [], cells: [], spreadImage: null }
      return p
    }))
    setCurrentPageId(targetLeftId); setSelEl(null); setMultiSel([])
    toast.success(`${mids.length > 1 ? `${mids.length} foto spostate` : 'Foto spostata'} — tavola ricomposta per ${allIds.length}`)
  }
  // SPOSTA le foto in una NUOVA tavola creata al punto si (gap): a sinistra = prima, a destra = dopo.
  function moveNewTavola(si: number, move: MovePayload) {
    const mids = move.mediaIds.filter((id) => mediaById.has(id))
    if (!mids.length) return
    insertTavolaWithPhotosAt(si, mids)
    setPages((arr) => arr.map((p) => (p.id === move.fromPageId ? { ...p, elements: (p.elements ?? []).filter((e) => !move.elIds.includes(e.id)) } : p)))
    setSelEl(null); setMultiSel([])
    toast.success(mids.length > 1 ? `${mids.length} foto in una nuova tavola` : 'Foto in una nuova tavola')
  }
  // Avvia lo spostamento POINTER (dalla maniglia sulla foto). Segue il cursore, evidenzia il bersaglio
  // nel navigatore (miniatura = sposta, gap = nuova tavola) e al rilascio applica lo spostamento.
  function startPhotoMove(fromPageId: string, items: { elId: string; mediaId: string }[], e: import('react').PointerEvent) {
    if (!items.length) return
    photoMoveRef.current = { items, fromPageId }
    setPhotoMoveUI({ x: e.clientX, y: e.clientY, n: items.length, hint: null })
    // bersaglio dall'elemento sotto il cursore (miniatura tavola o gap)
    const targetOf = (elm: Element | null): { kind: 'tavola' | 'gap'; key: string } | null => {
      const tav = elm?.closest('[data-tavdrop]') as HTMLElement | null
      if (tav?.dataset.tavdrop) return { kind: 'tavola', key: tav.dataset.tavdrop }
      const gap = elm?.closest('[data-gapdrop]') as HTMLElement | null
      if (gap && gap.dataset.gapdrop != null) return { kind: 'gap', key: gap.dataset.gapdrop }
      return null
    }
    let lastHiEl: Element | null = null // ultima MINIATURA/gap evidenziata (fallback al rilascio)
    let scrollDir = 0
    const timer = window.setInterval(() => { const c = filmstripRef.current; if (c && scrollDir) c.scrollLeft += scrollDir * 16 }, 16)
    const onMove = (ev: PointerEvent) => {
      const under = document.elementFromPoint(ev.clientX, ev.clientY)
      const t = under?.closest('[data-tavdrop],[data-gapdrop]') ?? null
      if (lastHiEl && lastHiEl !== t) lastHiEl.classList.remove('pf-drop-target')
      if (t) { t.classList.add('pf-drop-target'); lastHiEl = t }
      const h = targetOf(under)
      // AUTO-SCROLL del navigatore quando il cursore è vicino ai bordi (per raggiungere le tavole nascoste)
      const c = filmstripRef.current
      if (c) { const r = c.getBoundingClientRect(); const EDGE = 72; scrollDir = ev.clientX > r.right - EDGE ? 1 : ev.clientX < r.left + EDGE ? -1 : 0 }
      setPhotoMoveUI({ x: ev.clientX, y: ev.clientY, n: items.length, hint: h ? h.kind : null })
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.clearInterval(timer)
      if (lastHiEl) lastHiEl.classList.remove('pf-drop-target')
      const d = photoMoveRef.current; photoMoveRef.current = null; setPhotoMoveUI(null)
      if (!d) return
      // bersaglio: sotto il cursore, altrimenti l'ULTIMO evidenziato (più tollerante ai rilasci al limite)
      const h = targetOf(document.elementFromPoint(ev.clientX, ev.clientY)) ?? targetOf(lastHiEl)
      if (!h) { toast.message('Rilascia la foto sopra una tavola (o tra due tavole) nel navigatore in basso'); return }
      const move: MovePayload = { fromPageId: d.fromPageId, elIds: d.items.map((i) => i.elId), mediaIds: d.items.map((i) => i.mediaId) }
      if (h.kind === 'tavola') movePhotosToTavola(h.key, move)
      else moveNewTavola(Number(h.key), move)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  // SCAMBIA due foto ovunque nell'album (tasto destro → "Sostituisci con"): la foto A prende il
  // posto di B e viceversa, in tutte le tavole (elementi, slot, foto a doppia pagina).
  function swapPhotos(a: string, b: string) {
    if (!a || !b || a === b) return
    const sw = (id: string) => (id === a ? b : id === b ? a : id)
    setPages((arr) => arr.map((p) => {
      let np: AlbumPage = p
      if ((p.elements?.length ?? 0) > 0) np = { ...np, elements: (np.elements ?? []).map((e) => ({ ...e, mediaId: sw(e.mediaId) })) }
      if ((p.mediaIds?.length ?? 0) > 0) np = { ...np, mediaIds: (np.mediaIds ?? []).map(sw) }
      if (p.spreadImage) np = { ...np, spreadImage: { ...p.spreadImage, mediaId: sw(p.spreadImage.mediaId) } }
      return np
    }))
    toast.success('Foto scambiate')
  }
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
  // ── elementi liberi (stile Canva) ──────────────────────────────────────────
  function convertToFree(pageId: string) { updatePage(pageId, (p) => ({ ...p, mode: 'free' as const, frozen: false, bg: p.bg ?? '#ffffff', elements: (p.elements && p.elements.length ? p.elements : toFreeElements(p, format)), mediaIds: [], cells: [] })) }
  // id della pagina SINISTRA della tavola che contiene `pageId` (gli spread sono coppie pari/dispari)
  function tavolaLeftIdOf(pageId: string): string {
    const i = pages.findIndex((p) => p.id === pageId); if (i < 0) return pageId
    return (i % 2 === 0 ? pages[i] : pages[i - 1])!.id
  }
  // Costruisce gli elementi di una TAVOLA UNICA (coord. 0..1 dell'INTERA tavola) dalle due pagine:
  // - sx già tavolaFree → elementi as-is; - spreadImage → un elemento alla sua cornice (+ le foto
  //   delle pagine se NON copre tutto); - altrimenti foto sx in x∈[0,0.5], dx in [0.5,1] (w dimezzata,
  //   ma tavola 2× più larga = identico). Nessuna foto viene persa.
  function buildTavolaEls(left: AlbumPage, right: AlbumPage | undefined): FreeEl[] { return buildTavolaElsPure(left, right, format) }
  // TAVOLA UNICA: fonde le due pagine in UNA superficie libera. Così le foto si spostano attraverso
  // la piega e i righelli agganciano da una metà all'altra.
  function convertTavolaToFree(leftId: string) {
    const idx = pages.findIndex((p) => p.id === leftId); if (idx < 0) return
    const els = buildTavolaEls(pages[idx]!, pages[idx + 1])
    setPages((arr) => arr.map((p, i) => {
      if (i === idx) return { ...p, mode: 'free' as const, frozen: false, tavolaFree: true, bg: p.bg ?? '#ffffff', elements: els, mediaIds: [], cells: [], spreadImage: null }
      if (i === idx + 1) return { ...p, mode: 'template' as const, mediaIds: [], cells: [], elements: [], tavolaFree: false, spreadImage: null }
      return p
    }))
    setCurrentPageId(leftId); setActiveSlot(null); setSelEl(null); setMultiSel([])
  }
  // Stende una foto su TUTTA la tavola (0,0,1,1) e la SELEZIONA (così è subito eliminabile con
  // Canc → torna nella libreria). Converte la tavola a "Libera" se serve. Usa la foto selezionata;
  // se non c'è selezione ma c'è una sola foto, quella.
  function fillElToTavola(leftId: string) {
    const idx = pages.findIndex((p) => p.id === leftId); if (idx < 0) return
    const left = pages[idx]!
    const els = buildTavolaEls(left, pages[idx + 1])
    const targetId = (left.tavolaFree && selEl && els.some((e) => e.id === selEl)) ? selEl : (els.length === 1 ? els[0]?.id ?? null : null)
    if (!targetId) {
      if (!left.tavolaFree) convertTavolaToFree(leftId)
      toast.message('Seleziona la foto da stendere su tutta la tavola'); return
    }
    const filled = els.map((e) => (e.id === targetId ? { ...e, x: 0, y: 0, w: 1, h: 1, rot: 0 } : e))
    setPages((arr) => arr.map((p, i) => {
      if (i === idx) return { ...p, mode: 'free' as const, frozen: false, tavolaFree: true, bg: p.bg ?? '#ffffff', elements: filled, mediaIds: [], cells: [], spreadImage: null }
      if (i === idx + 1) return { ...p, mode: 'template' as const, mediaIds: [], cells: [], elements: [], tavolaFree: false, spreadImage: null }
      return p
    }))
    setCurrentPageId(leftId); setActiveSlot(null); setSelEl(targetId); setMultiSel([])
  }
  function freeUpdate(pageId: string, id: string, patch: Partial<FreeEl>) { updatePage(pageId, (p) => ({ ...p, elements: updateFreeEl(p.elements ?? [], id, patch) })) }
  function freeAdd(pageId: string, mediaId: string) { updatePage(pageId, (p) => ({ ...p, mode: 'free' as const, bg: p.bg ?? '#ffffff', elements: bringToFront([...(p.elements ?? []), newFreeEl(mediaId)], 'x') })) }
  // Trascinando una foto SOPRA una foto già presente, la SOSTITUISCE: resta posizione/dimensione/
  // rotazione del riquadro, cambia solo la foto (ritaglio azzerato così la nuova riempie il riquadro).
  function freeReplace(pageId: string, id: string, mediaId: string) { updatePage(pageId, (p) => ({ ...p, elements: (p.elements ?? []).map((e) => (e.id === id ? { ...e, mediaId, cell: { ...DEFAULT_CELL } } : e)) })) }
  // SCAMBIA due foto della tavola: si scambiano contenuto (foto + ritaglio + bordo/ombra) mantenendo
  // ciascuna il proprio riquadro (posizione/dimensione/rotazione). Usato dal drag con ALT (⌥).
  function freeSwapEls(pageId: string, idA: string, idB: string) {
    updatePage(pageId, (p) => {
      const els = p.elements ?? []
      const a = els.find((e) => e.id === idA), b = els.find((e) => e.id === idB)
      if (!a || !b) return p
      return { ...p, elements: els.map((e) => {
        if (e.id === idA) return { ...e, mediaId: b.mediaId, cell: { ...b.cell }, border: b.border, shadow: b.shadow }
        if (e.id === idB) return { ...e, mediaId: a.mediaId, cell: { ...a.cell }, border: a.border, shadow: a.shadow }
        return e
      }) }
    })
  }
  function freeRemove(pageId: string, id: string) { updatePage(pageId, (p) => ({ ...p, elements: removeFreeEl(p.elements ?? [], id) })); if (selEl === id) setSelEl(null); setMultiSel((s) => s.filter((x) => x !== id)) }
  function freeDuplicate(pageId: string, id: string) {
    const src = pages.find((p) => p.id === pageId)?.elements?.find((e) => e.id === id); if (!src) return
    const copy = { ...src, id: newPage().id, x: Math.min(0.9, src.x + 0.04), y: Math.min(0.9, src.y + 0.04), cell: { ...src.cell } }
    updatePage(pageId, (p) => ({ ...p, elements: bringToFront([...(p.elements ?? []), copy], copy.id) })); setSelEl(copy.id)
  }
  // Z-ORDER + ADATTA (per il menu contestuale stile InDesign)
  function freeBringFront(pageId: string, id: string) { updatePage(pageId, (p) => ({ ...p, elements: bringToFront(p.elements ?? [], id) })) }
  function freeSendBack(pageId: string, id: string) { updatePage(pageId, (p) => { const els = p.elements ?? []; const el = els.find((e) => e.id === id); return el ? { ...p, elements: [el, ...els.filter((e) => e.id !== id)] } : p }) }
  // riordino di UN passo (pannello Livelli): dir +1 = verso il davanti, -1 = verso il fondo.
  function freeReorderOne(pageId: string, id: string, dir: -1 | 1) {
    updatePage(pageId, (p) => { const els = [...(p.elements ?? [])]; const i = els.findIndex((e) => e.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= els.length) return p; const t = els[i]!; els[i] = els[j]!; els[j] = t; return { ...p, elements: els } })
  }
  function freeFillFrame(pageId: string, id: string) { updatePage(pageId, (p) => ({ ...p, elements: (p.elements ?? []).map((e) => (e.id === id ? { ...e, cell: { ...DEFAULT_CELL } } : e)) })) }
  function freeCenterContent(pageId: string, id: string) { updatePage(pageId, (p) => ({ ...p, elements: (p.elements ?? []).map((e) => (e.id === id ? { ...e, cell: { ...e.cell, fx: 0.5, fy: 0.5 } } : e)) })) }
  // MENU CONTESTUALE (tasto destro su una foto)
  const [ctxMenu, setCtxMenu] = useState<{ pageId: string; id: string; x: number; y: number } | null>(null)
  function openCtx(pageId: string, id: string, x: number, y: number) { if (!multiSel.includes(id)) { setSelEl(id); setMultiSel([]) } setCtxMenu({ pageId, id, x, y }) }
  const [navMenu, setNavMenu] = useState<{ si: number; x: number; y: number } | null>(null) // tasto destro su una tavola nel navigatore
  const [gapInsert, setGapInsert] = useState<{ si: number; mediaId: string; x: number; y: number } | null>(null) // foto trascinata tra due tavole
  // SPOSTAMENTO foto tra tavole via POINTER (affidabile su mouse/trackpad/touch, non usa HTML5 drag):
  const photoMoveRef = useRef<{ items: { elId: string; mediaId: string }[]; fromPageId: string } | null>(null)
  const [photoMoveUI, setPhotoMoveUI] = useState<{ x: number; y: number; n: number; hint: 'tavola' | 'gap' | null } | null>(null)
  const [swapPick, setSwapPick] = useState<{ mediaId: string } | null>(null) // "Sostituisci con": scegli con quale scambiare
  const [swapIdx, setSwapIdx] = useState(0) // indice della card mostrata nello slider "Sostituisci con"
  const swapTouch = useRef<number | null>(null) // X inizio swipe
  // tastiera nello slider "Sostituisci con": ← / → scorrono, Esc chiude
  useEffect(() => {
    if (!swapPick) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setSwapIdx((x) => x + 1)
      else if (e.key === 'ArrowLeft') setSwapIdx((x) => Math.max(0, x - 1))
      else if (e.key === 'Escape') setSwapPick(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [swapPick])
  const [aiBusy, setAiBusy] = useState(false) // impaginazione AI in corso
  const [aiProg, setAiProg] = useState<{ done: number; total: number; phase?: string } | null>(null) // barra avanzamento analisi foto
  // "AI SELEZIONA": cura la selezione (taglia doppioni/momenti ripetuti, tiene il meglio con respiro)
  const [curateBusy, setCurateBusy] = useState(false)
  const [curateProg, setCurateProg] = useState<{ done: number; total: number; phase?: string } | null>(null)
  const curateCancel = useRef(false)
  const curateAnalysesRef = useRef<Record<string, unknown>[]>([])
  const curatePhotosRef = useRef<{ id: string; url: string; likes: number }[]>([])
  const [curateResult, setCurateResult] = useState<{ drop: { id: string; reason: string }[]; total: number } | null>(null)
  const [curateTarget, setCurateTarget] = useState(0)
  const [curateRescue, setCurateRescue] = useState<Set<string>>(new Set())
  const [curateRerun, setCurateRerun] = useState(false)
  const [aiPick, setAiPick] = useState(false) // brief impaginazione AI (stile + opzioni)
  const [styleOpen, setStyleOpen] = useState(false) // pannello "Il mio stile" (impara dai PDF del fotografo)
  const [hasStyle, setHasStyle] = useState(false) // il fotografo ha già istruito uno stile (per il funnel)
  useEffect(() => { void (async () => { const { data } = await (supabase.from as any)('album_style_pdfs').select('id').limit(1); setHasStyle(Array.isArray(data) && data.length > 0) })() }, [styleOpen])
  const [aiStyle, setAiStyle] = useState<string>('fotografo')
  const [aiMaxPer, setAiMaxPer] = useState<number>(0)        // 0 = automatico (dallo stile)
  const [aiGroupBw, setAiGroupBw] = useState<boolean>(true)  // tieni insieme le foto in bianco e nero
  const [aiHeroDouble, setAiHeroDouble] = useState<boolean>(true) // foto forti a doppia pagina
  const [aiDoublePct, setAiDoublePct] = useState<number>(8)  // % foto a doppia pagina
  const [aiFullPct, setAiFullPct] = useState<number>(10)     // % foto a pagina intera
  const [aiRespectFormat, setAiRespectFormat] = useState<boolean>(true) // verticali/orizzontali restano tali
  const [aiAutoSelect, setAiAutoSelect] = useState<boolean>(false) // fai scegliere le foto all'AI (cura + impagina il sottoinsieme)
  const [aiMaxPages, setAiMaxPages] = useState<number>(60) // tetto massimo di pagine dell'album
  const [qualityScores, setQualityScores] = useState<Record<string, { score: number; issues: string[]; reason: string; advice?: string }>>({}) // ranking qualità stampa + consiglio tecnico
  const [qualityBusy, setQualityBusy] = useState(false)
  const [qualityProg, setQualityProg] = useState<{ done: number; total: number } | null>(null) // barra avanzamento valutazione qualità
  const [qualityOpen, setQualityOpen] = useState(false) // pannello-report qualità (si apre a fine analisi)
  const [inpaint, setInpaint] = useState<{ pageId: string; elId: string; src: string } | null>(null) // "Cancella oggetto (AI)"
  const [wbBusy, setWbBusy] = useState(false) // valutazione bilanciamento bianco della tavola
  const [wbResult, setWbResult] = useState<{ wb: { id: string; temp: number; tint: number; label: string }[]; consistent: boolean; off: string[]; note: string; advice: string } | null>(null)
  const [highlightMedia, setHighlightMedia] = useState<string | null>(null) // foto evidenziata dal report
  const [exifMeta, setExifMeta] = useState<Record<string, { takenAt: number | null; w: number | null; h: number | null }>>({}) // EXIF: orario scatto + dimensioni reali (per sequenza cronologica)
  const [faceMap, setFaceMap] = useState<Record<string, { fx: number; fy: number; face?: boolean }>>({}) // dove l'AI ha mappato i volti
  const [showFaces, setShowFaces] = useState(true) // mostra i pallini dei volti sulle miniature
  // APRI IN PHOTOSHOP: (1) scarica l'ORIGINALE a piena risoluzione come file su disco, (2) tenta di
  // AVVIARE Photoshop via protocol-handler `photoshop://`. Un'app web non può forzare l'apertura di
  // un'app desktop se non tramite protocollo registrato: se Photoshop non parte da solo, il file è
  // comunque scaricato (impostando Photoshop come app predefinita per i .jpg si apre col doppio clic).
  // Apre "Cancella oggetto (AI)" sulla foto: risolve un URL CORS-safe (grant Drive → proxy) e apre il modale.
  async function openInpaint(pageId: string, elId: string, mediaId: string) {
    const m = mediaById.get(mediaId); if (!m) { toast.error('Foto non disponibile'); return }
    let src = hiUrl(m)
    try {
      if (isDrive(m) && entryId) {
        const { data } = await (supabase.rpc as any)('album_export_grant', { p_entry: entryId })
        const grant = (data as string) ?? null
        if (grant) src = hiResProxyUrl(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, grant, mediaId)
      }
    } catch { /* fallback a hiUrl */ }
    setInpaint({ pageId, elId, src })
  }
  async function openInPhotoshop(mediaId: string) {
    const m = mediaById.get(mediaId); if (!m) { toast.error('Foto non disponibile'); return }
    let url = hiUrl(m)
    try {
      if (isDrive(m) && entryId) {
        const { data } = await (supabase.rpc as any)('album_export_grant', { p_entry: entryId })
        const grant = (data as string) ?? null
        if (grant) url = hiResProxyUrl(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, grant, mediaId)
      }
    } catch { /* fallback all'URL hi */ }
    // (1) scarica come file vero (fetch→blob→download). Se il CORS lo blocca, apre in una scheda.
    try {
      const r = await fetch(url); if (!r.ok) throw new Error('fetch')
      const b = await r.blob()
      const a = document.createElement('a'); const obj = URL.createObjectURL(b)
      a.href = obj; a.download = `foto-${mediaId.slice(0, 8)}.jpg`; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(obj), 15000)
    } catch { window.open(url, '_blank') }
    // (2) tenta di avviare Photoshop (protocol handler, best-effort: se non registrato, non fa nulla)
    try { const f = document.createElement('iframe'); f.style.display = 'none'; f.src = 'photoshop://'; document.body.appendChild(f); setTimeout(() => f.remove(), 1500) } catch { /* ignora */ }
    toast.message('Scarico l’originale e avvio Photoshop. Se non parte da solo, apri il file scaricato (imposta Photoshop come app predefinita per i .jpg).')
  }
  // ROUND-TRIP: carica il file MODIFICATO (salvato da Photoshop), lo uppa su Planfully e SOSTITUISCE
  // la foto nell'elemento → te lo ritrovi nella tavola e in libreria. (Il browser non può fare
  // l'upload automatico dopo il salvataggio in PS: serve scegliere il file salvato.)
  const psFileRef = useRef<HTMLInputElement>(null)
  const psTarget = useRef<{ pageId: string; elId: string } | null>(null)
  async function replaceElWithFile(pageId: string, elId: string, file: File) {
    if (!entryId) return
    if (!file.type.startsWith('image/')) { toast.error('Serve un file immagine'); return }
    setImporting({ done: 0, total: 1 })
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${entryId}/album/${crypto.randomUUID()}.${ext}`
      const up = await supabase.storage.from('event-guest-uploads').upload(path, file, { upsert: false, contentType: file.type || undefined })
      if (up.error) throw up.error
      const pub = supabase.storage.from('event-guest-uploads').getPublicUrl(path).data.publicUrl
      const { data, error } = await (supabase.rpc as any)('album_add_media', { p_entry: entryId, p_storage_path: path, p_thumb: pub, p_media_type: 'PHOTO', p_moment: null })
      if (error) throw error
      const newId = (data as { id?: string } | null)?.id
      if (!newId) throw new Error('upload non riuscito')
      setMedia((arr) => [...arr, { id: newId, drive_file_id: `album:${path}`, thumbnail_link: pub, media_type: 'PHOTO', guest_tag_name: null, album_choice: 'KEPT', album_moment: null }])
      freeReplace(pageId, elId, newId)
      toast.success('Versione modificata caricata e inserita nella tavola')
    } catch (e) { toast.error('Caricamento non riuscito: ' + (e as Error).message) } finally { setImporting(null) }
  }
  function setPageBg(pageId: string, color: string) { updatePage(pageId, (p) => ({ ...p, bg: color })) }
  // ── layout personalizzati (salva la disposizione corrente, riapplicala dove vuoi) ──
  function saveCurLayout() {
    const page = pages.find((p) => p.id === currentPageId); if (!page) { toast.error('Apri prima una pagina'); return }
    const frames = pageToFrames(page); if (!frames.length) { toast.error('La pagina è vuota'); return }
    const els = pageToFreeEls(page) // se libera: salva la composizione completa (con rotazione)
    const label = page.mode === 'free' ? `Composizione libera ${frames.length} foto` : `Layout ${frames.length} foto`
    setLayouts(saveLayout(label, frames, els)); toast.success(page.mode === 'free' ? 'Composizione libera salvata come preset' : 'Layout salvato tra i tuoi')
  }
  // Applica un preset: se è una composizione LIBERA (els), ricrea gli elementi liberi
  // (con rotazione) mappando le foto già presenti nella pagina; altrimenti griglia template.
  function applyLayoutCur(l: SavedLayout) {
    if (!currentPageId) return
    updatePage(currentPageId, (p) => {
      if (!l.els || !l.els.length) return applyLayout(materializeFree(p), l.frames)
      const photos = p.mode === 'free'
        ? (p.elements ?? []).map((e) => ({ mediaId: e.mediaId, cell: e.cell }))
        : (p.mediaIds ?? []).map((id, i) => ({ mediaId: id, cell: p.cells?.[i] ?? DEFAULT_CELL })).filter((x) => x.mediaId)
      const els = l.els.map((s, i) => (photos[i] ? { ...newFreeEl(photos[i]!.mediaId), x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot, cell: photos[i]!.cell ?? DEFAULT_CELL } : null)).filter(Boolean) as FreeEl[]
      return { ...p, mode: 'free' as const, bg: p.bg ?? '#ffffff', elements: els, mediaIds: [], cells: [] }
    })
  }
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
  // ALLINEA / DISTRIBUISCI le foto selezionate (stile impaginatore pro). Operano sul bounding box
  // della selezione; la distribuzione spazia uniformemente i centri.
  function alignSel(kind: 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom') {
    if (!currentPageId) return
    updatePage(currentPageId, (p) => {
      const all = p.elements ?? []; const g = all.filter((x) => multiSel.includes(x.id)); if (g.length < 2) return p
      const bx = Math.min(...g.map((x) => x.x)), ex = Math.max(...g.map((x) => x.x + x.w))
      const by = Math.min(...g.map((x) => x.y)), ey = Math.max(...g.map((x) => x.y + x.h))
      const sel = new Set(multiSel)
      return { ...p, elements: all.map((el) => {
        if (!sel.has(el.id)) return el
        let { x, y } = el
        if (kind === 'left') x = bx; else if (kind === 'right') x = ex - el.w; else if (kind === 'hcenter') x = (bx + ex) / 2 - el.w / 2
        else if (kind === 'top') y = by; else if (kind === 'bottom') y = ey - el.h; else if (kind === 'vmiddle') y = (by + ey) / 2 - el.h / 2
        return { ...el, x, y }
      }) }
    })
  }
  function distributeSel(axis: 'h' | 'v') {
    if (!currentPageId) return
    updatePage(currentPageId, (p) => {
      const all = p.elements ?? []; const g = all.filter((x) => multiSel.includes(x.id)); if (g.length < 3) return p
      const cen = (el: FreeEl) => (axis === 'h' ? el.x + el.w / 2 : el.y + el.h / 2)
      const ord = [...g].sort((a, b) => cen(a) - cen(b))
      const c0 = cen(ord[0]!), c1 = cen(ord[ord.length - 1]!), step = (c1 - c0) / (ord.length - 1)
      const target = new Map<string, number>(); ord.forEach((el, i) => target.set(el.id, c0 + step * i))
      return { ...p, elements: all.map((el) => {
        const c = target.get(el.id); if (c == null) return el
        return axis === 'h' ? { ...el, x: c - el.w / 2 } : { ...el, y: c - el.h / 2 }
      }) }
    })
  }
  // MARGINI UGUALI (mosaico 2D): rende TUTTI gli spazi bianchi tra le foto uguali a N mm — sia i
  // margini verticali sia quelli orizzontali — ricostruendo i tagli guillotine dentro il riquadro
  // attuale della selezione (o di tutta la tavola se non c'è selezione).
  function uniformGapsSel() {
    if (!currentPageId) return
    const mm = Math.max(0, gutterMm)
    let okFlag = true
    updatePage(currentPageId, (p) => {
      const all = p.elements ?? []
      const selSet = new Set(multiSel)
      const g = selSet.size >= 2 ? all.filter((e) => selSet.has(e.id)) : all
      if (g.length < 2) { okFlag = false; return p }
      const tw = p.tavolaFree ? fmt.w * 2 : fmt.w
      const gx = mm / tw, gy = mm / fmt.h
      const bx = Math.min(...g.map((e) => e.x)), by = Math.min(...g.map((e) => e.y))
      const ex = Math.max(...g.map((e) => e.x + e.w)), ey = Math.max(...g.map((e) => e.y + e.h))
      const res = guillotineLayout(g.map((e) => ({ id: e.id, x: e.x, y: e.y, w: e.w, h: e.h })), { x: bx, y: by, w: ex - bx, h: ey - by }, gx, gy)
      if (!res) { okFlag = false; return p }
      return { ...p, elements: all.map((e) => { const r = res.get(e.id); return r ? { ...e, x: r.x, y: r.y, w: r.w, h: r.h } : e }) }
    })
    toast[okFlag ? 'success' : 'message'](okFlag ? `Margini uguali a ${mm} mm` : 'Le foto si sovrappongono: disponile in righe/colonne nette, poi riprova')
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
  // CLIPBOARD (Cmd+C/X/V): copia/taglia/incolla le foto selezionate, stile Illustrator/InDesign.
  const clipboard = useRef<FreeEl[]>([])
  function copySel(): number {
    if (!currentPageId) return 0; const ids = selIds(); if (!ids.length) return 0
    const page = pages.find((p) => p.id === currentPageId); if (!page) return 0
    clipboard.current = (page.elements ?? []).filter((e) => ids.includes(e.id)).map((e) => ({ ...e, cell: { ...e.cell } }))
    return clipboard.current.length
  }
  function copySelToast() { const n = copySel(); if (n) toast.success(n === 1 ? 'Foto copiata' : `${n} foto copiate`) }
  function cutSel() { const n = copySel(); if (n) { deleteSel(); toast.success(n === 1 ? 'Foto tagliata' : `${n} foto tagliate`) } }
  function pasteSel() {
    if (!currentPageId || !clipboard.current.length) return
    const copies = clipboard.current.map((e) => ({ ...e, id: newPage().id, x: Math.min(0.94, e.x + 0.03), y: Math.min(0.94, e.y + 0.03), cell: { ...e.cell } }))
    updatePage(currentPageId, (p) => ({ ...p, mode: 'free' as const, elements: [...(p.elements ?? []), ...copies] }))
    setMultiSel(copies.map((c) => c.id)); setSelEl(copies[copies.length - 1]!.id)
    toast.success(copies.length === 1 ? 'Foto incollata' : `${copies.length} foto incollate`)
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
      const payload = { p_entry: entryId, p_gallery: null, p_format: format, p_status: st, p_layout: { pages, bleed } }
      let { data, error } = await (supabase.rpc as any)('album_project_save', payload)
      // Album CONGELATO dall'approvazione degli sposi: il layout non è sovrascrivibile finché non si
      // riapre. L'autosave (silent) non disturba; il save esplicito propone la riapertura non distruttiva
      // (il lavoro locale resta in stato, non si perde).
      if (!error && (data as any)?.error === 'layout_approvato') {
        if (silent) return
        const msg = (data as any)?.message ?? 'L\'album è approvato. Riaprirlo revoca l\'approvazione degli sposi.'
        if (!window.confirm(msg + '\n\nRiaprire e salvare le modifiche?')) {
          toast.message('Modifiche non salvate: l\'album resta approvato.')
          return
        }
        const { error: rErr } = await (supabase as any).rpc('album_reopen_layout', { p_entry: entryId })
        if (rErr) throw new Error((rErr as { message?: string }).message ?? 'riapertura non riuscita')
        ;({ data, error } = await (supabase.rpc as any)('album_project_save', payload))
      }
      if (error || (data as any)?.error) throw new Error((data as any)?.error ?? error?.message ?? 'errore')
      if (nextStatus) setStatus(nextStatus)
      setSavedAt(Date.now())
      if (!silent) toast.success('Album salvato')
    } catch (e) { if (!silent) toast.error((e as Error).message) } finally { if (!silent) setBusy(false) }
  }

  // ── richieste di modifica (cliente ↔ fotografo) ────────────────────────────
  const loadRevs = useCallback(async () => {
    if (!entryId) return
    const { data } = await (supabase.from as any)('album_revision_requests').select('id, author_name, page_index, tavola_index, anchor_x, anchor_y, media_id, kind, replace_media_id, body, status, created_at, reply, reply_reason, reply_at').eq('entry_id', entryId).order('created_at', { ascending: false })
    setRevList((data as Postit[]) ?? [])
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
  async function reopenRev(id: string) { await (supabase.from as any)('album_revision_requests').update({ status: 'OPEN' }).eq('id', id); await loadRevs() }
  async function deleteRev(id: string) { await (supabase.from as any)('album_revision_requests').delete().eq('id', id); setOpenPin(null); await loadRevs() }
  // fotografo: risponde "perché meglio di no" → la richiesta passa a DECLINED con la motivazione
  // (tecnica: proporzioni, pagine, risoluzione, taglio, dorso…) e la coppia viene avvisata.
  async function replyRev(id: string, reason: string, text: string) {
    const body = text.trim(); if (!body) { toast.error('Scrivi la motivazione'); return }
    const { error } = await (supabase.from as any)('album_revision_requests').update({ reply: body, reply_reason: reason || null, status: 'DECLINED' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    setReplyFor(null); setReplyText(''); setReplyReason(''); toast.success('Risposta inviata al cliente'); await loadRevs()
  }
  // apre il composer di risposta precompilando la frase tecnica della motivazione scelta
  function startReply(id: string, reasonKey: string) {
    const r = ALBUM_REPLY_REASONS.find((x) => x.key === reasonKey)
    setReplyFor(id); setReplyReason(reasonKey); setReplyText(r?.hint ?? '')
  }
  async function sendClientReq() {
    if (!revBody.trim() || !entryId) return
    const { error } = await (supabase.from as any)('album_revision_requests').insert({ entry_id: entryId, body: revBody.trim(), page_index: clientIdx * 2 + 1 })
    if (error) { toast.error(error.message); return }
    toast.success('Richiesta inviata al fotografo'); setRevBody(''); setClientReqOpen(false); await loadRevs()
  }
  // ── POST-IT ancorati ───────────────────────────────────────────────────────
  // Tocco sulla tavola → (x,y) in 0..1 della tavola intera + foto sotto il dito (se tavolaFree).
  function hitMediaAt(tavLeft: AlbumPage | undefined, x: number, y: number): string | null {
    const els = tavLeft?.tavolaFree ? (tavLeft.elements ?? []) : []
    // l'ultimo elemento che contiene il punto sta "sopra" (z-order = ordine array)
    for (let i = els.length - 1; i >= 0; i--) { const e = els[i]!; if (x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) return e.mediaId }
    return null
  }
  async function savePostit() {
    if (!placing || !entryId) return
    const body = revBody.trim()
    const isReplace = replaceMode && !!placing.mediaId
    const defText = isReplace ? (replaceId ? 'Sostituisci con la foto indicata' : 'Sostituisci questa foto') : '(senza testo)'
    const { error } = await (supabase.from as any)('album_revision_requests').insert({
      entry_id: entryId, body: body || defText, page_index: placing.tav * 2 + 1,
      tavola_index: placing.tav, anchor_x: placing.x, anchor_y: placing.y, media_id: placing.mediaId,
      kind: isReplace ? 'REPLACE' : 'NOTE', replace_media_id: isReplace ? replaceId : null,
    })
    if (error) { toast.error(error.message); return }
    toast.success(isReplace ? 'Richiesta di sostituzione inviata' : 'Post-it inviato al fotografo')
    setRevBody(''); setPlacing(null); setReplaceMode(false); setReplaceId(null); await loadRevs()
  }
  // FOTOGRAFO: applica una richiesta "sostituisci con" → rimpiazza la foto del post-it sulla tavola
  // con quella scelta dal cliente, pronta da inserire. Poi segna il post-it come fatto.
  function applyReplacePostit(p: Postit) {
    if (!p.media_id || !p.replace_media_id) { toast.message('Il cliente non ha indicato con quale foto sostituire'); return }
    const lp = spreadPages[0]
    const el = (lp?.elements ?? []).find((e) => e.mediaId === p.media_id)
    if (!lp?.tavolaFree || !el) { toast.error('Foto da sostituire non trovata su questa tavola'); return }
    freeReplace(lp.id, el.id, p.replace_media_id)
    void resolveRev(p.id); setOpenPin(null)
    toast.success('Foto sostituita. Ricontrolla il ritaglio se serve.')
  }

  const exportRef = useRef<HTMLDivElement>(null)
  async function doExport(kind: 'pdf' | 'spread' | 'jpg' | 'jpgspread') {
    if (pages.length === 0) { toast.error('Nessuna pagina da esportare'); return }
    setExporting(true)
    exportCancel.current = false
    setExportProg({ done: 0, total: Math.max(1, kind === 'spread' || kind === 'jpgspread' ? Math.ceil(pages.length / 2) : pages.length) })
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
      const isSpread = kind === 'spread' || kind === 'jpgspread'
      const onProgress = (done: number, total: number) => setExportProg({ done, total })
      const onZip = (zip: number) => setExportProg((p) => (p ? { ...p, zip } : { done: 1, total: 1, zip }))
      const shouldCancel = () => exportCancel.current
      if (kind === 'jpg' || kind === 'jpgspread') await exportAlbumJpgZip(pages, format, resolve, { filename: `${base}-${isSpread ? 'tavole' : 'pagine'}-jpg.zip`, dpi: Math.min(exportDpi, 240), pageNumbers: pageNums, mode: isSpread ? 'spreads' : 'pages', onProgress, onZip, shouldCancel })
      else await exportAlbumPdf(pages, format, resolve, { mode: isSpread ? 'spreads' : 'pages', filename: `${base}-${isSpread ? 'tavole' : 'pagine'}.pdf`, bleed, dpi: exportDpi, cutMarks: cutMarks && bleed, pageNumbers: pageNums, onProgress, shouldCancel })
      toast.success('Export pronto')
    } catch (e) { if (e instanceof ExportCancelled || (e as Error)?.message === 'export_cancelled') toast.message('Export annullato'); else toast.error('Export non riuscito: ' + (e as Error).message) } finally { setExporting(false); setExportProg(null) }
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

  // ANTEPRIMA grande col la BARRA SPAZIATRICE nel canvas: seleziona (clic) una foto in tavola e
  // premi Spazio → la vedi ingrandita. Spazio/Esc per chiudere. Usa la foto selezionata (selEl /
  // slot attivo / foto a piena tavola).
  const focusedMediaId = (): string | null => {
    if (selEl) { for (const p of spreadPages) { const el = (p.elements ?? []).find((e) => e.id === selEl); if (el) return el.mediaId } }
    if (activeSlot != null && currentPage) return currentPage.mediaIds?.[activeSlot] ?? null
    const sp = spreadPages.find((p) => p.spreadImage)?.spreadImage
    return sp?.mediaId ?? null
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
      if (e.code === 'Space' || e.key === ' ') {
        if (step !== 'design') return
        const mid = photoPreview ? null : focusedMediaId()
        if (photoPreview || mid) { e.preventDefault(); setPhotoPreview(photoPreview ? null : mid) }
      } else if (e.key === 'Escape' && photoPreview) { setPhotoPreview(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, photoPreview, selEl, activeSlot, spreadPages, currentPage])
  const spreadHpx = Math.max(180, (fitH || 560) * zoom)

  // Applica una disposizione: ricostruisce gli elementi della tavola assegnando ogni foto allo
  // slot più adatto per orientamento; gutter tra le foto; il ritaglio si azzera (riempi slot).
  function applyTavolaLayout(slots: Slot[]) {
    const lp = spreadPages[0]; if (!lp?.tavolaFree) return
    const els = lp.elements ?? []; if (!els.length) return
    const orients = els.map((e) => classifyAspect(photoAspect.get(e.mediaId) ?? 1))
    const assign = assignPhotos(slots, orients, fmt.w * 2, fmt.h)
    const gx = gutterMm / (fmt.w * 2), gy = gutterMm / fmt.h // margine impostato (mm) tra le foto
    const newEls: FreeEl[] = slots.map((s, k) => {
      const ai = assign[k] ?? -1
      const src = els[ai >= 0 ? ai : k] ?? els[k]; if (!src) return null
      const g = gutterSlot(s, gx, gy)
      return { ...newFreeEl(src.mediaId), x: g.x, y: g.y, w: g.w, h: g.h, rot: 0, cell: { ...DEFAULT_CELL }, border: src.border, shadow: src.shadow }
    }).filter(Boolean) as FreeEl[]
    updatePage(lp.id, (p) => ({ ...p, elements: newEls })); setSelEl(null); setMultiSel([])
    toast.success('Disposizione applicata')
  }
  // Applica un PRESET SALVATO (composizione libera con rotazioni) alla tavola: assegna le foto
  // correnti agli slot per orientamento, conservando posizioni E rotazioni del preset.
  function applySavedToTavola(saved: SavedLayout) {
    const lp = spreadPages[0]; if (!lp?.tavolaFree) return
    const els = lp.elements ?? []; if (!els.length) return
    const sl = saved.els ?? []; if (!sl.length) return
    const slots: Slot[] = sl.map((s) => ({ x: s.x, y: s.y, w: s.w, h: s.h }))
    const orients = els.map((e) => classifyAspect(photoAspect.get(e.mediaId) ?? 1))
    const assign = assignPhotos(slots, orients, fmt.w * 2, fmt.h)
    const newEls: FreeEl[] = sl.map((s, k) => {
      const ai = assign[k] ?? -1
      const src = els[ai >= 0 ? ai : k] ?? els[k]; if (!src) return null
      return { ...newFreeEl(src.mediaId), x: s.x, y: s.y, w: s.w, h: s.h, rot: s.rot, cell: { ...DEFAULT_CELL }, border: src.border, shadow: src.shadow }
    }).filter(Boolean) as FreeEl[]
    updatePage(lp.id, (p) => ({ ...p, elements: newEls })); setSelEl(null); setMultiSel([])
    toast.success('Preset applicato')
  }
  // Organizza le foto SELEZIONATE dentro UNA sola PAGINA (metà tavola, sinistra o destra): le dispone
  // in modo giustificato entro il rettangolo della pagina singola. Le altre foto restano intatte.
  // La metà (sx/dx) è quella dove sta il baricentro della selezione.
  function organizeSelectionIntoPage(pageId: string, ids: string[]) {
    const i = pages.findIndex((p) => p.id === pageId); if (i < 0) return
    const lp = pages[i - (i % 2)]
    if (!lp?.tavolaFree) { toast.message('Disponibile sulle tavole libere (attiva "Libera").'); return }
    const els = lp.elements ?? []
    const sel = els.filter((e) => ids.includes(e.id))
    if (!sel.length) { toast.message('Seleziona prima una o più foto sulla tavola.'); return }
    const cx = sel.reduce((s, e) => s + (e.x + e.w / 2), 0) / sel.length // baricentro X della selezione
    const isLeft = cx < 0.5
    const f = getFormat(format)
    const pageAsp = f.w / f.h                                   // aspetto della PAGINA SINGOLA
    const gx = gutterMm / (f.w * 2), gy = gutterMm / f.h
    const slots = justifiedSlots(sel.map((e) => aspects[e.mediaId] ?? photoAspect.get(e.mediaId) ?? 1), pageAsp)
    const x0 = isLeft ? 0 : 0.5
    const newEls = els.map((e) => {
      const k = sel.indexOf(e); if (k < 0) return e             // non selezionata: invariata
      const s = slots[k] ?? { x: 0, y: 0, w: 1, h: 1 }
      const raw = { x: x0 + s.x * 0.5, y: s.y, w: s.w * 0.5, h: s.h } // dal 0..1 della pagina al mezzo tavola
      const g = gutterSlot(raw, gx, gy)
      return { ...e, x: g.x, y: g.y, w: g.w, h: g.h, rot: 0 }
    })
    updatePage(lp.id, (p) => ({ ...p, frozen: false, elements: newEls })); setSelEl(null); setMultiSel([])
    toast.success(`${sel.length} foto disposte nella pagina ${isLeft ? 'sinistra' : 'destra'}`)
  }

  // ── IMPAGINAZIONE AI ────────────────────────────────────────────────────────────────────────
  // "Il fotografo lascia impaginare all'AI." OpenAI (GPT) fa la parte CURATORIALE (raggruppa le foto
  // in tavole + sequenza del racconto); la GEOMETRIA resta nel motore testato. Per rispettare "il
  // modello che uso più spesso" la costruzione PREFERISCE un preset SALVATO dal fotografo con lo
  // stesso numero di foto; altrimenti genera la disposizione migliore.
  function buildAiTavola(ids: string[], focusMap?: Record<string, { fx: number; fy: number; hero?: boolean; ht?: number; hb?: number; face?: boolean; sx?: number; sr?: number }>, heroDouble = true, layout?: string, usedSigs?: Map<string, number>, respectFormat = false): AlbumPage[] {
    const clean = ids.filter((id) => mediaById.has(id))
    const left: AlbumPage = { ...newPage(), mode: 'free', tavolaFree: true, bg: '#ffffff', elements: [], mediaIds: [], cells: [] }
    const right: AlbumPage = { ...newPage(), tavolaFree: false }
    if (!clean.length) return [left, right]
    const spreadAspect = (fmt.w * 2) / fmt.h
    const gx = gutterMm / (fmt.w * 2), gy = gutterMm / fmt.h
    const iaOf = (id: string) => aspects[id] ?? photoAspect.get(id) ?? 1
    const cellFor = (mid: string, sa: number): Cell => { const fo = focusMap?.[mid]; return fo ? goldenCell(iaOf(mid), sa, fo.fx, fo.fy, fo.ht, fo.hb, fo.face, fo.sx, fo.sr) : { ...DEFAULT_CELL } }

    // RISPETTA FORMATO = PRIORITÀ ASSOLUTA: ogni foto al suo aspetto ESATTO (niente double/full che
    // tagliano), con margine di sicurezza dai bordi di taglio → visi mai sul trim, niente teste tagliate.
    if (respectFormat) {
      // STILE GISKO: uno scatto ORIZZONTALE forte da solo → DOPPIA PAGINA full-bleed (auto, navata,
      // coppia, brindisi). I verticali e i gruppi NON vanno mai full-bleed → riquadri con bianco.
      if (clean.length === 1 && iaOf(clean[0]!) >= 1.4 && (heroDouble || layout === 'double')) {
        const mid = clean[0]!
        return [{ ...newPage(), mode: 'template', tavolaFree: false, spreadImage: { mediaId: mid, cell: cellFor(mid, spreadAspect) } }, { ...newPage(), tavolaFree: false }]
      }
      const SAFE = 0.045, ins = 0.985
      const js = justifiedSlots(clean.map(iaOf), spreadAspect)
      left.elements = js.map((s, i) => {
        const mid = clean[i]!
        const gx0 = s.x + (s.w * (1 - ins)) / 2, gy0 = s.y + (s.h * (1 - ins)) / 2
        const w0 = s.w * ins, h0 = s.h * ins
        const x = SAFE + gx0 * (1 - 2 * SAFE), y = SAFE + gy0 * (1 - 2 * SAFE)
        const rw = w0 * (1 - 2 * SAFE), rh = h0 * (1 - 2 * SAFE)
        return { ...newFreeEl(mid), x, y, w: rw, h: rh, rot: 0, cell: cellFor(mid, (rw * fmt.w * 2) / Math.max(0.001, rh * fmt.h)) }
      })
      return [left, right]
    }

    // DOPPIA PAGINA: 1 foto forte full-bleed su entrambe le pagine, ritaglio aureo sul volto.
    // SOLO per foto ORIZZONTALI (ia≥1.3): una verticale a doppia pagina taglierebbe le teste.
    if (clean.length === 1 && (heroDouble || layout === 'double') && iaOf(clean[0]!) >= 1.3) {
      const mid = clean[0]!
      const hero: AlbumPage = { ...newPage(), mode: 'template', tavolaFree: false, spreadImage: { mediaId: mid, cell: cellFor(mid, spreadAspect) } }
      return [hero, { ...newPage(), tavolaFree: false }]
    }

    // PAGINA INTERA: 1 foto dominante a piena pagina (sinistra) + le altre piccole (destra).
    // La dominante COMBACIA col verso della pagina: album verticale → dominante VERTICALE (riempie
    // bene la pagina); album orizzontale → dominante orizzontale. Evita metà pagina sprecata.
    if (layout === 'full' && clean.length >= 2) {
      const els: FreeEl[] = []
      const pagePortrait = fmt.w < fmt.h
      const dom = pagePortrait
        ? clean.reduce((b, id) => (iaOf(id) < iaOf(b) ? id : b), clean[0]!)  // più verticale
        : clean.reduce((b, id) => (iaOf(id) > iaOf(b) ? id : b), clean[0]!)  // più orizzontale
      const gd = gutterSlot({ x: 0, y: 0, w: 0.5, h: 1 }, gx, gy)
      els.push({ ...newFreeEl(dom), x: gd.x, y: gd.y, w: gd.w, h: gd.h, rot: 0, cell: cellFor(dom, (gd.w * fmt.w * 2) / Math.max(0.001, gd.h * fmt.h)) })
      const others = clean.filter((id) => id !== dom)
      gridSlots(others.length, (0.5 * fmt.w * 2) / fmt.h).forEach((s, i) => {
        const mid = others[i]!; const g = gutterSlot({ x: 0.5 + s.x * 0.5, y: s.y, w: s.w * 0.5, h: s.h }, gx, gy)
        els.push({ ...newFreeEl(mid), x: g.x, y: g.y, w: g.w, h: g.h, rot: 0, cell: cellFor(mid, (g.w * fmt.w * 2) / Math.max(0.001, g.h * fmt.h)) })
      })
      left.elements = els
      return [left, right]
    }

    // RISPETTA FORMATO: disposizione giustificata, ogni foto tiene le proporzioni reali (V resta V, H resta H)
    // NORMALE: preset salvato che combacia → generatore (poche foto) → griglia (tante, fino a 24)
    const orients = clean.map((id) => classifyAspect(iaOf(id)))
    const saved = layouts.filter((l) => (l.els?.length ?? 0) === clean.length && l.els!.length > 0)
    let slots: Slot[]; let rots: number[]; const useSaved = saved.length > 0
    if (useSaved) {
      // se ho più preset salvati con lo stesso numero di foto, RUOTO (il meno usato finora)
      const s = saved.reduce((best, c, i) => {
        const k = (x: SavedLayout, j: number) => `saved:${x.id ?? x.name ?? j}`
        return (usedSigs?.get(k(c, i)) ?? 0) < (usedSigs?.get(k(best.l, best.i)) ?? 0) ? { l: c, i } : best
      }, { l: saved[0]!, i: 0 }).l
      usedSigs?.set(`saved:${s.id ?? s.name ?? 0}`, (usedSigs?.get(`saved:${s.id ?? s.name ?? 0}`) ?? 0) + 1)
      slots = s.els!.map((e) => ({ x: e.x, y: e.y, w: e.w, h: e.h })); rots = s.els!.map((e) => e.rot ?? 0)
    } else if (clean.length <= 8) {
      const gen = genTavolaLayouts(orients, fmt.w * 2, fmt.h, 48)
      // VARIA i template: tra i migliori candidati scegli quello MENO usato finora (poi per punteggio)
      const topK = [...gen].sort((a, b) => b.score - a.score).slice(0, 6)
      const chosen = topK.reduce<GenLayout | null>((best, c) => {
        if (!best) return c
        const bu = usedSigs?.get(best.sig) ?? 0, cu = usedSigs?.get(c.sig) ?? 0
        return cu < bu ? c : best
      }, null)
      if (chosen) usedSigs?.set(chosen.sig, (usedSigs?.get(chosen.sig) ?? 0) + 1)
      slots = chosen?.slots ?? gridSlots(clean.length, spreadAspect); rots = slots.map(() => 0)
    } else {
      slots = gridSlots(clean.length, spreadAspect); rots = slots.map(() => 0)
    }
    const assign = assignPhotos(slots, orients, fmt.w * 2, fmt.h)
    const els: FreeEl[] = slots.map((s, k) => {
      const ai = assign[k] ?? -1
      const mid = clean[ai >= 0 ? ai : k] ?? clean[k]; if (!mid) return null
      const g = useSaved ? { x: s.x, y: s.y, w: s.w, h: s.h } : gutterSlot(s, gx, gy)
      return { ...newFreeEl(mid), x: g.x, y: g.y, w: g.w, h: g.h, rot: rots[k] ?? 0, cell: cellFor(mid, (g.w * fmt.w * 2) / Math.max(0.001, g.h * fmt.h)) }
    }).filter(Boolean) as FreeEl[]
    left.elements = els
    return [left, right]
  }
  // Profilo di STILE del fotografo: quante foto per tavola usa di solito (dai preset salvati + album
  // attuale). Serve all'AI per rispettare la SUA cadenza di impaginazione.
  function styleProfile(): { perSpread: number; times: number }[] {
    const c = new Map<number, number>()
    for (const l of layouts) { const n = l.els?.length ?? 0; if (n) c.set(n, (c.get(n) ?? 0) + 1) }
    for (const p of pages) { if (p.tavolaFree) { const n = (p.elements ?? []).length; if (n) c.set(n, (c.get(n) ?? 0) + 1) } }
    return [...c.entries()].map(([perSpread, times]) => ({ perSpread, times })).sort((a, b) => b.times - a.times).slice(0, 6)
  }
  // Analisi visiva a BATCH (barra + annullo), riusata da "Impagina con AI" e da "AI seleziona".
  async function analyzeInBatches(photosPayload: { id: string; url: string; moment?: string | null }[], cancelRef: { current: boolean }, onProg: (done: number, total: number) => void): Promise<{ analyses: Record<string, unknown>[]; reason: string; cancelled: boolean }> {
    const AN_BATCH = 8, AN_CONC = 3
    const chunks: (typeof photosPayload)[] = []
    for (let k = 0; k < photosPayload.length; k += AN_BATCH) chunks.push(photosPayload.slice(k, k + AN_BATCH))
    let analyzed = 0; const analyses: Record<string, unknown>[] = []; let reason = ''
    for (let c = 0; c < chunks.length; c += AN_CONC) {
      if (cancelRef.current) return { analyses, reason, cancelled: true }
      const group = chunks.slice(c, c + AN_CONC)
      const rs = await Promise.all(group.map(async (batch) => {
        try {
          const { data, error } = await supabase.functions.invoke('album-ai-layout', { body: { mode: 'analyze', photos: batch } })
          if (error) return { a: batch.map((p) => ({ id: p.id })), r: error.message }
          const a = (data as { analyses?: Record<string, unknown>[] }).analyses ?? []
          const r = (data as { reason?: string } | null)?.reason
          return { a: a.length ? a : batch.map((p) => ({ id: p.id })), r: r ?? '' }
        } catch (e) { return { a: batch.map((p) => ({ id: p.id })), r: String((e as Error)?.message ?? e) } }
      }))
      for (const x of rs) { analyses.push(...x.a); if (x.r && !reason) reason = x.r; analyzed += x.a.length }
      onProg(Math.min(analyzed, photosPayload.length), photosPayload.length)
    }
    return { analyses, reason, cancelled: false }
  }

  async function aiLayout(opts?: { style?: string; maxPerSpread?: number; groupBw?: boolean; heroDouble?: boolean; doublePct?: number; fullPct?: number; respectFormat?: boolean; maxPages?: number; autoSelect?: boolean }) {
    if (kept.length < 2) { toast.error('Servono almeno 2 foto selezionate'); return }
    if (usageCount.size > 0 && !window.confirm("L'impaginazione AI rifà tutte le tavole da capo. Sostituire l'impaginato attuale? (puoi annullare con ⌘Z)")) return
    setStep('design') // passa all'impaginato: così si vede l'animazione e poi il risultato
    setAiBusy(true)
    aiCancel.current = false
    try {
      // EXIF: orario di scatto → ordino le foto CRONOLOGICAMENTE prima di comporre (sequenza vera del giorno)
      let meta = exifMeta
      if (!Object.keys(meta).length) meta = await loadExif()
      const takenAt = (id: string): number | null => meta[id]?.takenAt ?? null
      const ordered = [...kept].sort((a, b) => {
        const ta = takenAt(a.id), tb = takenAt(b.id)
        if (ta != null && tb != null) return ta - tb   // entrambi con orario → cronologico
        if (ta != null) return -1                        // chi ha l'orario prima
        if (tb != null) return 1
        return 0                                          // nessun orario → ordine originale
      })
      // STILE APPRESO dai PDF del fotografo ("Il mio stile"), se presente → ha priorità sul profilo dedotto
      type LearnedStyle = { perSpread?: { perSpread: number; times: number }[]; fullbleedPct?: number; avgPhotos?: number; whiteAvg?: number }
      let learned: LearnedStyle | null = null
      try { const { data } = await (supabase.from as any)('album_style_profiles').select('profile').maybeSingle(); learned = (data?.profile as LearnedStyle) ?? null } catch { /* nessuno stile appreso */ }
      const photosPayload = ordered.map((m) => ({ id: m.id, url: thumbUrl(m), moment: m.album_moment, aspect: aspects[m.id] ?? photoAspect.get(m.id) ?? 1, likes: likeCounts[m.id] ?? 0, takenAt: takenAt(m.id) }))

      // ── FASE A lato CLIENT: l'AI GUARDA le foto un BATCH alla volta → BARRA di avanzamento reale. ──
      setAiProg({ done: 0, total: photosPayload.length, phase: 'Guardo le foto una a una…' })
      const an = await analyzeInBatches(photosPayload, aiCancel, (done, total) => setAiProg({ done, total, phase: 'Guardo le foto una a una…' }))
      if (an.cancelled) { toast.message('Analisi interrotta'); return }
      let analyses = an.analyses
      let usePhotos = photosPayload
      let curatedNote = ''
      // "Fai scegliere le foto all'AI": prima di comporre, l'AI cura il sottoinsieme migliore
      // (taglia doppioni/momenti ripetuti). Compone SOLO le scelte (le altre restano in selezione).
      if (opts?.autoSelect && photosPayload.length >= 8) {
        setAiProg({ done: photosPayload.length, total: photosPayload.length, phase: 'Scelgo le foto migliori…' })
        try {
          const { data: cd } = await supabase.functions.invoke('album-ai-layout', { body: { mode: 'curate', analyses, photos: photosPayload, target: 0 } })
          const keep = (cd as { keep?: string[] } | null)?.keep
          if (Array.isArray(keep) && keep.length >= 2 && keep.length < photosPayload.length) {
            const keepSet = new Set(keep)
            usePhotos = photosPayload.filter((p) => keepSet.has(p.id))
            analyses = analyses.filter((a) => keepSet.has((a as { id?: string }).id ?? ''))
            curatedNote = ` · AI ha scelto ${usePhotos.length}/${photosPayload.length}`
          }
        } catch { /* se la cura fallisce, impagina tutte */ }
      }
      setAiProg({ done: photosPayload.length, total: photosPayload.length, phase: 'Compongo le tavole…' })

      const payload = {
        // Foto GIÀ in ordine cronologico di scatto (takenAt). Le ANALISI sono già fatte dal client
        // (barra), il server ora COMPONE soltanto → risposta più rapida e progresso reale.
        photos: usePhotos,
        analyses,
        format, albumOrient: (fmt.w / fmt.h < 0.92 ? 'verticale' : fmt.w / fmt.h > 1.08 ? 'orizzontale' : 'quadrato'),
        style: opts?.style, maxPerSpread: opts?.maxPerSpread, groupBw: opts?.groupBw, doublePct: opts?.doublePct, fullPct: opts?.fullPct, maxPages: opts?.maxPages, chronological: true,
        styleProfile: (learned?.perSpread?.length ? learned.perSpread : styleProfile()), learnedStyle: learned,
      }
      if (aiCancel.current) { toast.message('Analisi interrotta'); return }
      const { data, error } = await supabase.functions.invoke('album-ai-layout', { body: payload })
      let err = (data as { error?: string } | null)?.error
      let detail = (data as { detail?: string } | null)?.detail
      // Su risposta non-2xx supabase mette l'errore in `error` e il corpo reale in error.context (Response).
      if (error) {
        try { const ctx = (error as { context?: Response }).context; if (ctx && typeof ctx.json === 'function') { const b = await ctx.json(); err = b?.error ?? err; detail = b?.detail ?? detail } } catch { /* ignora */ }
      }
      if (error || err) {
        toast.error(err === 'missing_openai_key' ? 'Manca la chiave OpenAI sul server (OPENAI_API_KEY)'
          : err === 'no_photos' ? 'Nessuna foto da impaginare'
          : err === 'openai_error' ? `OpenAI ha rifiutato: ${detail ?? 'chiave/credito?'}`.slice(0, 200)
          : `Impaginazione AI non riuscita${err ? `: ${err}` : ''}${detail ? ` — ${detail}` : (error?.message ? ` — ${error.message}` : '')}`.slice(0, 200))
        return
      }
      const tavole = (data as { tavole?: { photoIds: string[] }[] }).tavole ?? []
      if (!tavole.length) { toast.error("L'AI non ha restituito tavole"); return }
      const focusMap = (data as { focus?: Record<string, { fx: number; fy: number; hero?: boolean; face?: boolean; ht?: number; hb?: number; sx?: number; sr?: number }> }).focus ?? {}
      setFaceMap(focusMap) // mostra sulle miniature dove l'AI ha trovato i volti
      const usedSigs = new Map<string, number>() // per far VARIARE i template tra una tavola e l'altra
      const newPages = tavole.flatMap((t) => buildAiTavola(t.photoIds, focusMap, opts?.heroDouble !== false, (t as { layout?: string }).layout, usedSigs, opts?.respectFormat !== false))
      if (!newPages.length) { toast.error('Nessuna tavola generata'); return }
      setPages(newPages); setCurrentPageId(newPages[0]!.id); setSelEl(null); setMultiSel([])
      const degraded = (data as { degraded?: boolean }).degraded
      const reason = (data as { reason?: string }).reason
      const seen = (data as { seen?: number }).seen ?? 0
      const cModel = (data as { composeModel?: string }).composeModel ?? ''
      const facesFound = (data as { facesFound?: number }).facesFound ?? 0
      if (degraded) toast.warning(`Impaginate ${tavole.length} tavole · letto ${seen} · volti su ${facesFound} · ${cModel}${curatedNote} · parziale: ${reason ?? 'OpenAI limitato'}`, { duration: 12000 })
      else toast.success(`Impaginate ${tavole.length} tavole · letto ${seen} foto · volti su ${facesFound} · ${cModel}${curatedNote}`, { duration: 8000 })
    } catch (e) {
      toast.error(`Impaginazione AI non riuscita: ${String((e as Error)?.message ?? e).slice(0, 120)}`)
    } finally { setAiBusy(false); setAiProg(null) }
  }

  // RANKING QUALITÀ DI STAMPA (on-demand): l'AI valuta a vista i criteri tecnici (esposizione, neri
  // chiusi, alte luci, fuoco/mosso, rumore) e dà un punteggio 0-100 + i problemi + il perché.
  // "AI SELEZIONA": analizza la selezione (a batch, con barra) e chiede all'AI di CURARE un
  // sottoinsieme che racconti meglio, tagliando doppioni e momenti ripetuti. Apre un modale di revisione.
  async function aiCurate() {
    if (kept.length < 8) { toast.message('La cura serve con selezioni ampie: qui le foto sono già poche.'); return }
    setCurateBusy(true); curateCancel.current = false
    try {
      let meta = exifMeta
      if (!Object.keys(meta).length) meta = await loadExif()
      const takenAt = (id: string): number | null => meta[id]?.takenAt ?? null
      const ordered = [...kept].sort((a, b) => { const ta = takenAt(a.id), tb = takenAt(b.id); if (ta != null && tb != null) return ta - tb; if (ta != null) return -1; if (tb != null) return 1; return 0 })
      const photosPayload = ordered.map((m) => ({ id: m.id, url: thumbUrl(m), moment: m.album_moment, likes: likeCounts[m.id] ?? 0, takenAt: takenAt(m.id) }))
      curatePhotosRef.current = photosPayload
      setCurateProg({ done: 0, total: photosPayload.length, phase: 'Guardo le foto una a una…' })
      const an = await analyzeInBatches(photosPayload, curateCancel, (done, total) => setCurateProg({ done, total, phase: 'Guardo le foto una a una…' }))
      if (an.cancelled) { toast.message('Selezione AI interrotta'); return }
      curateAnalysesRef.current = an.analyses
      setCurateProg({ done: photosPayload.length, total: photosPayload.length, phase: 'Scelgo il meglio del racconto…' })
      const { data, error } = await supabase.functions.invoke('album-ai-layout', { body: { mode: 'curate', analyses: an.analyses, photos: photosPayload, target: 0 } })
      if (error || (data as { error?: string } | null)?.error) { toast.error(`Selezione AI non riuscita${(data as { reason?: string } | null)?.reason ? `: ${(data as { reason?: string }).reason}` : ''}`.slice(0, 160)); return }
      const drop = (data as { drop?: { id: string; reason: string }[] }).drop ?? []
      if (!drop.length) { toast.success("L'AI non toglierebbe nulla: la selezione è già essenziale."); return }
      setCurateTarget((data as { target?: number }).target ?? (photosPayload.length - drop.length))
      setCurateRescue(new Set())
      setCurateResult({ drop, total: photosPayload.length })
    } catch (e) { toast.error(`Selezione AI non riuscita: ${String((e as Error)?.message ?? e).slice(0, 120)}`) }
    finally { setCurateBusy(false); setCurateProg(null) }
  }
  // Ri-cura con un OBIETTIVO diverso, riusando le analisi già fatte (nessuna nuova analisi).
  async function recurate(target: number) {
    const analyses = curateAnalysesRef.current, cphotos = curatePhotosRef.current
    if (!analyses.length || !cphotos.length) return
    setCurateRerun(true)
    try {
      const { data, error } = await supabase.functions.invoke('album-ai-layout', { body: { mode: 'curate', analyses, photos: cphotos, target } })
      if (error || (data as { error?: string } | null)?.error) { toast.error('Non riuscito a ricalcolare'); return }
      const drop = (data as { drop?: { id: string; reason: string }[] }).drop ?? []
      setCurateRescue(new Set())
      setCurateResult({ drop, total: cphotos.length })
      setCurateTarget((data as { target?: number }).target ?? (cphotos.length - drop.length))
    } finally { setCurateRerun(false) }
  }
  // Applica: toglie dalla selezione (KEPT→DISCARDED, batch atomico) le foto scartate NON "recuperate".
  async function applyCurate() {
    if (!curateResult) return
    const toDrop = curateResult.drop.map((d) => d.id).filter((id) => !curateRescue.has(id))
    if (!toDrop.length) { setCurateResult(null); toast.message('Nessuna foto tolta.'); return }
    const ids = new Set(toDrop)
    const before = new Map(photos.filter((m) => ids.has(m.id)).map((m) => [m.id, m.album_choice] as const))
    setMedia((arr) => arr.map((x) => (ids.has(x.id) ? { ...x, album_choice: 'DISCARDED' } : x)))
    const { data, error } = await (supabase.rpc as any)('album_set_choices', { p_ids: toDrop, p_choice: 'DISCARDED' })
    if (error || (data && (data as { error?: string }).error)) {
      setMedia((arr) => arr.map((x) => (before.has(x.id) ? { ...x, album_choice: before.get(x.id) ?? null } : x)))
      toast.error('Non riuscito a togliere le foto dalla selezione'); return
    }
    const k = curateResult.total - toDrop.length
    setCurateResult(null)
    toast.success(`Selezione curata: tolte ${toDrop.length} foto, ne restano ${k} — più respiro nell'album.`)
  }

  // Tutte le foto (id) presenti su una tavola (le due pagine dello spread): elementi liberi, slot
  // template, foto a doppia pagina. Serve per confrontarne il bilanciamento del bianco.
  function tavolaMediaIds(pageId: string): string[] {
    const i = pages.findIndex((p) => p.id === pageId); if (i < 0) return []
    const start = i - (i % 2); const ids: string[] = []
    for (const p of [pages[start], pages[start + 1]]) {
      if (!p) continue
      for (const e of p.elements ?? []) if (e.mediaId) ids.push(e.mediaId)
      for (const id of p.mediaIds ?? []) if (id) ids.push(id)
      if (p.spreadImage?.mediaId) ids.push(p.spreadImage.mediaId)
    }
    return [...new Set(ids)]
  }
  // "Bilanciamento bianco (tavola)": confronta le foto della tavola per capire se il WB coincide.
  async function evalTavolaWB(pageId: string) {
    const ids = tavolaMediaIds(pageId)
    if (ids.length < 2) { toast.message('Servono almeno 2 foto sulla tavola per confrontare il bilanciamento.'); return }
    setWbBusy(true)
    try {
      const photos = ids.map((id) => { const m = mediaById.get(id); return m ? { id, url: hiUrl(m) } : null }).filter(Boolean)
      const { data, error } = await supabase.functions.invoke('album-ai-layout', { body: { mode: 'wb', photos } })
      let err = (data as { error?: string } | null)?.error
      if (error) { try { const ctx = (error as { context?: Response }).context; if (ctx && typeof ctx.json === 'function') { const b = await ctx.json(); err = b?.error ?? err } } catch { /* */ } }
      if (error || err) { toast.error(err === 'missing_openai_key' ? 'Manca la chiave OpenAI sul server' : `Valutazione WB non riuscita${err ? `: ${err}` : ''}`.slice(0, 160)); return }
      const wb = (data as { wb?: { id: string; temp: number; tint: number; label: string }[] }).wb ?? []
      if (!wb.length) { toast.error('Non sono riuscito a valutare il bilanciamento'); return }
      setWbResult({ wb, consistent: (data as { consistent?: boolean }).consistent !== false, off: (data as { off?: string[] }).off ?? [], note: (data as { note?: string }).note ?? '', advice: (data as { advice?: string }).advice ?? '' })
    } catch (e) { toast.error(`Valutazione WB non riuscita: ${String((e as Error)?.message ?? e).slice(0, 120)}`) }
    finally { setWbBusy(false) }
  }

  type QRes = { score: number; issues: string[]; reason: string; advice?: string }
  async function rankQuality() {
    if (kept.length < 1) { toast.error('Nessuna foto da valutare'); return }
    setQualityBusy(true)
    qualityCancel.current = false
    const total = kept.length
    setQualityProg({ done: 0, total })
    try {
      // BATCH guidati dal client → BARRA di avanzamento reale (prima era una chiamata unica cieca).
      const Q_BATCH = 6, Q_CONC = 2
      const chunks: M[][] = []
      for (let k = 0; k < kept.length; k += Q_BATCH) chunks.push(kept.slice(k, k + Q_BATCH))
      const allScores: Record<string, QRes> = {}
      let done = 0, fatalErr = '', anyReason = '', cancelled = false
      for (let c = 0; c < chunks.length && !fatalErr; c += Q_CONC) {
        if (qualityCancel.current) { cancelled = true; break }
        const group = chunks.slice(c, c + Q_CONC)
        const rs = await Promise.all(group.map(async (batch) => {
          try {
            const { data, error } = await supabase.functions.invoke('album-ai-layout', { body: { mode: 'quality', photos: batch.map((m) => ({ id: m.id, url: hiUrl(m) })) } })
            let err = (data as { error?: string } | null)?.error; let detail = (data as { detail?: string } | null)?.detail
            if (error) { try { const ctx = (error as { context?: Response }).context; if (ctx && typeof ctx.json === 'function') { const b = await ctx.json(); err = b?.error ?? err; detail = b?.detail ?? detail } } catch { /* */ } }
            if (error || err) return { n: batch.length, scores: {} as Record<string, QRes>, err: err ?? 'errore', detail }
            return { n: batch.length, scores: (data as { scores?: Record<string, QRes> }).scores ?? {}, reason: (data as { reason?: string }).reason }
          } catch (e) { return { n: batch.length, scores: {} as Record<string, QRes>, err: String((e as Error)?.message ?? e) } }
        }))
        for (const x of rs) {
          Object.assign(allScores, x.scores)
          done += x.n
          if (x.err === 'missing_openai_key') fatalErr = 'Manca la chiave OpenAI sul server (OPENAI_API_KEY)'
          else if (x.err && !anyReason) anyReason = x.detail ? `${x.err}: ${x.detail}` : x.err
          if (x.reason && !anyReason) anyReason = x.reason
        }
        setQualityScores((prev) => ({ ...prev, ...allScores })) // badge live man mano
        setQualityProg({ done: Math.min(done, total), total })
      }
      if (fatalErr) { toast.error(fatalErr); return }
      const n = Object.keys(allScores).length
      if (n) setQualityOpen(true)
      if (cancelled) toast.message(n ? `Interrotto · valutate ${n} foto (report parziale)` : 'Valutazione interrotta')
      else if (!n) toast.error(`Valutazione non riuscita${anyReason ? `: ${anyReason}` : ''}`.slice(0, 160))
      else if (anyReason) toast.warning(`Valutate ${n} foto · alcune non valutabili (${anyReason})`.slice(0, 160), { duration: 9000 })
      else toast.success(`Valutate ${n} foto — apro il report qualità`)
    } catch (e) { toast.error(`Valutazione non riuscita: ${String((e as Error)?.message ?? e).slice(0, 120)}`) }
    finally { setQualityBusy(false); setQualityProg(null) }
  }

  // EXIF: chiede a Drive l'orario di scatto (+ dimensioni reali) delle foto dell'evento → serve
  // all'impaginatore per l'ordine CRONOLOGICO. Silenzioso: se Drive non è collegato, si prosegue senza.
  async function loadExif(): Promise<Record<string, { takenAt: number | null; w: number | null; h: number | null }>> {
    if (!entryId) return {}
    try {
      const { data, error } = await supabase.functions.invoke('album-exif', { body: { entryId } })
      if (error || (data as { error?: string } | null)?.error) return {}
      const meta = (data as { meta?: Record<string, { takenAt: number | null; w: number | null; h: number | null }> }).meta ?? {}
      setExifMeta((prev) => ({ ...prev, ...meta }))
      return meta
    } catch { return {} }
  }

  // ── VISTA CLIENTE (mobile-first, stile Canva mobile): sfoglia le tavole grandi, zoom a tutto
  //    schermo, richiedi modifiche. Sola lettura: il cliente non modifica per sbaglio la struttura. ──
  if (lite) {
    const myOpen = revList.filter((r) => r.status === 'OPEN').length
    const tavPins = (si: number) => revList.filter((r) => r.anchor_x != null && r.tavola_index === si)
    const goSpread = (d: number) => { const pf = bookRef.current?.pageFlip?.(); if (!pf) return; if (d > 0) pf.flipNext(); else pf.flipPrev() }
    // FOGLI del libro: ogni tavola → pagina SINISTRA + pagina DESTRA (mezze superfici), così il
    // cliente sfoglia pagina-per-pagina (react-pageflip) da pag. 1 in poi, come un vero album.
    const flatPages = spreads.flatMap((pair, si) => [
      { si, side: 'L' as const, page: pair[0]!, other: pair[1] },
      { si, side: 'R' as const, page: pair[0]!, other: pair[1] },
    ])
    const renderHalf = (fp: { si: number; side: 'L' | 'R'; page: AlbumPage; other?: AlbumPage }) =>
      fp.page?.tavolaFree
        ? <HalfSurface page={fp.page} side={fp.side} mediaById={mediaById} thumb={hiUrl} />
        : fp.side === 'L'
          ? <div className="absolute inset-0">{fp.page ? <MiniPage page={fp.page} formatKey={format} mediaById={mediaById} thumb={hiUrl} /> : null}</div>
          : <div className="absolute inset-0 bg-white">{fp.other ? <MiniPage page={fp.other} formatKey={format} mediaById={mediaById} thumb={hiUrl} /> : null}</div>
    // dimensioni FISSE del singolo foglio: fitta lo spread (2 pagine) nell'area del reader
    const rbW = readerBox.w || 360, rbH = readerBox.h || 480
    const availW = Math.max(120, rbW - 32), availH = Math.max(120, rbH - 56)
    let leafW = Math.min(availW / 2, availH * asp)
    let leafH = leafW / asp
    if (leafH > availH) { leafH = availH; leafW = leafH * asp }
    leafW = Math.max(60, Math.round(leafW)); leafH = Math.max(60, Math.round(leafH))
    // NB: funzione (non componente <SpreadView/>): definirla inline come componente la rimonterebbe
    // a ogni render → la textarea del post-it perderebbe il focus a ogni tasto.
    const renderSpread = ({ pair, si, max, interactive }: { pair: AlbumPage[]; si: number; max: string; interactive?: boolean }) => (
      <div className="relative flex bg-white shadow-xl mx-auto" style={{ aspectRatio: String(asp * pair.length), width: max }}>
        {pair[0]?.tavolaFree
          ? <FreeSurface page={pair[0]} mediaById={mediaById} thumb={hiUrl} />
          : pair.map((p) => <div key={p.id} className="h-full" style={{ aspectRatio: String(asp) }}><MiniPage page={p} formatKey={format} mediaById={mediaById} thumb={hiUrl} /></div>)}
        {!pair[0]?.tavolaFree && pair[0]?.spreadImage && (() => { const m = mediaById.get(pair[0]!.spreadImage!.mediaId); return m ? <SpreadImg src={hiUrl(m)} cell={pair[0]!.spreadImage!.cell} frame={spreadFrameOf(pair[0]!.spreadImage)} /> : null })()}
        {pair.length === 2 && <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-black/10 pointer-events-none" />}
        {/* NUMERI DI PAGINA (sinistra/destra) FUORI dalla pagina, sotto i bordi (solo nel reader) */}
        {!interactive && <>
          <span className="absolute -bottom-6 left-0 text-[11px] font-medium text-[rgb(var(--fg-muted))] tabular-nums pointer-events-none select-none">{si * 2 + 1}</span>
          <span className="absolute -bottom-6 right-0 text-[11px] font-medium text-[rgb(var(--fg-muted))] tabular-nums pointer-events-none select-none">{si * 2 + 2}</span>
        </>}
        <PostitLayer
          pins={tavPins(si)} openId={interactive ? openPin : null} onOpen={interactive ? setOpenPin : () => {}}
          canPlace={!!interactive && isCouple}
          onPlaceAt={(x, y) => { setRevBody(''); setReplaceMode(false); setReplaceId(null); setPlacing({ tav: si, x, y, mediaId: hitMediaAt(pair[0], x, y) }) }}
          placing={placing && placing.tav === si ? placing : null}
          composer={interactive && placing && placing.tav === si ? (
            <div className="rounded-md rounded-tl-none bg-amber-50 border border-amber-300 shadow-xl p-2.5 space-y-2 -rotate-1">
              <p className="text-[11px] text-amber-800 font-medium">{placing.mediaId ? '📷 Su questa foto' : '📍 Su questo punto'} · Tav. {si + 1}</p>
              {placing.mediaId && (
                <div className="flex gap-1">
                  <button onClick={() => setReplaceMode(false)} className={`flex-1 text-[11px] py-1 rounded border ${!replaceMode ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-300 text-amber-800'}`}>✍️ Nota</button>
                  <button onClick={() => setReplaceMode(true)} className={`flex-1 text-[11px] py-1 rounded border ${replaceMode ? 'bg-amber-500 text-white border-amber-500' : 'border-amber-300 text-amber-800'}`}>🔄 Sostituisci</button>
                </div>
              )}
              <textarea value={revBody} onChange={(e) => setRevBody(e.target.value)} rows={2} autoFocus placeholder={replaceMode ? 'Perché la cambieresti? (facoltativo)' : 'Cosa vorresti cambiare qui?'} className="w-full text-sm rounded border border-amber-300 bg-white/90 px-2 py-1.5 outline-none focus:border-amber-500" />
              {replaceMode && placing.mediaId && (
                <div className="space-y-1">
                  <p className="text-[10px] text-amber-700">Con quale foto? <span className="opacity-70">(facoltativo — può scegliere il fotografo)</span></p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
                    <button onClick={() => setReplaceId(null)} className={`shrink-0 h-12 w-12 rounded grid place-items-center text-[9px] text-center border ${replaceId == null ? 'border-amber-500 ring-2 ring-amber-300 bg-amber-100' : 'border-amber-200 bg-white'}`}>scegli<br />tu</button>
                    {kept.filter((m) => m.id !== placing.mediaId).map((m) => (
                      <button key={m.id} onClick={() => setReplaceId(m.id)} className={`shrink-0 h-12 w-12 rounded overflow-hidden border ${replaceId === m.id ? 'border-amber-500 ring-2 ring-amber-300' : 'border-amber-200'}`}>
                        <img src={thumbUrl(m)} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-1.5">
                <button onClick={() => { setPlacing(null); setReplaceMode(false); setReplaceId(null) }} className="text-xs px-2 py-1 rounded text-amber-800 hover:bg-amber-100">Annulla</button>
                <button onClick={() => void savePostit()} className="text-xs px-2.5 py-1 rounded bg-amber-500 text-white font-medium hover:bg-amber-600">{replaceMode ? 'Chiedi sostituzione' : 'Invia'}</button>
              </div>
            </div>
          ) : null}
          renderBubble={(p) => {
            const isRepl = p.kind === 'REPLACE'
            const rep = p.replace_media_id ? mediaById.get(p.replace_media_id) : null
            return (
            <div className="rounded-md rounded-tl-none bg-amber-50 border border-amber-300 shadow-xl p-2.5 -rotate-1">
              {isRepl && <p className="text-[10px] font-medium text-amber-800 mb-1 flex items-center gap-1">🔄 Sostituisci questa foto{rep ? ' con:' : ''}</p>}
              {isRepl && rep && <img src={thumbUrl(rep)} alt="" className="w-full h-20 object-cover rounded mb-1.5" />}
              {p.body && p.body !== '(senza testo)' && <p className="text-sm whitespace-pre-wrap break-words">{p.body}</p>}
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] text-amber-700">{p.author_name ?? 'Cliente'}{p.status === 'DONE' ? ' · fatto ✓' : p.status === 'DECLINED' ? ' · risposta dal fotografo' : ''}</span>
                <button onClick={() => void deleteRev(p.id)} className="text-[10px] text-rose-500 hover:underline">Elimina</button>
              </div>
              {p.reply && (
                <div className="mt-1.5 rounded bg-sky-50 border border-sky-200 p-1.5">
                  {p.reply_reason && <span className="block text-[9px] uppercase tracking-wider text-sky-700">{ALBUM_REPLY_REASONS.find((x) => x.key === p.reply_reason)?.label ?? p.reply_reason}</span>}
                  <p className="text-[12px] text-[rgb(var(--fg))]">{p.reply}</p>
                  <p className="text-[9px] text-sky-700/70 mt-0.5">— il fotografo</p>
                </div>
              )}
            </div>
          )}}
        />
      </div>
    )
    return (
      <div className="min-h-screen flex flex-col bg-[rgb(var(--bg-sunken))]">
        <RotateScreenGate title="Gira il telefono" subtitle="L’album si sfoglia molto meglio in orizzontale: ruota lo schermo (o allarga la finestra)." />
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
            {/* READER SFOGLIABILE come un VERO ALBUM: ogni tavola = pagina sinistra + destra; si
                sfoglia foglio-per-foglio (react-pageflip) con ombre, drag/swipe e frecce. Tap su una
                pagina → zoom a tutto schermo per il post-it. */}
            {(() => { const ci = Math.min(clientIdx, spreads.length - 1); return (
              <div ref={setReaderEl} className="flex-1 min-h-0 relative overflow-hidden flex items-center justify-center select-none">
                {readerBox.w > 0 && (
                  <HTMLFlipBook
                    key={`fb-${leafW}x${leafH}-${flatPages.length}`}
                    ref={bookRef}
                    startPage={ci * 2}
                    size="fixed"
                    width={leafW} height={leafH}
                    minWidth={60} maxWidth={3000} minHeight={60} maxHeight={3000}
                    drawShadow maxShadowOpacity={0.5}
                    flippingTime={700}
                    usePortrait={false}
                    startZIndex={0}
                    autoSize={false}
                    showCover={false}
                    mobileScrollSupport={false}
                    clickEventForward
                    useMouseEvents
                    swipeDistance={24}
                    showPageCorners
                    disableFlipByClick
                    className="" style={{}}
                    onFlip={(e: any) => setClientIdx(Math.max(0, Math.floor((e?.data ?? 0) / 2)))}
                  >
                    {flatPages.map((fp, i) => (
                      <div key={i} className="bg-white" style={{ width: leafW, height: leafH }}>
                        <div className="relative w-full h-full cursor-zoom-in" onClick={() => setZoomSpread(fp.si)} title="Tocca per ingrandire e lasciare un post-it">
                          {renderHalf(fp)}
                          {/* numero pagina FUORI dall'immagine, nel margine inferiore */}
                          <span className={`absolute bottom-1 ${fp.side === 'L' ? 'left-2' : 'right-2'} text-[10px] font-medium text-[rgb(var(--fg-subtle))] tabular-nums pointer-events-none select-none`}>{fp.side === 'L' ? fp.si * 2 + 1 : fp.si * 2 + 2}</span>
                          {/* puntine post-it (sola lettura) sulla metà giusta della tavola */}
                          {tavPins(fp.si).filter((p) => p.anchor_x != null && ((fp.side === 'L') === ((p.anchor_x as number) < 0.5))).map((p) => {
                            const lx = fp.side === 'L' ? (p.anchor_x as number) * 2 : ((p.anchor_x as number) - 0.5) * 2
                            return <span key={p.id} className="absolute h-3 w-3 rounded-full bg-amber-400 border border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: `${lx * 100}%`, top: `${(p.anchor_y as number) * 100}%` }} />
                          })}
                        </div>
                      </div>
                    ))}
                  </HTMLFlipBook>
                )}
                {ci > 0 && <button onClick={() => goSpread(-1)} title="Pagina precedente" className="absolute left-0 top-0 bottom-0 w-10 z-10 flex items-center justify-start pl-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] hover:bg-black/[0.03]"><ChevronLeft size={26} /></button>}
                {ci < spreads.length - 1 && <button onClick={() => goSpread(1)} title="Pagina successiva" className="absolute right-0 top-0 bottom-0 w-10 z-10 flex items-center justify-end pr-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] hover:bg-black/[0.03]"><ChevronRight size={26} /></button>}
              </div>
            ) })()}
            <div className="sticky bottom-0 bg-[rgb(var(--bg))] border-t border-[rgb(var(--border))] px-4 py-2 flex flex-col gap-1.5">
              <p className="text-center text-[11px] text-[rgb(var(--fg-muted))]">Sfoglia con le frecce o trascinando · tocca una pagina per il post-it</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[rgb(var(--fg-muted))] tabular-nums w-24">Pag. {clientIdx * 2 + 1}–{clientIdx * 2 + 2}</span>
                <div className="flex-1 flex justify-center gap-1 flex-wrap">{spreads.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all ${i === clientIdx ? 'w-4 bg-[rgb(var(--gold-500))]' : 'w-1.5 bg-[rgb(var(--border))]'}`} />)}</div>
                <Button variant="gold" size="sm" onClick={() => setZoomSpread(clientIdx)}><MessageSquare size={14} /> Post-it</Button>
              </div>
            </div>
          </>
        )}

        {/* zoom a tutto schermo della tavola — qui il cliente APPUNTA i post-it toccando le foto */}
        {zoomSpread != null && spreads[zoomSpread] && (
          <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col" onClick={() => { setZoomSpread(null); setPlacing(null); setOpenPin(null) }}>
            <div className="flex items-center justify-between px-4 py-2 text-white" onClick={(e) => e.stopPropagation()}>
              <span className="text-sm">Pagine {zoomSpread * 2 + 1}–{zoomSpread * 2 + 2}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="!text-white !border-white/30" onClick={() => { setClientIdx(zoomSpread); setClientReqOpen(true) }}><MessageSquare size={14} /> Nota generale</Button>
                <button onClick={() => { setZoomSpread(null); setPlacing(null); setOpenPin(null) }} className="p-1.5 rounded hover:bg-white/10"><X size={20} className="text-white" /></button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-3 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              {renderSpread({ pair: spreads[zoomSpread]!, si: zoomSpread, max: 'min(180vw, 1400px)', interactive: true })}
            </div>
            <p className="text-center text-white/70 text-xs pb-3">{isCouple ? 'Tocca una foto o un punto della tavola per lasciare un post-it · tocca una puntina per rileggerla' : 'Tocca una puntina per leggere il post-it'}</p>
          </div>
        )}

        {/* foglio "richiedi modifica" */}
        {clientReqOpen && (
          <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setClientReqOpen(false)}>
            <div className="bg-[rgb(var(--bg))] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <p className="font-medium flex items-center gap-2"><MessageSquare size={16} /> Richiedi una modifica</p>
              <p className="text-xs text-[rgb(var(--fg-muted))]">Riferita alle <strong>pagine {clientIdx * 2 + 1}–{clientIdx * 2 + 2}</strong>. Scrivi cosa vorresti cambiare (foto, posizione, ritaglio…): il fotografo la sistema.</p>
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
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${r.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : r.status === 'DECLINED' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.status === 'OPEN' ? 'In attesa' : r.status === 'DECLINED' ? 'Risposta dal fotografo' : 'Fatto'}</span>
                      </div>
                      <p className="text-sm">{r.body}</p>
                      {r.reply && (
                        <div className="mt-2 rounded-md bg-sky-50 border border-sky-200 p-2">
                          {r.reply_reason && <span className="inline-block text-[10px] uppercase tracking-wider text-sky-700 mb-0.5">{ALBUM_REPLY_REASONS.find((x) => x.key === r.reply_reason)?.label ?? r.reply_reason}</span>}
                          <p className="text-[13px]">{r.reply}</p>
                          <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-0.5">— il fotografo</p>
                          {r.status === 'DECLINED' && <button onClick={() => void reopenRev(r.id)} className="mt-1.5 text-[11px] px-2 py-1 rounded-full border border-amber-300 text-amber-700 hover:bg-amber-50">Insisti comunque</button>}
                        </div>
                      )}
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
            {!lite && (
              <div className="relative flex items-center gap-1">
                <select value={format} onChange={(e) => setFormat(e.target.value)} className="text-sm rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5 max-w-[230px]">
                  <optgroup label="Standard">
                    {ALBUM_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </optgroup>
                  {(customFmts.length > 0 || isCustomFormat(format)) && (
                    <optgroup label="Personalizzati">
                      {customFmts.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      {isCustomFormat(format) && !customFmts.some((f) => f.key === format) && (
                        <option value={format}>{getFormat(format).label}</option>
                      )}
                    </optgroup>
                  )}
                </select>
                <button title="Formato personalizzato"
                  onClick={() => { const c = getFormat(format); setCfW(String(c.w / 10)); setCfH(String(c.h / 10)); setFmtPanel((v) => !v) }}
                  className="px-2 py-1.5 rounded-lg border border-[rgb(var(--border))] text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] hover:bg-[rgb(var(--bg-sunken))]"><Plus size={15} /></button>
                {fmtPanel && (
                  <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-xl p-3 text-sm">
                    <p className="font-medium mb-2">Formato personalizzato</p>
                    <div className="flex items-end gap-2 mb-2">
                      <label className="text-[11px] text-[rgb(var(--fg-muted))]">Largh.<input value={cfW} onChange={(e) => setCfW(e.target.value)} inputMode="decimal" className="mt-0.5 w-16 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1" /></label>
                      <span className="text-[rgb(var(--fg-subtle))] pb-1.5">×</span>
                      <label className="text-[11px] text-[rgb(var(--fg-muted))]">Alt.<input value={cfH} onChange={(e) => setCfH(e.target.value)} inputMode="decimal" className="mt-0.5 w-16 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1" /></label>
                      <span className="text-[11px] text-[rgb(var(--fg-subtle))] pb-1.5">cm</span>
                    </div>
                    <input value={cfName} onChange={(e) => setCfName(e.target.value)} placeholder="Nome (facoltativo)" className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1 mb-1.5" />
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))] mb-2">Misura della pagina singola — la tavola sarà larga il doppio.</p>
                    <div className="flex gap-2">
                      <button onClick={saveCustom} className="flex-1 rounded-lg bg-[rgb(var(--gold-500))] text-white px-3 py-1.5 text-xs font-medium hover:opacity-90"><Save size={12} className="inline mr-1" />Salva e usa</button>
                      <button onClick={() => setFmtPanel(false)} className="rounded-lg border border-[rgb(var(--border))] px-3 py-1.5 text-xs">Chiudi</button>
                    </div>
                    {customFmts.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-[rgb(var(--border))] space-y-1 max-h-32 overflow-auto">
                        {customFmts.map((f) => (
                          <div key={f.key} className="flex items-center gap-2">
                            <button onClick={() => { setFormat(f.key); setFmtPanel(false) }} className="flex-1 text-left text-xs hover:underline truncate" title={f.label}>{f.label}</button>
                            <button onClick={() => setCustomFmts(deleteCustomFormat(f.key))} className="text-[rgb(var(--fg-subtle))] hover:text-rose-500" title="Elimina"><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="hidden sm:flex rounded-lg border border-[rgb(var(--border))] overflow-hidden">
              <button onClick={() => setStep('select')} className={`px-3 py-1.5 text-xs ${step === 'select' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : ''}`}>1 · Selezione</button>
              <button onClick={() => setStep('design')} className={`px-3 py-1.5 text-xs ${step === 'design' ? 'bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] font-medium' : ''}`}>2 · Impagina</button>
            </div>
          </div>
        </div>
      </div>

      {step === 'select' ? (
        <div className="max-w-7xl mx-auto px-4 py-5">
          {!lite && !isCouple && kept.length >= 2 && (
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))] px-4 py-3">
              <p className="text-sm text-[rgb(var(--fg))]">Hai <strong>{kept.length}</strong> foto selezionate. Lascia impaginare l'album all'AI: guarda le foto, le raggruppa in tavole e sceglie il ritaglio.</p>
              <Button variant="gold" size="sm" disabled={busy || aiBusy} onClick={() => setAiPick(true)}>{aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Impagina con AI</Button>
            </div>
          )}
          <SelectStep
            photos={photos} kept={kept} total={total} okRange={okRange} untagged={untagged}
            missingMin={missingMin} perMoment={perMoment}
            onToggle={toggleKeep} onMoment={setMoment} onGenerate={generate} thumb={thumbUrl}
            isCouple={isCouple} onReadyToLayout={coupleReadyToLayout}
            onKeepAll={() => void setKeepAll('KEPT')} onKeepNone={() => void setKeepAll('DISCARDED')}
            onImport={importPhotos} importing={importing}
            likeCounts={likeCounts} onKeepLiked={() => void keepLiked()}
          />
        </div>
      ) : (
        <>
          {/* FUNNEL: percorso a step per il fotografo (① stile → ② impagina → ③ valuta → ④ esporta) */}
          {!lite && (
            <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))]/50 px-3 py-1.5">
              <FunnelSteps steps={[
                { key: 'stile', label: 'Il mio stile', done: hasStyle, onClick: () => setStyleOpen(true), hint: "Insegna all'AI come impagini (facoltativo, ma migliora tutto)" },
                { key: 'seleziona', label: 'AI seleziona', done: false, onClick: () => void aiCurate(), hint: 'Troppe foto? L\'AI cura la selezione: taglia doppioni e momenti ripetuti, tiene il meglio con respiro' },
                { key: 'impagina', label: 'Impagina con AI', done: pages.length > 0, onClick: () => setAiPick(true), hint: "L'AI legge le foto e compone le tavole" },
                { key: 'valuta', label: 'Valuta qualità', done: Object.keys(qualityScores).length > 0, onClick: () => void rankQuality(), hint: 'Controllo tecnico di stampa, come in stamperia' },
                { key: 'esporta', label: 'Esporta', onClick: () => setExportOpen(true), hint: 'PDF o JPG pronti per la stampa' },
              ]} />
            </div>
          )}
          {/* barra strumenti impaginatore */}
          <div className="border-b border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 flex items-center gap-2 flex-wrap text-sm">
            {lite && <span className="text-[11px] px-2 py-1 rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]">Versione cliente · sposta/cambia le foto e scrivi le modifiche</span>}
            {!lite && <Button variant="gold" size="sm" disabled={busy || aiBusy} onClick={() => setAiPick(true)} title="L'AI guarda le foto, capisce i momenti, le raggruppa in tavole, sceglie la sequenza e il ritaglio giusto — al posto tuo, seguendo il tuo stile">{aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Impagina con AI</Button>}
            {!lite && <Button variant="outline" size="sm" disabled={busy || aiBusy || curateBusy} onClick={() => void aiCurate()} title="Troppe foto o momenti ripetuti? L'AI cura la selezione: taglia doppioni e ripetizioni, tiene il meglio del racconto con più respiro. Poi rivedi e applichi.">{curateBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} AI seleziona</Button>}
            {!lite && <Button variant="outline" size="sm" disabled={busy || aiBusy} onClick={() => setPages(autoLayout(kept.map((m) => ({ id: m.id, moment: m.album_moment })), format).pages)} title="Impaginazione automatica veloce (senza AI): raggruppa per momento"><Wand2 size={14} /> Auto rapida</Button>}
            {!lite && <Button variant="outline" size="sm" disabled={busy || qualityBusy} onClick={() => void rankQuality()} title="L'AI valuta la qualità TECNICA di stampa di ogni foto (esposizione, neri chiusi, alte luci, fuoco/mosso, rumore) e dà un voto 0-100 con il perché e cosa fare">{qualityBusy ? <Loader2 size={14} className="animate-spin" /> : <Sliders size={14} />} Valuta qualità</Button>}
            {!lite && Object.keys(qualityScores).length > 0 && <Button variant="outline" size="sm" onClick={() => setQualityOpen(true)} title="Riapri il report qualità di stampa"><FileText size={14} /> Report</Button>}
            {!lite && <Button variant="outline" size="sm" disabled={busy} onClick={() => setStyleOpen(true)} title="Carica i tuoi album PDF: l'AI impara COME impagini (foto per tavola, respiro, doppia pagina) e 'Impagina con AI' comporrà nel tuo stile"><Frame size={14} /> Il mio stile</Button>}
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
            {!lite && Object.keys(faceMap).length > 0 && <ToolToggle on={showFaces} onClick={() => setShowFaces((v) => !v)} icon={<Eye size={14} />} label="Volti" />}
            {(lowResFlags.low > 0 || lowResFlags.warn > 0) && (
              <span title="Alcune foto piazzate sono a risoluzione troppo bassa per la dimensione di stampa: in album risulterebbero sgranate. Cercale (bordo/badge arancione sulla tavola), rimpiccioliscile o sostituiscile con una versione a risoluzione più alta."
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${lowResFlags.low > 0 ? 'bg-rose-100 text-rose-700 border border-rose-300' : 'bg-amber-100 text-amber-800 border border-amber-300'}`}>
                <AlertTriangle size={13} /> {lowResFlags.low + lowResFlags.warn} a bassa risoluzione
              </span>
            )}
            {/* "Libera": ON = editi a mano (handle); spegnendola ESCI → la composizione resta
                CONGELATA IDENTICA (stesse posizioni/ritagli/rotazioni), solo non più editabile a
                mano. Riaccendendola rientri in modifica. Un preset/griglia la SOVRASCRIVE. */}
            {!lite && spreadPages[0] && (() => { const lp = spreadPages[0]!; const isFree = !!lp.tavolaFree; return <ToolToggle on={isFree && !lp.frozen} onClick={() => { if (!isFree) convertTavolaToFree(lp.id); else updatePage(lp.id, (p) => ({ ...p, frozen: !p.frozen })) }} icon={<Move size={14} />} label="Libera" /> })()}
            {!lite && spreadPages[0] && <ToolToggle on={false} onClick={() => fillElToTavola(spreadPages[0]!.id)} icon={<Maximize size={14} />} label="Piena tavola" />}
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
            <aside className="shrink-0 border-r border-[rgb(var(--border))] overflow-auto p-2" style={{ width: libW }}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-medium text-[rgb(var(--fg-muted))]" title="Foto della libreria già inserite nell'album / totale">Usate {trayMedia.filter((m) => placedIds.has(m.id)).length}/{trayMedia.length}</p>
                {!lite && <>
                  <input ref={trayFileRef} type="file" accept="image/*,video/*" multiple className="hidden"
                    onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) void importPhotos(fs) }} />
                  <button title="Aggiungi altre foto all'album" disabled={!!importing} onClick={() => trayFileRef.current?.click()}
                    className="text-[10px] inline-flex items-center gap-0.5 text-[rgb(var(--gold-700))] hover:underline disabled:opacity-50">
                    {importing ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}{importing ? `${importing.done + 1}/${importing.total}` : 'Aggiungi'}
                  </button>
                </>}
              </div>
              {/* FILTRO per MOMENTO: legge i tag (album_moment) e mostra solo quelle foto */}
              <select value={momentFilter} onChange={(e) => setMomentFilter(e.target.value)}
                className="w-full mb-1.5 text-[11px] px-1 py-1 rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))]">
                <option value="">Tutti i momenti ({trayMedia.length})</option>
                {MOMENTS.filter((mm) => (trayMoments.get(mm.key) ?? 0) > 0).map((mm) => <option key={mm.key} value={mm.key}>{mm.label} ({trayMoments.get(mm.key)})</option>)}
                {(trayMoments.get('_none') ?? 0) > 0 && <option value="_none">Senza momento ({trayMoments.get('_none')})</option>}
              </select>
              <div className="grid grid-cols-2 gap-1.5">
                {trayFiltered.map((m) => (
                  <div key={m.id} id={`tray-${m.id}`} className={`relative group/tray rounded ${highlightMedia === m.id ? 'ring-4 ring-[rgb(var(--gold-500))] ring-offset-2 ring-offset-[rgb(var(--bg))]' : ''}`}>
                    <button
                      draggable onDragStart={(e) => e.dataTransfer.setData('text/media', m.id)}
                      onClick={() => { if (!currentPageId) return; if (currentPage?.mode === 'free') freeAdd(currentPageId, m.id); else placeInto(currentPageId, activeSlot, m.id) }}
                      title={getMoment(m.album_moment)?.label ?? 'senza momento'}
                      className={`block w-full relative aspect-square rounded overflow-hidden border ${placedIds.has(m.id) ? 'border-[rgb(var(--border))]' : 'border-[rgb(var(--gold-400))] ring-1 ring-[rgb(var(--gold-400))]'}`}>
                      {/* SEMPRE a colori. INSERITE: sfumate (opacità) → si capisce che sono a posto.
                          NON inserite: piene e nitide, con bordino dorato → le foto che MANCANO
                          saltano subito all'occhio. (niente bianco/nero) */}
                      <img src={thumbUrl(m)} alt="" loading="lazy"
                        className={`w-full h-full object-cover ${placedIds.has(m.id) ? 'opacity-40' : ''}`} />
                      {/* VOLTO mappato dall'AI: pallino sulla posizione del viso (mappato sul crop quadrato) */}
                      {showFaces && faceMap[m.id]?.face && (() => {
                        const ia = aspects[m.id] ?? 1
                        let px = faceMap[m.id]!.fx, py = faceMap[m.id]!.fy
                        if (ia >= 1) px = (px - 0.5) * ia + 0.5; else py = (py - 0.5) / ia + 0.5
                        if (px < 0.02 || px > 0.98 || py < 0.02 || py > 0.98) return null
                        return <span title="Volto rilevato dall'AI" className="pointer-events-none absolute z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[rgb(var(--gold-500))] shadow" style={{ left: `${px * 100}%`, top: `${py * 100}%` }} />
                      })()}
                      {(() => { const n = usageCount.get(m.id) ?? 0; return n >= 1 ? (
                        <span title={n > 1 ? `Usata ${n} volte` : 'Usata 1 volta'}
                          className={`absolute top-0.5 right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full text-[9px] font-bold leading-[15px] text-center text-white ${n > 1 ? 'bg-[rgb(var(--rose-500))] ring-1 ring-white' : 'bg-black/55'}`}>{n > 1 ? `×${n}` : '✓'}</span>
                      ) : null })()}
                    </button>
                    {/* ELIMINA dalla selezione (non dal disco): compare in hover, aggiorna tutti i numeri */}
                    {!lite && (
                      <button title="Togli dalla selezione (non elimina dal disco)"
                        onClick={(e) => { e.stopPropagation(); void removeFromSelection(m) }}
                        className="absolute top-0.5 left-0.5 z-10 h-[16px] w-[16px] rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover/tray:opacity-100 hover:bg-rose-600 transition-opacity">
                        <X size={11} />
                      </button>
                    )}
                    {/* voto qualità stampa (0-100) dell'AI: verde ≥75, ambra 50-74, rosso <50 */}
                    {(qualityScores[m.id]?.score ?? 0) > 0 && (
                      <span title={`Qualità stampa ${qualityScores[m.id]!.score}/100 — ${qualityScores[m.id]!.reason}${qualityScores[m.id]!.issues.length ? ' · ' + qualityScores[m.id]!.issues.join(', ') : ''}${qualityScores[m.id]!.advice ? '\nDa fare: ' + qualityScores[m.id]!.advice : ''}`}
                        className={`absolute bottom-0.5 left-0.5 z-10 min-w-[18px] h-[15px] px-1 rounded text-[9px] font-bold leading-[15px] text-center text-white ${qualityScores[m.id]!.score >= 75 ? 'bg-emerald-600/90' : qualityScores[m.id]!.score >= 50 ? 'bg-amber-500/95' : 'bg-rose-600/90'}`}>
                        {qualityScores[m.id]!.score}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </aside>
            {/* maniglia: allarga/stringi la libreria */}
            {!lite && <DragSize axis="x" onResize={(d) => setLibW((w) => clampPx(w + d, 120, 440))} className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-[rgb(var(--gold-400))] transition-colors" />}

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
                    {spreadPages[0]?.tavolaFree ? (() => {
                      const lp = spreadPages[0]!
                      const activate = () => { if (lp.id !== currentPageId) { setCurrentPageId(lp.id); setActiveSlot(null); setSelEl(null); setMultiSel([]) } }
                      return (
                        <div key={lp.id} onPointerDownCapture={activate} className="relative h-full" style={{ aspectRatio: String(asp * spreadPages.length) }}>
                          <FreeStage page={lp} formatKey={format} spread bleed={bleed} gridOn={gridOn} marginsOn={marginsOn} pageNum={null}
                            aspects={aspects} realDims={realDims} mediaById={mediaById} thumb={thumbUrl} locked={!!lp.frozen} selEl={!lp.frozen ? selEl : null} multiSel={!lp.frozen ? multiSel : []}
                            onSelect={(id, additive) => selectEl(id, additive)} onUpdateEl={(id, patch) => freeUpdate(lp.id, id, patch)}
                            onUpdateMany={(patches) => freeUpdateMany(lp.id, patches)}
                            onRemove={(id) => freeRemove(lp.id, id)} onDuplicateEl={(id) => freeDuplicate(lp.id, id)}
                            onDropMedia={(id) => freeAdd(lp.id, id)} onReplaceEl={(id, mid) => freeReplace(lp.id, id, mid)} onSwapEls={(a, b) => freeSwapEls(lp.id, a, b)} onContext={(id, x, y) => openCtx(lp.id, id, x, y)} onStartMove={startPhotoMove} />
                        </div>
                      )
                    })() : spreadPages.map((p) => {
                      const isAct = p.id === currentPageId
                      const pnum = pageNums ? pages.findIndex((x) => x.id === p.id) + 1 : null
                      const activate = () => { if (p.id !== currentPageId) { setCurrentPageId(p.id); setActiveSlot(null); setSelEl(null); setMultiSel([]) } }
                      return (
                        <div key={p.id} onPointerDownCapture={activate} className="relative h-full" style={{ aspectRatio: String(asp) }}>
                          {p.mode === 'free' ? (
                            <FreeStage page={p} formatKey={format} bleed={bleed} gridOn={gridOn} marginsOn={marginsOn} pageNum={pnum}
                              aspects={aspects} realDims={realDims} mediaById={mediaById} thumb={thumbUrl} locked={!!p.frozen} selEl={isAct && !p.frozen ? selEl : null} multiSel={isAct && !p.frozen ? multiSel : []}
                              onSelect={(id, additive) => selectEl(id, additive)} onUpdateEl={(id, patch) => freeUpdate(p.id, id, patch)}
                              onUpdateMany={(patches) => freeUpdateMany(p.id, patches)}
                              onRemove={(id) => freeRemove(p.id, id)} onDuplicateEl={(id) => freeDuplicate(p.id, id)}
                              onDropMedia={(id) => freeAdd(p.id, id)} onReplaceEl={(id, mid) => freeReplace(p.id, id, mid)} onSwapEls={(a, b) => freeSwapEls(p.id, a, b)} onContext={(id, x, y) => openCtx(p.id, id, x, y)} onStartMove={startPhotoMove} />
                          ) : (
                            <PageStage page={p} formatKey={format} bleed={bleed} gridOn={gridOn} marginsOn={marginsOn} pageNum={pnum}
                              aspects={aspects} mediaById={mediaById} thumb={thumbUrl} activeSlot={isAct ? activeSlot : null}
                              onSlot={setActiveSlot} onDropMedia={(s, id) => placeInto(p.id, s, id)}
                              onClearSlot={(s) => clearSlot(p.id, s)} onCell={(s, partial) => updateCell(p.id, s, partial)} onCrop={(s) => setCropFor(s)}
                              onFree={() => convertTavolaToFree(tavolaLeftIdOf(p.id))} onSwap={(a, b) => swapSlots(p.id, a, b)} />
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
                      const spQ: Quality = m ? photoQuality(realDims[sp.mediaId], fr.w * fmt.w * 2, fr.h * fmt.h, sp.cell) : { level: 'ok', dpi: 0 }
                      const spLow = spQ.level === 'low' || spQ.level === 'warn'
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
                              {spLow && !lite && (
                                <>
                                  <div className={`absolute inset-0 pointer-events-none ring-2 ring-inset ${spQ.level === 'low' ? 'ring-rose-500/80' : 'ring-amber-400/80'}`} />
                                  <div title={qualityHint(spQ)} className={`absolute top-1 left-1 z-[46] inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold text-white pointer-events-none shadow ${spQ.level === 'low' ? 'bg-rose-600/90' : 'bg-amber-500/95'}`}>
                                    <AlertTriangle size={11} /> {spQ.dpi} dpi · bassa risoluzione
                                  </div>
                                </>
                              )}
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
                    {/* filigrana del dorso (solo editor, non in stampa) — in tavola unica la disegna la FreeStage */}
                    {spreadPages.length === 2 && !spreadPages[0]?.tavolaFree && <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-[rgba(184,146,63,.55)] pointer-events-none z-50" title="Dorso (non viene stampato)" />}
                    {/* POST-IT del cliente, appuntati sulla tavola: il fotografo li legge e li segna fatti */}
                    <PostitLayer pins={revList.filter((r) => r.anchor_x != null && r.tavola_index === activeSpread)} openId={openPin} onOpen={setOpenPin}
                      renderBubble={(p) => {
                        const isRepl = p.kind === 'REPLACE'
                        const rep = p.replace_media_id ? mediaById.get(p.replace_media_id) : null
                        return (
                        <div className="rounded-md rounded-tl-none bg-amber-50 border border-amber-300 shadow-xl p-2.5 text-[rgb(var(--fg))]">
                          {isRepl && <p className="text-[11px] font-semibold text-amber-800 mb-1">🔄 Richiesta: sostituisci questa foto{rep ? ' con quella scelta:' : ' (foto a tua scelta)'}</p>}
                          {isRepl && rep && <img src={thumbUrl(rep)} alt="" className="w-full h-24 object-cover rounded mb-1.5" />}
                          {p.body && p.body !== '(senza testo)' && <p className="text-sm whitespace-pre-wrap break-words">{p.body}</p>}
                          <p className="text-[10px] text-amber-700 mt-1">{p.author_name ?? 'Cliente'} · {new Date(p.created_at).toLocaleDateString('it-IT')}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 justify-end">
                            {isRepl && rep && p.status === 'OPEN' && <button onClick={() => applyReplacePostit(p)} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[rgb(var(--gold-500))] text-white font-medium"><Shuffle size={11} /> Inserisci la foto</button>}
                            {p.status === 'OPEN'
                              ? <button onClick={() => { void resolveRev(p.id); setOpenPin(null) }} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-500 text-white"><Check size={11} /> Fatto</button>
                              : <button onClick={() => void reopenRev(p.id)} className="text-[11px] px-2 py-0.5 rounded border border-amber-300">Riapri</button>}
                            <button onClick={() => void deleteRev(p.id)} className="text-[11px] text-rose-500 hover:underline">Elimina</button>
                          </div>
                        </div>
                      )}} />
                  </div>
                ) : (
                  <Card className="p-10 text-center text-sm text-[rgb(var(--fg-muted))]">
                    Nessuna tavola. Premi <strong>Impagina con AI</strong> o aggiungi una tavola.
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
              {/* maniglia: alza/abbassa la striscia delle tavole (le miniature scalano) */}
              {!lite && <DragSize axis="y" onResize={(d) => setStripH((h) => clampPx(h - d, 48, 240))} className="h-1.5 shrink-0 cursor-row-resize bg-transparent hover:bg-[rgb(var(--gold-400))] transition-colors" />}
              {/* filmstrip TAVOLE (doppia pagina, come in stampa) */}
              <div ref={filmstripRef}
                onDragOver={(e) => { const c = filmstripRef.current; if (!c) return; const r = c.getBoundingClientRect(); const EDGE = 72; if (e.clientX > r.right - EDGE) c.scrollLeft += 22; else if (e.clientX < r.left + EDGE) c.scrollLeft -= 22 }}
                className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-2 flex items-center gap-3 overflow-x-auto">
                {spreads.map((pair, si) => (
                  <Fragment key={si}>
                    {!lite && <GapDrop onDropPhoto={(mid, x, y) => setGapInsert({ si, mediaId: mid, x, y })} onMoveNewTavola={(move) => moveNewTavola(si, move)} onInsert={() => insertEmptyTavola(si)} gapIndex={si} h={stripH} />}
                    <SpreadThumb pair={pair} index={si} aspect={asp} active={si === activeSpread} lite={lite} thumbH={stripH}
                      mediaById={mediaById} thumb={thumbUrl} formatKey={format} aspects={aspects}
                      onSelect={() => { setCurrentPageId((pair[0] ?? pair[1])!.id); setActiveSlot(null); setSelEl(null); setMultiSel([]) }}
                      onDropMedia={(pageId, id) => placeInto(pageId, null, id)}
                      onMovePhotos={(pageId, move) => movePhotosToTavola(pageId, move)}
                      onMove={(d) => moveSpread(si, d)} onDelete={() => delSpread(si)} onReorder={(from, to) => moveSpreadInsert(from, to)}
                      onContext={(x, y) => setNavMenu({ si, x, y })} />
                  </Fragment>
                ))}
                {!lite && <GapDrop onDropPhoto={(mid, x, y) => setGapInsert({ si: spreads.length, mediaId: mid, x, y })} onMoveNewTavola={(move) => moveNewTavola(spreads.length, move)} onInsert={() => insertEmptyTavola(spreads.length)} gapIndex={spreads.length} h={stripH} />}
                {!lite && <button onClick={addSpread} className="shrink-0 rounded-lg border-2 border-dashed border-[rgb(var(--border))] text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))] flex items-center justify-center px-3" style={{ height: stripH, aspectRatio: String(asp * 2) }} title="Aggiungi tavola"><Plus size={16} className="mr-1" /> Tavola</button>}
              </div>
            </main>

            {/* maniglia: allarga/stringi il pannello funzioni */}
            {!lite && <DragSize axis="x" onResize={(d) => setPanelW((w) => clampPx(w - d, 180, 560))} className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-[rgb(var(--gold-400))] transition-colors" />}
            {/* pannello proprietà */}
            <aside className="shrink-0 border-l border-[rgb(var(--border))] overflow-auto p-3" style={{ width: panelW }}>
              {currentPage && (currentPage.mode === 'free' && !currentPage.frozen ? (
                <FreePanel
                  page={currentPage} selEl={selEl} lite={lite}
                  onBg={(c) => setPageBg(currentPage.id, c)}
                  onElUpdate={(id, patch) => freeUpdate(currentPage.id, id, patch)}
                  onElRemove={(id) => freeRemove(currentPage.id, id)}
                  onAddPage={() => addSpread()} onDelPage={() => delPage(currentPage.id)} onDuplicate={() => duplicatePage(currentPage.id)}
                  onSaveLayout={saveCurLayout}
                  presets={tavPresets} tavAspect={asp * 2} onApplyTavolaLayout={applyTavolaLayout}
                  myPresets={myTavPresets} onApplySaved={applySavedToTavola} onDeleteSaved={removeLayout}
                  selCount={multiSel.length} onAlign={alignSel} onDistribute={distributeSel} onUniformGaps={uniformGapsSel}
                  gutterMm={gutterMm} onGutter={setGutterMm}
                  layers={[...(currentPage.elements ?? [])].reverse().map((e) => { const m = mediaById.get(e.mediaId); return { id: e.id, thumb: m ? thumbUrl(m) : '' } })}
                  onSelectEl={(id) => { setSelEl(id); setMultiSel([]) }}
                  onReorderEl={(id, dir) => freeReorderOne(currentPage.id, id, dir)}
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

          {/* (Ritaglio elemento libero: ora SOLO via navigatore inline nel pannello, non più modale) */}

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

          {/* MENU CONTESTUALE (tasto destro su una foto) stile InDesign */}
          {ctxMenu && (() => {
            const cm = ctxMenu; const close = () => setCtxMenu(null); const run = (fn: () => void) => { fn(); close() }
            const left = Math.min(cm.x, window.innerWidth - 232); const top = Math.min(cm.y, window.innerHeight - 372)
            return (
              <div className="fixed inset-0 z-[90]" onPointerDown={close} onContextMenu={(e) => { e.preventDefault(); close() }}>
                <div className="absolute min-w-[210px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-xl py-1 text-sm" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
                  <CtxItem label="Copia" sk="⌘C" onClick={() => run(copySelToast)} />
                  <CtxItem label="Taglia" sk="⌘X" onClick={() => run(cutSel)} />
                  <CtxItem label="Incolla" sk="⌘V" disabled={!clipboard.current.length} onClick={() => run(pasteSel)} />
                  <CtxItem label="Duplica" sk="⌘D" onClick={() => run(duplicateSel)} />
                  <CtxSep />
                  <CtxItem label="Apri in Photoshop" onClick={() => run(() => { const el = (pages.find((p) => p.id === cm.pageId)?.elements ?? []).find((e) => e.id === cm.id); if (el) void openInPhotoshop(el.mediaId) })} />
                  <CtxItem label="Carica versione modificata" onClick={() => run(() => { psTarget.current = { pageId: cm.pageId, elId: cm.id }; psFileRef.current?.click() })} />
                  <CtxItem label="Cancella oggetto (AI)" onClick={() => run(() => { const el = (pages.find((p) => p.id === cm.pageId)?.elements ?? []).find((e) => e.id === cm.id); if (el) void openInpaint(cm.pageId, cm.id, el.mediaId) })} />
                  <CtxItem label="Ritaglia la foto" onClick={() => run(() => { setSelEl(cm.id); setMultiSel([]) })} />
                  <CtxItem label="Sostituisci foto" onClick={() => run(() => { setSelEl(cm.id); setMultiSel([]); toast.message('Trascina una foto dalla libreria sopra questa per sostituirla.') })} />
                  <CtxItem label="Sostituisci con… (scambia)" onClick={() => run(() => { const el = (pages.find((p) => p.id === cm.pageId)?.elements ?? []).find((e) => e.id === cm.id); if (el) { setSwapIdx(0); setSwapPick({ mediaId: el.mediaId }) } })} />
                  <CtxSep />
                  <CtxItem label="Bilanciamento bianco (tavola)" onClick={() => run(() => void evalTavolaWB(cm.pageId))} />
                  <CtxSep />
                  <CtxItem label={`Organizza nella pagina${multiSel.length > 1 ? ` (${multiSel.length} foto)` : ''}`} onClick={() => run(() => organizeSelectionIntoPage(cm.pageId, multiSel.length ? multiSel : [cm.id]))} />
                  <CtxSep />
                  <CtxItem label="Riempi la cornice" onClick={() => run(() => freeFillFrame(cm.pageId, cm.id))} />
                  <CtxItem label="Centra il contenuto" onClick={() => run(() => freeCenterContent(cm.pageId, cm.id))} />
                  <CtxSep />
                  <CtxItem label="Porta in primo piano" onClick={() => run(() => freeBringFront(cm.pageId, cm.id))} />
                  <CtxItem label="Porta in fondo" onClick={() => run(() => freeSendBack(cm.pageId, cm.id))} />
                  <CtxSep />
                  <CtxItem label="Elimina" sk="⌫" danger onClick={() => run(deleteSel)} />
                </div>
              </div>
            )
          })()}

          {/* MENU CONTESTUALE del NAVIGATORE (tasto destro su una tavola nella filmstrip) */}
          {navMenu && (() => {
            const nm = navMenu; const close = () => setNavMenu(null); const run = (fn: () => void) => { fn(); close() }
            const left = Math.min(nm.x, window.innerWidth - 232); const top = Math.min(nm.y, window.innerHeight - 200)
            const nSpreads = Math.ceil(pages.length / 2)
            return (
              <div className="fixed inset-0 z-[90]" onPointerDown={close} onContextMenu={(e) => { e.preventDefault(); close() }}>
                <div className="absolute min-w-[210px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-xl py-1 text-sm" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
                  <CtxItem label="Aggiungi tavola dopo" onClick={() => run(() => addSpreadAfter(nm.si))} />
                  <CtxItem label="Aggiungi tavola prima" onClick={() => run(() => addSpreadAfter(nm.si - 1))} />
                  <CtxSep />
                  <CtxItem label="Sposta a sinistra" disabled={nm.si <= 0} onClick={() => run(() => moveSpread(nm.si, -1))} />
                  <CtxItem label="Sposta a destra" disabled={nm.si >= nSpreads - 1} onClick={() => run(() => moveSpread(nm.si, 1))} />
                  <CtxSep />
                  <CtxItem label="Elimina tavola" danger onClick={() => run(() => delSpread(nm.si))} />
                </div>
              </div>
            )
          })()}

          {/* SCELTA inserimento tavola (foto trascinata tra due tavole): singola / doppia / piena */}
          {gapInsert && (() => {
            const gi = gapInsert; const close = () => setGapInsert(null); const run = (mode: 'single' | 'double' | 'full') => { insertTavolaWithPhotoAt(gi.si, gi.mediaId, mode); close() }
            const left = Math.min(gi.x, window.innerWidth - 232); const top = Math.min(gi.y, window.innerHeight - 170)
            return (
              <div className="fixed inset-0 z-[90]" onPointerDown={close} onContextMenu={(e) => { e.preventDefault(); close() }}>
                <div className="absolute min-w-[210px] rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-xl py-1 text-sm" style={{ left, top }} onPointerDown={(e) => e.stopPropagation()}>
                  <p className="px-3 py-1 text-[11px] text-[rgb(var(--fg-muted))]">Inserisci qui la foto come…</p>
                  <CtxItem label="Foto su una pagina" onClick={() => run('single')} />
                  <CtxItem label="Foto a piena tavola" onClick={() => run('full')} />
                  <CtxItem label="Foto a doppia pagina" onClick={() => run('double')} />
                </div>
              </div>
            )
          })()}

          {/* SOSTITUISCI CON… : scegli un'altra foto e le due si SCAMBIANO di posto */}
          {swapPick && (() => {
            const cands = trayMedia.filter((m) => m.id !== swapPick.mediaId)
            const src = mediaById.get(swapPick.mediaId)
            if (!cands.length) return (
              <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/60 p-4" onClick={() => setSwapPick(null)}>
                <div className="w-[min(94vw,420px)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <p className="font-display text-base">Nessun'altra foto</p>
                  <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">Non ci sono altre foto con cui scambiare.</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setSwapPick(null)}>Chiudi</Button>
                </div>
              </div>
            )
            const i = Math.max(0, Math.min(swapIdx, cands.length - 1))
            const cur = cands[i]
            if (!cur) return null
            const go = (d: number) => setSwapIdx((x) => ((Math.min(x, cands.length - 1) + d) % cands.length + cands.length) % cands.length)
            return (
              <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/70 p-4" onClick={() => setSwapPick(null)}
                onTouchStart={(e) => { swapTouch.current = e.changedTouches[0]?.clientX ?? null }}
                onTouchEnd={(e) => { const s = swapTouch.current; swapTouch.current = null; if (s == null) return; const dx = (e.changedTouches[0]?.clientX ?? s) - s; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1) }}>
                <div className="flex max-h-[92vh] w-[min(96vw,860px)] flex-col rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  {/* intestazione: quale foto sto sostituendo + contatore */}
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {src ? <img src={thumbUrl(src)} alt="" className="h-11 w-11 rounded object-cover ring-2 ring-[rgb(var(--gold-500))]" /> : null}
                      <div>
                        <p className="font-display text-base">Sostituisci con…</p>
                        <p className="text-xs text-[rgb(var(--fg-muted))]">Scorri le foto e scegli con quale scambiare · <span className="tabular-nums">{i + 1} / {cands.length}</span></p>
                      </div>
                    </div>
                    <button onClick={() => setSwapPick(null)} className="rounded-full p-1.5 hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
                  </div>

                  {/* card grande: la foto candidata, intera (object-contain), con frecce */}
                  <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black">
                    <img key={cur.id} src={hiUrl(cur)} alt="" className="max-h-[56vh] max-w-full animate-[fadeIn_.18s_ease] object-contain" />
                    {(usageCount.get(cur.id) ?? 0) >= 1 && <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">già in album</span>}
                    <button onClick={() => go(-1)} aria-label="Precedente" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition-colors hover:bg-black/70"><ChevLeft size={22} /></button>
                    <button onClick={() => go(1)} aria-label="Successiva" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white backdrop-blur transition-colors hover:bg-black/70"><ChevRight size={22} /></button>
                  </div>

                  {/* striscia miniature: prima → ultima, la corrente evidenziata, click per saltare */}
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                    {cands.map((m, k) => (
                      <button key={m.id} onClick={() => setSwapIdx(k)}
                        ref={k === i ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}
                        className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition-all ${k === i ? 'border-[rgb(var(--gold-500))] ring-2 ring-[rgb(var(--gold-400))]' : 'border-[rgb(var(--border))] opacity-60 hover:opacity-100'}`}>
                        <img src={thumbUrl(m)} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>

                  {/* azione */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Button variant="outline" size="sm" onClick={() => setSwapPick(null)}>Annulla</Button>
                    <Button variant="gold" size="sm" onClick={() => { swapPhotos(swapPick.mediaId, cur.id); setSwapPick(null) }}><Shuffle size={14} /> Scambia con questa</Button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* BRIEF AI: prima di impaginare l'AI chiede le cose che contano (stile, densità, B/N, hero) */}
          {aiPick && (
            <div className="fixed inset-0 z-[92] flex items-center justify-center bg-black/50 p-4" onClick={() => setAiPick(false)}>
              <div className="w-[min(94vw,620px)] max-h-[90vh] overflow-auto rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <p className="font-display text-lg">Impagina con AI</p>
                <p className="mb-1 mt-0.5 text-sm text-[rgb(var(--fg-muted))]">Poche scelte e l'AI compone l'album di conseguenza (legge le foto, gli orari di scatto e i volti).</p>
                <p className="mb-3 text-xs"><button type="button" onClick={() => { setAiPick(false); setStyleOpen(true) }} className="text-[rgb(var(--gold-700))] hover:underline">Insegna il tuo stile</button> <span className="text-[rgb(var(--fg-subtle))]">— carica un tuo album PDF e l'AI impaginerà come te.</span></p>

                <p className="mb-1.5 text-xs font-medium text-[rgb(var(--fg-muted))]">Stile</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {AI_STYLES.map((s) => (
                    <button key={s.key} onClick={() => setAiStyle(s.key)}
                      className={`rounded-xl border p-2.5 text-left transition-colors ${aiStyle === s.key ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))] hover:border-[rgb(var(--gold-400))]'}`}>
                      <div className="flex items-center gap-2 text-sm font-medium">{aiStyle === s.key ? <Check size={14} className="text-[rgb(var(--gold-600))]" /> : <Sparkles size={14} className="text-[rgb(var(--gold-600))]" />} {s.label}</div>
                      <p className="mt-0.5 text-[11px] text-[rgb(var(--fg-muted))]">{s.desc}</p>
                    </button>
                  ))}
                </div>

                <p className="mb-1.5 mt-4 text-xs font-medium text-[rgb(var(--fg-muted))]">Massimo foto per tavola</p>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 2, 3, 4, 6, 8, 12, 24].map((n) => (
                    <button key={n} onClick={() => setAiMaxPer(n)}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${aiMaxPer === n ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] font-medium' : 'border-[rgb(var(--border))]'}`}>
                      {n === 0 ? 'Auto' : n}
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs"><span className="font-medium text-[rgb(var(--fg-muted))]">Foto a doppia pagina</span><span>{aiDoublePct}%</span></div>
                    <input type="range" min={0} max={30} value={aiDoublePct} onChange={(e) => setAiDoublePct(Number(e.target.value))} className="w-full accent-[rgb(var(--gold-500))]" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs"><span className="font-medium text-[rgb(var(--fg-muted))]">Foto a pagina intera</span><span>{aiFullPct}%</span></div>
                    <input type="range" min={0} max={40} value={aiFullPct} onChange={(e) => setAiFullPct(Number(e.target.value))} className="w-full accent-[rgb(var(--gold-500))]" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs"><span className="font-medium text-[rgb(var(--fg-muted))]">Numero massimo di pagine</span><span>{aiMaxPages}</span></div>
                    <input type="range" min={10} max={140} step={2} value={aiMaxPages} onChange={(e) => setAiMaxPages(Number(e.target.value))} className="w-full accent-[rgb(var(--gold-500))]" />
                    <p className="mt-0.5 text-[10px] text-[rgb(var(--fg-subtle))]">Se serve spazio l'AI usa più tavole per non tagliare, ma senza superare questo limite.</p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-50))] p-2.5 text-sm">
                    <input type="checkbox" checked={aiAutoSelect} onChange={(e) => setAiAutoSelect(e.target.checked)} className="mt-0.5 accent-[rgb(var(--gold-500))]" />
                    <span><strong>Fai scegliere le foto all'AI</strong> — se sono troppe o ripetono i momenti, l'AI usa solo il meglio (taglia doppioni e ripetizioni) per un album con più respiro. <span className="text-[rgb(var(--fg-subtle))]">Le altre restano in selezione, semplicemente non entrano nell'album.</span></span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={aiGroupBw} onChange={(e) => setAiGroupBw(e.target.checked)} className="accent-[rgb(var(--gold-500))]" />
                    Raggruppa le foto in <strong>bianco e nero</strong> (non mischiarle col colore)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={aiHeroDouble} onChange={(e) => setAiHeroDouble(e.target.checked)} className="accent-[rgb(var(--gold-500))]" />
                    Anche le foto che l'AI giudica forti a <strong>doppia pagina</strong>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={aiRespectFormat} onChange={(e) => setAiRespectFormat(e.target.checked)} className="accent-[rgb(var(--gold-500))]" />
                    Rispetta il <strong>formato reale</strong> delle foto (verticali restano verticali, orizzontali orizzontali)
                  </label>
                </div>

                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setAiPick(false)}>Annulla</Button>
                  <Button variant="gold" size="sm" onClick={() => { setAiPick(false); void aiLayout({ style: aiStyle, maxPerSpread: aiMaxPer || undefined, groupBw: aiGroupBw, heroDouble: aiHeroDouble, doublePct: aiDoublePct, fullPct: aiFullPct, respectFormat: aiRespectFormat, maxPages: aiMaxPages, autoSelect: aiAutoSelect }) }}><Sparkles size={14} /> Impagina</Button>
                </div>
              </div>
            </div>
          )}

          {/* "IL MIO STILE" — dentro l'impaginatore: il fotografo carica i suoi album PDF e l'AI impara */}
          {styleOpen && (
            <div className="fixed inset-0 z-[93] flex items-center justify-center bg-black/50 p-4" onClick={() => setStyleOpen(false)}>
              <div className="w-[min(94vw,640px)] max-h-[90vh] overflow-auto rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <MyStylePanel onClose={() => setStyleOpen(false)} />
              </div>
            </div>
          )}

          {/* REPORT QUALITÀ STAMPA: foto peggiori in cima, voto + problemi + consiglio tecnico VISIBILI */}
          {qualityOpen && (() => {
            const ISSUE: Record<string, string> = { bassa_risoluzione: 'bassa risoluzione', fuori_fuoco: 'fuori fuoco', mosso: 'mosso', luci_bruciate: 'alte luci bruciate', neri_chiusi: 'neri chiusi (impasto)', sottoesposta: 'sottoesposta', sovraesposta: 'sovraesposta', poco_contrasto: 'poco contrasto', troppo_contrasto: 'troppo contrasto', dominante_colore: 'dominante colore', incarnati: 'incarnati fuori tono', rumore: 'rumore', banding: 'banding (posterizzazione)', aberrazione_cromatica: 'aberrazione cromatica', artefatti_jpeg: 'artefatti JPEG', fuori_gamut: 'fuori gamut CMYK', aloni_nitidezza: 'aloni da over-sharpen', ok: 'ok' }
            const entries = Object.entries(qualityScores).filter(([id]) => mediaById.has(id)).sort((a, b) => a[1].score - b[1].score)
            const arr = entries.map(([, v]) => v.score)
            const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
            const bad = arr.filter((s) => s < 50).length, mid = arr.filter((s) => s >= 50 && s < 75).length, good = arr.filter((s) => s >= 75).length
            const chip = (s: number) => s >= 75 ? 'bg-emerald-600' : s >= 50 ? 'bg-amber-500' : 'bg-rose-600'
            const jump = (id: string) => { setQualityOpen(false); setHighlightMedia(id); setTimeout(() => document.getElementById(`tray-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); setTimeout(() => setHighlightMedia(null), 2400) }
            return (
              <div className="fixed inset-0 z-[93] flex items-center justify-center bg-black/60 p-4" onClick={() => setQualityOpen(false)}>
                <div className="flex max-h-[92vh] w-[min(96vw,760px)] flex-col rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  {/* intestazione + sintesi */}
                  <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--border))] p-4">
                    <div>
                      <p className="font-display text-lg">Qualità di stampa</p>
                      <p className="mt-0.5 text-sm text-[rgb(var(--fg-muted))]">{entries.length} foto valutate · media <strong className="tabular-nums">{avg}</strong>/100. In cima le più critiche.</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium text-white">
                        <span className="rounded-full bg-rose-600 px-2 py-0.5">{bad} da rivedere</span>
                        <span className="rounded-full bg-amber-500 px-2 py-0.5">{mid} accettabili</span>
                        <span className="rounded-full bg-emerald-600 px-2 py-0.5">{good} ottime</span>
                      </div>
                    </div>
                    <button onClick={() => setQualityOpen(false)} className="rounded-full p-1.5 hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
                  </div>
                  {/* elenco */}
                  <div className="min-h-0 flex-1 divide-y divide-[rgb(var(--border))] overflow-auto">
                    {entries.length === 0 && <p className="p-6 text-center text-sm text-[rgb(var(--fg-muted))]">Nessuna foto valutata.</p>}
                    {entries.map(([id, q]) => { const m = mediaById.get(id); if (!m) return null; return (
                      <div key={id} className="flex gap-3 p-3">
                        <button onClick={() => jump(id)} title="Vai alla foto" className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[rgb(var(--border))]">
                          <img src={thumbUrl(m)} alt="" loading="lazy" className="h-full w-full object-cover" />
                          <span className={`absolute bottom-0 left-0 right-0 py-0.5 text-center text-[11px] font-bold text-white ${chip(q.score)}`}>{q.score}</span>
                        </button>
                        <div className="min-w-0 flex-1">
                          {q.issues?.length ? (
                            <div className="mb-1 flex flex-wrap gap-1">
                              {q.issues.map((it) => <span key={it} className="rounded-full bg-[rgb(var(--bg-sunken))] px-2 py-0.5 text-[11px] text-[rgb(var(--fg-muted))]">{ISSUE[it] ?? it}</span>)}
                            </div>
                          ) : <p className="mb-1 text-[11px] text-emerald-600">Nessun difetto rilevato</p>}
                          {(() => { const d = realDims[id]; return d && d.w > 0 && !d.capped ? <p className="mb-0.5 text-[11px] text-[rgb(var(--fg-subtle))]">Risoluzione file: <span className="tabular-nums">{d.w}×{d.h} px</span> ({(Math.round(d.w * d.h / 100000) / 10)} MP)</p> : null })()}
                          {q.reason && <p className="text-sm">{q.reason}</p>}
                          {q.advice && <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]"><strong className="text-[rgb(var(--fg))]">Da fare:</strong> {q.advice}</p>}
                          <button onClick={() => jump(id)} className="mt-1.5 inline-flex items-center gap-1 text-xs text-[rgb(var(--gold-700))] hover:underline">Vai alla foto <ChevRight size={12} /></button>
                        </div>
                      </div>
                    ) })}
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-[rgb(var(--border))] p-3">
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Nitidezza e rumore dall'anteprima sono indicativi.</p>
                    <Button variant="outline" size="sm" onClick={() => setQualityOpen(false)}>Chiudi</Button>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Anteprima grande della foto selezionata in tavola (barra spaziatrice). */}
          {photoPreview && (() => {
            const m = mediaById.get(photoPreview)
            if (!m) return null
            return (
              <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 select-none" onClick={() => setPhotoPreview(null)}>
                <img src={hiUrl(m)} alt="" className="max-w-full max-h-full object-contain rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
                <button onClick={() => setPhotoPreview(null)} title="Chiudi (Esc)" className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><X size={18} /></button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-[11px] bg-black/40 rounded-full px-3 py-1">Spazio o Esc per chiudere</div>
              </div>
            )
          })()}

          {/* Barra di avanzamento dell'export (prima girava a vuoto senza feedback) */}
          {exportProg && (
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
              <div className="w-[min(92vw,380px)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5 shadow-2xl">
                <div className="flex items-center gap-2"><Loader2 size={16} className="animate-spin text-[rgb(var(--gold-600))]" /> <p className="font-display text-base">Esporto l'album…</p></div>
                {exportProg.zip != null ? (
                  <>
                    <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">Comprimo lo ZIP delle tavole… <span className="tabular-nums">{exportProg.zip}%</span></p>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-sunken))]">
                      <div className="h-full rounded-full bg-[rgb(var(--gold-500))] transition-[width] duration-200" style={{ width: `${exportProg.zip}%` }} />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">Preparo le tavole in alta risoluzione. <span className="tabular-nums">{exportProg.done}/{exportProg.total}</span></p>
                    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-sunken))]">
                      <div className="h-full rounded-full bg-[rgb(var(--gold-500))] transition-[width] duration-200" style={{ width: `${Math.round((exportProg.done / Math.max(1, exportProg.total)) * 100)}%` }} />
                    </div>
                  </>
                )}
                <p className="mt-2 text-[11px] text-[rgb(var(--fg-subtle))]">Alla fine parte il download del file. Non chiudere la pagina.</p>
                <div className="mt-3 text-right"><Button variant="outline" size="sm" onClick={() => { exportCancel.current = true }}><X size={14} /> Interrompi</Button></div>
              </div>
            </div>
          )}

          {/* Barra di avanzamento della VALUTAZIONE QUALITÀ (prima girava senza feedback) */}
          {qualityProg && (
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
              <div className="w-[min(92vw,380px)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5 shadow-2xl">
                <div className="flex items-center gap-2"><Sliders size={16} className="animate-pulse text-[rgb(var(--gold-600))]" /> <p className="font-display text-base">Controllo qualità di stampa…</p></div>
                <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">Analizzo ogni foto come in stamperia. <span className="tabular-nums">{qualityProg.done}/{qualityProg.total}</span></p>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-sunken))]">
                  <div className="h-full rounded-full bg-[rgb(var(--gold-500))] transition-[width] duration-200" style={{ width: `${Math.round((qualityProg.done / Math.max(1, qualityProg.total)) * 100)}%` }} />
                </div>
                <p className="mt-2 text-[11px] text-[rgb(var(--fg-subtle))]">Alla fine si apre il report. Non chiudere la pagina.</p>
                <div className="mt-3 text-right"><Button variant="outline" size="sm" onClick={() => { qualityCancel.current = true }}><X size={14} /> Interrompi</Button></div>
              </div>
            </div>
          )}

          {/* Barra di avanzamento di "AI seleziona" (analisi + cura) */}
          {curateProg && (
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
              <div className="w-[min(92vw,380px)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5 shadow-2xl">
                <div className="flex items-center gap-2"><Sparkles size={16} className="animate-pulse text-[rgb(var(--gold-600))]" /> <p className="font-display text-base">AI seleziona…</p></div>
                <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">{curateProg.phase ?? 'Analizzo la selezione…'} <span className="tabular-nums">{curateProg.done}/{curateProg.total}</span></p>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-sunken))]">
                  <div className="h-full rounded-full bg-[rgb(var(--gold-500))] transition-[width] duration-200" style={{ width: `${Math.round((curateProg.done / Math.max(1, curateProg.total)) * 100)}%` }} />
                </div>
                <div className="mt-3 text-right"><Button variant="outline" size="sm" onClick={() => { curateCancel.current = true }}><X size={14} /> Interrompi</Button></div>
              </div>
            </div>
          )}

          {/* REVISIONE "AI seleziona": mostra le foto che l'AI TOGLIE (con motivo). Puoi salvarne alcune
              (click = "tieni comunque"), regolare quante tenerne, poi Applica. Reversibile dal passo Selezione. */}
          {curateResult && (() => {
            const removed = curateResult.drop.filter((d) => !curateRescue.has(d.id)).length
            const keepCount = curateResult.total - removed
            const minKeep = Math.max(1, Math.round(curateResult.total * 0.35))
            return (
              <div className="fixed inset-0 z-[93] flex items-center justify-center bg-black/60 p-4" onClick={() => setCurateResult(null)}>
                <div className="flex max-h-[92vh] w-[min(96vw,860px)] flex-col rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="border-b border-[rgb(var(--border))] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-lg">AI seleziona — racconto più asciutto</p>
                        <p className="mt-0.5 text-sm text-[rgb(var(--fg-muted))]">Da <strong>{curateResult.total}</strong> foto l'AI ne terrebbe <strong className="text-[rgb(var(--gold-700))] tabular-nums">{keepCount}</strong> e ne toglierebbe <strong className="tabular-nums">{removed}</strong> (doppioni e momenti ripetuti). Le tolte restano su disco: sparisce solo il cuore.</p>
                      </div>
                      <button onClick={() => setCurateResult(null)} className="rounded-full p-1.5 hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
                    </div>
                    {/* obiettivo: quante tenerne (ricalcola riusando le analisi) */}
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-xs font-medium text-[rgb(var(--fg-muted))] shrink-0">Tieni ~</span>
                      <input type="range" min={minKeep} max={curateResult.total} value={Math.min(curateResult.total, Math.max(minKeep, curateTarget || keepCount))} disabled={curateRerun}
                        onChange={(e) => setCurateTarget(Number(e.target.value))}
                        onMouseUp={(e) => void recurate(Number((e.target as HTMLInputElement).value))}
                        onTouchEnd={(e) => void recurate(Number((e.target as HTMLInputElement).value))}
                        className="w-full accent-[rgb(var(--gold-500))]" />
                      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">{curateTarget || keepCount}</span>
                      {curateRerun && <Loader2 size={15} className="animate-spin text-[rgb(var(--gold-600))]" />}
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto p-4">
                    <p className="mb-2 text-xs text-[rgb(var(--fg-muted))]">Foto che l'AI TOGLIE — tocca una foto per <strong>tenerla comunque</strong>:</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                      {curateResult.drop.map((d) => { const m = mediaById.get(d.id); if (!m) return null; const rescued = curateRescue.has(d.id); return (
                        <button key={d.id} onClick={() => setCurateRescue((s) => { const n = new Set(s); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n })}
                          className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${rescued ? 'border-[rgb(var(--gold-500))] ring-2 ring-[rgb(var(--gold-400))]' : 'border-transparent'}`}>
                          <img src={thumbUrl(m)} alt="" loading="lazy" className={`h-full w-full object-cover transition-all ${rescued ? '' : 'opacity-60 grayscale'}`} />
                          <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white">{rescued ? '✓ tieni' : d.reason}</span>
                        </button>
                      ) })}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-[rgb(var(--border))] p-3">
                    <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Reversibile: rimetti il cuore dal passo Selezione.</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setCurateResult(null)}>Annulla</Button>
                      <Button variant="gold" size="sm" disabled={removed === 0} onClick={() => void applyCurate()}><Check size={14} /> Applica ({keepCount} restano)</Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Cancella oggetto (AI): pennello/testo → gpt-image-1 → sostituisce la foto nella tavola */}
          {inpaint && (
            <ObjectRemoveModal src={inpaint.src} onClose={() => setInpaint(null)}
              onResult={(file) => { const t = inpaint; setInpaint(null); if (t) void replaceElWithFile(t.pageId, t.elId, file) }} />
          )}

          {/* Valutazione WB in corso */}
          {wbBusy && (
            <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4">
              <div className="w-[min(92vw,340px)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-5 text-center shadow-2xl">
                <Loader2 size={22} className="mx-auto mb-2 animate-spin text-[rgb(var(--gold-600))]" />
                <p className="font-display text-base">Confronto il bilanciamento del bianco…</p>
                <p className="mt-1 text-sm text-[rgb(var(--fg-muted))]">Verifico se le foto della tavola coincidono.</p>
              </div>
            </div>
          )}

          {/* Report BILANCIAMENTO BIANCO della tavola: temp/tinta di ogni foto + coerenza + come uniformare */}
          {wbResult && (() => {
            const tempLabel = (t: number) => t === 0 ? 'neutro' : `${t > 0 ? 'caldo' : 'freddo'} ${t > 0 ? '+' : ''}${t}`
            const tintLabel = (t: number) => t === 0 ? 'neutro' : `${t > 0 ? 'magenta' : 'verde'} ${t > 0 ? '+' : ''}${t}`
            const tempCls = (t: number) => t > 0 ? 'bg-amber-500' : t < 0 ? 'bg-sky-500' : 'bg-[rgb(var(--fg-subtle))]'
            const tintCls = (t: number) => t > 0 ? 'bg-fuchsia-500' : t < 0 ? 'bg-emerald-500' : 'bg-[rgb(var(--fg-subtle))]'
            return (
              <div className="fixed inset-0 z-[93] flex items-center justify-center bg-black/60 p-4" onClick={() => setWbResult(null)}>
                <div className="flex max-h-[92vh] w-[min(96vw,560px)] flex-col rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-start justify-between gap-3 border-b border-[rgb(var(--border))] p-4">
                    <div>
                      <p className="font-display text-lg">Bilanciamento del bianco — tavola</p>
                      <p className={`mt-0.5 text-sm font-medium ${wbResult.consistent ? 'text-[rgb(var(--emerald-600))]' : 'text-amber-600'}`}>{wbResult.consistent ? '✓ Coerente: le foto si accordano tra loro' : '⚠ Da uniformare: qualcuna stona'}</p>
                      {wbResult.note && <p className="mt-0.5 text-xs text-[rgb(var(--fg-muted))]">{wbResult.note}</p>}
                    </div>
                    <button onClick={() => setWbResult(null)} className="rounded-full p-1.5 hover:bg-[rgb(var(--bg-sunken))]"><X size={18} /></button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto p-3">
                    <div className="space-y-2">
                      {wbResult.wb.map((w) => { const m = mediaById.get(w.id); if (!m) return null; const isOff = wbResult.off.includes(w.id); return (
                        <div key={w.id} className={`flex items-center gap-3 rounded-lg border p-2 ${isOff ? 'border-amber-400 bg-amber-50' : 'border-[rgb(var(--border))]'}`}>
                          <img src={thumbUrl(m)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded object-cover" />
                          <div className="min-w-0 flex-1">
                            {w.label && <p className="mb-1 text-sm font-medium">{w.label}{isOff && <span className="ml-1 text-xs text-amber-600">· stona</span>}</p>}
                            <div className="flex flex-wrap gap-1.5 text-[11px] text-white">
                              <span className={`rounded-full px-2 py-0.5 ${tempCls(w.temp)}`}>Temp: {tempLabel(w.temp)}</span>
                              <span className={`rounded-full px-2 py-0.5 ${tintCls(w.tint)}`}>Tinta: {tintLabel(w.tint)}</span>
                            </div>
                          </div>
                        </div>
                      ) })}
                    </div>
                    {wbResult.advice && <p className="mt-3 rounded-lg bg-[rgb(var(--bg-sunken))] p-3 text-sm"><strong>Come uniformare:</strong> {wbResult.advice}</p>}
                    <p className="mt-2 text-[11px] text-[rgb(var(--fg-subtle))]">Stima da anteprima: indicativa. Il WB si legge sui toni neutri (abito, pelle, muri).</p>
                  </div>
                  <div className="flex justify-end border-t border-[rgb(var(--border))] p-3"><Button variant="outline" size="sm" onClick={() => setWbResult(null)}>Chiudi</Button></div>
                </div>
              </div>
            )
          })()}

          {/* Etichetta che segue il cursore mentre sposto le foto tra le tavole (drag pointer) */}
          {photoMoveUI && (
            <div className="pointer-events-none fixed z-[120]" style={{ left: photoMoveUI.x + 14, top: photoMoveUI.y + 14 }}>
              <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg ${photoMoveUI.hint ? 'bg-[rgb(var(--gold-500))]' : 'bg-black/75'}`}>
                <Move size={12} /> {photoMoveUI.n > 1 ? `${photoMoveUI.n} foto` : 'Sposto la foto'} {photoMoveUI.hint === 'tavola' ? '→ in questa tavola' : photoMoveUI.hint === 'gap' ? '→ nuova tavola qui' : '· portala su una tavola in basso'}
              </div>
            </div>
          )}

          {/* Animazione "AI sta ragionando" + BARRA di avanzamento analisi foto */}
          {aiBusy && <AiThinkingOverlay thumbs={kept.slice(0, 6).map((m) => thumbUrl(m))} progress={aiProg} onCancel={() => { aiCancel.current = true }} />}

          {/* input nascosto: file modificato in Photoshop → upload + sostituzione nell'elemento */}
          <input ref={psFileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; const t = psTarget.current; psTarget.current = null; if (f && t) void replaceElWithFile(t.pageId, t.elId, f) }} />

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
                    <div key={r.id} className={`rounded-lg border p-2.5 text-sm ${r.status === 'DONE' ? 'opacity-60 border-[rgb(var(--border))]' : r.status === 'DECLINED' ? 'border-sky-300 bg-sky-50' : 'border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))]/30'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p>{r.body}</p>
                          <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">— {r.author_name ?? 'Cliente'}{r.page_index ? ` · pag. ${r.page_index}` : ''}{r.status === 'DONE' ? ' · fatto ✓' : r.status === 'DECLINED' ? ' · risposto' : ''}</p>
                        </div>
                        {!isCouple && r.status === 'OPEN' && (
                          <div className="shrink-0 flex items-center gap-1">
                            <button onClick={() => void resolveRev(r.id)} title="Segna fatto" className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]"><Check size={12} /> Fatto</button>
                            <button onClick={() => (replyFor === r.id ? setReplyFor(null) : startReply(r.id, 'proporzioni'))} title="Spiega perché conviene tenerla così" className="inline-flex items-center text-[11px] px-2 py-1 rounded border border-sky-300 text-sky-700 hover:bg-sky-100">Perché meglio di no</button>
                          </div>
                        )}
                      </div>

                      {/* risposta del fotografo già inviata (visibile anche al cliente nella sua app) */}
                      {r.reply && (
                        <div className="mt-2 rounded-md bg-white/70 border border-sky-200 p-2">
                          {r.reply_reason && <span className="inline-block text-[10px] uppercase tracking-wider text-sky-700 mb-0.5">{ALBUM_REPLY_REASONS.find((x) => x.key === r.reply_reason)?.label ?? r.reply_reason}</span>}
                          <p className="text-[13px] text-[rgb(var(--fg))]">{r.reply}</p>
                          <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-0.5">{isCouple ? 'Risposta del fotografo' : 'La tua risposta al cliente'}</p>
                        </div>
                      )}

                      {/* composer "perché meglio di no" — motivazioni tecniche preimpostate */}
                      {!isCouple && replyFor === r.id && (
                        <div className="mt-2 rounded-md border border-sky-200 bg-sky-50/60 p-2 space-y-2">
                          <div className="flex flex-wrap gap-1">
                            {ALBUM_REPLY_REASONS.map((rr) => (
                              <button key={rr.key} onClick={() => { setReplyReason(rr.key); if (rr.hint) setReplyText(rr.hint) }}
                                className={`text-[11px] px-2 py-0.5 rounded-full border ${replyReason === rr.key ? 'bg-sky-600 text-white border-sky-600' : 'border-sky-300 text-sky-700 hover:bg-sky-100'}`}>{rr.label}</button>
                            ))}
                          </div>
                          <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={3} placeholder="Spiega al cliente perché conviene tenerla così…" className="w-full text-sm rounded border border-sky-300 bg-white px-2 py-1.5 outline-none focus:border-sky-500" />
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => { setReplyFor(null); setReplyText(''); setReplyReason('') }} className="text-xs px-2 py-1 rounded border border-[rgb(var(--border))]">Annulla</button>
                            <button onClick={() => void replyRev(r.id, replyReason, replyText)} className="text-xs px-2.5 py-1 rounded bg-sky-600 text-white font-medium hover:bg-sky-700">Invia risposta</button>
                          </div>
                        </div>
                      )}
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
                  <div className="rounded-lg bg-[rgb(var(--bg-sunken))] p-2.5">
                    <p className="text-[11px] text-[rgb(var(--fg-muted))]">Ogni <strong>tavola</strong> è un foglio unico: <strong>{(fmt.w * 2 / 10).toFixed(0)}×{(fmt.h / 10).toFixed(0)} cm</strong> (la riga centrale è solo la piega). {pages.length > 0 ? `${Math.ceil(pages.length / 2)} tavole.` : ''}</p>
                  </div>
                  <div className="pt-1 grid grid-cols-2 gap-2">
                    <Button variant="gold" size="sm" disabled={exporting} onClick={() => { setExportOpen(false); void doExport('spread') }}><FileText size={14} /> Esporta PDF</Button>
                    <Button variant="outline" size="sm" disabled={exporting} onClick={() => { setExportOpen(false); void doExport('jpgspread') }}><FileImage size={14} /> Esporta JPG (ZIP)</Button>
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
                  <div className="relative flex gap-1">
                    {lp?.tavolaFree
                      ? <div className="relative bg-white shadow-xl shrink-0 overflow-hidden" style={{ aspectRatio: String(asp * 2), height: `min(74vh, ${(46 / asp).toFixed(2)}vw)` }}><FreeSurface page={lp} mediaById={mediaById} thumb={hiUrl} /></div>
                      : <>{lp && <Mini p={lp} />}{rp && <Mini p={rp} />}
                        {lp?.spreadImage && (() => { const m = mediaById.get(lp.spreadImage!.mediaId); return m ? <SpreadImg src={hiUrl(m)} cell={lp.spreadImage!.cell} frame={spreadFrameOf(lp.spreadImage)} /> : null })()}</>}
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
  onKeepAll: () => void; onKeepNone: () => void
  onImport: (files: File[]) => void; importing: { done: number; total: number } | null
  isCouple?: boolean; onReadyToLayout?: () => void
  likeCounts: Record<string, number>; onKeepLiked: () => void
}) {
  const { photos, total, okRange, untagged, missingMin, perMoment, onToggle, onMoment, onGenerate, thumb, onKeepAll, onKeepNone, onImport, importing, isCouple, onReadyToLayout, likeCounts, onKeepLiked } = props
  const allKept = photos.length > 0 && total >= photos.length
  const [likedFirst, setLikedFirst] = useState(false)
  // Vista "Solo selezionate": riaprendo un album che HA già una selezione mostro solo le foto scelte
  // (rivedo/organizzo le mie 106 senza riscorrere tutta la galleria). Un album ancora da curare parte
  // mostrando TUTTE le foto; il toggle passa da una vista all'altra (per aggiungerne altre).
  const [onlyKept, setOnlyKept] = useState(false)
  const initedView = useRef(false)
  useEffect(() => {
    if (!initedView.current && photos.length > 0) { initedView.current = true; setOnlyKept(total > 0) }
  }, [photos.length, total])
  const likedTotal = photos.filter((m) => (likeCounts[m.id] ?? 0) > 0).length
  const showingKeptOnly = onlyKept && total > 0
  const base = showingKeptOnly ? photos.filter((m) => m.album_choice === 'KEPT') : photos
  const shown = likedFirst ? [...base].sort((a, b) => (likeCounts[b.id] ?? 0) - (likeCounts[a.id] ?? 0)) : base
  const fileRef = useRef<HTMLInputElement>(null)
  // ANTEPRIMA "Quick Look" (stile macOS): passa/clicca su una foto e premi BARRA SPAZIATRICE per
  // ingrandirla a tutto schermo; Spazio/Esc per chiudere, ←/→ per scorrere. focusRef = ultima foto
  // sotto il cursore, così Spazio apre proprio quella.
  const [preview, setPreview] = useState<M | null>(null)
  const focusRef = useRef<M | null>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      if (e.code === 'Space' || e.key === ' ') {
        if (typing) return
        e.preventDefault() // niente scroll pagina né toggle del cuore sul bottone a fuoco
        setPreview((p) => (p ? null : focusRef.current))
        return
      }
      if (!preview) return
      if (e.key === 'Escape') { e.preventDefault(); setPreview(null); return }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault()
        const idx = shown.findIndex((x) => x.id === preview.id)
        if (idx < 0) return
        const ni = e.key === 'ArrowRight' ? Math.min(shown.length - 1, idx + 1) : Math.max(0, idx - 1)
        if (shown[ni]) { setPreview(shown[ni]); focusRef.current = shown[ni] }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shown, preview])
  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5">
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple className="hidden"
            onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; if (fs.length) onImport(fs) }} />
          <Button variant="gold" size="sm" disabled={!!importing} onClick={() => fileRef.current?.click()}>
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {importing ? `Carico ${importing.done + 1}/${importing.total}…` : 'Aggiungi foto'}
          </Button>
          {photos.length > 0 && <>
            <Button variant={allKept ? 'outline' : 'gold'} size="sm" onClick={onKeepAll} disabled={allKept}>
              <Heart size={14} className="fill-current" /> Seleziona tutti i cuori
            </Button>
            <Button variant="outline" size="sm" onClick={onKeepNone} disabled={total === 0}>
              <Heart size={14} /> Deseleziona tutti
            </Button>
            {likedTotal > 0 && <Button variant="outline" size="sm" onClick={onKeepLiked} title="Aggiungi all'album le foto a cui gli sposi hanno messo mi piace"><Heart size={14} className="fill-rose-400 text-rose-400" /> Tieni le preferite ({likedTotal})</Button>}
            {likedTotal > 0 && <Button variant={likedFirst ? 'gold' : 'outline'} size="sm" onClick={() => setLikedFirst((v) => !v)} title="Mostra prima le foto più piaciute dagli sposi">{likedFirst ? 'Ordine originale' : 'Preferite prima'}</Button>}
            {total > 0 && photos.length > total && <Button variant={showingKeptOnly ? 'gold' : 'outline'} size="sm" onClick={() => setOnlyKept((v) => !v)} title={showingKeptOnly ? 'Mostra tutta la galleria per aggiungerne altre' : 'Mostra solo le foto scelte per l’album'}>{showingKeptOnly ? `Tutte le foto (${photos.length})` : `Solo selezionate (${total})`}</Button>}
            <span className="text-xs text-[rgb(var(--fg-muted))] ml-auto"><strong>{total}</strong>/{photos.length} selezionate</span>
          </>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {shown.map((m) => {
            const keptOn = m.album_choice === 'KEPT'
            const likes = likeCounts[m.id] ?? 0
            return (
              <Card key={m.id} className={`group overflow-hidden ${keptOn ? 'ring-2 ring-[rgb(var(--gold-500))]' : ''}`}>
                <button onClick={() => onToggle(m)} onMouseEnter={() => { focusRef.current = m }} onFocus={() => { focusRef.current = m }}
                  title="Clic = seleziona · Barra spaziatrice o lente = anteprima grande" className="relative block w-full aspect-square">
                  <img src={thumb(m)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  <span className={`absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center ${keptOn ? 'bg-[rgb(var(--gold-500))] text-white' : 'bg-black/40 text-white'}`}><Heart size={13} className={keptOn ? 'fill-current' : ''} /></span>
                  {likes > 0 && <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-0.5 rounded-full bg-rose-500/90 text-white text-[10px] px-1.5 py-0.5" title="Mi piace degli sposi"><Heart size={10} className="fill-current" /> {likes}</span>}
                  {/* Lente: click sicuro per l'anteprima grande (non tocca il cuore). */}
                  <span role="button" tabIndex={0} title="Ingrandisci (anteprima)" onMouseEnter={() => { focusRef.current = m }}
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setPreview(m); focusRef.current = m }}
                    className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full bg-black/45 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70">
                    <Maximize2 size={13} />
                  </span>
                </button>
                <select value={m.album_moment ?? ''} onChange={(e) => onMoment(m, e.target.value)} disabled={!keptOn}
                  title={keptOn ? 'Assegna un momento a questa foto' : 'Metti prima il cuore: i momenti si assegnano solo alle foto scelte'}
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
        {isCouple && onReadyToLayout ? (
          <>
            <Button variant="gold" className="w-full" disabled={total === 0} onClick={onReadyToLayout}><Check size={15} /> Ok, puoi impaginare la bozza</Button>
            <p className="text-[11px] text-center text-[rgb(var(--fg-muted))]">Conferma la tua selezione ({total} foto): il fotografo riceverà l'ok e impaginerà la bozza dell'album.</p>
          </>
        ) : (
          <>
            <Button variant="gold" className="w-full" disabled={total === 0} onClick={onGenerate}><Wand2 size={15} /> Genera impaginazione</Button>
            {!okRange && total > 0 && <p className="text-[11px] text-center text-[rgb(var(--fg-muted))]">Puoi generare comunque: l'ideale è {ALBUM_MIN_PHOTOS}–{ALBUM_MAX_PHOTOS}{missingMin.length ? `, mancano minimi: ${missingMin.map((x) => x.label).join(', ')}` : ''}.</p>}
          </>
        )}
      </div>

      {/* ANTEPRIMA a tutto schermo (barra spaziatrice). Click/Esc/Spazio per chiudere, ←/→ per scorrere. */}
      {preview && (() => {
        const idx = shown.findIndex((x) => x.id === preview.id)
        return (
          <div className="fixed inset-0 z-[100] bg-black/85 flex items-center justify-center p-4 select-none" onClick={() => setPreview(null)}>
            <img src={hiUrl(preview)} alt="" className="max-w-full max-h-full object-contain rounded shadow-2xl" onClick={(e) => e.stopPropagation()} />
            <button onClick={() => setPreview(null)} title="Chiudi (Esc)" className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><X size={18} /></button>
            {idx > 0 && <button onClick={(e) => { e.stopPropagation(); const n = shown[idx - 1]; if (n) { setPreview(n); focusRef.current = n } }} className="absolute left-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><ChevronLeft size={22} /></button>}
            {idx < shown.length - 1 && <button onClick={(e) => { e.stopPropagation(); const n = shown[idx + 1]; if (n) { setPreview(n); focusRef.current = n } }} className="absolute right-3 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"><ChevronRight size={22} /></button>}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-[11px] bg-black/40 rounded-full px-3 py-1">{idx + 1} / {shown.length} · Spazio o Esc per chiudere · ← → per scorrere</div>
          </div>
        )
      })()}
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
                  <img src={thumb(m)} alt="" draggable={false} style={coverImgStyle(cell, slotAspectOf(fr, fmt.w, fmt.h))} />
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
  realDims?: Record<string, RealDim>   // px reali per l'avviso bassa risoluzione (badge sulle foto)
  onSelect: (id: string | null, additive?: boolean) => void; onUpdateEl: (id: string, patch: Partial<FreeEl>) => void
  onUpdateMany: (patches: { id: string; patch: Partial<FreeEl> }[]) => void
  onRemove: (id: string) => void; onDuplicateEl: (id: string) => void; onDropMedia: (id: string) => void
  onReplaceEl: (id: string, mediaId: string) => void   // drop di una foto SOPRA un'altra → sostituisce
  onSwapEls?: (a: string, b: string) => void           // trascina (senza Shift) una foto su un'altra → SCAMBIA
  onContext?: (id: string, x: number, y: number) => void // tasto destro su una foto → menu contestuale
  locked?: boolean   // libera "uscita": mostra la composizione identica ma non editabile a mano
  spread?: boolean   // TAVOLA UNICA: superficie larga 2×W (la riga centrale è solo la piega)
  onStartMove?: (fromPageId: string, items: { elId: string; mediaId: string }[], e: import('react').PointerEvent) => void // trascina la foto verso il navigatore (sposta tra tavole)
}) {
  const { page, formatKey, bleed, gridOn, marginsOn, pageNum, mediaById, thumb, selEl, multiSel, realDims, onSelect, onUpdateEl, onUpdateMany, onRemove, onDuplicateEl, onDropMedia, onReplaceEl, onSwapEls, onContext, locked, spread, onStartMove } = props
  const fmt = getFormat(formatKey)
  const effW = spread ? fmt.w * 2 : fmt.w
  const aspect = effW / fmt.h
  const mx = MARGIN_MM / effW, my = MARGIN_MM / fmt.h
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ kind: 'move' | 'resize' | 'rotate' | 'gresize'; id: string; corner?: Corner | 'n' | 's' | 'e' | 'w'; sx: number; sy: number; el: FreeEl; group: FreeEl[]; anchor?: { x: number; y: number }; h0?: { x: number; y: number }; gAxes?: { x: boolean; y: boolean }; swap?: boolean; swapTo?: string | null } | null>(null)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const [gapMarks, setGapMarks] = useState<GapMark[]>([])
  const [dropId, setDropId] = useState<string | null>(null) // foto sotto il cursore durante un drop (sostituzione)
  // SCAMBIO (con ALT ⌥): trascinando una foto con ALT premuto, evidenzia quella sotto il cursore e al
  // rilascio le due si scambiano (presa = swapSrc, bersaglio = swapTarget). Senza modificatori: SPOSTA.
  const [swapSrc, setSwapSrc] = useState<string | null>(null)
  const [swapTarget, setSwapTarget] = useState<string | null>(null)
  const els = page.elements ?? []

  function frac(e: React.PointerEvent) {
    const r = boxRef.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / Math.max(1, r.width), y: (e.clientY - r.top) / Math.max(1, r.height) }
  }
  function down(e: React.PointerEvent, kind: 'move' | 'resize' | 'rotate', el: FreeEl, corner?: Corner | 'n' | 's' | 'e' | 'w') {
    e.stopPropagation()
    if (kind === 'move' && e.shiftKey) { onSelect(el.id, true) } else if (!multiSel.includes(el.id)) { onSelect(el.id) }
    const inGroup = kind === 'move' && multiSel.length > 1 && multiSel.includes(el.id)
    const group = inGroup ? els.filter((x) => multiSel.includes(x.id)) : [el]
    // DEFAULT: trascinare una foto la SPOSTA liberamente. Con ALT (⌥): modalità SCAMBIO
    // (trascina su un'altra → si scambiano). Shift = selezione multipla / spostamento di gruppo.
    const swapMode = kind === 'move' && e.altKey && !inGroup
    const f = frac(e); drag.current = { kind, id: el.id, corner, sx: f.x, sy: f.y, el, group, swap: swapMode, swapTo: null }
    if (swapMode) { setSwapSrc(el.id); setSwapTarget(null) }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  // Resize di GRUPPO: scala insieme tutte le foto selezionate, attorno all'angolo opposto
  // (uniforme, stile Canva). Lo snapshot del gruppo è preso all'inizio del drag.
  // handle = angolo (nw/ne/sw/se → due assi) OPPURE lato (n/s/e/w → un solo asse: i "punti cardine"
  // centro-lato che ridimensionano solo la larghezza (e/w) o solo l'altezza (n/s) dell'insieme).
  function downGroup(e: React.PointerEvent, handle: string) {
    e.stopPropagation()
    const g = els.filter((x) => multiSel.includes(x.id))
    if (g.length < 2) return
    const bx = Math.min(...g.map((x) => x.x)), by = Math.min(...g.map((x) => x.y))
    const ex = Math.max(...g.map((x) => x.x + x.w)), ey = Math.max(...g.map((x) => x.y + x.h))
    const hasE = handle.includes('e'), hasW = handle.includes('w'), hasN = handle.includes('n'), hasS = handle.includes('s')
    const anchor = { x: hasW ? ex : bx, y: hasN ? ey : by }     // bordo opposto a quello afferrato
    const h0 = { x: hasW ? bx : ex, y: hasN ? by : ey }         // bordo afferrato
    const f = frac(e)
    drag.current = { kind: 'gresize', id: '__group__', sx: f.x, sy: f.y, el: g[0]!, group: g, anchor, h0, gAxes: { x: hasE || hasW, y: hasN || hasS } }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    const d = drag.current; if (!d) return
    const f = frac(e)
    if (d.kind === 'move' && d.swap) {
      // SCAMBIO: non sposto la foto; evidenzio quella sotto il cursore (la più in alto). Lo scambio
      // avviene al rilascio.
      let target: string | null = null
      for (let i = els.length - 1; i >= 0; i--) { const x = els[i]!; if (x.id !== d.id && f.x >= x.x && f.x <= x.x + x.w && f.y >= x.y && f.y <= x.y + x.h) { target = x.id; break } }
      d.swapTo = target
      setSwapTarget(target)
      return
    }
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
      // SINGOLA: angolo = solo mouse LIBERO (w/h indip.), SHIFT = PROPORZIONALE; punto cardine
      // (lato) = un solo asse (e/w larghezza, n/s altezza). L'immagine non si deforma mai (cover).
      const c = d.corner
      let r: FreeEl
      if (c === 'n' || c === 's' || c === 'e' || c === 'w') {
        const el = d.el; let { x, y, w, h } = el
        if (c === 'e') w = Math.max(0.02, f.x - el.x)
        else if (c === 'w') { const right = el.x + el.w; const nx = Math.min(right - 0.02, f.x); x = nx; w = right - nx }
        else if (c === 's') h = Math.max(0.02, f.y - el.y)
        else { const bot = el.y + el.h; const ny = Math.min(bot - 0.02, f.y); y = ny; h = bot - ny }
        r = { ...el, x, y, w, h }
      } else {
        r = resizeEl(d.el, c, f.x, f.y)
        if (e.shiftKey) {
          const ax = c.includes('e') ? d.el.x : d.el.x + d.el.w
          const ay = c.includes('s') ? d.el.y : d.el.y + d.el.h
          const sc = Math.max(0.02 / d.el.w, 0.02 / d.el.h, Math.abs(f.x - ax) / d.el.w, Math.abs(f.y - ay) / d.el.h)
          const nw = d.el.w * sc, nh = d.el.h * sc
          r = { ...d.el, x: c.includes('e') ? ax : ax - nw, y: c.includes('s') ? ay : ay - nh, w: nw, h: nh }
        }
      }
      onUpdateEl(d.id, { x: r.x, y: r.y, w: r.w, h: r.h })
      const otherEls = els.filter((x) => x.id !== d.id)
      const snap = snapMove(r, otherEls, mx, my)
      setGuides({ v: snap.vGuides, h: snap.hGuides })
      setGapMarks(neighborGaps(r, otherEls))
    } else if (d.kind === 'gresize' && d.anchor && d.h0) {
      // GRUPPO: angolo = due assi (LIBERO indipendenti, o SHIFT = uniforme); maniglia di lato
      // (punto cardine) = un solo asse → solo larghezza (e/w) o solo altezza (n/s).
      const a = d.anchor, h0 = d.h0
      const ax = d.gAxes?.x ?? true, ay = d.gAxes?.y ?? true
      const dx = h0.x - a.x, dy = h0.y - a.y
      const lim = (av: number, hv: number) => { const dd = hv - av; if (Math.abs(dd) < 1e-6) return Infinity; return dd > 0 ? (1 - av) / dd : (0 - av) / dd }
      let nx2: number, ny2: number
      if (e.shiftKey && ax && ay) {
        const denom = dx * dx + dy * dy; if (denom < 1e-7) return
        const maxS = Math.max(0.2, Math.min(lim(a.x, h0.x), lim(a.y, h0.y)))
        const s = Math.max(0.12, Math.min(((f.x - a.x) * dx + (f.y - a.y) * dy) / denom, maxS, 8))
        onUpdateMany(d.group.map((g) => ({ id: g.id, patch: { x: a.x + (g.x - a.x) * s, y: a.y + (g.y - a.y) * s, w: Math.max(0.02, g.w * s), h: Math.max(0.02, g.h * s) } })))
        nx2 = a.x + dx * s; ny2 = a.y + dy * s
      } else {
        let sx = ax && Math.abs(dx) >= 1e-6 ? (f.x - a.x) / dx : 1
        let sy = ay && Math.abs(dy) >= 1e-6 ? (f.y - a.y) / dy : 1
        if (ax) sx = Math.max(0.12, Math.min(sx, Math.max(0.2, lim(a.x, h0.x)), 8))
        if (ay) sy = Math.max(0.12, Math.min(sy, Math.max(0.2, lim(a.y, h0.y)), 8))
        onUpdateMany(d.group.map((g) => ({ id: g.id, patch: { x: a.x + (g.x - a.x) * sx, y: a.y + (g.y - a.y) * sy, w: Math.max(0.02, g.w * sx), h: Math.max(0.02, g.h * sy) } })))
        nx2 = a.x + dx * (ax ? sx : 1); ny2 = a.y + dy * (ay ? sy : 1)
      }
      const others = els.filter((x) => !d.group.some((gg) => gg.id === x.id))
      const bb = { ...d.el, x: Math.min(a.x, nx2), y: Math.min(a.y, ny2), w: Math.abs(nx2 - a.x), h: Math.abs(ny2 - a.y) }
      const snap = snapMove(bb, others, mx, my)
      setGuides({ v: snap.vGuides, h: snap.hGuides })
      setGapMarks(neighborGaps(bb, others))
    } else if (d.kind === 'rotate') {
      const cx = d.el.x + d.el.w / 2, cy = d.el.y + d.el.h / 2
      const deg = (Math.atan2(f.y - cy, f.x - cx) * 180) / Math.PI + 90
      onUpdateEl(d.id, { rot: snapAngle(deg) })
    }
  }
  function up() {
    const d = drag.current
    if (d?.swap && d.swapTo && d.swapTo !== d.id) onSwapEls?.(d.id, d.swapTo)
    drag.current = null; setGuides({ v: [], h: [] }); setGapMarks([]); setSwapSrc(null); setSwapTarget(null)
  }

  return (
    <div ref={boxRef} className="relative shadow-[var(--shadow-lift)] h-full max-h-full max-w-full overflow-hidden"
      style={{ aspectRatio: String(aspect), background: page.bg ?? '#ffffff' }}
      onPointerMove={locked ? undefined : move} onPointerUp={locked ? undefined : up} onPointerLeave={locked ? undefined : up}
      onClick={locked ? undefined : (e) => { if (e.target === e.currentTarget) onSelect(null) }}
      onDragOver={locked ? undefined : (e) => e.preventDefault()}
      onDrop={locked ? undefined : (e) => { e.preventDefault(); const mid = e.dataTransfer.getData('text/media'); if (mid) onDropMedia(mid) }}>
      {spread && <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-[rgba(184,146,63,.5)] pointer-events-none z-[48]" title="Piega (non stampata)" />}
      {els.map((el) => {
        const m = mediaById.get(el.mediaId)
        const sel = selEl === el.id
        const inSel = multiSel.includes(el.id)
        const pm = elPrintMm(el, fmt, !!spread)
        const q: Quality = m ? photoQuality(realDims?.[el.mediaId], pm.w, pm.h, el.cell) : { level: 'ok', dpi: 0 }
        const lowRes = q.level === 'low' || q.level === 'warn'
        return (
          <div key={el.id} className="group absolute" style={{ left: `${el.x * 100}%`, top: `${el.y * 100}%`, width: `${el.w * 100}%`, height: `${el.h * 100}%`, transform: `rotate(${el.rot}deg)`, zIndex: sel ? 20 : inSel ? 10 : 1 }}>
            {/* Maniglia: TRASCINA la foto (o le selezionate) su un'altra tavola nel navigatore, o tra le
                tavole (a sinistra/destra) per crearne una nuova prima/dopo. SEMPRE (anche a tavola
                congelata: spostare tra tavole non è una modifica libera). DENTRO la foto per non
                essere tagliata dall'overflow del canvas. */}
            {onStartMove && (
              <div
                onPointerDown={(e) => {
                  e.stopPropagation(); e.preventDefault()
                  const elIds = (multiSel.includes(el.id) && multiSel.length > 1) ? multiSel : [el.id]
                  const items = elIds.map((eid) => ({ elId: eid, mediaId: els.find((x) => x.id === eid)?.mediaId ?? el.mediaId })).filter((it) => it.mediaId)
                  onStartMove(page.id, items.length ? items : [{ elId: el.id, mediaId: el.mediaId }], e)
                }}
                title="Trascina questa foto sul navigatore in basso: su un'altra tavola per spostarla, o tra due tavole (sinistra/destra) per crearne una nuova prima/dopo"
                className={`absolute top-1.5 right-1.5 z-[30] flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-full border-2 border-white bg-[rgb(var(--gold-500))] text-white shadow-md transition-opacity active:cursor-grabbing ${sel || inSel ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
                <Move size={13} />
                {multiSel.length > 1 && multiSel.includes(el.id) && <span className="absolute -bottom-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[rgb(var(--rose-500))] px-0.5 text-[9px] font-bold ring-1 ring-white">{multiSel.length}</span>}
              </div>
            )}
            <div
              onPointerDown={locked ? undefined : (e) => down(e, 'move', el)}
              onContextMenu={locked || !onContext ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); onContext(el.id, e.clientX, e.clientY) }}
              onDoubleClick={locked ? undefined : (e) => { e.stopPropagation(); onSelect(el.id) }}
              onDragOver={locked ? undefined : (e) => { if (e.dataTransfer.types.includes('text/media')) { e.preventDefault(); e.stopPropagation(); if (dropId !== el.id) setDropId(el.id) } }}
              onDragLeave={locked ? undefined : () => setDropId((d) => (d === el.id ? null : d))}
              onDrop={locked ? undefined : (e) => { const mid = e.dataTransfer.getData('text/media'); setDropId(null); if (mid) { e.preventDefault(); e.stopPropagation(); onReplaceEl(el.id, mid) } }}
              className={`w-full h-full relative overflow-hidden transition-[transform,opacity] ${locked ? '' : 'touch-none cursor-move'} ${swapTarget === el.id ? 'outline outline-[3px] outline-[rgb(var(--gold-600))] ring-4 ring-[rgba(184,146,63,.4)]' : sel ? 'outline outline-2 outline-[rgb(var(--gold-500))]' : inSel ? 'outline outline-2 outline-dashed outline-[rgb(var(--gold-400))]' : ''} ${swapSrc === el.id ? 'opacity-50 scale-95' : ''}`}
              style={{ backgroundColor: m ? undefined : 'rgba(0,0,0,.06)', boxShadow: el.shadow ? '0 6px 18px rgba(0,0,0,.28)' : undefined, border: el.border ? `${Math.max(1, el.border.w)}px solid ${el.border.color}` : undefined }}>
              {m && <img src={thumb(m)} alt="" draggable={false} style={coverImgStyle(el.cell, (el.w / Math.max(0.001, el.h)) * (fmt.w / fmt.h))} />}
              {dropId === el.id && <div className="absolute inset-0 ring-4 ring-inset ring-[rgb(var(--gold-500))] bg-[rgb(var(--gold-500))]/20 flex items-center justify-center pointer-events-none"><span className="text-[10px] font-semibold text-white bg-black/55 rounded px-1.5 py-0.5">Sostituisci</span></div>}
              {lowRes && !locked && (
                <>
                  <div className={`absolute inset-0 pointer-events-none z-[24] ring-2 ring-inset ${q.level === 'low' ? 'ring-rose-500/80' : 'ring-amber-400/80'}`} />
                  <div title={qualityHint(q)} className={`absolute top-1 left-1 z-[25] inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold text-white pointer-events-none shadow ${q.level === 'low' ? 'bg-rose-600/90' : 'bg-amber-500/95'}`}>
                    <AlertTriangle size={10} /> {q.dpi} dpi
                  </div>
                </>
              )}
            </div>
            {sel && multiSel.length <= 1 && (
              <>
                {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((c) => (
                  <div key={c} onPointerDown={(e) => down(e, 'resize', el, c)}
                    className="absolute h-3 w-3 bg-white border border-[rgb(var(--gold-500))] rounded-sm touch-none transition-[background-color,box-shadow] hover:bg-[rgb(var(--gold-400))] hover:shadow-[0_0_0_3px_rgba(184,146,63,.35)] before:absolute before:content-[''] before:-inset-2"
                    style={{ left: c.includes('w') ? -6 : undefined, right: c.includes('e') ? -6 : undefined, top: c.includes('n') ? -6 : undefined, bottom: c.includes('s') ? -6 : undefined, cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />
                ))}
                {/* PUNTI CARDINE centro-lato della singola foto: e/w = larghezza, n/s = altezza */}
                {(['s', 'e', 'w'] as const).map((c) => {
                  const horiz = c === 'e' || c === 'w'
                  return (
                    <div key={c} onPointerDown={(e) => down(e, 'resize', el, c)} title={horiz ? 'Larghezza' : 'Altezza'}
                      className="absolute h-3 w-3 bg-white border border-[rgb(var(--gold-500))] rounded-sm touch-none transition-[background-color,box-shadow] hover:bg-[rgb(var(--gold-400))] hover:shadow-[0_0_0_3px_rgba(184,146,63,.35)] before:absolute before:content-[''] before:-inset-2"
                      style={{ left: c === 'w' ? -6 : c === 'e' ? undefined : '50%', right: c === 'e' ? -6 : undefined, bottom: c === 's' ? -6 : undefined, top: c === 's' ? undefined : '50%', transform: horiz ? 'translateY(-50%)' : 'translateX(-50%)', cursor: horiz ? 'ew-resize' : 'ns-resize' }} />
                  )
                })}
                <div onPointerDown={(e) => down(e, 'rotate', el)} className="absolute left-1/2 -top-6 -translate-x-1/2 h-4 w-4 bg-white border border-[rgb(var(--gold-500))] rounded-full touch-none cursor-grab flex items-center justify-center"><RotateCw size={9} /></div>
                <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 flex gap-1" style={{ transform: `rotate(${-el.rot}deg)` }}>
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
                className="absolute h-3.5 w-3.5 bg-white border-2 border-[rgb(var(--gold-500))] rounded-sm touch-none pointer-events-auto transition-[background-color,box-shadow] hover:bg-[rgb(var(--gold-400))] hover:shadow-[0_0_0_3px_rgba(184,146,63,.35)] before:absolute before:content-[''] before:-inset-2"
                style={{ left: c.includes('w') ? -7 : undefined, right: c.includes('e') ? -7 : undefined, top: c.includes('n') ? -7 : undefined, bottom: c.includes('s') ? -7 : undefined, cursor: c === 'nw' || c === 'se' ? 'nwse-resize' : 'nesw-resize' }} />
            ))}
            {/* PUNTI CARDINE centro-lato: solo larghezza (e/w) o solo altezza (n/s) */}
            {(['n', 's', 'e', 'w'] as const).map((c) => {
              const horiz = c === 'e' || c === 'w'
              return (
                <div key={c} onPointerDown={(e) => downGroup(e, c)} title={horiz ? 'Larghezza' : 'Altezza'}
                  className="absolute h-3.5 w-3.5 bg-white border-2 border-[rgb(var(--gold-500))] rounded-sm touch-none pointer-events-auto transition-[background-color,box-shadow] hover:bg-[rgb(var(--gold-400))] hover:shadow-[0_0_0_3px_rgba(184,146,63,.35)] before:absolute before:content-[''] before:-inset-2"
                  style={{
                    left: c === 'w' ? -7 : c === 'e' ? undefined : '50%',
                    right: c === 'e' ? -7 : undefined,
                    top: c === 'n' ? -7 : c === 's' ? undefined : '50%',
                    bottom: c === 's' ? -7 : undefined,
                    transform: horiz ? 'translateY(-50%)' : 'translateX(-50%)',
                    cursor: horiz ? 'ew-resize' : 'ns-resize',
                  }} />
              )
            })}
            <span className="absolute -top-5 left-0 text-[9px] px-1 rounded bg-[rgb(var(--gold-500))] text-white pointer-events-none whitespace-nowrap">{g.length} foto · angoli = libero (Shift = proporz.) · lati = larghezza/altezza</span>
          </div>
        )
      })()}

      {/* smart guides (allineamento bordi/centri) */}
      {guides.v.map((g, i) => <div key={`v${i}`} className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none" style={{ left: `${g * 100}%` }} />)}
      {guides.h.map((g, i) => <div key={`h${i}`} className="absolute left-0 right-0 h-px bg-rose-500 pointer-events-none" style={{ top: `${g * 100}%` }} />)}
      {/* righelli viola di distanza/margine verso le altre foto, con misura in cm */}
      {gapMarks.map((mk, i) => {
        const cm = (Math.abs(mk.b - mk.a) * (mk.axis === 'x' ? effW : fmt.h) / 10)
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

// Zona di rilascio TRA due tavole nella filmstrip: ci trascini una foto (dalla libreria o dal
// navigatore) e crea una NUOVA tavola in quel punto, intersecando tra le pagine.
function GapDrop({ onDropPhoto, onMoveNewTavola, onInsert, gapIndex, h }: { onDropPhoto: (mid: string, x: number, y: number) => void; onMoveNewTavola?: (move: MovePayload, x: number, y: number) => void; onInsert?: () => void; gapIndex?: number; h: number }) {
  const [over, setOver] = useState(false)
  return (
    <div data-gapdrop={gapIndex}
      onClick={() => onInsert?.()}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('text/media')) { e.preventDefault(); if (!over) setOver(true) } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false)
        const mv = e.dataTransfer.getData('text/move')
        if (mv && onMoveNewTavola) { e.preventDefault(); e.stopPropagation(); try { onMoveNewTavola(JSON.parse(mv) as MovePayload, e.clientX, e.clientY) } catch { /* payload rotto */ } return }
        const mid = e.dataTransfer.getData('text/media'); if (mid) { e.preventDefault(); e.stopPropagation(); onDropPhoto(mid, e.clientX, e.clientY) }
      }}
      title="Clicca per inserire una nuova tavola qui — oppure trascinaci una foto"
      style={{ minHeight: Math.round(h * 0.7) }}
      className={`group/gap flex shrink-0 cursor-pointer items-center justify-center self-stretch rounded transition-all ${over ? 'w-7 bg-[rgb(var(--gold-400))] ring-2 ring-[rgb(var(--gold-500))]' : 'w-3 bg-transparent hover:bg-[rgb(var(--gold-100))]'}`}>
      <Plus size={13} className={`text-[rgb(var(--gold-600))] transition-opacity ${over ? 'opacity-0' : 'opacity-0 group-hover/gap:opacity-100'}`} />
    </div>
  )
}

// Miniatura di una TAVOLA (2 pagine) con la filigrana del dorso al centro.
function SpreadThumb(props: {
  pair: AlbumPage[]; index: number; aspect: number; active: boolean; lite?: boolean; formatKey: string; thumbH?: number
  aspects: Record<string, number>; mediaById: Map<string, M>; thumb: (m: M) => string
  onSelect: () => void; onMove: (d: -1 | 1) => void; onDelete: () => void; onDropMedia: (pageId: string, id: string) => void
  onMovePhotos?: (targetPageId: string, move: MovePayload) => void
  onReorder: (from: number, to: number) => void; onContext?: (x: number, y: number) => void
}) {
  const { pair, index, aspect, active, lite, formatKey, thumbH = 64, aspects, mediaById, thumb, onSelect, onMove, onDelete, onDropMedia, onMovePhotos, onReorder, onContext } = props
  // drop di una foto trascinata dal navigatore: se ha il marcatore "move" la SPOSTA in questa tavola.
  const handleMediaDrop = (pageId: string, e: import('react').DragEvent) => {
    const mv = e.dataTransfer.getData('text/move')
    if (mv && onMovePhotos) { e.preventDefault(); e.stopPropagation(); try { onMovePhotos(pageId, JSON.parse(mv) as MovePayload) } catch { /* rotto */ } return }
    const mid = e.dataTransfer.getData('text/media'); if (mid) { e.preventDefault(); e.stopPropagation(); onDropMedia(pageId, mid) }
  }
  const w = aspect * pair.length
  const [over, setOver] = useState<false | 'l' | 'r'>(false)
  return (
    <div className="shrink-0 group relative" data-tavdrop={pair[0]?.id ?? pair[1]?.id}
      onContextMenu={lite || !onContext ? undefined : (e) => { e.preventDefault(); e.stopPropagation(); onContext(e.clientX, e.clientY) }}
      draggable={!lite}
      onDragStart={(e) => { e.dataTransfer.setData('text/spread', String(index)); e.dataTransfer.effectAllowed = 'move' }}
      onDragOver={(e) => { if (lite) return; const hasSpread = e.dataTransfer.types.includes('text/spread'); if (!hasSpread) return; e.preventDefault(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setOver(e.clientX < r.left + r.width / 2 ? 'l' : 'r') }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { const side = over; setOver(false); const raw = e.dataTransfer.getData('text/spread'); if (raw === '') return; e.preventDefault(); e.stopPropagation(); const from = Number(raw); if (Number.isNaN(from)) return; const to = side === 'r' ? index + 1 : index; if (to !== from && to !== from + 1) onReorder(from, to) }}>
      {over && <div className={`absolute top-0 bottom-0 w-1 rounded bg-[rgb(var(--gold-500))] z-10 ${over === 'l' ? '-left-1.5' : '-right-1.5'}`} />}
      <button onClick={onSelect} className={`relative flex overflow-hidden border bg-white ${active ? 'ring-2 ring-[rgb(var(--gold-500))] border-[rgb(var(--gold-500))]' : 'border-[rgb(var(--border))]'} ${!lite ? 'cursor-grab active:cursor-grabbing' : ''}`} style={{ height: thumbH, aspectRatio: String(w) }}>
        {pair[0]?.tavolaFree ? (
          <div className="relative h-full w-full"
            onDragOver={(e) => { if (e.dataTransfer.types.includes('text/media')) e.preventDefault() }} onDrop={(e) => handleMediaDrop(pair[0]!.id, e)}>
            <FreeSurface page={pair[0]} mediaById={mediaById} thumb={thumb} />
          </div>
        ) : pair.map((p) => (
          <div key={p.id} className="h-full" style={{ aspectRatio: String(aspect) }}
            onDragOver={(e) => { if (e.dataTransfer.types.includes('text/media')) e.preventDefault() }} onDrop={(e) => handleMediaDrop(p.id, e)}>
            <MiniPage page={p} formatKey={formatKey} aspects={aspects} mediaById={mediaById} thumb={thumb} />
          </div>
        ))}
        {!pair[0]?.tavolaFree && pair[0]?.spreadImage && (() => { const m = mediaById.get(pair[0]!.spreadImage!.mediaId); return m ? <SpreadImg src={thumb(m)} cell={pair[0]!.spreadImage!.cell} frame={spreadFrameOf(pair[0]!.spreadImage)} pointerNone /> : null })()}
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

// Overlay "L'AI sta ragionando come impaginare" — mostrato durante l'impaginazione AI. Animazione
// leggera (CSS): anello che gira, sparkle che pulsa, miniature che sfarfallano, messaggi a rotazione.
function AiThinkingOverlay({ thumbs, progress, onCancel }: { thumbs: string[]; progress?: { done: number; total: number; phase?: string } | null; onCancel?: () => void }) {
  const MSGS = [
    'Analizzo i momenti del racconto…',
    'Raggruppo le foto per tavola…',
    'Scelgo la sequenza giusta…',
    'Rispetto il tuo stile di impaginazione…',
    'Compongo le tavole…',
  ]
  const [mi, setMi] = useState(0)
  useEffect(() => { const t = setInterval(() => setMi((i) => (i + 1) % MSGS.length), 1600); return () => clearInterval(t) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : null
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[min(92vw,420px)] rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] p-6 text-center shadow-2xl">
        <div className="relative mx-auto mb-4 h-16 w-16">
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-[rgb(var(--gold-400))]/30 border-t-[rgb(var(--gold-500))]" />
          <div className="absolute inset-0 flex items-center justify-center"><Sparkles size={26} className="animate-pulse text-[rgb(var(--gold-600))]" /></div>
        </div>
        <p className="font-display text-base font-semibold">L'AI sta ragionando…</p>
        <p className="mt-1 min-h-[20px] text-sm text-[rgb(var(--fg-muted))]">{progress?.phase ?? MSGS[mi]}</p>
        {thumbs.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {thumbs.slice(0, 6).map((t, i) => (
              <div key={i} className="h-9 w-9 animate-pulse overflow-hidden rounded-md ring-1 ring-[rgb(var(--border))]" style={{ animationDelay: `${i * 140}ms` }}>
                <img src={t} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
        {pct != null ? (
          <>
            <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-sunken))]">
              <div className="h-full rounded-full bg-[rgb(var(--gold-500))] transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-[rgb(var(--fg-subtle))]"><span className="tabular-nums">{progress!.done}/{progress!.total}</span> foto analizzate · non chiudere la pagina</p>
          </>
        ) : (
          <>
            <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-sunken))]">
              <div className="h-full w-1/3 rounded-full bg-[rgb(var(--gold-500))]" style={{ animation: 'aiThinkBar 1.4s ease-in-out infinite' }} />
            </div>
            <p className="mt-3 text-[11px] text-[rgb(var(--fg-subtle))]">Può richiedere qualche secondo · non chiudere la pagina</p>
          </>
        )}
        {onCancel && <div className="mt-4"><Button variant="outline" size="sm" onClick={onCancel}><X size={14} /> Interrompi</Button></div>}
      </div>
      <style>{`@keyframes aiThinkBar{0%{transform:translateX(-120%)}100%{transform:translateX(360%)}}`}</style>
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
        <img src={src} alt="" draggable={false} style={coverImgStyle(cell, aspect > 0 ? aspect : 1)} />
        <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/55 text-white rounded px-1 pointer-events-none">trascina · zoom</span>
      </div>
      <div className="flex items-center gap-1.5">
        <ZoomOut size={13} className="text-[rgb(var(--fg-subtle))] shrink-0" />
        <input type="range" min={1} max={4} step={0.05} value={z} onChange={(e) => onChange({ ...cell, z: +e.target.value })} className="flex-1 accent-[rgb(var(--gold-600))]" />
        <ZoomIn size={13} className="text-[rgb(var(--fg-subtle))] shrink-0" />
      </div>
      {/* Ruota la FOTO dentro la cornice ferma: raddrizza (slider fine) + scatti di 90°. */}
      {(() => {
        const r = cell.r ?? 0
        const quarter = Math.round(r / 90) * 90
        const fine = Math.max(-45, Math.min(45, r - quarter))
        return (
          <div className="flex items-center gap-1.5">
            <RotateCw size={13} className="text-[rgb(var(--fg-subtle))] shrink-0" />
            <input type="range" min={-45} max={45} step={1} value={fine} title="Raddrizza la foto"
              onChange={(e) => onChange({ ...cell, r: quarter + (+e.target.value) })} className="flex-1 accent-[rgb(var(--gold-600))]" />
            <span className="text-[10px] tabular-nums w-8 text-right text-[rgb(var(--fg-subtle))]">{fine > 0 ? '+' : ''}{fine}°</span>
            <button title="Ruota la foto 90° a sinistra" onClick={() => onChange({ ...cell, r: r - 90 })} className="h-6 w-6 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))] inline-flex items-center justify-center"><RotateCw size={11} className="-scale-x-100" /></button>
            <button title="Ruota la foto 90° a destra" onClick={() => onChange({ ...cell, r: r + 90 })} className="h-6 w-6 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))] inline-flex items-center justify-center"><RotateCw size={11} /></button>
          </div>
        )
      })()}
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange({ z: 1, fx: 0.5, fy: 0.5, r: 0, fh: false, fv: false })} className="text-[11px] px-2 py-1 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]">Riempi</button>
        <button title="Specchia in orizzontale" onClick={() => onChange({ ...cell, fh: !cell.fh })} className={`h-6 w-6 rounded border inline-flex items-center justify-center ${cell.fh ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}><FlipHorizontal2 size={12} /></button>
        <button title="Specchia in verticale" onClick={() => onChange({ ...cell, fv: !cell.fv })} className={`h-6 w-6 rounded border inline-flex items-center justify-center ${cell.fv ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]'}`}><FlipVertical2 size={12} /></button>
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
  // foto in pagina: dalle celle template OPPURE dagli elementi liberi (pagina libera "congelata")
  const isFrozenFree = page.mode === 'free'
  const nPhotos = isFrozenFree ? (page.elements?.length ?? 0) : page.mediaIds.length
  const alts = templatesFor(Math.max(1, nPhotos))
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
      ) : isFrozenFree ? (
        <div className="rounded-lg border border-[rgb(var(--gold-400))] bg-[rgb(var(--gold-100))] p-2.5">
          <p className="text-xs font-medium flex items-center gap-1.5"><Move size={13} /> Composizione libera bloccata</p>
          <p className="text-[11px] text-[rgb(var(--fg-muted))] mt-0.5">Resta esattamente com'è. Riaccendi <strong>Libera</strong> per modificarla, o scegli un preset qui sotto per rifarla.</p>
          {!lite && <Button variant="gold" size="sm" className="w-full mt-2" onClick={onFree}><Move size={13} /> Riprendi modifica libera</Button>}
        </div>
      ) : (
        <p className="text-xs text-[rgb(var(--fg-subtle))]">Seleziona una foto: poi <strong>Ritaglia</strong>, sposta, zooma o allinea.</p>
      )}

      <div className="border-t border-[rgb(var(--border))] pt-3">
        <p className="font-medium mb-2 flex items-center gap-1.5"><LayoutGrid size={14} /> Layout pagina {moment && <span className={`text-[10px] px-1.5 py-0.5 rounded ${moment.color}`}>{moment.label}</span>}</p>
        <p className="text-xs text-[rgb(var(--fg-muted))] mb-1.5">Preset per {nPhotos || 1} foto — tocca per applicare{isFrozenFree ? ' (sovrascrive la composizione)' : ''}</p>
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
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2">{nPhotos}/{MAX_PER_PAGE} foto in pagina</p>
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
// Voce del menu contestuale (tasto destro).
function CtxItem({ label, sk, onClick, disabled, danger }: { label: string; sk?: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-6 ${disabled ? 'opacity-40 cursor-default' : danger ? 'text-rose-500 hover:bg-rose-500/10' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
      <span>{label}</span>{sk && <span className="text-[11px] text-[rgb(var(--fg-subtle))] tabular-nums">{sk}</span>}
    </button>
  )
}
function CtxSep() { return <div className="my-1 h-px bg-[rgb(var(--border))]" /> }

const clampPx = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
// Maniglia di ridimensionamento (trascina): emette il delta incrementale in px sull'asse scelto.
function DragSize({ axis, onResize, className }: { axis: 'x' | 'y'; onResize: (delta: number) => void; className?: string }) {
  const last = useRef(0)
  return (
    <div role="separator" className={className}
      onPointerDown={(e) => {
        e.preventDefault(); last.current = axis === 'x' ? e.clientX : e.clientY
        const move = (ev: PointerEvent) => { const cur = axis === 'x' ? ev.clientX : ev.clientY; onResize(cur - last.current); last.current = cur }
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
      }} />
  )
}

function FreePanel(props: {
  page: AlbumPage; selEl: string | null; lite?: boolean
  onBg: (c: string) => void; onElUpdate: (id: string, patch: Partial<FreeEl>) => void
  onElRemove: (id: string) => void
  onAddPage: () => void; onDelPage: () => void; onDuplicate: () => void; onSaveLayout?: () => void
  presets?: GenLayout[]; tavAspect?: number; onApplyTavolaLayout?: (slots: Slot[]) => void
  myPresets?: SavedLayout[]; onApplySaved?: (l: SavedLayout) => void; onDeleteSaved?: (id: string) => void
  selCount?: number; onAlign?: (k: 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom') => void; onDistribute?: (a: 'h' | 'v') => void
  onUniformGaps?: () => void
  gutterMm?: number; onGutter?: (mm: number) => void
  layers?: { id: string; thumb: string }[]; onSelectEl?: (id: string) => void; onReorderEl?: (id: string, dir: -1 | 1) => void
  crop?: { src: string; aspect: number; cell: Cell; onChange: (c: Cell) => void; onRotate90?: (dir: -1 | 1) => void } | null
}) {
  const { page, selEl, lite, onBg, onElUpdate, onElRemove, onAddPage, onDelPage, onDuplicate, onSaveLayout, presets, tavAspect, onApplyTavolaLayout, myPresets, onApplySaved, onDeleteSaved, selCount, onAlign, onDistribute, onUniformGaps, gutterMm, onGutter, layers, onSelectEl, onReorderEl, crop } = props
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

      {/* LIVELLI: pila delle foto della tavola (in alto = davanti). Seleziona, riordina, elimina. */}
      {!lite && layers && layers.length > 0 && (
        <div className="border-t border-[rgb(var(--border))] pt-3">
          <p className="font-medium mb-1.5 flex items-center gap-1.5"><LayoutGrid size={14} /> Livelli <span className="text-[10px] text-[rgb(var(--fg-subtle))]">({layers.length})</span></p>
          <ul className="space-y-1 max-h-64 overflow-auto">
            {layers.map((l, i) => (
              <li key={l.id} className={`flex items-center gap-1.5 rounded px-1 py-1 ${selEl === l.id ? 'bg-[rgb(var(--gold-100))] ring-1 ring-[rgb(var(--gold-400))]' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}>
                <button onClick={() => onSelectEl?.(l.id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                  {l.thumb ? <img src={l.thumb} alt="" className="h-8 w-8 rounded object-cover border border-[rgb(var(--border))] shrink-0" /> : <span className="h-8 w-8 rounded bg-[rgb(var(--bg-sunken))] shrink-0" />}
                  <span className="text-[11px] truncate">Livello {layers.length - i}</span>
                </button>
                <button title="Porta avanti" disabled={i === 0} onClick={() => onReorderEl?.(l.id, 1)} className="px-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] disabled:opacity-25">↑</button>
                <button title="Porta indietro" disabled={i === layers.length - 1} onClick={() => onReorderEl?.(l.id, -1)} className="px-1 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] disabled:opacity-25">↓</button>
                <button title="Elimina" onClick={() => onElRemove(l.id)} className="px-1 text-[rgb(var(--fg-subtle))] hover:text-rose-500"><Trash2 size={12} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ALLINEA / DISTRIBUISCI la selezione multipla (impaginatore pro) */}
      {!lite && onAlign && (selCount ?? 0) >= 2 && (
        <div className="border-t border-[rgb(var(--border))] pt-3">
          <p className="font-medium mb-1.5 flex items-center gap-1.5"><Grid3x3 size={14} /> Allinea <span className="text-[10px] text-[rgb(var(--fg-subtle))]">({selCount} foto)</span></p>
          <div className="grid grid-cols-3 gap-1">
            {([['left', '⊣ Sx'], ['hcenter', '╪ Centro'], ['right', '⊢ Dx'], ['top', '⊤ Alto'], ['vmiddle', '╫ Mezzo'], ['bottom', '⊥ Basso']] as const).map(([k, lbl]) => (
              <button key={k} onClick={() => onAlign(k)} className="text-[11px] px-1.5 py-1 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]">{lbl}</button>
            ))}
          </div>
          {onDistribute && (selCount ?? 0) >= 3 && (
            <div className="grid grid-cols-2 gap-1 mt-1">
              <button onClick={() => onDistribute('h')} title="Spazia uniformemente in orizzontale" className="text-[11px] px-1.5 py-1 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]">↔ Distrib. orizz.</button>
              <button onClick={() => onDistribute('v')} title="Spazia uniformemente in verticale" className="text-[11px] px-1.5 py-1 rounded border border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-sunken))]">↕ Distrib. vert.</button>
            </div>
          )}
          {/* MARGINI UGUALI: tutti gli spazi bianchi tra le foto uguali a N mm (anche mosaico 2D) */}
          {onUniformGaps && (
            <div className="mt-2 pt-2 border-t border-[rgb(var(--border))]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[11px] text-[rgb(var(--fg-muted))] whitespace-nowrap">Margine uguale</span>
                <input type="number" min={0} max={30} value={gutterMm ?? 3} onChange={(e) => onGutter?.(Math.max(0, Math.min(30, +e.target.value || 0)))} className="w-12 text-[11px] px-1 py-0.5 rounded border border-[rgb(var(--border))] bg-[rgb(var(--bg))]" />
                <span className="text-[11px] text-[rgb(var(--fg-muted))]">mm</span>
              </div>
              <Button variant="gold" size="sm" className="w-full" onClick={onUniformGaps}><Grid3x3 size={13} /> Rendi tutti i margini uguali</Button>
              <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1 leading-tight">Tutti gli spazi bianchi tra le foto selezionate diventano uguali ({gutterMm ?? 3} mm), sia in verticale sia in orizzontale.</p>
            </div>
          )}
        </div>
      )}

      {/* DISPOSIZIONI: schemi (solo griglia, niente foto) per il numero esatto di foto sulla tavola,
          con slot che rispecchiano gli orientamenti. Clic = applica. + I TUOI preset salvati. */}
      {!lite && onApplyTavolaLayout && (page.elements ?? []).length > 0 && (
        <div className="border-t border-[rgb(var(--border))] pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="font-medium flex items-center gap-1.5"><Grid3x3 size={14} /> Disposizioni <span className="text-[10px] text-[rgb(var(--fg-subtle))]">({presets?.length ?? 0} · {(page.elements ?? []).length} foto)</span></p>
            {onSaveLayout && <button onClick={onSaveLayout} title="Salva la composizione attuale tra i tuoi preset" className="text-[11px] inline-flex items-center gap-1 text-[rgb(var(--gold-700))] hover:underline"><Save size={12} /> Salva questa</button>}
          </div>
          {myPresets && myPresets.length > 0 && (
            <>
              <p className="text-[11px] font-medium text-[rgb(var(--fg-muted))] mb-1">I tuoi preset</p>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {myPresets.map((l) => (
                  <div key={l.id} className="relative group/mp">
                    <button title={`${l.name} · applica`} onClick={() => onApplySaved?.(l)}
                      className="w-full rounded-md overflow-hidden border border-[rgb(var(--gold-400))] hover:ring-1 hover:ring-[rgb(var(--gold-500))] transition">
                      <Wireframe slots={l.els ?? []} aspect={tavAspect ?? 2} />
                    </button>
                    {onDeleteSaved && <button title="Elimina preset" onClick={() => onDeleteSaved(l.id)} className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-rose-500 text-white text-[10px] leading-none hidden group-hover/mp:flex items-center justify-center">×</button>}
                  </div>
                ))}
              </div>
            </>
          )}
          {presets && presets.length > 0 && (
            <>
              <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1.5">Suggerite — a vivo, con cornice o a fascia. Le foto entrano negli slot adatti al loro verso.</p>
              <div className="grid grid-cols-3 gap-1.5 max-h-72 overflow-auto pr-0.5">
                {presets.map((pz, i) => (
                  <button key={pz.sig} title={`Disposizione ${i + 1}`} onClick={() => onApplyTavolaLayout(pz.slots)}
                    className="rounded-md overflow-hidden border border-[rgb(var(--border))] hover:border-[rgb(var(--gold-500))] hover:ring-1 hover:ring-[rgb(var(--gold-500))] transition">
                    <Wireframe slots={pz.slots} aspect={tavAspect ?? 2} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {el ? (
        <div className="border-t border-[rgb(var(--border))] pt-3 space-y-2">
          <p className="font-medium flex items-center gap-1.5"><Move size={14} /> Foto</p>
          <Button variant="outline" size="sm" className="w-full" onClick={() => onElUpdate(el.id, { x: 0, y: 0, w: 1, h: 1, rot: 0 })}><Maximize size={14} /> Riempi tutta la tavola</Button>
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
        <div className="border-t border-[rgb(var(--border))] pt-3 space-y-1.5">
          <div className="flex gap-1.5 flex-wrap">
            <Button variant="outline" size="sm" onClick={onAddPage}><Plus size={13} /> Tavola</Button>
            <Button variant="outline" size="sm" onClick={onDuplicate}><Copy size={13} /> Duplica</Button>
            <Button variant="outline" size="sm" className="text-rose-500" onClick={onDelPage}><Trash2 size={13} /> Elimina</Button>
          </div>
          {onSaveLayout && <Button variant="outline" size="sm" className="w-full" onClick={onSaveLayout}><Hash size={13} /> Salva questa composizione come preset</Button>}
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
class AlbumBoundary extends Component<{ children: ReactNode }, { err: Error | null; info: string }> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { err: null, info: '' } }
  static getDerivedStateFromError(err: Error) { return { err } }
  componentDidCatch(err: Error, info: { componentStack?: string | null }) {
    console.error('AlbumDesigner crash', err, info)
    // prima riga utile dello stack del componente → diagnosi immediata da screenshot
    const cs = (info.componentStack ?? '').trim().split('\n').slice(0, 3).join('\n')
    this.setState({ info: cs })
  }
  render() {
    if (this.state.err) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center bg-[rgb(var(--bg-sunken))]">
          <p className="font-display text-xl mb-2">Qualcosa è andato storto nell'album</p>
          <p className="text-sm text-[rgb(var(--fg-muted))] max-w-md">Ricarica la pagina. Se continua, mostra questo messaggio al fotografo:</p>
          <pre className="mt-3 text-[11px] text-rose-500 max-w-md overflow-auto whitespace-pre-wrap">{this.state.err.message}{this.state.info ? `\n${this.state.info}` : ''}</pre>
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
