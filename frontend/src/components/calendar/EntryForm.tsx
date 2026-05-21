import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [error, setError] = useState<string | null>(null)

  function toggleParticipant(id: string) {
    setParticipants((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const base = {
        title: form.title.trim(),
        client_name: form.client_name || null,
        client_email: form.client_email || null,
        date_from: form.date_from,
        date_to: form.date_to,
        status: form.status,
        value_amount: form.value_amount ? Number(form.value_amount) : null,
        notes: form.notes || null,
      }
      if (entry) {
        await update.mutateAsync({ id: entry.id, patch: base })
      } else {
        await create.mutateAsync({ entry: base, participantIds: participants })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore inatteso')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold">{entry ? 'Modifica evento' : 'Nuovo evento'}</h2>
          <Button variant="ghost" onClick={onClose} data-testid="close-entry-modal">Chiudi</Button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4" data-testid="entry-form">
          <div className="space-y-2">
            <Label htmlFor="title">Titolo evento</Label>
            <Input id="title" required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date_from">Dal</Label>
              <Input id="date_from" type="date" required value={form.date_from}
                onChange={(e) => setForm((f) => ({ ...f, date_from: e.target.value, date_to: f.date_to < e.target.value ? e.target.value : f.date_to }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_to">Al</Label>
              <Input id="date_to" type="date" required value={form.date_to}
                onChange={(e) => setForm((f) => ({ ...f, date_to: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="client_name">Nome cliente</Label>
              <Input id="client_name" value={form.client_name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_email">Email cliente</Label>
              <Input id="client_email" type="email" value={form.client_email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="status">Stato</Label>
              <select id="status" value={form.status}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as Status }))}>
                <option value="IN_TRATTATIVA">In trattativa</option>
                <option value="OPZIONATA">Opzionata</option>
                <option value="CONFERMATA">Confermata</option>
                <option value="RIFIUTATA">Rifiutata</option>
                <option value="CANCELLATA">Cancellata</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="value_amount">Valore (€)</Label>
              <Input id="value_amount" type="number" step="0.01" value={form.value_amount}
                onChange={(e) => setForm((f) => ({ ...f, value_amount: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Note private</Label>
            <textarea id="notes" rows={3} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          {!entry && (
            <div className="space-y-2">
              <Label>Fornitori coinvolti</Label>
              <div className="grid grid-cols-1 gap-2">
                {(collabs ?? []).map((c: any) => {
                  const u = c.supplier
                  if (!u) return null
                  return (
                    <label key={u.id} className={`flex items-center gap-2 rounded border px-3 py-2 cursor-pointer ${
                      participants.includes(u.id) ? 'border-slate-900 bg-slate-50' : 'border-slate-200'
                    }`}>
                      <input type="checkbox" checked={participants.includes(u.id)} onChange={() => toggleParticipant(u.id)} />
                      <span className="text-sm">
                        <strong>{u.business_name ?? u.full_name}</strong> {u.subrole && `(${u.subrole})`}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

          <div className="flex justify-between">
            {entry && (
              <Button type="button" variant="destructive" onClick={() => {
                if (confirm('Eliminare evento?')) { del.mutate(entry.id); onClose() }
              }}>Elimina</Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose}>Annulla</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Salvataggio...' : entry ? 'Aggiorna' : 'Crea'}</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
