import { useEffect, useRef, useState } from 'react'
import { Eraser } from 'lucide-react'

// Firma a dito/penna su canvas (pointer events). Emette la dataURL PNG al sollevamento,
// null quando vuota. Mobile-friendly (touch-action: none).
export function SignaturePad({ onChange, height = 160 }: { onChange: (dataUrl: string | null) => void; height?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const dirty = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = ref.current; if (!c) return
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = c.clientWidth, h = c.clientHeight
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr)
      const ctx = c.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#23201a'
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  const pos = (e: React.PointerEvent) => {
    const c = ref.current!; const r = c.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    const c = ref.current!; c.setPointerCapture(e.pointerId)
    drawing.current = true
    const ctx = c.getContext('2d')!; const p = pos(e)
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = ref.current!.getContext('2d')!; const p = pos(e)
    ctx.lineTo(p.x, p.y); ctx.stroke()
    if (!dirty.current) { dirty.current = true; setEmpty(false) }
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange(dirty.current ? ref.current!.toDataURL('image/png') : null)
  }
  const clear = () => {
    const c = ref.current!; const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    dirty.current = false; setEmpty(true); onChange(null)
  }

  return (
    <div>
      <div className="relative rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] overflow-hidden" style={{ height }}>
        <canvas
          ref={ref} className="w-full h-full block"
          style={{ touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        />
        {empty && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none text-[rgb(var(--fg-subtle))] text-sm">
            Firma qui col dito
          </div>
        )}
      </div>
      <button type="button" onClick={clear}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))] transition-colors">
        <Eraser size={13} /> Cancella firma
      </button>
    </div>
  )
}
