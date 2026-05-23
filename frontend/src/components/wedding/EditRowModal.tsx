import { useState, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type Field =
  | { type: 'text' | 'number' | 'date' | 'datetime-local' | 'tel' | 'email' | 'url'; key: string; label: string; placeholder?: string }
  | { type: 'textarea'; key: string; label: string; placeholder?: string; rows?: number }
  | { type: 'select'; key: string; label: string; options: Array<{ v: string; l: string }> }
  | { type: 'checkbox'; key: string; label: string }

type Props<T> = {
  open: boolean
  onClose: () => void
  title: string
  row: T
  fields: Field[]
  onSave: (patch: Partial<T>) => Promise<void> | void
  onDelete?: () => Promise<void> | void
}

export function EditRowModal<T extends Record<string, any>>({
  open, onClose, title, row, fields, onSave, onDelete,
}: Props<T>) {
  const [draft, setDraft] = useState<Record<string, any>>(row ?? {})
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) setDraft({ ...row }) }, [open, row])

  if (!open) return null

  async function save() {
    setBusy(true)
    try {
      await onSave(draft as Partial<T>)
      onClose()
    } finally { setBusy(false) }
  }

  async function del() {
    if (!onDelete) return
    if (!confirm('Eliminare definitivamente?')) return
    setBusy(true)
    try { await onDelete(); onClose() }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4">
      <div className="surface surface-lift w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-[rgb(var(--bg-elev))] z-10" style={{ borderColor: 'rgb(var(--border))' }}>
          <h2 className="font-display text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Chiudi" className="h-8 w-8 rounded-md hover:bg-[rgb(var(--bg-sunken))] flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`f-${f.key}`}>{f.label}</Label>
              {f.type === 'textarea' ? (
                <Textarea id={`f-${f.key}`} rows={(f as any).rows ?? 3}
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                  placeholder={(f as any).placeholder} />
              ) : f.type === 'select' ? (
                <Select id={`f-${f.key}`} value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value || null }))}>
                  <option value="">—</option>
                  {(f as any).options.map((o: any) => (<option key={o.v} value={o.v}>{o.l}</option>))}
                </Select>
              ) : f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!draft[f.key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.checked }))} />
                  <span>{f.label}</span>
                </label>
              ) : (
                <Input id={`f-${f.key}`} type={f.type}
                  value={draft[f.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: f.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value }))}
                  placeholder={(f as any).placeholder} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-2 p-4 border-t sticky bottom-0 bg-[rgb(var(--bg-elev))]" style={{ borderColor: 'rgb(var(--border))' }}>
          <div>
            {onDelete && (
              <Button variant="ghost" onClick={del} disabled={busy} className="text-[rgb(var(--rose-500))]">
                <Trash2 size={14} /> Elimina
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>Annulla</Button>
            <Button variant="gold" onClick={save} disabled={busy}>
              <Save size={14} /> {busy ? '…' : 'Salva'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
