import { type FormEvent, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCollaboratingSuppliers } from '@/hooks/useCatalog'
import { useCreateEntry, useDeleteEntry, useUpdateEntry, type EntryWithParticipants } from '@/hooks/useCalendar'
import type { Database } from '@/lib/database.types'

type Status = Database['public']['Enums']['entry_status']

type Props = {
  entry: EntryWithParticipants | null
  defaultDate?: string
  onClose: () => void
}

export function EntryForm({ entry, defaultDate, onClose }: Props) {
  const create = useCreateEntry()
  const update = useUpdateEntry()
  const del = useDeleteEntry()
  const { data: collabs } = useCollaboratingSuppliers()

  const [form, setForm] = useState({
    title: entry?.title ?? '',
    client_name: entry?.client_name ?? '',
    client_email: entry?.client_email ?? '',
    date_from: entry?.date_from ?? defaultDate ?? new Date().toISOString().slice(0, 10),
    date_to: entry?.date_to ?? defaultDate ?? new Date().toISOString().slice(0, 10),
    status: (entry?.status ?? 'IN_TRATTATIVA') as Status,
    value_amount: entry?.value_amount?.toString() ?? '',
    notes: entry?.notes ?? '',
  })
  const [participants, setParticipants] = useState<string[]>(
    entry?.calendar_entry_participants?.map((p) => p.user_id) ?? [],
  )
  const [busy, setBusy] = useState(false)

  function toggleParticipant(id: string) {
    setParticipants((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const base = {
        title: form.title.trim(),
        client_name: form.client_name || null,
        client_email: form.client_email || null,
        date_from: form.date_from, date_to: form.date_to,
        status: form.status,
        value_amount: form.value_amount ? Number(form.value_amount) : null,
        notes: form.notes || null,
      }
      if (entry) {
        await update.mutateAsync({ id: entry.id, patch: base })
        toast.success('Evento aggiornato')
      } else {
        await create.mutateAsync({ entry: base, participantIds: participants })
        toast.success('Evento creato')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Errore')
    } finally { setBusy(false) }
  }

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 22, stiffness: 240 }}
          className="relative w-full max-w-lg max-h-[90vh] surface surface-lift overflow-hidden flex flex-col">
          <header className="flex justify-between items-center px-6 py-4 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
            <h2 className="font-display text-xl">{entry ? 'Modifica evento' : 'Nuovo evento'}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="close-entry-modal">
              <X size={18} />
            </Button>
          </header>
          <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto" data-testid="entry-form">
            <div className="space-y-1">
              <Label htmlFor="title">Titolo evento</Label>
              <Input id="title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="date_from">Dal</Label>
                <Input id="date_from" type="date" required value={form.date_from}
                  onChange={(e) => setForm((f) => ({ ...f, date_from: e.target.value, date_to: f.date_to < e.target.value ? e.target.value : f.date_to }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="date_to">Al</Label>
                <Input id="date_to" type="date" required value={form.date_to}
                  onChange={(e) => setForm((f) => ({ ...f, date_to: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="client_name">Cliente</Label>
                <Input id="client_name" value={form.client_name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="client_email">Email cliente</Label>
                <Input id="client_email" type="email" value={form.client_email ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="status">Stato</Label>
                <Select id="status" value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}>
                  <option value="IN_TRATTATIVA">In trattativa</option>
                  <option value="OPZIONATA">Opzionata</option>
                  <option value="CONFERMATA">Confermata</option>
                  <option value="RIFIUTATA">Rifiutata</option>
                  <option value="CANCELLATA">Cancellata</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="value_amount">Valore (€)</Label>
                <Input id="value_amount" type="number" step="0.01" value={form.value_amount}
                  onChange={(e) => setForm((f) => ({ ...f, value_amount: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Note private</Label>
              <Textarea id="notes" rows={3} value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            {!entry && (
              <div className="space-y-2">
                <Label>Fornitori coinvolti</Label>
                <div className="grid grid-cols-1 gap-1">
                  {(collabs ?? []).map((c: any) => {
                    const u = c.supplier
                    if (!u) return null
                    const active = participants.includes(u.id)
                    return (
                      <label key={u.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer text-sm transition-colors ${
                        active ? 'border-[rgb(var(--fg))] bg-[rgb(var(--bg-sunken))]' : 'border-[rgb(var(--border))]'
                      }`}>
                        <input type="checkbox" className="size-4 accent-[rgb(var(--gold-500))]"
                          checked={active} onChange={() => toggleParticipant(u.id)} />
                        <span className="flex-1">
                          <strong>{u.business_name ?? u.full_name}</strong>
                          {u.subrole && <span className="text-[rgb(var(--fg-subtle))]"> · {u.subrole}</span>}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              {entry && (
                <Button type="button" variant="destructive"
                  onClick={() => { if (confirm('Eliminare evento?')) { del.mutate(entry.id); onClose() } }}>
                  <Trash2 size={14} /> Elimina
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={onClose}>Annulla</Button>
                <Button type="submit" variant="gold" disabled={busy}>
                  {busy ? 'Salvataggio...' : entry ? 'Aggiorna' : 'Crea'}
                </Button>
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
