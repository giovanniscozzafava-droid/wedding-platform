// L'IMPAGINAZIONE DELLA COPERTINA, in mano alla coppia e pensata per il telefono: la copertina in
// pianta (proporzioni vere), le finestre foto dove le mette il modello — dentro ognuna la foto si
// trascina col dito e si ingrandisce con la barra — e il blocco nomi/logo che si trascina dove si
// vuole e si fa grande o piccolo. Stessa geometria del 3D e del PSD (cropRect / LogoPlace).
import { useEffect, useRef, useState } from 'react'
import { RotateCcw } from '@/components/icons/lucide'
import { cropSlack, DEFAULT_CROP, type LogoPlace, type PhotoCrop, type Rect } from '@/components/album/glb/layoutSpec'

type Props = {
  wCm: number; hCm: number
  bgHex?: string
  decorPrint?: string | null
  decorInvert?: boolean
  photos: string[]
  windows: Rect[]
  crops: Record<number, PhotoCrop>
  onCrops: (c: Record<number, PhotoCrop>) => void
  /** il blocco nomi/logo: immagine composta (data URL) o solo testo */
  logoImage?: string | null
  logoAspect?: number             // altezza/larghezza dell'immagine del logo
  namesText?: string
  ink: string
  place: LogoPlace
  defaultPlace: LogoPlace
  onPlace: (p: LogoPlace | null) => void
}

export function CoverLayoutEditor({ wCm, hCm, bgHex, decorPrint, decorInvert, photos, windows, crops, onCrops, logoImage, logoAspect, namesText, ink, place, defaultPlace, onPlace }: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [sel, setSel] = useState<number>(windows.length ? 0 : -1)
  const [dims, setDims] = useState<Record<number, { w: number; h: number }>>({})
  const drag = useRef<{ kind: 'photo' | 'logo'; i: number; x0: number; y0: number; start: PhotoCrop | LogoPlace } | null>(null)
  useEffect(() => { setSel(windows.length ? 0 : -1) }, [windows.length])

  const px = () => { const r = ref.current?.getBoundingClientRect(); return { w: r?.width ?? 1, h: r?.height ?? 1 } }
  const crop = (i: number): PhotoCrop => crops[i] ?? DEFAULT_CROP
  const setCrop = (i: number, c: PhotoCrop) => onCrops({ ...crops, [i]: c })
  const clampCrop = (i: number, c: PhotoCrop): PhotoCrop => {
    const d = dims[i]; const win = windows[i]
    if (!d || !win) return c
    const s = cropSlack(d.w, d.h, win.w * wCm, win.h * hCm, c.zoom)
    return { ...c, ox: Math.min(Math.max(c.ox, -s.x), s.x), oy: Math.min(Math.max(c.oy, -s.y), s.y) }
  }

  const onDown = (kind: 'photo' | 'logo', i: number) => (e: React.PointerEvent) => {
    e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { kind, i, x0: e.clientX, y0: e.clientY, start: kind === 'photo' ? crop(i) : place }
    if (kind === 'photo') setSel(i)
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const { w, h } = px(); const dx = e.clientX - d.x0, dy = e.clientY - d.y0
    if (d.kind === 'photo') {
      const win = windows[d.i]; if (!win) return
      const s = d.start as PhotoCrop
      setCrop(d.i, clampCrop(d.i, { ...s, ox: s.ox + dx / (w * win.w), oy: s.oy + dy / (h * win.h) }))
    } else {
      const s = d.start as LogoPlace
      const x = Math.min(Math.max(s.x + dx / w, s.w / 2 + 0.02), 1 - s.w / 2 - 0.02)
      const y = Math.min(Math.max(s.y + dy / h, 0.02), 1 - 0.02 - blockH(s.w))
      onPlace({ ...s, x, y })
    }
  }
  const onUp = () => { drag.current = null }

  // altezza del blocco nomi/logo in frazioni della copertina (il logo tiene le sue proporzioni; i nomi soli ≈ una riga)
  const blockH = (w: number) => (logoImage ? w * (logoAspect ?? 0.4) * (wCm / hCm) : 0.08)
  const cur = sel >= 0 ? crop(sel) : null
  const logoH = logoImage ? blockH(place.w) : undefined

  return (
    <div className="space-y-3 select-none">
      <div ref={ref} className="relative w-full overflow-hidden rounded-2xl border border-[rgb(var(--border))] shadow-[0_10px_30px_rgba(20,18,14,.14)] touch-none"
        style={{ aspectRatio: `${wCm} / ${hCm}`, background: bgHex ?? '#e9e2d6' }} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {decorPrint && <img src={decorPrint} alt="" className="absolute inset-0 h-full w-full pointer-events-none" style={{ opacity: 0.9, filter: decorInvert ? 'invert(1)' : undefined }} draggable={false} />}
        {windows.map((win, i) => {
          const c = crop(i); const on = sel === i; const src = photos[i] ?? photos[0]
          return (
            <div key={i} onPointerDown={onDown('photo', i)}
              className={`absolute overflow-hidden bg-[rgb(var(--bg-sunken))] ${on ? 'ring-2 ring-[rgb(var(--gold-500))]' : 'ring-1 ring-black/10'} cursor-grab active:cursor-grabbing`}
              style={{ left: `${(win.x - win.w / 2) * 100}%`, top: `${(win.y - win.h / 2) * 100}%`, width: `${win.w * 100}%`, height: `${win.h * 100}%` }}>
              {src ? (
                <img src={src} alt="" draggable={false} onLoad={(e) => { const im = e.currentTarget; setDims((d) => ({ ...d, [i]: { w: im.naturalWidth, h: im.naturalHeight } })) }}
                  className="h-full w-full object-cover pointer-events-none" style={{ transform: `translate(${c.ox * 100}%, ${c.oy * 100}%) scale(${c.zoom})` }} />
              ) : <div className="grid h-full w-full place-items-center text-[10px] text-[rgb(var(--fg-subtle))]">foto {i + 1}</div>}
              {windows.length > 1 && <span className="absolute top-1 left-1 h-5 w-5 grid place-items-center rounded-full bg-black/60 text-white text-[10px]">{i + 1}</span>}
            </div>
          )
        })}
        {(logoImage || namesText) && (
          <div onPointerDown={onDown('logo', 0)} className="absolute cursor-grab active:cursor-grabbing rounded-md ring-1 ring-dashed ring-[rgb(var(--gold-500))]/80"
            style={{ left: `${(place.x - place.w / 2) * 100}%`, top: `${place.y * 100}%`, width: `${place.w * 100}%`, height: logoH ? `${logoH * 100}%` : undefined }}>
            {logoImage
              ? <img src={logoImage} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none" />
              : <div className="w-full text-center pointer-events-none whitespace-nowrap overflow-hidden" style={{ color: ink, fontFamily: '"Fraunces", "Cormorant Garamond", Georgia, serif', fontStyle: 'italic', fontSize: `clamp(10px, ${place.w * 22}cqw, 60px)`, lineHeight: 1.2 }}>{namesText}</div>}
          </div>
        )}
      </div>
      {/* comandi: ingrandimento della foto selezionata, grandezza del blocco nomi/logo, reimposta */}
      {cur && windows[sel] && (
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] w-24 shrink-0">{windows.length > 1 ? `Foto ${sel + 1}` : 'La foto'}</span>
          <input type="range" min={1} max={3} step={0.01} value={cur.zoom} aria-label="Ingrandisci la foto" className="flex-1 accent-[rgb(var(--gold-600))]"
            onChange={(e) => setCrop(sel, clampCrop(sel, { ...cur, zoom: Number(e.target.value) }))} />
          <button type="button" onClick={() => setCrop(sel, DEFAULT_CROP)} className="inline-flex items-center gap-1 text-[12px] text-[rgb(var(--fg-muted))]"><RotateCcw size={13} /> Centra</button>
        </div>
      )}
      {(logoImage || namesText) && (
        <div className="flex items-center gap-3">
          <span className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] w-24 shrink-0">{logoImage ? 'Il logo' : 'I nomi'}</span>
          <input type="range" min={0.12} max={0.7} step={0.005} value={place.w} aria-label="Grandezza del logo" className="flex-1 accent-[rgb(var(--gold-600))]"
            onChange={(e) => { const w = Number(e.target.value); onPlace({ ...place, w, x: Math.min(Math.max(place.x, w / 2 + 0.02), 1 - w / 2 - 0.02), y: Math.min(place.y, 1 - 0.02 - blockH(w)) }) }} />
          <button type="button" onClick={() => onPlace(null)} className="inline-flex items-center gap-1 text-[12px] text-[rgb(var(--fg-muted))]" title={`Dove lo mette il catalogo (${Math.round(defaultPlace.w * 100)}% della larghezza)`}><RotateCcw size={13} /> Come da catalogo</button>
        </div>
      )}
      <p className="text-[11px] text-[rgb(var(--fg-subtle))]">Trascina col dito la foto dentro la sua finestra e il blocco dei nomi dove lo vuoi; le barre ingrandiscono. Il 3D e la tavola per l'azienda seguono al millimetro.</p>
    </div>
  )
}
