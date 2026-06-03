import { useEffect, useRef, useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { useHelpMode } from '@/lib/helpMode'
import { HELP_CONTENT } from '@/lib/helpContent'

// Pallino "?" contestuale. Reso SOLO quando la modalità aiuto è attiva, così non
// disturba il layout normale. Click → popover con "a cosa serve / cosa farci".
export function HelpDot({ id, className = '' }: { id: string; className?: string }) {
  const { enabled } = useHelpMode()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  if (!enabled) return null
  const entry = HELP_CONTENT[id]

  return (
    <span ref={ref} className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
        aria-label={`Aiuto: ${entry?.title ?? id}`}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-white shadow ring-2 ring-white/70 animate-pulse"
        style={{ background: 'rgb(var(--gold-500))' }}
      >
        <HelpCircle size={13} />
      </button>
      {open && (
        <span
          role="dialog"
          className="absolute z-[80] left-1/2 top-7 -translate-x-1/2 w-64 rounded-xl border p-3 text-left shadow-2xl"
          style={{ background: 'rgb(var(--bg-elev))', borderColor: 'rgb(var(--gold-500))' }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="flex items-start justify-between gap-2 mb-1">
            <strong className="font-display text-sm leading-tight">{entry?.title ?? 'Aiuto'}</strong>
            <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false) }} aria-label="Chiudi" className="shrink-0 text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg))]">
              <X size={13} />
            </button>
          </span>
          <span className="block text-xs leading-relaxed" style={{ color: 'rgb(var(--fg-muted))' }}>
            {entry?.body ?? 'Spiegazione non ancora disponibile per questo elemento.'}
          </span>
        </span>
      )}
    </span>
  )
}

// Pulsante per attivare/disattivare la modalità aiuto (in alto nello shell).
export function HelpModeToggle({ compact = false }: { compact?: boolean }) {
  const { enabled, toggle } = useHelpMode()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? 'Disattiva aiuto' : 'Attiva aiuto: spiega ogni elemento'}
      className="inline-flex items-center gap-1.5 rounded-full transition-colors"
      style={{
        padding: compact ? '6px' : '6px 10px',
        background: enabled ? 'rgb(var(--gold-500))' : 'transparent',
        color: enabled ? 'white' : 'rgb(var(--fg-muted))',
        border: enabled ? '1px solid transparent' : '1px solid rgb(var(--border-strong))',
      }}
    >
      <HelpCircle size={16} />
      {!compact && <span className="text-xs font-medium">{enabled ? 'Aiuto attivo' : 'Aiuto'}</span>}
    </button>
  )
}
