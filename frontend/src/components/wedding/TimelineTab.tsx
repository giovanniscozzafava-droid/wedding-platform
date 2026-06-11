import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, Clock, AlertTriangle, Download, GripVertical, ArrowDownAZ } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTimeline, useTimelineMutations } from '@/hooks/useWedding'
import { timelinePreset } from '@/lib/timelinePresets'
import { exportTableToPdf } from '@/lib/pdf-export'
import { SectionRings } from '@/components/event/SectionRings'

// Un evento può sforare la mezzanotte: orari prima delle 05:00 contano come
// "giorno dopo" e vanno in CODA, non in testa. Senza questo, 00:30 (taglio torta)
// finirebbe prima delle 09:00 (preparativi) e la scaletta si sballa.
const ROLLOVER_HOUR = 5
function chronoMinutes(t?: string | null): number | null {
  if (!t) return null
  const [hh, mm] = String(t).split(':')
  const h = Number(hh), m = Number(mm)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const mins = h * 60 + m
  return h < ROLLOVER_HOUR ? mins + 24 * 60 : mins
}
/** Ordina cronologicamente (mezzanotte-aware). Le voci senza ora restano in coda per ord. */
function sortByTime(list: any[]): any[] {
  const timed = list.filter((it) => it.start_time)
  const untimed = list.filter((it) => !it.start_time)
  timed.sort((a, b) => (chronoMinutes(a.start_time) ?? 0) - (chronoMinutes(b.start_time) ?? 0))
  untimed.sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
  return [...timed, ...untimed]
}

export function TimelineTab({ entryId, eventKind }: { entryId: string; eventKind?: string | null }) {
  const { data, isLoading } = useTimeline(entryId)
  const { add, update, remove } = useTimelineMutations(entryId)
  const [openNew, setOpenNew] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const presets = timelinePreset(eventKind)
  async function addPreset(p: { start_time: string; title: string; duration_min?: number }) {
    try {
      await add.mutateAsync({ title: p.title, start_time: p.start_time || null, duration_min: p.duration_min ?? null, location: null, is_critical: false, ord: (data?.length ?? 0) + 1 } as any)
      toast.success(`"${p.title}" aggiunto`)
    } catch (e) { toast.error((e as Error).message) }
  }
  async function loadFullPreset() {
    setSeeding(true)
    try {
      let ord = (data?.length ?? 0)
      for (const p of presets) {
        ord += 1
        await add.mutateAsync({ title: p.title, start_time: p.start_time || null, duration_min: p.duration_min ?? null, location: null, is_critical: false, ord } as any)
      }
      toast.success('Scaletta tipo caricata')
    } catch (e) { toast.error((e as Error).message) }
    finally { setSeeding(false) }
  }
  const [draft, setDraft] = useState({ start_time: '', title: '', duration_min: '', location: '', is_critical: false })
  const [items, setItems] = useState<any[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)

  // Copia locale nell'ORDINE MANUALE (ord): così le voci spostate con la manina
  // restano dove le metti. Per riallineare cronologicamente c'è "Ordina per ora".
  useEffect(() => {
    const ordered = ((data ?? []) as any[]).slice().sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
    setItems(ordered)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

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

  /** Salva i nuovi ord sul DB (batch). */
  async function persistOrder(next: any[]) {
    setReordering(true)
    try {
      // Solo le righe che cambiano ord
      const updates = next.map((it, i) => ({ id: it.id, newOrd: i + 1, oldOrd: it.ord ?? 0 }))
        .filter((u) => u.newOrd !== u.oldOrd)
      for (const u of updates) {
        await update.mutateAsync({ id: u.id, patch: { ord: u.newOrd } } as any)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setReordering(false)
    }
  }

  /** Cambia l'ora di una voce: aggiorna il valore SENZA riordinare (ordine manuale). */
  async function changeTime(id: string, value: string) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, start_time: value || null } : it)))
    try {
      await update.mutateAsync({ id, patch: { start_time: value || null } } as any)
    } catch (e) { toast.error((e as Error).message) }
  }

  function onDragStart(idx: number) {
    setDragIdx(idx)
  }
  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setHoverIdx(idx)
  }
  async function onDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) { setDragIdx(null); setHoverIdx(null); return }
    const next = items.slice()
    const [moved] = next.splice(dragIdx, 1)
    if (moved) next.splice(idx, 0, moved)
    setItems(next)
    setDragIdx(null)
    setHoverIdx(null)
    await persistOrder(next)
  }
  function onDragEnd() {
    setDragIdx(null)
    setHoverIdx(null)
  }

  async function sortChronological() {
    // Mezzanotte-aware: gli orari dopo le 05:00 fanno fede, quelli notturni vanno in coda.
    const next = sortByTime(items)
    setItems(next)
    await persistOrder(next)
    toast.success('Scaletta riordinata per ora')
  }

  function exportPdf() {
    exportTableToPdf({
      title: 'Scaletta evento',
      subtitle: `${items.length} momenti`,
      filename: 'scaletta-evento.pdf',
      columns: [
        { header: 'Ora', key: 'start_time', width: 22 },
        { header: 'Durata (min)', key: 'duration_min', width: 25 },
        { header: 'Step', key: 'title', width: 80 },
        { header: 'Luogo', key: 'location', width: 40 },
        { header: 'Critico', key: 'critico' },
      ],
      rows: items.map((s: any) => ({
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
      <SectionRings entryId={entryId} keys={['timeline']} />
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-2xl">Scaletta evento</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Imposta l'ora di ogni voce: si riposiziona da sola in ordine cronologico, anche oltre la mezzanotte. Le voci senza ora le trascini a mano.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={sortChronological} disabled={reordering || items.length < 2}>
            <ArrowDownAZ size={14} /> Ordina per ora
          </Button>
          <Button variant="outline" onClick={exportPdf}><Download size={14} /> PDF</Button>
          <Button variant="gold" onClick={() => setOpenNew(true)}>
            <Plus /> Nuovo step
          </Button>
        </div>
      </header>

      {/* Momenti tipici pre-impostati: pianifica in pochi click */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--fg-muted))] flex-1">Momenti tipici · tocca per aggiungere</p>
          <Button variant="outline" size="sm" disabled={seeding} onClick={() => void loadFullPreset()}>
            <Plus size={13} className="mr-1" /> Carica scaletta tipo
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p.title} type="button" onClick={() => void addPreset(p)}
              className="px-2.5 py-1 rounded-full text-xs border hover:bg-[rgb(var(--bg-sunken))]"
              style={{ borderColor: 'rgb(var(--border))' }}>
              <span className="text-[rgb(var(--gold-700))] font-medium">{p.start_time}</span> {p.title}
            </button>
          ))}
        </div>
      </Card>

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
      {!isLoading && items.length === 0 && (
        <Card className="p-12 text-center">
          <Clock size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <p className="text-[rgb(var(--fg-muted))]">Nessuna voce in scaletta. Aggiungi il primo momento.</p>
        </Card>
      )}

      <div className="relative">
        {items.length > 0 && (
          <div className="absolute left-[5.5rem] top-0 bottom-0 w-px hidden sm:block" style={{ background: 'rgb(var(--border))' }} />
        )}
        <ul className="space-y-3">
          {items.map((s: any, idx) => {
            const isDragging = dragIdx === idx
            const isHoverTarget = hoverIdx === idx && dragIdx !== null && dragIdx !== idx
            return (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: isDragging ? 0.5 : 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                draggable
                onDragStart={() => onDragStart(idx)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={() => void onDrop(idx)}
                onDragEnd={onDragEnd}
                className={isHoverTarget ? 'ring-2 ring-[rgb(var(--gold-500))] rounded-xl' : ''}
              >
                <Card className={`p-4 sm:pl-28 relative ${s.is_critical ? 'ring-2 ring-[rgb(var(--rose-500))]/30' : ''} cursor-grab active:cursor-grabbing`}>
                  <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))] hidden sm:block" title="Trascina per spostare">
                    <GripVertical size={14} />
                  </span>
                  <div className="sm:absolute sm:left-7 sm:top-1/2 sm:-translate-y-1/2 flex items-center gap-2 mb-2 sm:mb-0">
                    <input
                      type="time"
                      value={s.start_time?.slice(0, 5) ?? ''}
                      onChange={(e) => void changeTime(s.id, e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      draggable={false}
                      title="Imposta l'ora: la voce si riposiziona da sola"
                      className="w-[5.5rem] bg-transparent border border-transparent hover:border-[rgb(var(--border))] focus:border-[rgb(var(--gold-500))] rounded-md px-1 py-0.5 font-display text-lg tabular-nums outline-none cursor-text"
                      style={{ color: s.is_critical ? 'rgb(var(--rose-500))' : 'rgb(var(--gold-700))' }}
                    />
                    <span className="sm:absolute sm:left-[4.75rem] sm:top-1/2 sm:-translate-y-1/2 inline-flex h-2.5 w-2.5 rounded-full hidden sm:inline-flex"
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
            )
          })}
        </ul>
      </div>
    </div>
  )
}
