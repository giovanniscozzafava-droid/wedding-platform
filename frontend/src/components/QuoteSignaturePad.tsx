import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

type Props = {
  onChange: (dataUrl: string | null) => void
  height?: number
}

// Canvas firma touch/mouse compatibile. Esporta data URL PNG quando l'utente
// rilascia il pennello (debounced). onChange(null) se viene resettato.
export function QuoteSignaturePad({ onChange, height = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)
  const lastPtRef = useRef<{ x: number; y: number } | null>(null)
  const hasInkRef = useRef(false)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const cssW = canvas.offsetWidth
    canvas.width = cssW * ratio
    canvas.height = height * ratio
    const ctx = canvas.getContext('2d')!
    ctx.scale(ratio, ratio)
    // Sfondo bianco SOLIDO (atto legale, no trasparenza nel PNG esportato)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, cssW, height)
    // Tratto firma nero
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [height])

  function getPoint(e: MouseEvent | TouchEvent | PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const t = 'touches' in e ? e.touches[0] : null
    const clientX = t ? t.clientX : (e as MouseEvent).clientX
    const clientY = t ? t.clientY : (e as MouseEvent).clientY
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function start(e: any) {
    e.preventDefault()
    drawingRef.current = true
    lastPtRef.current = getPoint(e)
  }

  function move(e: any) {
    if (!drawingRef.current) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pt = getPoint(e)
    if (lastPtRef.current) {
      ctx.beginPath()
      ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y)
      ctx.lineTo(pt.x, pt.y)
      ctx.stroke()
    }
    lastPtRef.current = pt
    hasInkRef.current = true
    if (empty) setEmpty(false)
  }

  function end() {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastPtRef.current = null
    if (hasInkRef.current) {
      const canvas = canvasRef.current!
      onChange(canvas.toDataURL('image/png'))
    }
  }

  function reset() {
    const canvas = canvasRef.current!
    const ratio = window.devicePixelRatio || 1
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // Riempi nuovamente di bianco
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, canvas.width / ratio, canvas.height / ratio)
    ctx.strokeStyle = '#000000'
    hasInkRef.current = false
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className="relative rounded-lg border-2 border-dashed touch-none overflow-hidden"
        style={{ borderColor: '#25402F', background: '#FFFFFF' }}>
        <canvas ref={canvasRef}
          style={{ width: '100%', height: `${height}px`, display: 'block', cursor: 'crosshair', background: '#FFFFFF' }}
          onMouseDown={start as any} onMouseMove={move as any} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start as any} onTouchMove={move as any} onTouchEnd={end} />
        {empty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-sm italic" style={{ color: '#A59C8E' }}>
            Firma qui col dito o col mouse
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: '#6E6E6E' }}>La tua firma sarà allegata all'atto di accettazione.</p>
        {!empty && (
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <Trash2 size={13} /> Cancella
          </Button>
        )}
      </div>
    </div>
  )
}
