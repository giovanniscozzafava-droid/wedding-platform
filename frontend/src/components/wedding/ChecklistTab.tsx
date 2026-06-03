import { useState } from 'react'
import { Plus, Trash2, CheckSquare, Download, Sparkles } from 'lucide-react'
import { exportTableToPdf } from '@/lib/pdf-export'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useTasks, useTaskMutations } from '@/hooks/useWedding'
import { CHECKLIST_PRESETS, PHASE_LABEL } from '@/lib/wedding-presets'

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

  async function importAllPresets() {
    if (!confirm(`Importi ${CHECKLIST_PRESETS.length} task standard? Salterò quelli già presenti.`)) return
    let n = 0
    try {
      for (const p of CHECKLIST_PRESETS) {
        const exists = (tasks ?? []).some((t: any) => t.title === p.title && t.phase === p.phase)
        if (!exists) { await add.mutateAsync({ title: p.title, phase: p.phase, description: p.description ?? null, due_at: null }); n++ }
      }
      toast.success(`${n} task aggiunte dal preset standard`)
    } catch (e) { toast.error((e as Error).message) }
  }

  async function importPhasePresets(phaseKey: any) {
    const presets = CHECKLIST_PRESETS.filter(p => p.phase === phaseKey)
    if (!presets.length) return
    let n = 0
    try {
      for (const p of presets) {
        const exists = (tasks ?? []).some((t: any) => t.title === p.title && t.phase === p.phase)
        if (!exists) { await add.mutateAsync({ title: p.title, phase: p.phase, description: p.description ?? null, due_at: null }); n++ }
      }
      toast.success(`${n}/${presets.length} task aggiunte per ${PHASE_LABEL[phaseKey as keyof typeof PHASE_LABEL]}`)
    } catch (e) { toast.error((e as Error).message) }
  }

  const done = (tasks ?? []).filter((t: any) => t.done).length
  const tot = tasks?.length ?? 0
  const pct = tot > 0 ? Math.round((done / tot) * 100) : 0

  function exportPdf() {
    const rows: any[] = []
    for (const p of PHASES) {
      const items = tasksByPhase(p.key)
      if (items.length === 0) continue
      rows.push({ phase: p.label, title: `── ${items.length} task ──`, done: '' })
      for (const t of items as any[]) {
        rows.push({ phase: '', title: t.title, done: t.done ? '✓' : '☐', due: t.due_at ?? '' })
      }
    }
    exportTableToPdf({
      title: 'Checklist evento',
      subtitle: `${done}/${tot} completati (${pct}%)`,
      filename: 'checklist.pdf',
      columns: [
        { header: 'Fase', key: 'phase', width: 35 },
        { header: 'Task', key: 'title', width: 110 },
        { header: 'Stato', key: 'done' },
      ],
      rows,
    })
  }

  return (
    <div>
      <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-2xl">Checklist evento</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Task organizzati per fase. {done}/{tot} completati ({pct}%).</p>
        </div>
        <Button variant="outline" onClick={exportPdf}><Download size={14} /> PDF</Button>
        <div className="flex-1 max-w-md">
          <div className="h-2 rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
            <div className="h-full bg-[rgb(var(--emerald-500))]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {/* Preset banner */}
      {(tasks?.length ?? 0) < 5 && (
        <Card className="p-4 mb-4" style={{ background: 'rgb(var(--bg-sunken))', borderColor: 'rgb(var(--gold-500))' }}>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-[rgb(var(--gold-600))]" />
            <p className="text-sm font-medium">Inizia da una checklist standard</p>
          </div>
          <p className="text-xs text-[rgb(var(--fg-muted))] mb-3">
            Importa {CHECKLIST_PRESETS.length} task organizzati per fase (12 mesi → giorno-X). Modificali e cancella quello che non ti serve.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="gold" size="sm" onClick={importAllPresets}>
              <Sparkles size={12} /> Importa checklist completa
            </Button>
            {(['12_MESI','6_MESI','3_MESI','1_MESE','1_SETTIMANA','DAY_OF'] as const).map((ph) => {
              const n = CHECKLIST_PRESETS.filter(p => p.phase === ph).length
              return (
                <button key={ph} onClick={() => importPhasePresets(ph)}
                  className="rounded-full px-2.5 py-1 text-xs font-medium border bg-[rgb(var(--bg-elev))] hover:bg-[rgb(var(--gold-500))] hover:text-[rgb(var(--bg))] hover:border-transparent transition-colors"
                  style={{ borderColor: 'rgb(var(--border))' }}>
                  {PHASE_LABEL[ph]} ({n})
                </button>
              )
            })}
          </div>
        </Card>
      )}

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
