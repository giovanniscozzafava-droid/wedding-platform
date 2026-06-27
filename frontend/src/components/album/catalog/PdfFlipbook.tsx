import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2, Check, MapPin } from 'lucide-react'
import { loadPdf, renderPdfPageDataUrl, pdfPageAspect, type PdfDoc } from '@/lib/pdf'
import type { Hotspot } from '@/hooks/useAlbumCatalog'
import type { AlbumPin } from './PinThreadPanel'
import { RotateScreenGate } from '@/components/ui/RotateScreenGate'

// Sfoglio del PDF catalogo per la coppia: pagine renderizzate con pdf.js, avanti/indietro + swipe.
// Due modi per scegliere il modello: i riquadri HOTSPOT definiti dal fotografo (se ci sono) OPPURE
// — sempre — TOCCANDO la pagina si lascia un PIN sul punto che si vuole. Gira il telefono se serve.
export function PdfFlipbook({
  pdfUrl, hotspots, selected, onPick, onDropPin, pins, onOpenPin,
}: { pdfUrl: string; hotspots: Hotspot[]; selected?: Hotspot | null; onPick: (h: Hotspot) => void; onDropPin?: (page: number, x: number, y: number) => void; pins?: AlbumPin[]; onOpenPin?: (p: AlbumPin) => void }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [imgs, setImgs] = useState<Record<number, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [wide, setWide] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let alive = true
    setDoc(null); setImgs({}); setPage(1); setErr(null)
    loadPdf(pdfUrl).then(async (d) => {
      if (!alive) return
      setDoc(d); setTotal(d.numPages)
      const a = await pdfPageAspect(d, 1).catch(() => 1)
      setWide(a > 1.1) // catalogo orizzontale → il gate inviterà a girare lo schermo se in verticale
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
      <RotateScreenGate when={wide} title="Gira il telefono"
        subtitle="Il catalogo è in orizzontale: ruota lo schermo (o allarga la finestra) per sfogliarlo al meglio." />

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
          <div className="relative cursor-crosshair"
            onClick={(e) => {
              if (!onDropPin) return
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              const x = (e.clientX - rect.left) / rect.width
              const y = (e.clientY - rect.top) / rect.height
              if (x < 0 || x > 1 || y < 0 || y > 1) return
              onDropPin(page, x, y)
            }}>
            <img src={imgs[page]} alt={`Pagina ${page}`} className="block w-full h-auto" draggable={false} />
            {pageHotspots.map((h) => {
              const on = selected?.id && h.id === selected.id
              return (
                <button key={h.id ?? `${h.x}-${h.y}`} type="button" onClick={(e) => { e.stopPropagation(); onPick(h) }}
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
            {/* PIN persistenti del cliente: marker col commento; si tocca per aprire la conversazione */}
            {(pins ?? []).filter((p) => p.page === page).map((p) => {
              const chosen = p.status === 'CHOSEN' || p.id === selected?.id
              return (
                <button key={p.id} type="button" onClick={(e) => { e.stopPropagation(); onOpenPin?.(p) }}
                  className="absolute -translate-x-1/2 -translate-y-full drop-shadow-lg" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} title={p.comment ?? 'Apri'}>
                  <MapPin size={32} className={chosen ? 'text-emerald-600 fill-emerald-400' : 'text-[rgb(var(--gold-700))] fill-[rgb(var(--gold-500))]'} />
                  {p.comment && <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-1.5 px-1.5 py-0.5 rounded-md text-[10px] bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] whitespace-nowrap max-w-[130px] truncate shadow">{p.comment}</span>}
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
      <p className="text-[11px] text-[rgb(var(--fg-subtle))] mt-2 text-center inline-flex items-center justify-center gap-1 w-full">
        <MapPin size={12} className="text-[rgb(var(--gold-600))]" />
        {pageHotspots.length ? 'Tocca un riquadro, oppure tocca la pagina per lasciare un pin sul modello che vuoi.' : 'Tocca sulla pagina il modello che ti piace: lasci un pin lì.'}
      </p>
    </div>
  )
}
