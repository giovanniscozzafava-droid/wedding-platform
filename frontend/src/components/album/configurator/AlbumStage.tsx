import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, LayoutGrid, RotateCcw } from 'lucide-react'
import { AlbumMockup3D, type AlbumMockup3DHandle, type AlbumView } from '../AlbumMockup3D'
import { AlbumCover2DPreview } from '../AlbumCover2DPreview'
import { modelByKey, sizeByKey, type Cover } from '../albumCatalog'

const VIEWS: { key: AlbumView; label: string }[] = [
  { key: 'front', label: 'Fronte' },
  { key: 'three-quarter', label: '3/4' },
  { key: 'spine', label: 'Dorso' },
]

// Stage 3D eroe: album al centro su fondale studio caldo, viste rapide, e azioni
// secondarie discrete (sfoglia, tavola 2D in un cassetto — non in competizione col 3D).
export function AlbumStage({ cover, onFlip }: { cover: Cover; onFlip: () => void }) {
  const handleRef = useRef<AlbumMockup3DHandle>(null)
  const [view, setView] = useState<AlbumView>('three-quarter')
  const [show2D, setShow2D] = useState(false)

  const pickView = (v: AlbumView) => { setView(v); handleRef.current?.setView(v) }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative rounded-3xl overflow-hidden border border-[rgb(var(--border))] shadow-[0_18px_50px_rgba(20,18,14,.14)]"
        style={{ background: 'radial-gradient(120% 90% at 50% 18%, rgb(var(--bg-elev)) 0%, rgb(var(--bg-sunken)) 58%, rgb(var(--gold-100)/.5) 130%)' }}
      >
        <div className="aspect-[4/5] sm:aspect-square lg:aspect-[4/5] w-full">
          <AlbumMockup3D ref={handleRef} cover={cover} view={view} width={620} />
        </div>

        {/* viste rapide */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))]/90 backdrop-blur px-1.5 py-1 shadow">
          {VIEWS.map((v) => (
            <button key={v.key} type="button" onClick={() => pickView(v.key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${view === v.key ? 'bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))]' : 'text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg))]'}`}>
              {v.label}
            </button>
          ))}
          <button type="button" onClick={() => pickView('three-quarter')} aria-label="Ripristina vista" title="Ripristina vista"
            className="px-2 py-1 rounded-full text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg))] transition-colors">
            <RotateCcw size={13} />
          </button>
        </div>

        <span className="absolute top-3 left-3 text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] bg-[rgb(var(--bg-elev))]/70 backdrop-blur rounded-full px-2.5 py-1">
          trascina per girare · {sizeByKey(cover.sizeKey)?.label ?? ''}
        </span>
      </div>

      <p className="text-center text-sm text-[rgb(var(--fg-muted))] px-4">{modelByKey(cover.model)?.label}</p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onFlip}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] hover:border-[rgb(var(--gold-300))] transition-colors">
          <BookOpen size={14} /> Sfoglia l'album
        </button>
        <button type="button" onClick={() => setShow2D((s) => !s)}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-full border transition-colors ${show2D ? 'border-[rgb(var(--gold-500))] bg-[rgb(var(--gold-100))]' : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))] hover:border-[rgb(var(--gold-300))]'}`}>
          <LayoutGrid size={14} /> Tavola 2D
        </button>
      </div>

      <AnimatePresence initial={false}>
        {show2D && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="pt-1 pb-2">
              <AlbumCover2DPreview cover={cover} width={300} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
