import { useEffect, useRef, useState } from 'react'
import HTMLFlipBook from 'react-pageflip'
import { X, ChevronLeft, ChevronRight, Loader2, Check, ZoomIn, ZoomOut } from 'lucide-react'
import { loadPdf, renderPdfPageDataUrl, pdfPageAspect } from '@/lib/pdf'
import type { Hotspot } from '@/hooks/useAlbumCatalog'

// Visore PDF a SCHERMO INTERO con sfoglio 3D (react-pageflip), pensato per il DESKTOP:
// il cliente "esplode" il catalogo e lo sfoglia come un libro vero, cliccando i modelli.
export function PdfLightbox({ pdfUrl, hotspots, onPick, onClose }: {
  pdfUrl: string; hotspots: Hotspot[]; selectedId?: string | null; onPick: (h: Hotspot) => void; onClose: () => void
}) {
  const [imgs, setImgs] = useState<string[]>([])
  const [asp, setAsp] = useState(1)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState(0)
  const [zoom, setZoom] = useState(1)   // lente: ingrandisce per vedere meglio il modello
  const bookRef = useRef<any>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const doc = await loadPdf(pdfUrl)
        const a = await pdfPageAspect(doc, 1).catch(() => 0.75)
        if (alive) setAsp(a || 0.75)
        const out: string[] = []
        for (let p = 1; p <= doc.numPages; p++) {
          const u = await renderPdfPageDataUrl(doc, p, 1400).catch(() => '')
          out.push(u)
          if (alive) { setImgs([...out]); setProgress(Math.round((p / doc.numPages) * 100)) }
        }
      } catch { /* niente */ }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [pdfUrl])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') bookRef.current?.pageFlip?.()?.flipNext?.()
      if (e.key === 'ArrowLeft') bookRef.current?.pageFlip?.()?.flipPrev?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // dimensione del singolo foglio: due fogli affiancati devono stare nella finestra
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const availH = Math.max(300, vh - 120)
  let leafH = availH
  let leafW = leafH * asp
  if (leafW * 2 > vw - 80) { leafW = (vw - 80) / 2; leafH = leafW / asp }
  leafW = Math.round(leafW); leafH = Math.round(leafH)

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col items-center justify-center">
      <button onClick={onClose} className="absolute top-3 right-3 z-10 h-10 w-10 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><X size={20} /></button>

      {loading ? (
        <div className="text-white/80 flex flex-col items-center gap-3">
          <Loader2 className="animate-spin" size={28} />
          <span className="text-sm">Preparo il catalogo… {progress}%</span>
        </div>
      ) : imgs.length === 0 ? (
        <div className="text-white/70 text-sm">Catalogo non caricabile</div>
      ) : (
        <>
          <button onClick={() => bookRef.current?.pageFlip?.()?.flipPrev?.()} className="absolute left-3 z-10 h-12 w-12 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft size={24} /></button>

          {/* lente: zoom per vedere meglio il modello. Quando è ingrandito, il contenitore scorre. */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-white/10 backdrop-blur px-1.5 py-1">
            <button onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} className="h-8 w-8 grid place-items-center rounded-full text-white hover:bg-white/20" title="Riduci"><ZoomOut size={16} /></button>
            <span className="text-white/80 text-xs w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))} className="h-8 w-8 grid place-items-center rounded-full text-white hover:bg-white/20" title="Ingrandisci"><ZoomIn size={16} /></button>
          </div>

          <div className="overflow-auto max-w-[96vw] max-h-[86vh] flex" onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom((z) => Math.min(3, Math.max(1, +(z - Math.sign(e.deltaY) * 0.15).toFixed(2)))) } }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform .15s ease', margin: 'auto' }}>
          {/* @ts-expect-error react-pageflip typings are loose */}
          <HTMLFlipBook ref={bookRef} width={leafW} height={leafH} size="fixed" minWidth={200} maxWidth={3000} minHeight={200} maxHeight={3000}
            showCover={false} drawShadow maxShadowOpacity={0.5} flippingTime={700} usePortrait={vw < 900} mobileScrollSupport={false} className="" style={{}}>
            {imgs.map((src, i) => (
              <div key={i} className="bg-white overflow-hidden" style={{ width: leafW, height: leafH }}>
                <div className="relative w-full h-full">
                  {src ? <img src={src} alt={`Pagina ${i + 1}`} className="w-full h-full object-contain" draggable={false} /> : <div className="grid place-items-center h-full text-neutral-300"><Loader2 className="animate-spin" /></div>}
                  {hotspots.filter((h) => h.page === i + 1 && h.catalog_id != null).map((h) => (
                    <button key={h.id ?? `${h.x}-${h.y}`} type="button" onClick={(e) => { e.stopPropagation(); onPick(h); onClose() }} title={h.label}
                      className="absolute rounded-lg border-2 border-[rgb(var(--gold-500))]/80 bg-[rgb(var(--gold-500))]/10 hover:bg-[rgb(var(--gold-500))]/25"
                      style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }}>
                      <span className="absolute -top-2.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-black/80 text-white whitespace-nowrap shadow">{h.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </HTMLFlipBook>
          </div>
          </div>
          <button onClick={() => bookRef.current?.pageFlip?.()?.flipNext?.()} className="absolute right-3 z-10 h-12 w-12 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight size={24} /></button>
          <p className="absolute bottom-3 text-white/70 text-xs flex items-center gap-1.5"><Check size={13} className="text-[rgb(var(--gold-400,212_175_55))]" /> Sfoglia con le frecce · lente in alto per ingrandire · clicca un riquadro per scegliere</p>
        </>
      )}
    </div>
  )
}
