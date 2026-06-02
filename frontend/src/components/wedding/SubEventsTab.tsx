import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Trash2, PartyPopper, Heart, Camera, Coffee, Plane } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useSubEvents, useSubEventMutations } from '@/hooks/useWedding'

const KINDS: Array<{ key: string; label: string; icon: typeof PartyPopper }> = [
  { key: 'ADDIO_NUBILATO',    label: 'Addio al nubilato',  icon: PartyPopper },
  { key: 'ADDIO_CELIBATO',    label: 'Addio al celibato',  icon: PartyPopper },
  { key: 'PRE_WEDDING_SHOOT', label: 'Pre-wedding shoot',  icon: Camera },
  { key: 'ENGAGEMENT_PARTY',  label: 'Engagement party',   icon: Heart },
  { key: 'CENA_PROVE',        label: 'Cena prove',         icon: Coffee },
  { key: 'REHEARSAL',         label: 'Prova cerimonia',    icon: Heart },
  { key: 'WELCOME_DINNER',    label: 'Welcome dinner',     icon: Coffee },
  { key: 'BRUNCH_POST',       label: 'Brunch del giorno dopo', icon: Coffee },
  { key: 'HONEYMOON_DEPART',  label: 'Partenza luna di miele', icon: Plane },
  { key: 'BABY_SHOWER',       label: 'Baby shower',        icon: PartyPopper },
  { key: 'ALTRO',             label: 'Altro',              icon: PartyPopper },
]
const iconOf = (k: string) => KINDS.find((x) => x.key === k)?.icon ?? PartyPopper
const labelOf = (k: string) => KINDS.find((x) => x.key === k)?.label ?? k

export function SubEventsTab({ entryId }: { entryId: string }) {
  const { data } = useSubEvents(entryId)
  const { add, update, remove } = useSubEventMutations(entryId)
  const [draft, setDraft] = useState({
    kind: 'ADDIO_NUBILATO', title: '', date_at: '', location: '', capacity: '', budget: '', organizer: '',
  })

  async function handleAdd() {
    if (!draft.title.trim()) return
    try {
      await add.mutateAsync({
        ...draft,
        capacity: draft.capacity ? Number(draft.capacity) : null,
        budget: draft.budget ? Number(draft.budget) : null,
        date_at: draft.date_at || null,
      })
      setDraft({ kind: 'ADDIO_NUBILATO', title: '', date_at: '', location: '', capacity: '', budget: '', organizer: '' })
      toast.success('Sub-evento aggiunto')
    } catch (e) { toast.error((e as Error).message) }
  }

  const totalBudget = (data ?? []).reduce((s: number, e: any) => s + Number(e.budget ?? 0), 0)

  return (
    <div>
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl">Eventi accessori</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Addio al nubilato/celibato, cena prove, brunch post, pre-wedding shoot, luna di miele.</p>
        </div>
        <div className="flex gap-3">
          <Stat label="Eventi" value={data?.length ?? 0} />
          <Stat label="Budget" value={`€ ${totalBudget.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`} />
        </div>
      </header>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <Select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}>
            {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </Select>
          <Input className="sm:col-span-2" placeholder="Titolo" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          <Input type="datetime-local" value={draft.date_at} onChange={(e) => setDraft((d) => ({ ...d, date_at: e.target.value }))} />
          <Input placeholder="Località" value={draft.location} onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))} />
          <Input type="number" placeholder="€ budget" value={draft.budget} onChange={(e) => setDraft((d) => ({ ...d, budget: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 items-end">
          <Input placeholder="Organizzatore" value={draft.organizer} onChange={(e) => setDraft((d) => ({ ...d, organizer: e.target.value }))} />
          <Input type="number" placeholder="Capacità ospiti" value={draft.capacity} onChange={(e) => setDraft((d) => ({ ...d, capacity: e.target.value }))} />
          <Button variant="gold" onClick={handleAdd}><Plus /> Aggiungi evento</Button>
        </div>
      </Card>

      {(data ?? []).length === 0 && (
        <Card className="p-10 text-center">
          <PartyPopper size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <p className="text-[rgb(var(--fg-muted))]">Nessun sub-evento ancora.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(data ?? []).map((e: any, idx: number) => {
          const Icon = iconOf(e.kind)
          return (
            <motion.div key={e.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}>
              <Card className="p-5">
                <div className="flex items-start gap-3 mb-3">
                  <span className="inline-flex h-12 w-12 rounded-full items-center justify-center shrink-0"
                    style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                    <Icon size={20} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <Badge tone="sage">{labelOf(e.kind)}</Badge>
                    <h3 className="font-display text-lg mt-1.5">{e.title}</h3>
                    {e.date_at && (
                      <p className="text-xs text-[rgb(var(--fg-subtle))] mt-0.5">
                        {new Date(e.date_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(e.id)}><Trash2 size={14} /></Button>
                </div>
                {e.location && (
                  <p className="text-sm text-[rgb(var(--fg-muted))]">📍 {e.location}</p>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                  {e.budget && <span className="font-display tabular-nums">€ {Number(e.budget).toLocaleString('it-IT')}</span>}
                  <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2 text-xs"
                    value={e.status} onChange={(ev) => update.mutate({ id: e.id, patch: { status: ev.target.value } })}>
                    <option value="PIANIFICATO">Pianificato</option>
                    <option value="CONFERMATO">Confermato</option>
                    <option value="COMPLETATO">Completato</option>
                    <option value="CANCELLATO">Cancellato</option>
                  </select>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="surface px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className="font-display text-xl tabular-nums">{value}</p>
    </div>
  )
}
