// L'IMPAGINAZIONE DELLA COPERTINA, in mano alla coppia e pensata per il telefono: la copertina in
// pianta (proporzioni vere), le finestre foto dove le mette il modello — dentro ognuna la foto si
// trascina col dito e si ingrandisce con la barra — il logo e la scritta (nomi e data), che si
// spostano e si ridimensionano OGNUNO PER CONTO SUO. Stessa geometria del 3D e del PSD
// (cropRect / LogoPlace / TextPlace + drawCoverText).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Move, RotateCcw, ZoomIn } from '@/components/icons/lucide'
import { coverTextMetrics, cropSlack, DEFAULT_CROP, frameOf, type LogoPlace, type PhotoCrop, type PhotoFrame, type Rect, type TextPlace } from '@/components/album/glb/layoutSpec'

type Sel = { kind: 'photo' | 'logo' | 'text'; i: number }

type Props = {
  wCm: number; hCm: number
  bgHex?: string
  decorPrint?: string | null
  decorInvert?: boolean
  photos: string[]
  windows: Rect[]
  crops: Record<number, PhotoCrop>
  onCrops: (c: Record<number, PhotoCrop>) => void
  /** i riquadri spostati dalla coppia (assenti = quelli del modello) */
  frames: Record<number, PhotoFrame>
  onFrames: (f: Record<number, PhotoFrame>) => void
  /** il logo: immagine composta (data URL) del ritaglio del catalogo, tinta */
  logoImage?: string | null
  logoAspect?: number             // altezza/larghezza dell'immagine del logo
  place: LogoPlace
  defaultPlace: LogoPlace
  onPlace: (p: LogoPlace | null) => void
  /** la scritta scelta dalla coppia: nomi e data (vuote = niente scritta) */
  names?: string
  dateText?: string
  /** il logo scelto porta già dentro nomi e data: la scritta non si ripete */
  textInsideLogo?: boolean
  textPlace: TextPlace
  defaultTextPlace: TextPlace
  onTextPlace: (p: TextPlace | null) => void
  ink: string
}

export function CoverLayoutEditor({
  wCm, hCm, bgHex, decorPrint, decorInvert, photos, windows, crops, onCrops, frames, onFrames,
  logoImage, logoAspect, place, defaultPlace, onPlace,
  names, dateText, textInsideLogo, textPlace, defaultTextPlace, onTextPlace, ink,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ w: 1, h: 1 })
  const [sel, setSel] = useState<Sel>(() => (windows.length ? { kind: 'photo', i: 0 } : { kind: 'text', i: 0 }))
  const [dims, setDims] = useState<Record<number, { w: number; h: number }>>({})
  const [moved, setMoved] = useState(false)          // la coppia ha già spostato qualcosa: via il suggerimento
  const drag = useRef<{ kind: Sel['kind']; i: number; x0: number; y0: number; start: PhotoCrop | LogoPlace } | null>(null)

  const hasText = !textInsideLogo && !!((names ?? '').trim() || (dateText ?? '').trim())
  const hasLogo = !!logoImage
  useEffect(() => { setSel(windows.length ? { kind: 'photo', i: 0 } : hasLogo ? { kind: 'logo', i: 0 } : { kind: 'text', i: 0 }) }, [windows.length, hasLogo])
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const read = () => { const r = el.getBoundingClientRect(); setBox({ w: r.width || 1, h: r.height || 1 }) }
    read()
    const ro = new ResizeObserver(read); ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /** il riquadro in uso: quello scelto dalla coppia, se c'è, altrimenti quello del modello */
  const rect = (i: number): PhotoFrame => frameOf(windows, i, frames) ?? { x: 0.5, y: 0.5, w: 0.5, h: 0.5, rot: 0 }
  const setFrame = (i: number, f: PhotoFrame) => { setMoved(true); onFrames({ ...frames, [i]: f }) }
  const resetFrame = (i: number) => { const { [i]: _drop, ...rest } = frames; setMoved(true); onFrames(rest) }
  const crop = (i: number): PhotoCrop => crops[i] ?? DEFAULT_CROP
  const setCrop = (i: number, c: PhotoCrop) => { setMoved(true); onCrops({ ...crops, [i]: c }) }
  const clampCrop = (i: number, c: PhotoCrop): PhotoCrop => {
    const d = dims[i]; const win = rect(i)
    if (!d || !win) return c
    const s = cropSlack(d.w, d.h, win.w * wCm, win.h * hCm, c.zoom)
    return { ...c, ox: Math.min(Math.max(c.ox, -s.x), s.x), oy: Math.min(Math.max(c.oy, -s.y), s.y) }
  }

  // altezze dei due blocchi, in frazioni della copertina
  const logoH = (w: number) => w * (logoAspect ?? 0.4) * (wCm / hCm)
  const textM = coverTextMetrics(names, dateText)
  const textH = (w: number) => (textM.h / textM.w) * w * (box.w / Math.max(box.h, 1))
  const blockH = (kind: Sel['kind'], w: number) => (kind === 'logo' ? logoH(w) : textH(w))

  const onDown = (kind: Sel['kind'], i: number) => (e: React.PointerEvent) => {
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { kind, i, x0: e.clientX, y0: e.clientY, start: kind === 'photo' ? crop(i) : kind === 'logo' ? place : textPlace }
    setSel({ kind, i })
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0
    if (d.kind === 'photo') {
      const win = rect(d.i); if (!win) return
      const s = d.start as PhotoCrop
      setCrop(d.i, clampCrop(d.i, { ...s, ox: s.ox + dx / (box.w * win.w), oy: s.oy + dy / (box.h * win.h) }))
      return
    }
    const s = d.start as LogoPlace
    const x = Math.min(Math.max(s.x + dx / box.w, s.w / 2 + 0.02), 1 - s.w / 2 - 0.02)
    const y = Math.min(Math.max(s.y + dy / box.h, 0.02), 1 - 0.02 - blockH(d.kind, s.w))
    setMoved(true)
    ;(d.kind === 'logo' ? onPlace : onTextPlace)({ ...s, x, y })
  }
  const onUp = () => { drag.current = null }

  const resize = (kind: 'logo' | 'text') => (w: number) => {
    const p = kind === 'logo' ? place : textPlace
    const next = { ...p, w, x: Math.min(Math.max(p.x, w / 2 + 0.02), 1 - w / 2 - 0.02), y: Math.min(p.y, 1 - 0.02 - blockH(kind, w)) }
    setMoved(true)
    ;(kind === 'logo' ? onPlace : onTextPlace)(next)
  }

  const chip = (s: Sel, label: string) => {
    const on = sel.kind === s.kind && sel.i === s.i
    return (
      <button key={`${s.kind}${s.i}`} type="button" onClick={() => setSel(s)}
        className={`rounded-full px-3 py-1 text-[12px] border transition ${on ? 'border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-50))] text-[rgb(var(--gold-700))]' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-muted))]'}`}>{label}</button>
    )
  }

  const curCrop = sel.kind === 'photo' && windows[sel.i] ? crop(sel.i) : null
  const textFont = (textPlace.w * box.w * 100) / textM.w

  return (
    <div className="space-y-3 select-none">
      <div ref={ref} className="relative w-full overflow-hidden rounded-2xl border border-[rgb(var(--border))] shadow-[0_10px_30px_rgba(20,18,14,.14)] touch-none"
        style={{ aspectRatio: `${wCm} / ${hCm}`, background: bgHex ?? '#e9e2d6' }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {decorPrint && <img src={decorPrint} alt="" className="absolute inset-0 h-full w-full pointer-events-none" style={{ opacity: 0.9, filter: decorInvert ? 'invert(1)' : undefined }} draggable={false} />}

        {windows.map((_win, i) => {
          const win = rect(i)
          const c = crop(i); const on = sel.kind === 'photo' && sel.i === i; const src = photos[i] ?? photos[0]
          return (
            <div key={i} onPointerDown={onDown('photo', i)}
              className={`absolute overflow-hidden bg-[rgb(var(--bg-sunken))] ${on ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'ring-1 ring-black/10'} cursor-grab active:cursor-grabbing`}
              style={{ left: `${(win.x - win.w / 2) * 100}%`, top: `${(win.y - win.h / 2) * 100}%`, width: `${win.w * 100}%`, height: `${win.h * 100}%`, transform: win.rot ? `rotate(${win.rot}deg)` : undefined }}>
              {src ? (
                <img src={src} alt="" draggable={false} onLoad={(e) => { const im = e.currentTarget; setDims((d) => ({ ...d, [i]: { w: im.naturalWidth, h: im.naturalHeight } })) }}
                  className="h-full w-full object-cover pointer-events-none" style={{ transform: `translate(${c.ox * 100}%, ${c.oy * 100}%) scale(${c.zoom})` }} />
              ) : <div className="grid h-full w-full place-items-center text-[10px] text-[rgb(var(--fg-subtle))]">foto {i + 1}</div>}
              {/* la finestra è un ritaglio: si vede il bordo dello scatto e si capisce che la foto si muove */}
              {on && (
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-70">
                  {Array.from({ length: 9 }, (_, k) => <div key={k} className="border border-white/30" />)}
                </div>
              )}
              {src && !moved && on && (
                <span title="Trascina la foto per scegliere il ritaglio"
                  className="pointer-events-none absolute left-1/2 bottom-1 -translate-x-1/2 grid h-6 w-6 place-items-center rounded-full bg-black/55 text-white">
                  <Move size={12} />
                </span>
              )}
              {windows.length > 1 && <span className="absolute top-1 left-1 h-5 w-5 grid place-items-center rounded-full bg-black/60 text-white text-[10px]">{i + 1}</span>}
            </div>
          )
        })}

        {hasLogo && (
          <div onPointerDown={onDown('logo', 0)}
            className={`absolute cursor-grab active:cursor-grabbing rounded-md ${sel.kind === 'logo' ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'ring-1 ring-dashed ring-[rgb(var(--gold-500))]/70'}`}
            style={{ left: `${(place.x - place.w / 2) * 100}%`, top: `${place.y * 100}%`, width: `${place.w * 100}%`, height: `${logoH(place.w) * 100}%` }}>
            <img src={logoImage!} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none" />
          </div>
        )}

        {hasText && (
          <div onPointerDown={onDown('text', 0)}
            className={`absolute cursor-grab active:cursor-grabbing rounded-md ${sel.kind === 'text' ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'ring-1 ring-dashed ring-[rgb(var(--gold-500))]/70'}`}
            style={{ left: `${(textPlace.x - textPlace.w / 2) * 100}%`, top: `${textPlace.y * 100}%`, width: `${textPlace.w * 100}%` }}>
            <div className="pointer-events-none w-full text-center whitespace-nowrap"
              style={{ color: ink, fontFamily: '"Fraunces", "Cormorant Garamond", Georgia, serif', fontStyle: 'italic', fontSize: `${textFont}px`, lineHeight: 1.15 }}>
              {(names ?? '').trim()}
            </div>
            {!!(dateText ?? '').trim() && (
              <div className="pointer-events-none w-full text-center whitespace-nowrap"
                style={{ color: ink, fontFamily: '"Fraunces", "Cormorant Garamond", Georgia, serif', fontStyle: 'italic', fontSize: `${textFont * 0.52}px`, lineHeight: 1.5 }}>
                {(dateText ?? '').trim()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* che cosa sto spostando */}
      {(windows.length + (hasLogo ? 1 : 0) + (hasText ? 1 : 0)) > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {windows.map((_, i) => chip({ kind: 'photo', i }, windows.length > 1 ? `Foto ${i + 1}` : 'La foto'))}
          {hasLogo && chip({ kind: 'logo', i: 0 }, 'Il logo')}
          {hasText && chip({ kind: 'text', i: 0 }, 'La scritta')}
        </div>
      )}

      {/* LO SCATTO dentro la finestra: si trascina col dito, la barra ingrandisce */}
      {curCrop && (
        <div className="flex items-center gap-3">
          <ZoomIn size={15} className="text-[rgb(var(--fg-subtle))] shrink-0" />
          <input type="range" min={1} max={3} step={0.01} value={curCrop.zoom} aria-label="Ingrandisci la foto" className="flex-1 accent-[rgb(var(--gold-600))]"
            onChange={(e) => setCrop(sel.i, clampCrop(sel.i, { ...curCrop, zoom: Number(e.target.value) }))} />
          <button type="button" onClick={() => setCrop(sel.i, DEFAULT_CROP)} className="inline-flex items-center gap-1 text-[12px] text-[rgb(var(--fg-muted))]"><RotateCcw size={13} /> Centra</button>
        </div>
      )}
      {/* IL RIQUADRO: poche posizioni pronte, si sfogliano con le frecce (niente misure da regolare) */}
      {sel.kind === 'photo' && windows[sel.i] && (() => {
        const list = framePresets(windows[sel.i]!)
        const cur = Math.max(0, list.findIndex((p) => sameFrame(p.frame, rect(sel.i))))
        const go = (d: number) => {
          const n = (cur + d + list.length) % list.length
          const p = list[n]!
          if (p.key === 'catalogo') resetFrame(sel.i); else setFrame(sel.i, p.frame)
        }
        return (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[rgb(var(--border))] px-2 py-1.5">
            <button type="button" onClick={() => go(-1)} aria-label="Posizione precedente" className="grid h-8 w-8 place-items-center rounded-full text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]"><ChevronLeft size={16} /></button>
            <div className="min-w-0 text-center">
              <p className="truncate text-[13px] font-medium">{list[cur]?.label ?? 'Come da catalogo'}</p>
              <div className="mt-1 flex items-center justify-center gap-1">
                {list.map((p, k) => <span key={p.key} className={`h-1.5 rounded-full transition-all ${k === cur ? 'w-4 bg-[rgb(var(--gold-600))]' : 'w-1.5 bg-[rgb(var(--border))]'}`} />)}
              </div>
            </div>
            <button type="button" onClick={() => go(1)} aria-label="Posizione successiva" className="grid h-8 w-8 place-items-center rounded-full text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--bg-sunken))]"><ChevronRight size={16} /></button>
          </div>
        )
      })()}
      {sel.kind === 'logo' && hasLogo && (
        <div className="flex items-center gap-3">
          <ZoomIn size={15} className="text-[rgb(var(--fg-subtle))] shrink-0" />
          <input type="range" min={0.12} max={0.7} step={0.005} value={place.w} aria-label="Grandezza del logo" className="flex-1 accent-[rgb(var(--gold-600))]"
            onChange={(e) => resize('logo')(Number(e.target.value))} />
          <button type="button" onClick={() => onPlace(null)} className="inline-flex items-center gap-1 text-[12px] text-[rgb(var(--fg-muted))]" title={`Dove lo mette il catalogo (${Math.round(defaultPlace.w * 100)}% della larghezza)`}><RotateCcw size={13} /> Come da catalogo</button>
        </div>
      )}
      {sel.kind === 'text' && hasText && (
        <div className="flex items-center gap-3">
          <ZoomIn size={15} className="text-[rgb(var(--fg-subtle))] shrink-0" />
          <input type="range" min={0.12} max={0.8} step={0.005} value={textPlace.w} aria-label="Grandezza della scritta" className="flex-1 accent-[rgb(var(--gold-600))]"
            onChange={(e) => resize('text')(Number(e.target.value))} />
          <button type="button" onClick={() => onTextPlace(null)} className="inline-flex items-center gap-1 text-[12px] text-[rgb(var(--fg-muted))]" title={`Dove la mette il catalogo (${Math.round(defaultTextPlace.w * 100)}% della larghezza)`}><RotateCcw size={13} /> Come da catalogo</button>
        </div>
      )}
      <p className="text-[11px] text-[rgb(var(--fg-subtle))]">
        {textInsideLogo
          ? 'Trascina la foto dentro la sua finestra e il logo dove lo vuoi: nomi e data sono già scritti dentro il logo che hai scelto. Il 3D e la tavola per l\'azienda seguono al millimetro.'
          : 'Trascina la foto dentro la sua finestra, e la scritta (o il logo) dove la vuoi; la barra ingrandisce. Il 3D e la tavola per l\'azienda seguono al millimetro.'}
      </p>
    </div>
  )
}

/** LE POSIZIONI PRONTE della foto sulla copertina: poche e chiare, si sfogliano con le frecce.
 *  Partono sempre dalla finestra del modello (quella stampata sul catalogo). */
export function framePresets(win: Rect): { key: string; label: string; frame: PhotoFrame }[] {
  const big = Math.min(1, Math.max(win.w, win.h) * 1.35)
  return [
    { key: 'catalogo', label: 'Come da catalogo', frame: { x: win.x, y: win.y, w: win.w, h: win.h, rot: 0 } },
    { key: 'grande', label: 'Più grande', frame: { x: win.x, y: win.y, w: Math.min(1, win.w * 1.25), h: Math.min(1, win.h * 1.25), rot: 0 } },
    { key: 'piena', label: 'Tutta la copertina', frame: { x: 0.5, y: 0.5, w: 1, h: 1, rot: 0 } },
    { key: 'fascia', label: 'Fascia intera', frame: { x: 0.5, y: win.y, w: 1, h: win.h, rot: 0 } },
    { key: 'alto', label: 'In alto', frame: { x: win.x, y: win.h / 2 + 0.04, w: win.w, h: win.h, rot: 0 } },
    { key: 'basso', label: 'In basso', frame: { x: win.x, y: 1 - win.h / 2 - 0.04, w: win.w, h: win.h, rot: 0 } },
    { key: 'inclinata', label: 'Leggermente inclinata', frame: { x: win.x, y: win.y, w: big, h: win.h * (big / win.w), rot: -4 } },
  ]
}
const sameFrame = (a: PhotoFrame, b: PhotoFrame) =>
  Math.abs(a.x - b.x) < 0.005 && Math.abs(a.y - b.y) < 0.005 && Math.abs(a.w - b.w) < 0.005 && Math.abs(a.h - b.h) < 0.005 && Math.abs((a.rot ?? 0) - (b.rot ?? 0)) < 0.1
