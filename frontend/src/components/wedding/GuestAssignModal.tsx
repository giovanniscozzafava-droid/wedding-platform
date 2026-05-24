import { useMemo, useState } from 'react'
import { X, Search, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Guest = { id: string; full_name: string; rsvp?: string | null; side?: string | null; group_label?: string | null }

type Props = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  guests: Guest[]
  assignedIds: Set<string>
  capacity?: number | null
  onConfirm: (selectedIds: string[]) => Promise<void>
  onUnassign: (guestId: string) => Promise<void>
}

export function GuestAssignModal({ open, onClose, title, subtitle, guests, assignedIds, capacity, onConfirm, onUnassign }: Props) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return guests.filter((g) => {
      if (assignedIds.has(g.id)) return false
      if (t && !g.full_name.toLowerCase().includes(t) && !(g.group_label ?? '').toLowerCase().includes(t)) return false
      return true
    }).sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [guests, q, assignedIds])

  const assigned = useMemo(() => guests.filter((g) => assignedIds.has(g.id)).sort((a, b) => a.full_name.localeCompare(b.full_name)), [guests, assignedIds])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function confirm() {
    if (selected.size === 0) { onClose(); return }
    setBusy(true)
    try {
      await onConfirm(Array.from(selected))
      setSelected(new Set())
      onClose()
    } finally { setBusy(false) }
  }

  if (!open) return null

  const remainingCap = capacity != null ? capacity - assigned.length - selected.size : null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[rgb(var(--bg-elev))] w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl border max-h-[92vh] flex flex-col"
        style={{ borderColor: 'rgb(var(--border))' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="min-w-0">
            <h3 className="font-display text-lg truncate">{title}</h3>
            <p className="text-xs text-[rgb(var(--fg-subtle))] truncate">
              {subtitle ?? `${assigned.length} assegnati`}
              {capacity != null && <span> · capienza {assigned.length + selected.size}/{capacity}</span>}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-[rgb(var(--bg-sunken))]"><X size={16} /></button>
        </div>

        <div className="px-5 py-3 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca ospite..." className="pl-9" />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {assigned.length > 0 && (
            <div className="px-5 py-3 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Assegnati ({assigned.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {assigned.map((g) => (
                  <button key={g.id} onClick={() => onUnassign(g.id)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs bg-[rgb(var(--emerald-100))] text-[rgb(var(--emerald-700))] hover:bg-rose-100 hover:text-rose-700 transition-colors"
                    title="Click per rimuovere">
                    <Check size={11} /> {g.full_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="px-5 py-3">
            <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))] mb-2">Da assegnare ({filtered.length})</p>
            {filtered.length === 0 && <p className="text-xs text-[rgb(var(--fg-subtle))] py-4 text-center">Tutti gli ospiti sono già assegnati o filtrati.</p>}
            <ul className="space-y-1">
              {filtered.map((g) => {
                const isSel = selected.has(g.id)
                const overCap = capacity != null && remainingCap != null && remainingCap <= 0 && !isSel
                return (
                  <li key={g.id}>
                    <button type="button" onClick={() => { if (!overCap) toggle(g.id) }} disabled={overCap}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${isSel ? 'bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))]' : 'hover:bg-[rgb(var(--bg-sunken))]'} ${overCap ? 'opacity-40 cursor-not-allowed' : ''}`}>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${isSel ? 'border-white bg-white text-[rgb(var(--gold-500))]' : ''}`}
                          style={!isSel ? { borderColor: 'rgb(var(--border-strong))' } : undefined}>
                          {isSel && <Check size={10} />}
                        </span>
                        <span className="truncate">{g.full_name}</span>
                      </span>
                      <span className="text-xs opacity-70 ml-2 shrink-0">
                        {g.rsvp && <span>{g.rsvp}</span>}
                        {g.group_label && <span className="ml-1.5">{g.group_label}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
          <p className="text-xs text-[rgb(var(--fg-muted))]">
            {selected.size > 0 ? `${selected.size} selezionati` : 'Tocca gli ospiti da aggiungere'}
          </p>
          <Button variant="gold" onClick={confirm} disabled={busy || selected.size === 0}>
            {busy ? 'Assegno...' : `Assegna ${selected.size > 0 ? `(${selected.size})` : ''}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
