import { useState } from 'react'
import { Siren } from '@/components/icons/lucide'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth'
import { useUpdateWedding } from '@/hooks/useWedding'

// Cadenze ammesse dal check constraint su calendar_entries.urgent_remind_every_hours.
const CADENZE = [
  { hours: 24, label: 'ogni 24 ore' },
  { hours: 48, label: 'ogni 48 ore' },
  { hours: 168, label: 'ogni 7 giorni' },
] as const

function giorniLabel(iso: string | null | undefined): string {
  if (!iso) return 'da oggi'
  const giorni = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))
  if (giorni <= 0) return 'da oggi'
  if (giorni === 1) return 'da 1 giorno'
  return `da ${giorni} giorni`
}

type WeddingUrgentFields = {
  id: string
  owner_id: string
  urgent?: boolean | null
  urgent_since?: string | null
  urgent_note?: string | null
  urgent_remind_every_hours?: number | null
}

// Controllo "Urgente" della scheda evento — SOLO owner (si autogate su
// user.id === wedding.owner_id, così il chiamante non deve duplicare il check).
// Effetti gestiti lato DB (vedi supabase/migrations/20260909120000_evento_urgente.sql):
// la lista eventi legge `urgent` per salire in cima, e il cron
// `urgent_reminders_due()` manda promemoria (in-app + email) finché resta true.
export function EventUrgentCard({ wedding }: { wedding: WeddingUrgentFields }) {
  const { user } = useAuth()
  const isOwner = !!user?.id && user.id === wedding.owner_id
  const update = useUpdateWedding(wedding.id)
  const on = !!wedding.urgent

  const [note, setNote] = useState(wedding.urgent_note ?? '')
  const [hours, setHours] = useState<number>(wedding.urgent_remind_every_hours ?? 24)
  const [dirty, setDirty] = useState(false)

  // Riallinea lo stato locale quando cambia l'evento (niente useEffect: si
  // aggiusta durante il render, come da guida React "adjusting state when a
  // prop changes" — evita il giro extra di render dell'effect).
  const [syncedId, setSyncedId] = useState(wedding.id)
  if (wedding.id !== syncedId) {
    setSyncedId(wedding.id)
    setNote(wedding.urgent_note ?? '')
    setHours(wedding.urgent_remind_every_hours ?? 24)
    setDirty(false)
  }

  if (!isOwner) return null

  async function toggle() {
    try {
      await update.mutateAsync({ urgent: !on })
      toast.success(!on ? 'Evento segnato come urgente' : 'Urgenza tolta: i promemoria si fermano')
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  async function save() {
    try {
      await update.mutateAsync({ urgent_note: note.trim() || null, urgent_remind_every_hours: hours })
      toast.success('Preferenze urgenza salvate')
      setDirty(false)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <Card className={cn('p-5', on && 'urgent-ring')} style={on ? { borderColor: 'rgb(var(--lacca))' } : undefined}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg mb-1 flex items-center gap-2">
            <Siren size={18} style={{ color: on ? 'rgb(var(--lacca))' : 'rgb(var(--gold-600))' }} />
            Evento urgente
          </h3>
          <p className="text-sm text-[rgb(var(--fg-muted))]">
            {on
              ? `Segnalato urgente ${giorniLabel(wedding.urgent_since)}: è in cima alla lista eventi e ti arriva un promemoria (in-app + email) finché resta urgente.`
              : 'Segna l’evento come urgente: sale in cima alla lista eventi e ricevi un promemoria periodico finché non lo disattivi.'}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Evento urgente"
          disabled={update.isPending}
          onClick={() => void toggle()}
          className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60"
          style={{ background: on ? 'rgb(var(--lacca))' : 'rgb(var(--border-strong))' }}
        >
          <span
            className="inline-block h-5 w-5 transform rounded-full bg-white transition"
            style={{ transform: on ? 'translateX(22px)' : 'translateX(4px)' }}
          />
        </button>
      </div>

      {on && (
        <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'rgb(var(--border))' }}>
          <div>
            <label htmlFor="urgent-note" className="text-xs text-[rgb(var(--fg-muted))]">Nota (facoltativa)</label>
            <textarea
              id="urgent-note"
              value={note}
              onChange={(e) => { setNote(e.target.value); setDirty(true) }}
              rows={2}
              placeholder="Perché è urgente…"
              className="mt-1 w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <label htmlFor="urgent-hours" className="text-xs text-[rgb(var(--fg-muted))]">Promemoria</label>
            <select
              id="urgent-hours"
              value={hours}
              onChange={(e) => { setHours(Number(e.target.value)); setDirty(true) }}
              className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg))] px-2 py-1.5 text-sm"
            >
              {CADENZE.map((c) => <option key={c.hours} value={c.hours}>{c.label}</option>)}
            </select>
            {dirty && (
              <Button size="sm" variant="lacca" onClick={() => void save()} disabled={update.isPending}>
                Salva
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

export default EventUrgentCard
