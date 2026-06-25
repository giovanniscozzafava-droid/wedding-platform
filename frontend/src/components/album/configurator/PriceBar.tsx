import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronUp, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { euro, type PriceBreakdown } from '../albumCatalog'

// Barra prezzo sticky in basso, sempre visibile: totale live + breakdown espandibile + CTA.
export function PriceBar({ price, busy, onSend }: { price: PriceBreakdown; busy: boolean; onSend: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="sticky bottom-0 z-30 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-elev))]/95 backdrop-blur-md shadow-[0_-8px_30px_rgba(20,18,14,.10)]">
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden border-b border-[rgb(var(--border))]"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 space-y-1">
              {price.lines.map((l, i) => (
                <div key={i} className="flex justify-between text-sm gap-3">
                  <span className="text-[rgb(var(--fg-muted))]">{l.label}</span>
                  <span className="whitespace-nowrap tabular-nums">{euro(l.amount)}</span>
                </div>
              ))}
              <p className="text-[10px] text-[rgb(var(--fg-subtle))] pt-1">Prezzi indicativi · IVA inclusa</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-col items-start min-w-0">
          <span className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] inline-flex items-center gap-1">
            Totale{price.copies > 1 ? ` · ${price.copies} copie` : ''}
            <ChevronUp size={12} className={`transition-transform ${open ? '' : 'rotate-180'}`} />
          </span>
          <span className="font-display text-2xl sm:text-3xl leading-none text-[rgb(var(--fg))] tabular-nums">{euro(price.total)}</span>
        </button>
        <Button variant="gold" size="lg" className="ml-auto flex-shrink-0" disabled={busy} onClick={onSend}>
          <Send size={16} /> {busy ? 'Invio…' : 'Invia in stampa'}
        </Button>
      </div>
    </div>
  )
}
