import { type ReactNode, type ComponentProps, useEffect, useMemo, useRef, useState } from 'react'
import HTMLFlipBook from 'react-pageflip'
import { X, ChevronLeft, ChevronRight, Loader2, Download } from 'lucide-react'
import { loadPdf, renderPdfPageDataUrl, pdfPageAspect } from '@/lib/pdf'
import { RotateScreenGate } from '@/components/ui/RotateScreenGate'
import { Button } from '@/components/ui/button'

// Bottone (stile Button standard) che apre il visore sfogliabile. Ogni superficie
// (preventivo/contratto, cliente o fotografo) lo usa con una riga.
export function PdfViewButton({ pdfUrl, title, children, ...btn }: { pdfUrl: string; title?: string; children: ReactNode } & Omit<ComponentProps<typeof Button>, 'onClick'>) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button {...btn} onClick={() => setOpen(true)}>{children}</Button>
      {open && <PdfBookViewer pdfUrl={pdfUrl} title={title} onClose={() => setOpen(false)} />}
    </>
  )
}

// Visore PDF SFOGLIABILE (preventivo/contratto, anche A4) alla massima risoluzione possibile.
// - pagine renderizzate con pdf.js ad alta risoluzione (in base allo schermo × devicePixelRatio)
// - sfoglio virtuale con react-pageflip (ombre, drag/swipe, frecce, tastiera ←/→/Esc)
// - su smartphone in verticale: invito a girare lo schermo (RotateScreenGate)
// Usato sia lato CLIENTE (dashboard coppia) sia lato FOTOGRAFO (editor/lista).
export function PdfBookViewer({ pdfUrl, title, onClose }: { pdfUrl: string; title?: string; onClose: () => void }) {
  const [pages, setPages] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [aspect, setAspect] = useState(0.707)      // A4 verticale di default (w/h)
  const [err, setErr] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [narrow, setNarrow] = useState(typeof window !== 'undefined' ? window.innerWidth < 820 : false)
  const bookRef = useRef<any>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Carica il PDF e renderizza TUTTE le pagine ad alta risoluzione (progressivo).
  useEffect(() => {
    let alive = true
    setPages([]); setErr(null); setIdx(0); setTotal(0)
    // risoluzione lato lungo: schermo × DPR, con un tetto per non esplodere in memoria
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1.5
    const longEdge = typeof window !== 'undefined' ? Math.max(window.innerWidth, window.innerHeight) : 1400
    const maxDim = Math.min(2600, Math.round(longEdge * dpr))
    loadPdf(pdfUrl).then(async (doc) => {
      if (!alive) return
      const n = Math.min(doc.numPages, 40)
      setTotal(n)
      const a = await pdfPageAspect(doc, 1).catch(() => 0.707)
      if (alive) setAspect(a || 0.707)
      const urls: string[] = []
      for (let p = 1; p <= n; p++) {
        const u = await renderPdfPageDataUrl(doc, p, maxDim, 0.92).catch(() => '')
        if (!alive) return
        urls.push(u)
        setPages(urls.slice())
      }
    }).catch(() => { if (alive) setErr('Documento non caricabile') })
    return () => { alive = false }
  }, [pdfUrl])

  // Misura il contenitore + rileva schermo stretto (una pagina per volta).
  useEffect(() => {
    const measure = () => {
      setNarrow(window.innerWidth < 820)
      if (boxRef.current) { const r = boxRef.current.getBoundingClientRect(); setBox({ w: r.width, h: r.height }) }
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', measure)
    return () => { window.removeEventListener('resize', measure); window.removeEventListener('orientationchange', measure) }
  }, [])
  useEffect(() => { if (boxRef.current) { const r = boxRef.current.getBoundingClientRect(); setBox({ w: r.width, h: r.height }) } }, [pages.length])

  const flip = (d: number) => { const pf = bookRef.current?.pageFlip?.(); if (!pf) return; if (d > 0) pf.flipNext(); else pf.flipPrev() }

  // Tastiera: ←/→ sfoglia, Esc chiude.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') flip(-1)
      else if (e.key === 'ArrowRight') flip(1)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])

  const single = narrow
  // Dimensioni del foglio per riempire l'area disponibile mantenendo il rapporto pagina.
  const { leafW, leafH } = useMemo(() => {
    const W = Math.max(0, box.w - 16), H = Math.max(0, box.h - 16)
    if (!W || !H) return { leafW: 0, leafH: 0 }
    const cols = single ? 1 : 2
    let h = H, w = aspect * h
    if (w * cols > W) { w = W / cols; h = w / aspect }
    return { leafW: Math.floor(w), leafH: Math.floor(h) }
  }, [box, aspect, single])

  return (
    <div className="fixed inset-0 z-[95] bg-black/92 flex flex-col" role="dialog" aria-modal="true">
      <RotateScreenGate title="Gira il telefono"
        subtitle="Il documento si sfoglia molto meglio in orizzontale: ruota lo schermo (o allarga la finestra)." />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 h-12 shrink-0 text-white">
        <span className="text-sm font-medium truncate">{title ?? 'Documento'}</span>
        <div className="flex items-center gap-1.5">
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="grid place-items-center w-9 h-9 rounded-full hover:bg-white/10" title="Scarica il PDF"><Download size={17} /></a>
          <button onClick={onClose} className="grid place-items-center w-9 h-9 rounded-full hover:bg-white/10" title="Chiudi" aria-label="Chiudi"><X size={19} /></button>
        </div>
      </div>

      {/* Area libro */}
      <div ref={boxRef} className="flex-1 min-h-0 relative flex items-center justify-center px-2 select-none">
        {err ? (
          <p className="text-white/80 text-sm">{err}</p>
        ) : pages.length === 0 ? (
          <div className="text-white/70 inline-flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={18} /> Preparo il documento…</div>
        ) : leafW > 0 ? (
          <>
            <HTMLFlipBook
              key={`${leafW}x${leafH}-${single}-${pages.length}`}
              ref={bookRef}
              startPage={0}
              size="fixed"
              width={leafW} height={leafH}
              minWidth={60} maxWidth={3000} minHeight={60} maxHeight={3000}
              drawShadow maxShadowOpacity={0.4}
              flippingTime={600}
              usePortrait={single}
              startZIndex={0}
              autoSize={false}
              showCover={false}
              mobileScrollSupport={false}
              clickEventForward
              useMouseEvents
              swipeDistance={24}
              showPageCorners
              disableFlipByClick
              className="" style={{}}
              onFlip={(e: any) => setIdx(e?.data ?? 0)}
            >
              {pages.map((u, i) => (
                <div key={i} className="bg-white grid place-items-center overflow-hidden" style={{ width: leafW, height: leafH }}>
                  {u ? <img src={u} alt={`Pagina ${i + 1}`} className="max-w-full max-h-full object-contain" draggable={false} />
                     : <Loader2 className="animate-spin text-black/30" size={18} />}
                </div>
              ))}
            </HTMLFlipBook>
            <button onClick={() => flip(-1)} aria-label="Precedente" className="hidden sm:grid place-items-center absolute left-2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft size={24} /></button>
            <button onClick={() => flip(1)} aria-label="Successiva" className="hidden sm:grid place-items-center absolute right-2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight size={24} /></button>
          </>
        ) : null}
      </div>

      {/* Footer: contatore + rendering progressivo */}
      {pages.length > 0 && (
        <div className="h-9 shrink-0 flex items-center justify-center gap-2 text-white/70 text-xs">
          <span className="tabular-nums">Pagina {Math.min(idx + 1, total)} / {total}</span>
          {pages.length < total && <span className="inline-flex items-center gap-1 text-white/45"><Loader2 size={11} className="animate-spin" /> alta risoluzione…</span>}
        </div>
      )}
    </div>
  )
}
