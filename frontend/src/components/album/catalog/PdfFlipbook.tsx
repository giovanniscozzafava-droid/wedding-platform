import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCw, Loader2, Check } from 'lucide-react'
import { loadPdf, renderPdfPageDataUrl, pdfPageAspect, type PdfDoc } from '@/lib/pdf'
import type { Hotspot } from '@/hooks/useAlbumCatalog'

// Sfoglio del PDF catalogo per la coppia: pagine renderizzate con pdf.js, avanti/indietro
// + swipe, overlay HOTSPOT tappabili (riquadri definiti dal fotografo) → seleziona il modello.
// Suggerisce di girare il telefono se il catalogo è orizzontale e lo schermo è verticale.
export function PdfFlipbook({
  pdfUrl, hotspots, selectedId, onPick,
}: { pdfUrl: string; hotspots: Hotspot[]; selectedId?: string | null; onPick: (h: Hotspot) => void }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [imgs, setImgs] = useState<Record<number, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [rotateHint, setRotateHint] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let alive = true
    setDoc(null); setImgs({}); setPage(1); setErr(null)
    loadPdf(pdfUrl).then(async (d) => {
      if (!alive) return
      setDoc(d); setTotal(d.numPages)
      const a = await pdfPageAspect(d, 1).catch(() => 1)
      const portrait = window.innerHeight > window.innerWidth
      setRotateHint(a > 1.1 && portrait)
    }).catch(() => alive && setErr('Catalogo non caricabile'))
    return () => { alive = false }
  }, [pdfUrl])

  useEffect(() => {
    if (!doc || imgs[page]) return
    let alive = true
    renderPdfPageDataUrl(doc, page, 1500).then((u) => { if (alive) setImgs((m) => ({ ...m, [page]: u })) }).catch(() => {})
    // pre-render pagina successiva
    if (page + 1 <= total && !imgs[page + 1]) renderPdfPageDataUrl(doc, page + 1, 1500).then((u) => alive && setImgs((m) => ({ ...m, [page + 1]: u }))).catch(() => {})
    return () => { alive = false }
  }, [doc, page, total]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (d: number) => setPage((p) => Math.min(total || 1, Math.max(1, p + d)))
  const pageHotspots = hotspots.filter((h) => h.page === page)

  if (err) return <div className="grid place-items-center h-72 text-[rgb(var(--rose-700))] text-sm">{err}</div>

  return (
    <div className="select-none">
      {rotateHint && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-[rgb(var(--gold-300))] bg-[rgb(var(--gold-100))] px-3 py-2 text-sm text-[rgb(var(--fg))]">
          <RotateCw size={16} className="text-[rgb(var(--gold-600))] shrink-0" />
          Gira il telefono in orizzontale per sfogliare meglio il catalogo.
          <button onClick={() => setRotateHint(false)} className="ml-auto text-[rgb(var(--fg-subtle))] text-xs">ok</button>
        </div>
      )}

      <div
        className="relative w-full rounded-2xl overflow-hidden bg-[rgb(var(--bg-sunken))] border border-[rgb(var(--border))] shadow-[0_18px_50px_rgba(20,18,14,.16)]"
        onTouchStart={(e) => { touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY } }}
        onTouchEnd={(e) => {
          if (!touch.current) return
          const dx = e.changedTouches[0]!.clientX - touch.current.x
          const dy = e.changedTouches[0]!.clientY - touch.current.y
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
          touch.current = null
        }}
      >
        {imgs[page] ? (
          <div className="relative">
            <img src={imgs[page]} alt={`Pagina ${page}`} className="block w-full h-auto" draggable={false} />
            {pageHotspots.map((h) => {
              const on = selectedId && h.id === selectedId
              return (
                <button key={h.id ?? `${h.x}-${h.y}`} type="button" onClick={() => onPick(h)}
                  title={h.label}
                  className={`absolute rounded-lg border-2 transition-all ${on
                    ? 'border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-500))]/25 ring-2 ring-[rgb(var(--gold-300))]'
                    : 'border-[rgb(var(--gold-500))]/70 bg-[rgb(var(--gold-500))]/10 hover:bg-[rgb(var(--gold-500))]/20'}`}
                  style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }}>
                  <span className="absolute -top-2.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] whitespace-nowrap shadow">
                    {on && <Check size={10} className="inline mr-0.5 -mt-0.5" />}{h.label}
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="grid place-items-center h-80 text-[rgb(var(--fg-subtle))]"><Loader2 className="animate-spin" /></div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 mt-3">
        <button onClick={() => go(-1)} disabled={page <= 1}
          className="inline-flex items-center gap-1 text-sm px-3.5 py-2 rounded-xl border border-[rgb(var(--border))] disabled:opacity-40 hover:border-[rgb(var(--gold-300))] transition-colors">
          <ChevronLeft size={16} /> Indietro
        </button>
        <span className="text-xs text-[rgb(var(--fg-muted))]">Pagina {page} / {total || '…'}</span>
        <button onClick={() => go(1)} disabled={page >= total}
          className="inline-flex items-center gap-1 text-sm px-3.5 py-2 rounded-xl border border-[rgb(var(--border))] disabled:opacity-40 hover:border-[rgb(var(--gold-300))] transition-colors">
          Avanti <ChevronRight size={16} />
        </button>
      </div>
      {!!pageHotspots.length && (
        <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2 text-center">Tocca un riquadro sulla pagina per scegliere quel modello.</p>
      )}
    </div>
  )
}
