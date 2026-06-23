import { useEffect, useRef } from 'react'
import { coverDims, type Cover } from './albumCatalog'
import { CoverCanvas } from './albumCoverCanvas'

export function AlbumCover2DPreview({ cover, width = 320 }: { cover: Cover; width?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const painterRef = useRef<CoverCanvas | null>(null)

  useEffect(() => {
    const copy = () => {
      const painter = painterRef.current
      const visible = canvasRef.current
      if (!painter || !visible) return
      visible.width = painter.canvas.width
      visible.height = painter.canvas.height
      const ctx = visible.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, visible.width, visible.height)
      ctx.drawImage(painter.canvas, 0, 0)
    }
    painterRef.current = new CoverCanvas(copy)
    copy()
    return () => { painterRef.current = null }
  }, [])

  useEffect(() => {
    const painter = painterRef.current
    if (!painter) return
    const dim = coverDims(cover)
    painter.setAspect(dim.w / dim.h)
    painter.paint(cover)
  }, [cover])

  const dim = coverDims(cover)
  const h = Math.round(width * (dim.h / dim.w))

  return (
    <div className="w-full grid place-items-center">
      <canvas
        ref={canvasRef}
        style={{ width, height: h, maxWidth: '100%' }}
        className="block rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] shadow-[0_18px_45px_rgba(20,18,14,.18)]"
      />
    </div>
  )
}
