import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import { ZoomIn, ZoomOut, Crosshair, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// ============================================================================
// Editor del logo: lo si zooma, trascina e centra dentro un'anteprima circolare
// (come appare negli avatar). Al salvataggio esporta un PNG quadrato già
// "fittato" nel cerchio, così il logo è corretto ovunque venga mostrato.
// ============================================================================

const STAGE = 288     // lato anteprima in px
const EXPORT = 512    // lato immagine esportata in px

type Bg = 'transparent' | 'white' | 'black'
const BG_CSS: Record<Bg, string> = { transparent: 'transparent', white: '#ffffff', black: '#000000' }

export function LogoCropper({ src, onCancel, onSave }: {
  src: string
  onCancel: () => void
  onSave: (blob: Blob) => void | Promise<void>
}) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [bg, setBg] = useState<Bg>('transparent')
  const [saving, setSaving] = useState(false)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  // Carica l'immagine (crossOrigin per poterla esportare su canvas anche da URL remoto).
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; setNat({ w: img.naturalWidth, h: img.naturalHeight }) }
    img.src = src
  }, [src])

  const baseScale = nat ? Math.min(STAGE / nat.w, STAGE / nat.h) : 1
  const drawScale = baseScale * zoom
  const dw = nat ? nat.w * drawScale : 0
  const dh = nat ? nat.h * drawScale : 0
  const left = (STAGE - dw) / 2 + offset.x
  const top = (STAGE - dh) / 2 + offset.y

  function onPointerDown(e: RPointerEvent) {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  function onPointerMove(e: RPointerEvent) {
    if (!drag.current) return
    setOffset({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) })
  }
  function onPointerUp() { drag.current = null }

  function center() { setOffset({ x: 0, y: 0 }); setZoom(1) }

  async function save() {
    const img = imgRef.current
    if (!img || !nat) return
    setSaving(true)
    try {
      const ratio = EXPORT / STAGE
      const canvas = document.createElement('canvas')
      canvas.width = EXPORT; canvas.height = EXPORT
      const ctx = canvas.getContext('2d')!
      if (bg !== 'transparent') { ctx.fillStyle = BG_CSS[bg]; ctx.fillRect(0, 0, EXPORT, EXPORT) }
      ctx.drawImage(img, left * ratio, top * ratio, dw * ratio, dh * ratio)
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => b ? res(b) : rej(new Error('toBlob fallito')), 'image/png'))
      await onSave(blob)
    } catch (e) {
      // Se l'immagine remota ha tainted il canvas (CORS), avvisa.
      alert('Non riesco a elaborare questa immagine. Ricaricala dal file originale e riprova.\n' + (e as Error).message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-md rounded-2xl p-5" style={{ background: 'rgb(var(--bg))', border: '1px solid rgb(var(--border))' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg">Posiziona il logo</h3>
          <button onClick={onCancel} className="text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]"><X size={18} /></button>
        </div>

        {/* Stage circolare */}
        <div className="mx-auto relative select-none touch-none rounded-full overflow-hidden"
          style={{ width: STAGE, height: STAGE, background: BG_CSS[bg], border: '1px solid rgb(var(--border-strong))', cursor: drag.current ? 'grabbing' : 'grab',
            backgroundImage: bg === 'transparent' ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #f8fafc 0% 50%)' : undefined, backgroundSize: '16px 16px' }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {nat && (
            <img src={src} alt="logo" draggable={false}
              style={{ position: 'absolute', left, top, width: dw, height: dh, maxWidth: 'none' }} />
          )}
          {/* ghiera guida */}
          <div className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.5)' }} />
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-3 mt-4">
          <ZoomOut size={16} className="text-[rgb(var(--fg-muted))]" />
          <input type="range" min={0.3} max={3} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[rgb(var(--gold-500))]" />
          <ZoomIn size={16} className="text-[rgb(var(--fg-muted))]" />
          <Button variant="outline" size="sm" onClick={center} title="Centra e azzera zoom"><Crosshair size={14} /></Button>
        </div>

        {/* Sfondo */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs text-[rgb(var(--fg-muted))]">Sfondo:</span>
          {(['transparent', 'white', 'black'] as Bg[]).map((b) => (
            <button key={b} onClick={() => setBg(b)}
              className={`px-2.5 py-1 rounded-full text-xs border ${bg === b ? 'border-[rgb(var(--gold-500))] font-medium' : 'border-[rgb(var(--border))]'}`}>
              {b === 'transparent' ? 'Trasparente' : b === 'white' ? 'Bianco' : 'Nero'}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-3">Trascina per spostare, usa lo slider per zoomare. L'anteprima è esattamente ciò che si vede nel cerchio.</p>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} disabled={saving}>Annulla</Button>
          <Button variant="gold" onClick={save} disabled={saving || !nat}>{saving ? 'Salvo…' : 'Salva logo'}</Button>
        </div>
      </div>
    </div>
  )
}
