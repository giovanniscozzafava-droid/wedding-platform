import { useEffect, useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { RotateCcw, RotateCw, FlipHorizontal2, FlipVertical2, X, Check, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { bakeFlips, getCroppedBlob, loadImage } from '@/lib/cropImage'

type Area = { x: number; y: number; width: number; height: number }

const ASPECTS: { label: string; value: number | undefined }[] = [
  { label: 'Libero', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:2', value: 3 / 2 },
  { label: '2:3', value: 2 / 3 },
  { label: '16:9', value: 16 / 9 },
]

// Editor foto NON distruttivo: messa in quadro (raddrizza), ruota, flip, crop.
// L'export è un Blob JPEG che il chiamante carica su storage (l'originale resta intatto).
export function PhotoEditorModal({ src, title, onClose, onSave }: {
  src: string
  title?: string
  onClose: () => void
  onSave: (blob: Blob) => Promise<void>
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)      // scatti di 90°
  const [straighten, setStraighten] = useState(0)  // raddrizza fine ±15°
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [aspect, setAspect] = useState<number | undefined>(undefined)
  const [pixels, setPixels] = useState<Area | null>(null)
  const [working, setWorking] = useState<string>(src)
  const [baseImg, setBaseImg] = useState<HTMLImageElement | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effRotation = ((rotation + straighten) % 360 + 360) % 360

  useEffect(() => {
    let alive = true
    setError(null)
    loadImage(src).then((img) => { if (alive) setBaseImg(img) })
      .catch(() => { if (alive) setError('Non riesco a caricare la foto per la modifica.') })
    return () => { alive = false }
  }, [src])

  // Applica i flip alla sorgente di lavoro (sempre CORS-clean) → WYSIWYG.
  useEffect(() => {
    let alive = true
    if (!baseImg) return
    if (!flipH && !flipV) { setWorking(src); return }
    void bakeFlips(baseImg, flipH, flipV).then((url) => { if (alive) setWorking(url) })
    return () => { alive = false }
  }, [baseImg, flipH, flipV, src])

  const onCropComplete = useCallback((_: Area, px: Area) => setPixels(px), [])

  function reset() {
    setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setStraighten(0)
    setFlipH(false); setFlipV(false); setAspect(undefined)
  }

  async function save() {
    if (!pixels) return
    setSaving(true); setError(null)
    try {
      const blob = await getCroppedBlob(working, pixels, effRotation, 0.92)
      await onSave(blob)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export non riuscito')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col" style={{ background: 'rgba(10,12,14,0.96)' }}>
      <div className="flex items-center justify-between px-4 py-3 text-white/90">
        <span className="text-sm font-medium truncate">{title ?? 'Modifica foto'}</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X size={20} /></button>
      </div>

      <div className="relative flex-1">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-center text-white/80 text-sm px-6">{error}</div>
        ) : (
          <Cropper
            image={working}
            crop={crop}
            zoom={zoom}
            rotation={effRotation}
            aspect={aspect}
            restrictPosition={false}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            zoomWithScroll
            minZoom={0.5}
            maxZoom={4}
          />
        )}
      </div>

      <div className="px-4 py-3 space-y-3" style={{ background: 'rgba(20,24,28,0.98)' }}>
        {/* Aspetto (proporzioni) */}
        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <button key={a.label} onClick={() => setAspect(a.value)}
              className={`text-xs px-3 py-1.5 rounded-full border ${aspect === a.value ? 'bg-white text-black border-transparent' : 'text-white/80 border-white/25 hover:bg-white/10'}`}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Raddrizza (messa in quadro) */}
        <div className="flex items-center gap-3 text-white/80 text-xs">
          <span className="w-20 shrink-0">Raddrizza</span>
          <input type="range" min={-15} max={15} step={0.5} value={straighten}
            onChange={(e) => setStraighten(Number(e.target.value))} className="flex-1 accent-white" />
          <span className="w-10 text-right tabular-nums">{straighten.toFixed(1)}°</span>
        </div>
        {/* Zoom */}
        <div className="flex items-center gap-3 text-white/80 text-xs">
          <span className="w-20 shrink-0">Zoom</span>
          <input type="range" min={0.5} max={4} step={0.01} value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-white" />
          <span className="w-10 text-right tabular-nums">{zoom.toFixed(1)}×</span>
        </div>

        {/* Azioni: ruota / flip / reset */}
        <div className="flex flex-wrap items-center gap-2">
          <IconBtn onClick={() => setRotation((r) => r - 90)} label="Ruota sx"><RotateCcw size={16} /></IconBtn>
          <IconBtn onClick={() => setRotation((r) => r + 90)} label="Ruota dx"><RotateCw size={16} /></IconBtn>
          <IconBtn onClick={() => setFlipH((v) => !v)} active={flipH} label="Specchia orizz."><FlipHorizontal2 size={16} /></IconBtn>
          <IconBtn onClick={() => setFlipV((v) => !v)} active={flipV} label="Specchia vert."><FlipVertical2 size={16} /></IconBtn>
          <IconBtn onClick={reset} label="Ripristina"><RefreshCw size={16} /></IconBtn>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} className="text-white/80 hover:bg-white/10">Annulla</Button>
            <Button variant="gold" onClick={() => void save()} disabled={saving || !pixels}>
              <Check size={15} /> {saving ? 'Esporto…' : 'Esporta modifica'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function IconBtn({ children, onClick, label, active }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`h-9 w-9 inline-flex items-center justify-center rounded-lg border ${active ? 'bg-white text-black border-transparent' : 'text-white/85 border-white/25 hover:bg-white/10'}`}>
      {children}
    </button>
  )
}
