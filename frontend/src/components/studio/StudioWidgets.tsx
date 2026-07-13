import { useRef, useEffect, useState } from 'react'
import { drawStamp } from '@/lib/studioStamps'
import { drawCustomBrush } from '@/lib/studioCustomBrushes'
import { hexToRgb, rgbToHsv, hsvToRgb, rgbToHex } from './engine'

// Anteprima di un pennello IMPORTATO (punta raster) nel pannello.
export function CustomBrushIcon({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { const c = ref.current; if (!c) return; const ctx = c.getContext('2d')!; ctx.clearRect(0, 0, c.width, c.height); drawCustomBrush(ctx, id, c.width / 2, c.height / 2, c.width / 2 - 1, '#5b4636', 1) }, [id])
  return <canvas ref={ref} width={30} height={30} className="max-w-full max-h-full" />
}

// Anteprima di un timbro decorativo nel pannello (mini canvas che riusa drawStamp).
export function MotifIcon({ motif }: { motif: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return
    const ctx = c.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    drawStamp(ctx, motif, c.width / 2, c.height / 2, 15, '#5b4636')
  }, [motif])
  return <canvas ref={ref} width={30} height={30} className="pointer-events-none" />
}

// Ruota colore HSB con anello + cursore + slider luminosità.
export function ColorWheel({ color, onChange }: { color: string; onChange: (hex: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [hsv, setHsv] = useState<[number, number, number]>(() => { const [r, g, b] = hexToRgb(color); return rgbToHsv(r, g, b) })
  const [h, s, v] = hsv
  const R = 82
  useEffect(() => {
    const [r, g, b] = hexToRgb(color); const c = hsvToRgb(h, s, v)
    if (Math.round(c[0]) !== r || Math.round(c[1]) !== g || Math.round(c[2]) !== b) setHsv(rgbToHsv(r, g, b))
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [color])
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return; const ctx = cvs.getContext('2d')!; const D = R * 2; const img = ctx.createImageData(D, D); const d = img.data
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const dx = x - R, dy = y - R, rr = Math.hypot(dx, dy), i = (y * D + x) * 4
      if (rr <= R) { const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, sat = rr / R; const [cr, cg, cb] = hsvToRgb(hue, sat, v); d[i] = cr; d[i + 1] = cg; d[i + 2] = cb; d[i + 3] = 255 } else d[i + 3] = 0
    }
    ctx.putImageData(img, 0, 0)
  }, [v])
  const pick = (e: React.PointerEvent) => {
    const cvs = ref.current!; const rect = cvs.getBoundingClientRect(); const x = e.clientX - rect.left - R, y = e.clientY - rect.top - R
    const rr = Math.min(R, Math.hypot(x, y)); const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360, sat = rr / R
    setHsv([hue, sat, v]); const [cr, cg, cb] = hsvToRgb(hue, sat, v); onChange(rgbToHex(cr, cg, cb))
  }
  const mx = R + Math.cos((h * Math.PI) / 180) * s * R, my = R + Math.sin((h * Math.PI) / 180) * s * R
  return (
    <div>
      <div className="relative mx-auto" style={{ width: R * 2, height: R * 2 }}>
        <canvas ref={ref} width={R * 2} height={R * 2} className="rounded-full cursor-crosshair" style={{ touchAction: 'none' }} onPointerDown={pick} onPointerMove={(e) => { if (e.buttons) pick(e) }} />
        <div className="absolute w-3 h-3 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ left: mx, top: my, background: color }} />
      </div>
      <label className="block text-[11px] text-[rgb(var(--fg-muted))] mt-1">Luminosità<input type="range" min={0} max={1} step={0.01} value={v} onChange={(e) => { const nv = Number(e.target.value); setHsv([h, s, nv]); const [cr, cg, cb] = hsvToRgb(h, s, nv); onChange(rgbToHex(cr, cg, cb)) }} className="w-full" /></label>
    </div>
  )
}
