import { useRef, useState } from 'react'

// Mockup 3D di un album (CSS 3D, niente WebGL): copertina con tessuto + foto + titolo, dorso e
// spessore pagine. Ruotabile col mouse. Usato nel configuratore (fotografo/coppia) e nella stamperia.
export type Cover = { model?: string; fabric?: string; color?: string; photo_url?: string | null; title?: string }

export const FABRICS: Array<{ key: string; label: string; swatch: string }> = [
  { key: 'lino', label: 'Lino', swatch: '#d9cdb8' },
  { key: 'velluto', label: 'Velluto', swatch: '#7d2b3a' },
  { key: 'pelle', label: 'Pelle', swatch: '#5a3a24' },
  { key: 'eco', label: 'Ecopelle', swatch: '#2b2b30' },
  { key: 'seta', label: 'Seta', swatch: '#c9b079' },
]
export const MODELS: Array<{ key: string; label: string }> = [
  { key: 'classic', label: 'Classico' },
  { key: 'box', label: 'Box cofanetto' },
  { key: 'layflat', label: 'Lay-flat' },
]

// texture del tessuto come gradiente CSS sopra il colore base
function fabricBg(fabric: string | undefined, color: string): string {
  switch (fabric) {
    case 'velluto': return `radial-gradient(120% 100% at 30% 0%, rgba(255,255,255,.22), rgba(0,0,0,.35)), ${color}`
    case 'pelle': return `repeating-radial-gradient(circle at 20% 30%, rgba(0,0,0,.10) 0 2px, transparent 2px 5px), linear-gradient(135deg, rgba(255,255,255,.10), rgba(0,0,0,.25)), ${color}`
    case 'seta': return `linear-gradient(115deg, rgba(255,255,255,.45), rgba(255,255,255,0) 40%), ${color}`
    case 'lino': return `repeating-linear-gradient(0deg, rgba(0,0,0,.045) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(0,0,0,.045) 0 1px, transparent 1px 3px), ${color}`
    default: return `linear-gradient(135deg, rgba(255,255,255,.06), rgba(0,0,0,.18)), ${color}`
  }
}

export function AlbumMockup({ cover, width = 280, interactive = true }: { cover: Cover; width?: number; interactive?: boolean }) {
  const [rot, setRot] = useState({ x: -12, y: -28 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const fabric = cover.fabric || 'lino'
  const color = cover.color || FABRICS.find((f) => f.key === fabric)?.swatch || '#d9cdb8'
  const bg = fabricBg(fabric, color)
  const depth = cover.model === 'box' ? 34 : 22
  const H = Math.round(width * 1.0)
  const light = ['lino', 'seta'].includes(fabric)
  const ink = light ? 'rgba(60,45,30,.85)' : 'rgba(255,255,255,.92)'

  function onMove(e: React.MouseEvent) {
    if (!drag.current) return
    setRot((r) => ({ x: Math.max(-35, Math.min(8, r.x - (e.clientY - drag.current!.y) * 0.4)), y: r.y + (e.clientX - drag.current!.x) * 0.4 }))
    drag.current = { x: e.clientX, y: e.clientY }
  }
  return (
    <div style={{ perspective: 1400, width, height: H + 40 }} className="grid place-items-center select-none"
      onMouseDown={(e) => interactive && (drag.current = { x: e.clientX, y: e.clientY })}
      onMouseUp={() => (drag.current = null)} onMouseLeave={() => (drag.current = null)} onMouseMove={onMove}>
      <div style={{ width, height: H, transformStyle: 'preserve-3d', transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`, transition: drag.current ? 'none' : 'transform .4s ease', cursor: interactive ? 'grab' : 'default' }}>
        {/* copertina (faccia frontale) */}
        <div style={{ position: 'absolute', inset: 0, transform: `translateZ(${depth / 2}px)`, background: bg, borderRadius: cover.model === 'box' ? 4 : 8, boxShadow: 'inset 0 0 40px rgba(0,0,0,.25), 0 30px 50px rgba(0,0,0,.35)', overflow: 'hidden' }}>
          {cover.model === 'box' && <div style={{ position: 'absolute', inset: 0, border: '6px double rgba(255,255,255,.25)', borderRadius: 4, margin: 10 }} />}
          {cover.photo_url
            ? <div style={{ position: 'absolute', left: '12%', right: '12%', top: '14%', bottom: '30%', backgroundImage: `url(${cover.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 6px 18px rgba(0,0,0,.45), 0 0 0 4px rgba(255,255,255,.85)' }} />
            : <div style={{ position: 'absolute', left: '14%', right: '14%', top: '16%', bottom: '32%', border: `2px dashed ${ink}`, opacity: .4, borderRadius: 4 }} />}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '12%', textAlign: 'center', color: ink, fontFamily: 'Georgia, serif', fontSize: width * 0.072, letterSpacing: 1, textShadow: light ? 'none' : '0 1px 2px rgba(0,0,0,.4)' }}>{cover.title || 'Marco & Anna'}</div>
        </div>
        {/* dorso (sinistra) */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: depth, height: '100%', transform: `rotateY(-90deg) translateZ(${depth / 2}px)`, transformOrigin: 'left center', background: bg, filter: 'brightness(.7)' }} />
        {/* spessore pagine (destra) */}
        <div style={{ position: 'absolute', top: 0, right: 0, width: depth, height: '100%', transform: `rotateY(90deg) translateZ(${width - depth / 2}px)`, transformOrigin: 'right center', background: 'repeating-linear-gradient(180deg, #fff 0 2px, #e7e2d8 2px 3px)' }} />
        {/* retro */}
        <div style={{ position: 'absolute', inset: 0, transform: `translateZ(${-depth / 2}px) rotateY(180deg)`, background: bg, filter: 'brightness(.8)', borderRadius: 8 }} />
        {/* sotto (spessore) */}
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: depth, transform: `rotateX(-90deg) translateZ(${depth / 2}px)`, transformOrigin: 'center bottom', background: 'repeating-linear-gradient(90deg, #fff 0 2px, #e7e2d8 2px 3px)' }} />
      </div>
    </div>
  )
}
