import { useState } from 'react'
import { Plus, Trash2, Bus, Car, Plane, Train, Ship, MapPin, Download } from 'lucide-react'
import { exportTableToPdf } from '@/lib/pdf-export'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useTransport, useTransportMutations } from '@/hooks/useWedding'
import { EditRowModal, type Field as ModalField } from './EditRowModal'

const KINDS: Array<{ key: string; label: string; icon: typeof Bus }> = [
  { key: 'AUTO_SPOSI',       label: 'Auto sposi',     icon: Car },
  { key: 'PULMINO_NAVETTA',  label: 'Navetta',        icon: Bus },
  { key: 'AUTOBUS_GRUPPO',   label: 'Autobus gruppo', icon: Bus },
  { key: 'TRENO_GRUPPO',     label: 'Treno',          icon: Train },
  { key: 'VOLO_GRUPPO',      label: 'Volo',           icon: Plane },
  { key: 'AUTO_NOLEGGIO',    label: 'Auto noleggio',  icon: Car },
  { key: 'TAXI_NCC',         label: 'Taxi / NCC',     icon: Car },
  { key: 'BARCA',            label: 'Barca',          icon: Ship },
  { key: 'ALTRO',            label: 'Altro',          icon: Car },
]
const iconOf = (k: string) => KINDS.find((x) => x.key === k)?.icon ?? Car

const TRANSPORT_FIELDS: ModalField[] = [
  { type: 'select', key: 'kind', label: 'Tipo', options: KINDS.map((k) => ({ v: k.key, l: k.label })) },
  { type: 'text', key: 'label', label: 'Etichetta' },
  { type: 'text', key: 'provider', label: 'Provider' },
  { type: 'datetime-local', key: 'depart_at', label: 'Partenza' },
  { type: 'text', key: 'depart_from', label: 'Da' },
  { type: 'text', key: 'arrive_to', label: 'A' },
  { type: 'number', key: 'capacity', label: 'Capacità (posti)' },
  { type: 'number', key: 'passengers_count', label: 'Passeggeri attuali' },
  { type: 'number', key: 'cost', label: 'Costo €' },
  { type: 'text', key: 'flight_number', label: 'Numero volo' },
  { type: 'tel', key: 'contact_phone', label: 'Telefono contatto' },
]

export function TransportTab({ entryId }: { entryId: string }) {
  const { data } = useTransport(entryId)
  const { add, update, remove } = useTransportMutations(entryId)
  const [editT, setEditT] = useState<any | null>(null)
  const [draft, setDraft] = useState({
    kind: 'PULMINO_NAVETTA', label: '', provider: '',
    capacity: '', depart_at: '', depart_from: '', arrive_to: '', cost: '',
    flight_number: '',
  })

  async function handleAdd() {
    if (!draft.label.trim()) return
    try {
      await add.mutateAsync({
        ...draft,
        capacity: draft.capacity ? Number(draft.capacity) : null,
        cost: draft.cost ? Number(draft.cost) : null,
        depart_at: draft.depart_at || null,
      })
      setDraft({ kind: draft.kind, label: '', provider: '', capacity: '', depart_at: '', depart_from: '', arrive_to: '', cost: '', flight_number: '' })
      toast.success('Trasporto aggiunto')
    } catch (e) { toast.error((e as Error).message) }
  }

  const totalCapacity = (data ?? []).reduce((s: number, t: any) => s + (t.capacity ?? 0), 0)
  const totalPassengers = (data ?? []).reduce((s: number, t: any) => s + (t.passengers_count ?? 0), 0)
  const totalCost = (data ?? []).reduce((s: number, t: any) => s + Number(t.cost ?? 0), 0)

  function exportPdf() {
    exportTableToPdf({
      title: 'Trasporti',
      subtitle: `${data?.length ?? 0} mezzi · ${totalPassengers}/${totalCapacity} posti`,
      filename: 'trasporti.pdf',
      landscape: true,
      columns: [
        { header: 'Tipo', key: 'kind', width: 28 },
        { header: 'Etichetta', key: 'label', width: 55 },
        { header: 'Provider', key: 'provider', width: 40 },
        { header: 'Partenza', key: 'depart_at', width: 40 },
        { header: 'Da', key: 'depart_from', width: 35 },
        { header: 'Posti', key: 'cap' },
      ],
      rows: (data ?? []).map((t: any) => ({
        ...t,
        provider: t.provider ?? '',
        depart_at: t.depart_at ? new Date(t.depart_at).toLocaleString('it-IT') : '',
        depart_from: t.depart_from ?? '',
        cap: `${t.passengers_count ?? 0}/${t.capacity ?? '?'}`,
      })),
    })
  }

  return (
    <div>
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl">Trasporti</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Voli, autobus, pulmini, taxi NCC, barche. Pianifica tutta la mobilità ospiti.</p>
        </div>
        <div className="flex gap-3 items-center">
          <Stat label="Mezzi" value={data?.length ?? 0} />
          <Stat label="Posti" value={`${totalPassengers}/${totalCapacity}`} />
          <Stat label="Spesa" value={`€ ${totalCost.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`} />
          <Button variant="outline" onClick={exportPdf}><Download size={14} /> PDF</Button>
        </div>
      </header>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <Select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}>
            {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </Select>
          <Input className="sm:col-span-2" placeholder="Etichetta (es. Navetta Hotel → Villa)" value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} />
          <Input placeholder="Provider" value={draft.provider} onChange={(e) => setDraft((d) => ({ ...d, provider: e.target.value }))} />
          <Input type="number" placeholder="Capacità" value={draft.capacity} onChange={(e) => setDraft((d) => ({ ...d, capacity: e.target.value }))} />
          <Input type="number" placeholder="Costo €" value={draft.cost} onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-2">
          <Input type="datetime-local" placeholder="Partenza" value={draft.depart_at} onChange={(e) => setDraft((d) => ({ ...d, depart_at: e.target.value }))} />
          <Input placeholder="Da" value={draft.depart_from} onChange={(e) => setDraft((d) => ({ ...d, depart_from: e.target.value }))} />
          <Input placeholder="A" value={draft.arrive_to} onChange={(e) => setDraft((d) => ({ ...d, arrive_to: e.target.value }))} />
          {(draft.kind === 'VOLO_GRUPPO') && (
            <Input placeholder="Numero volo (es. AZ123)" value={draft.flight_number} onChange={(e) => setDraft((d) => ({ ...d, flight_number: e.target.value }))} />
          )}
        </div>
        <div className="flex justify-end mt-3">
          <Button variant="gold" onClick={handleAdd}><Plus /> Aggiungi trasporto</Button>
        </div>
      </Card>

      {(data ?? []).length === 0 && (
        <Card className="p-10 text-center">
          <Bus size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <p className="text-[rgb(var(--fg-muted))]">Nessun mezzo configurato.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(data ?? []).map((t: any) => {
          const Icon = iconOf(t.kind)
          return (
            <Card key={t.id} className="p-5 cursor-pointer hover:shadow-[var(--shadow-lift)] transition-shadow" onClick={() => setEditT(t)}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="inline-flex h-10 w-10 rounded-full items-center justify-center shrink-0"
                    style={{ background: 'rgb(var(--gold-100))', color: 'rgb(var(--gold-700))' }}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <Badge tone="sky">{t.kind}</Badge>
                    <h3 className="font-medium mt-1 truncate">{t.label}</h3>
                    {t.provider && <p className="text-xs text-[rgb(var(--fg-subtle))]">{t.provider}{t.flight_number && ` · ${t.flight_number}`}</p>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove.mutate(t.id) }}><Trash2 size={14} /></Button>
              </div>
              {t.depart_at && (
                <p className="text-sm text-[rgb(var(--fg-muted))]">
                  {new Date(t.depart_at).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
              {(t.depart_from || t.arrive_to) && (
                <p className="text-xs text-[rgb(var(--fg-subtle))] mt-1 flex items-center gap-1">
                  <MapPin size={11} /> {t.depart_from ?? '—'} → {t.arrive_to ?? '—'}
                </p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t text-sm" style={{ borderColor: 'rgb(var(--border))' }}>
                {t.capacity && <span className="text-[rgb(var(--fg-muted))]">Posti: <strong>{t.passengers_count ?? 0}/{t.capacity}</strong></span>}
                {t.cost && <span className="font-display tabular-nums">€ {Number(t.cost).toLocaleString('it-IT')}</span>}
              </div>
            </Card>
          )
        })}
      </div>

      <EditRowModal
        open={!!editT}
        onClose={() => setEditT(null)}
        title={editT?.label ?? 'Modifica trasporto'}
        row={editT ?? {}}
        fields={TRANSPORT_FIELDS}
        onSave={async (patch) => { if (editT) await update.mutateAsync({ id: editT.id, patch }) }}
        onDelete={async () => { if (editT) await remove.mutateAsync(editT.id) }}
      />
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
