import { useMemo, useState } from 'react'
import { X, Shuffle, LayoutGrid, ChevronLeft, ChevronRight } from 'lucide-react'

export type ShowItem = { id: string; thumb: string; full: string }

// Vista "mostra galleria": mosaico a colonne (Pinterest-style). Modalità CASUAL = foto mischiate e
// rimescolabili; ORDINATA = come caricate. Click su una foto → lightbox a tutto schermo con frecce.
export function GalleryShowcase({ items, title, onClose }: { items: ShowItem[]; title?: string; onClose: () => void }) {
  const [casual, setCasual] = useState(true)
  const [seed, setSeed] = useState(1)
  const [box, setBox] = useState<number | null>(null)

  const ordered = useMemo(() => {
    if (!casual) return items
    const a = items.slice()
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]!; a[i] = a[j]!; a[j] = t }
    return a
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, casual, seed])

  const nav = (d: number) => setBox((b) => (b === null ? b : (b + d + ordered.length) % ordered.length))

  return (
    <div className="fixed inset-0 z-50 overflow-auto" style={{ background: '#0c0a09' }}>
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-white/10 text-white" style={{ background: 'rgba(12,10,9,.85)', backdropFilter: 'blur(8px)' }}>
        <span className="font-display text-lg">{title || 'Galleria'} <span className="text-white/45 text-sm">· {items.length} foto</span></span>
        <div className="flex items-center gap-2">
          <button onClick={() => setCasual((c) => !c)} className="text-sm inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
            {casual ? <><Shuffle size={15} /> Casual</> : <><LayoutGrid size={15} /> Ordinata</>}
          </button>
          {casual && <button onClick={() => setSeed((s) => s + 1)} title="Rimescola" className="text-sm px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition"><Shuffle size={15} /></button>}
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition"><X size={20} /></button>
        </div>
      </div>

      <div className="p-3" style={{ columnGap: '8px', columnWidth: '230px' }}>
        {ordered.map((m, i) => (
          <button key={m.id + i} onClick={() => setBox(i)} className="block w-full mb-2 overflow-hidden rounded-lg group" style={{ breakInside: 'avoid' }}>
            <img src={m.thumb} loading="lazy" alt="" className="w-full block transition group-hover:opacity-90 group-hover:scale-[1.015]" />
          </button>
        ))}
        {items.length === 0 && <p className="text-white/50 text-center py-20">Nessuna foto da mostrare.</p>}
      </div>

      {box !== null && (
        <div className="fixed inset-0 z-20 grid place-items-center" style={{ background: 'rgba(0,0,0,.95)' }} onClick={() => setBox(null)}>
          <img src={ordered[box]!.full} alt="" className="max-h-[92vh] max-w-[94vw] object-contain rounded" onClick={(e) => e.stopPropagation()} />
          <button className="absolute top-4 right-4 text-white/80 hover:text-white" onClick={() => setBox(null)}><X size={26} /></button>
          <button className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2" onClick={(e) => { e.stopPropagation(); nav(-1) }}><ChevronLeft size={34} /></button>
          <button className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2" onClick={(e) => { e.stopPropagation(); nav(1) }}><ChevronRight size={34} /></button>
        </div>
      )}
    </div>
  )
}
