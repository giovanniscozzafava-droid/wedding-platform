import { useRef, useState } from 'react'
import { materialByKey, type Cover } from './albumCatalog'

// Mockup album leggero (CSS 3D, niente WebGL): anteprima usata nella coda
// stamperia (FotoLab). La tassonomia vive in ./albumCatalog. Per il configuratore
// della coppia si usa il vero 3D: ./AlbumMockup3D.
export type { Cover }

function lum(hex: string): number {
  const m = hex.replace('#', '')
  if (m.length < 6) return 0.8
  return (parseInt(m.slice(0, 2), 16) * 0.299 + parseInt(m.slice(2, 4), 16) * 0.587 + parseInt(m.slice(4, 6), 16) * 0.114) / 255
}

// gradiente CSS che richiama la grana del materiale sopra il colore base
function materialBg(texture: string | undefined, color: string): string {
  switch (texture) {
    case 'metal':
      return `linear-gradient(115deg, rgba(255,255,255,.5), rgba(255,255,255,0) 45%), ${color}`
    case 'juta':
      return `repeating-linear-gradient(0deg, rgba(0,0,0,.07) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgba(0,0,0,.07) 0 1px, transparent 1px 4px), ${color}`
    case 'crazy':
      return `repeating-radial-gradient(circle at 30% 20%, rgba(0,0,0,.10) 0 2px, transparent 2px 6px), ${color}`
    case 'alcantara':
    case 'suade':
    case 'velu-arte':
    case 'soft-touch':
      return `radial-gradient(120% 100% at 30% 0%, rgba(255,255,255,.18), rgba(0,0,0,.22)), ${color}`
    default:
      return `linear-gradient(135deg, rgba(255,255,255,.08), rgba(0,0,0,.2)), ${color}`
  }
}

export function AlbumMockup({ cover, width = 280, interactive = true }: { cover: Cover; width?: number; interactive?: boolean }) {
  const [rot, setRot] = useState({ x: -12, y: -28 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const mat = materialByKey(cover.fabric)
  const color = cover.color || mat?.swatch || '#d9cdb8'
  const bg = materialBg(mat?.texture, color)
  const depth = 22
  const W = width, H = Math.round(width * 1.0)
  const light = lum(color) > 0.6
  const ink = light ? 'rgba(60,45,30,.85)' : 'rgba(255,255,255,.92)'

  function onMove(e: React.MouseEvent) {
    if (!drag.current) return
    setRot((r) => ({ x: Math.max(-35, Math.min(8, r.x - (e.clientY - drag.current!.y) * 0.4)), y: r.y + (e.clientX - drag.current!.x) * 0.4 }))
    drag.current = { x: e.clientX, y: e.clientY }
  }
  return (
    <div style={{ perspective: 1400, width: W, height: H + 40 }} className="grid place-items-center select-none"
      onMouseDown={(e) => interactive && (drag.current = { x: e.clientX, y: e.clientY })}
      onMouseUp={() => (drag.current = null)} onMouseLeave={() => (drag.current = null)} onMouseMove={onMove}>
      <div style={{ width: W, height: H, transformStyle: 'preserve-3d', transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`, transition: drag.current ? 'none' : 'transform .4s ease', cursor: interactive ? 'grab' : 'default' }}>
        <div style={{ position: 'absolute', inset: 0, transform: `translateZ(${depth / 2}px)`, background: bg, borderRadius: 8, boxShadow: 'inset 0 0 40px rgba(0,0,0,.25), 0 30px 50px rgba(0,0,0,.35)', overflow: 'hidden' }}>
          {cover.photo_url
            ? <div style={{ position: 'absolute', left: '12%', right: '12%', top: '14%', bottom: '30%', backgroundImage: `url(${cover.photo_url})`, backgroundSize: 'cover', backgroundPosition: 'center', boxShadow: '0 6px 18px rgba(0,0,0,.45), 0 0 0 4px rgba(255,255,255,.85)' }} />
            : <div style={{ position: 'absolute', left: '14%', right: '14%', top: '16%', bottom: '32%', border: `2px dashed ${ink}`, opacity: .4, borderRadius: 4 }} />}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: '12%', textAlign: 'center', color: ink, fontFamily: 'Georgia, serif', fontSize: width * 0.072, letterSpacing: 1, textShadow: light ? 'none' : '0 1px 2px rgba(0,0,0,.4)' }}>{cover.title || 'Marco & Anna'}</div>
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, width: depth, height: '100%', transform: `rotateY(-90deg) translateZ(${depth / 2}px)`, transformOrigin: 'left center', background: bg, filter: 'brightness(.7)' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: depth, height: '100%', transform: `rotateY(90deg) translateZ(${W - depth / 2}px)`, transformOrigin: 'right center', background: 'repeating-linear-gradient(180deg, #fff 0 2px, #e7e2d8 2px 3px)' }} />
        <div style={{ position: 'absolute', inset: 0, transform: `translateZ(${-depth / 2}px) rotateY(180deg)`, background: bg, filter: 'brightness(.8)', borderRadius: 8 }} />
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: depth, transform: `rotateX(-90deg) translateZ(${depth / 2}px)`, transformOrigin: 'center bottom', background: 'repeating-linear-gradient(90deg, #fff 0 2px, #e7e2d8 2px 3px)' }} />
      </div>
    </div>
  )
}
