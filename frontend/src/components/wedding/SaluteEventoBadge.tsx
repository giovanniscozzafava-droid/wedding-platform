// FASE 6.1 — Badge "salute evento"
//
// Mostra il livello di salute di un calendar_entry leggendo `v_salute_evento`.
// Colori: verde (OTTIMA / OK), giallo (ATTENZIONE), rosso (CRITICA).
// Tooltip mobile-friendly: tap su mobile, hover su desktop. Una sola riga
// con l'azione primaria implicita (apertura tooltip), >= 44px touch target.

import { useEffect, useRef, useState } from 'react'
import { Activity, AlertTriangle, CheckCircle2, AlertOctagon } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type SaluteLabel = 'OTTIMA' | 'OK' | 'ATTENZIONE' | 'CRITICA'

type Row = {
  entry_id: string
  evento_stato: string | null
  giorni_alla_data: number | null
  blocchi_aperti_count: number | null
  ultimo_audit_il: string | null
  salute_label: SaluteLabel | string | null
}

type Tone = { bg: string; fg: string; ring: string; Icon: typeof Activity; label: string }

const TONES: Record<SaluteLabel, Tone> = {
  OTTIMA: {
    bg: 'rgb(220 252 231)', // emerald-100
    fg: 'rgb(4 120 87)',    // emerald-700
    ring: 'rgb(167 243 208)',
    Icon: CheckCircle2,
    label: 'Salute ottima',
  },
  OK: {
    bg: 'rgb(220 252 231)',
    fg: 'rgb(4 120 87)',
    ring: 'rgb(167 243 208)',
    Icon: Activity,
    label: 'Salute OK',
  },
  ATTENZIONE: {
    bg: 'rgb(254 243 199)', // amber-100
    fg: 'rgb(180 83 9)',    // amber-700
    ring: 'rgb(253 224 71)',
    Icon: AlertTriangle,
    label: 'Attenzione',
  },
  CRITICA: {
    bg: 'rgb(254 226 226)', // rose-100
    fg: 'rgb(190 18 60)',   // rose-700
    ring: 'rgb(252 165 165)',
    Icon: AlertOctagon,
    label: 'Critica',
  },
}

function eventoStatoHumane(s: string | null | undefined): string {
  if (!s) return '—'
  return s.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase())
}

function giorniText(g: number | null | undefined): string {
  if (g == null) return 'data non definita'
  if (g === 0) return 'oggi'
  if (g === 1) return 'domani'
  if (g === -1) return 'ieri'
  if (g > 0) return `fra ${g} giorni`
  return `${Math.abs(g)} giorni fa`
}

type Size = 'sm' | 'md'

export function SaluteEventoBadge({
  entryId,
  size = 'md',
  className,
}: {
  entryId: string
  size?: Size
  className?: string
}) {
  const [row, setRow] = useState<Row | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    void (async () => {
      try {
        const { data, error } = await (supabase.from('v_salute_evento' as any) as any)
          .select('entry_id, evento_stato, giorni_alla_data, blocchi_aperti_count, ultimo_audit_il, salute_label')
          .eq('entry_id', entryId)
          .maybeSingle()
        if (error) {
          if (mounted) setRow(null)
        } else if (mounted) {
          setRow((data ?? null) as Row | null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [entryId])

  // Tap-outside per chiudere tooltip su mobile
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent | TouchEvent) {
      if (!ref.current) return
      const target = e.target as Node
      if (!ref.current.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [open])

  if (loading || !row) return null

  const label = ((row.salute_label as SaluteLabel) in TONES
    ? (row.salute_label as SaluteLabel)
    : 'OK') as SaluteLabel
  const tone = TONES[label]
  const Icon = tone.Icon

  const pad = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5'
  const text = size === 'sm' ? 'text-[11px]' : 'text-xs'
  const iconSize = size === 'sm' ? 12 : 14

  return (
    <div ref={ref} className={`relative inline-block ${className ?? ''}`}>
      <button
        type="button"
        aria-label={`${tone.label} — apri dettagli salute evento`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${pad} ${text} min-h-[28px]
          ring-1 transition-colors`}
        style={{ background: tone.bg, color: tone.fg, borderColor: tone.ring }}
      >
        <Icon size={iconSize} aria-hidden="true" />
        <span className="uppercase tracking-wider">{label}</span>
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute z-50 mt-2 left-0 sm:left-auto sm:right-0 w-[min(90vw,18rem)] rounded-lg border shadow-lg p-3 text-xs"
          style={{
            background: 'rgb(var(--bg-elev))',
            borderColor: 'rgb(var(--border))',
            color: 'rgb(var(--fg))',
          }}
        >
          <p className="font-medium text-sm mb-1" style={{ color: tone.fg }}>
            {tone.label}
          </p>
          <p className="text-[11px] text-[rgb(var(--fg-muted))] mb-1.5 leading-snug">
            Salute dell'evento: un colpo d'occhio su quanto è in ordine. Si basa su blocchi aperti (cose da sistemare), avvicinarsi della data e ultimo controllo automatico.
          </p>
          <dl className="space-y-1">
            <div className="flex justify-between gap-3">
              <dt className="text-[rgb(var(--fg-muted))]">Stato</dt>
              <dd className="font-medium text-right">{eventoStatoHumane(row.evento_stato)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[rgb(var(--fg-muted))]">Data evento</dt>
              <dd className="font-medium text-right">{giorniText(row.giorni_alla_data)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[rgb(var(--fg-muted))]">Blocchi aperti</dt>
              <dd className="font-medium text-right tabular-nums">{row.blocchi_aperti_count ?? 0}</dd>
            </div>
            {row.ultimo_audit_il && (
              <div className="flex justify-between gap-3">
                <dt className="text-[rgb(var(--fg-muted))]">Ultimo audit</dt>
                <dd className="font-medium text-right">
                  {new Date(row.ultimo_audit_il).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

export default SaluteEventoBadge
