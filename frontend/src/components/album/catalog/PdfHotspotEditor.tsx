import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2, Loader2, MousePointerClick } from 'lucide-react'
import { loadPdf, renderPdfPageDataUrl, type PdfDoc } from '@/lib/pdf'
import { Input } from '@/components/ui/input'
import type { Hotspot } from '@/hooks/useAlbumCatalog'

// Editor hotspot lato fotografo: renderizza ogni pagina del PDF, ci si disegna sopra un
// riquadro (drag), lo si etichetta col nome del modello (+ formato/pagine default opz.).
// Coordinate salvate normalizzate 0..1 → indipendenti dalla risoluzione di render.
export function PdfHotspotEditor({
  pdfUrl, hotspots, onChange, onEditOptions,
}: { pdfUrl: string; hotspots: Hotspot[]; onChange: (h: Hotspot[]) => void; onEditOptions?: (i: number) => void }) {
  const [doc, setDoc] = useState<PdfDoc | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [imgs, setImgs] = useState<Record<number, string>>({})
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const start = useRef<{ x: number; y: number } | null>(null)
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  useEffect(() => {
    let alive = true
    loadPdf(pdfUrl).then((d) => { if (alive) { setDoc(d); setTotal(d.numPages) } }).catch(() => {})
    return () => { alive = false }
  }, [pdfUrl])

  useEffect(() => {
    if (!doc || imgs[page]) return
    let alive = true
    renderPdfPageDataUrl(doc, page, 1500).then((u) => alive && setImgs((m) => ({ ...m, [page]: u }))).catch(() => {})
    return () => { alive = false }
  }, [doc, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const norm = (e: React.PointerEvent) => {
    const r = wrapRef.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-hotspot]')) return // non iniziare se clicchi su un hotspot esistente
    e.preventDefault(); wrapRef.current!.setPointerCapture(e.pointerId)
    const p = norm(e); start.current = p; setRect({ x: p.x, y: p.y, w: 0, h: 0 })
  }
  const move = (e: React.PointerEvent) => {
    if (!start.current) return
    const p = norm(e); const s = start.current
    setRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }
  const up = () => {
    const r = rect; start.current = null; setRect(null)
    if (!r || r.w < 0.03 || r.h < 0.03) return // troppo piccolo = ignora
    onChange([...hotspots, { page, x: r.x, y: r.y, w: r.w, h: r.h, label: 'Modello', default_format: null, default_pages: null }])
  }

  const pageHs = hotspots.map((h, i) => ({ h, i })).filter(({ h }) => h.page === page)
  const update = (idx: number, patch: Partial<Hotspot>) => onChange(hotspots.map((h, i) => (i === idx ? { ...h, ...patch } : h)))
  const remove = (idx: number) => onChange(hotspots.filter((_, i) => i !== idx))

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-5 items-start">
      <div>
        <div className="flex items-center gap-2 mb-2 text-sm text-[rgb(var(--fg-muted))]">
          <MousePointerClick size={15} className="text-[rgb(var(--gold-600))]" />
          Trascina sul modello per creare un riquadro, poi dagli un nome a destra.
        </div>
        <div ref={wrapRef} className="relative w-full rounded-xl overflow-hidden border border-[rgb(var(--border))] bg-[rgb(var(--bg-sunken))] touch-none cursor-crosshair"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
          {imgs[page] ? <img src={imgs[page]} alt={`Pagina ${page}`} className="block w-full h-auto select-none" draggable={false} />
            : <div className="grid place-items-center h-80 text-[rgb(var(--fg-subtle))]"><Loader2 className="animate-spin" /></div>}
          {pageHs.map(({ h, i }) => (
            <div key={i} data-hotspot className="absolute border-2 border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-500))]/12 rounded-md"
              style={{ left: `${h.x * 100}%`, top: `${h.y * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` }}>
              <span className="absolute -top-2.5 left-1 px-1.5 py-0.5 rounded text-[10px] bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] whitespace-nowrap">{h.label}</span>
            </div>
          ))}
          {rect && (
            <div className="absolute border-2 border-dashed border-[rgb(var(--gold-600))] bg-[rgb(var(--gold-500))]/15 rounded"
              style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }} />
          )}
        </div>
        <div className="flex items-center justify-between gap-3 mt-3">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border border-[rgb(var(--border))] disabled:opacity-40"><ChevronLeft size={16} /> Prec</button>
          <span className="text-xs text-[rgb(var(--fg-muted))]">Pagina {page} / {total || '…'}</span>
          <button onClick={() => setPage((p) => Math.min(total || 1, p + 1))} disabled={page >= total}
            className="inline-flex items-center gap-1 text-sm px-3 py-2 rounded-lg border border-[rgb(var(--border))] disabled:opacity-40">Succ <ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Modelli su questa pagina · {pageHs.length}</p>
        {pageHs.length === 0 && <p className="text-sm text-[rgb(var(--fg-subtle))]">Nessun riquadro qui. Trascinane uno sulla pagina.</p>}
        {pageHs.map(({ h, i }) => (
          <div key={i} className="rounded-xl border border-[rgb(var(--border))] p-2.5 space-y-1.5 bg-[rgb(var(--bg))]">
            <div className="flex items-center gap-2">
              <Input value={h.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Nome modello" className="h-8 text-sm" />
              <button onClick={() => remove(i)} className="text-[rgb(var(--rose-700))] shrink-0" title="Elimina"><Trash2 size={15} /></button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Input value={h.default_format ?? ''} onChange={(e) => update(i, { default_format: e.target.value || null })} placeholder="Formato (opz.)" className="h-7 text-xs" />
              <Input type="number" value={h.default_pages ?? ''} onChange={(e) => update(i, { default_pages: e.target.value ? Number(e.target.value) : null })} placeholder="Pagine (opz.)" className="h-7 text-xs" />
              <Input type="number" value={h.cost ?? ''} onChange={(e) => update(i, { cost: e.target.value ? Number(e.target.value) : null })} placeholder="Costo € (listino)" className="h-7 text-xs" title="Quanto ti costa dal lab (l'AI lo legge dal PDF)" />
              <Input type="number" value={h.price ?? ''} onChange={(e) => update(i, { price: e.target.value ? Number(e.target.value) : null })} placeholder="Prezzo cliente €" className="h-7 text-xs" title="Prezzo di vendita = costo + ricarico" />
            </div>
            {h.cost != null && h.price != null && <p className="text-[10px] text-[rgb(var(--fg-subtle))] mt-1">Margine: € {Math.round(Number(h.price) - Number(h.cost))}</p>}
            {onEditOptions && <button onClick={() => onEditOptions(i)} className="mt-1.5 text-[11px] text-[rgb(var(--gold-700))] hover:underline">Opzioni (materiali, colori, logo, foto)…</button>}
          </div>
        ))}
      </div>
    </div>
  )
}
