import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Clock, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTimeline, useTimelineMutations } from '@/hooks/useWedding'
import { exportTableToPdf } from '@/lib/pdf-export'

export function TimelineTab({ entryId }: { entryId: string }) {
  const { data, isLoading } = useTimeline(entryId)
  const { add, update, remove } = useTimelineMutations(entryId)
  const [openNew, setOpenNew] = useState(false)
  const [draft, setDraft] = useState({ start_time: '', title: '', duration_min: '', location: '', is_critical: false })

  async function handleAdd() {
    if (!draft.title.trim()) return
    try {
      await add.mutateAsync({
        title: draft.title.trim(),
        start_time: draft.start_time || null,
        duration_min: draft.duration_min ? Number(draft.duration_min) : null,
        location: draft.location || null,
        is_critical: draft.is_critical,
        ord: (data?.length ?? 0) + 1,
      })
      setDraft({ start_time: '', title: '', duration_min: '', location: '', is_critical: false })
      setOpenNew(false)
      toast.success('Step aggiunto')
    } catch (e) { toast.error((e as Error).message) }
  }

  function exportPdf() {
    exportTableToPdf({
      title: 'Scaletta evento',
      subtitle: `${(data ?? []).length} momenti`,
      filename: 'scaletta-evento.pdf',
      columns: [
        { header: 'Ora', key: 'start_time', width: 22 },
        { header: 'Durata (min)', key: 'duration_min', width: 25 },
        { header: 'Step', key: 'title', width: 80 },
        { header: 'Luogo', key: 'location', width: 40 },
        { header: 'Critico', key: 'critico' },
      ],
      rows: (data ?? []).map((s: any) => ({
        ...s,
        start_time: s.start_time ?? '—',
        duration_min: s.duration_min ?? '',
        location: s.location ?? '',
        critico: s.is_critical ? 'SI' : '',
      })),
    })
  }

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-2xl">Scaletta evento</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Timeline minuto per minuto. Marca i momenti critici.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf}><Download size={14} /> PDF</Button>
          <Button variant="gold" onClick={() => setOpenNew(true)}>
            <Plus /> Nuovo step
          </Button>
        </div>
      </header>

      {openNew && (
        <Card className="p-5 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div className="space-y-1">
              <Label>Ora</Label>
              <Input type="time" value={draft.start_time} onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Cosa succede</Label>
              <Input value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Es. Cerimonia civile" />
            </div>
            <div className="space-y-1">
              <Label>Durata (min)</Label>
              <Input type="number" value={draft.duration_min} onChange={(e) => setDraft((d) => ({ ...d, duration_min: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Luogo</Label>
              <Input value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} placeholder="Villa Aurora" />
            </div>
            <div className="sm:col-span-5 flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-[rgb(var(--gold-500))]"
                  checked={draft.is_critical} onChange={(e) => setDraft((d) => ({ ...d, is_critical: e.target.checked }))} />
                Momento critico
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpenNew(false)}>Annulla</Button>
                <Button variant="gold" onClick={handleAdd}>Aggiungi</Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {isLoading && <p className="text-[rgb(var(--fg-subtle))]">Caricamento...</p>}
      {!isLoading && (data ?? []).length === 0 && (
        <Card className="p-12 text-center">
          <Clock size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <p className="text-[rgb(var(--fg-muted))]">Nessuna voce in scaletta. Aggiungi il primo momento.</p>
        </Card>
      )}

      <div className="relative">
        {/* timeline rail */}
        {(data ?? []).length > 0 && (
          <div className="absolute left-[5.5rem] top-0 bottom-0 w-px hidden sm:block" style={{ background: 'rgb(var(--border))' }} />
        )}
        <ul className="space-y-3">
          {(data ?? []).map((s: any, idx) => (
            <motion.li key={s.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card className={`p-4 sm:pl-28 relative ${s.is_critical ? 'ring-2 ring-[rgb(var(--rose-500))]/30' : ''}`}>
                <div className="sm:absolute sm:left-3 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-2 mb-2 sm:mb-0">
                  <span className="font-display text-lg tabular-nums" style={{ color: s.is_critical ? 'rgb(var(--rose-500))' : 'rgb(var(--gold-700))' }}>
                    {s.start_time?.slice(0, 5) ?? '—'}
                  </span>
                  <span className="sm:absolute sm:left-[5.25rem] sm:top-1/2 sm:-translate-y-1/2 inline-flex h-2.5 w-2.5 rounded-full hidden sm:inline-flex"
                    style={{ background: s.is_critical ? 'rgb(var(--rose-500))' : 'rgb(var(--gold-500))' }} />
                </div>
                <div className="flex items-start gap-3 justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium flex items-center gap-1">
                      {s.is_critical && <AlertTriangle size={14} className="text-[rgb(var(--rose-500))]" />}
                      {s.title}
                    </p>
                    <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">
                      {s.duration_min ? `${s.duration_min} min` : 'durata libera'}
                      {s.location && ` · ${s.location}`}
                      {s.supplier && ` · ${s.supplier.business_name ?? s.supplier.full_name}`}
                    </p>
                    {s.description && <p className="text-sm text-[rgb(var(--fg-muted))] mt-1">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" className="size-3 accent-[rgb(var(--rose-500))]"
                        checked={s.is_critical}
                        onChange={(e) => update.mutate({ id: s.id, patch: { is_critical: e.target.checked } })} />
                      critico
                    </label>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}><Trash2 size={14} /></Button>
                  </div>
                </div>
              </Card>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  )
}
