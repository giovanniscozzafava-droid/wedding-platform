import { useState } from 'react'
import { Plus, Trash2, CheckSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useTasks, useTaskMutations } from '@/hooks/useWedding'

const PHASES = [
  { key: '12_MESI',    label: '12 mesi prima' },
  { key: '6_MESI',     label: '6 mesi prima' },
  { key: '3_MESI',     label: '3 mesi prima' },
  { key: '1_MESE',     label: '1 mese prima' },
  { key: '1_SETTIMANA',label: 'Settimana evento' },
  { key: 'DAY_OF',     label: 'Giorno dell\'evento' },
  { key: 'GENERICA',   label: 'Generica' },
]

export function ChecklistTab({ entryId }: { entryId: string }) {
  const { data: tasks } = useTasks(entryId)
  const { add, update, remove } = useTaskMutations(entryId)
  const [draft, setDraft] = useState({ title: '', phase: '3_MESI', due_at: '' })

  function tasksByPhase(p: string) {
    return (tasks ?? []).filter((t: any) => t.phase === p)
  }

  async function addTask() {
    if (!draft.title.trim()) return
    try {
      await add.mutateAsync({ title: draft.title.trim(), phase: draft.phase, due_at: draft.due_at || null })
      setDraft({ title: '', phase: draft.phase, due_at: '' })
    } catch (e) { toast.error((e as Error).message) }
  }

  const done = (tasks ?? []).filter((t: any) => t.done).length
  const tot = tasks?.length ?? 0
  const pct = tot > 0 ? Math.round((done / tot) * 100) : 0

  return (
    <div>
      <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">Checklist matrimonio</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Task organizzati per fase. {done}/{tot} completati ({pct}%).</p>
        </div>
        <div className="flex-1 max-w-md">
          <div className="h-2 rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
            <div className="h-full bg-[rgb(var(--emerald-500))]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div className="sm:col-span-2"><Input placeholder="Nuovo task..." value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} /></div>
          <Select value={draft.phase} onChange={(e) => setDraft((d) => ({ ...d, phase: e.target.value }))}>
            {PHASES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </Select>
          <div className="flex gap-2">
            <Input type="date" value={draft.due_at} onChange={(e) => setDraft((d) => ({ ...d, due_at: e.target.value }))} />
            <Button variant="gold" size="icon" onClick={addTask}><Plus size={16} /></Button>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        {PHASES.map((p) => {
          const items = tasksByPhase(p.key)
          if (items.length === 0) return null
          return (
            <section key={p.key}>
              <h3 className="font-display text-lg mb-2">{p.label} <span className="text-xs text-[rgb(var(--fg-subtle))]">({items.length})</span></h3>
              <Card>
                <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                  {items.map((t: any) => (
                    <li key={t.id} className="px-4 py-3 flex items-center gap-3">
                      <input type="checkbox" className="size-4 accent-[rgb(var(--gold-500))]"
                        checked={t.done} onChange={(e) => update.mutate({ id: t.id, patch: { done: e.target.checked, done_at: e.target.checked ? new Date().toISOString() : null } })} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${t.done ? 'line-through text-[rgb(var(--fg-subtle))]' : ''}`}>{t.title}</p>
                        {t.due_at && <p className="text-xs text-[rgb(var(--fg-subtle))]">scadenza {new Date(t.due_at).toLocaleDateString('it-IT')}</p>}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}><Trash2 size={14} /></Button>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )
        })}
        {tot === 0 && (
          <Card className="p-10 text-center">
            <CheckSquare size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
            <p className="text-[rgb(var(--fg-muted))]">Nessun task ancora. Aggiungi il primo dalla casella sopra.</p>
          </Card>
        )}
      </div>
    </div>
  )
}
