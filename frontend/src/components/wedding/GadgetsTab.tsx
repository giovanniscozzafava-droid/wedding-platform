import { useState } from 'react'
import { Plus, Trash2, Gift, Package, Download } from 'lucide-react'
import { exportTableToPdf } from '@/lib/pdf-export'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useGadgets, useGadgetMutations } from '@/hooks/useWedding'

const KINDS = [
  { key: 'BOMBONIERA',      label: 'Bomboniera' },
  { key: 'CONFETTI',        label: 'Confetti' },
  { key: 'WELCOME_BAG',     label: 'Welcome bag' },
  { key: 'SAVE_THE_DATE',   label: 'Save the date' },
  { key: 'INVITO',          label: 'Inviti' },
  { key: 'MENU_STAMPATO',   label: 'Menù stampati' },
  { key: 'TABLEAU',         label: 'Tableau de mariage' },
  { key: 'SEGNAPOSTO',      label: 'Segnaposto' },
  { key: 'LIBRO_FIRME',     label: 'Libro firme' },
  { key: 'RINGRAZIAMENTO',  label: 'Thank you card' },
  { key: 'GADGET',          label: 'Gadget custom' },
  { key: 'ALTRO',           label: 'Altro' },
]
const STATUS = ['IDEA', 'APPROVATO', 'ORDINATO', 'RICEVUTO', 'CONSEGNATO']
const STATUS_TONE: Record<string, 'neutral' | 'amber' | 'sky' | 'sage' | 'emerald'> = {
  IDEA: 'neutral', APPROVATO: 'amber', ORDINATO: 'sky', RICEVUTO: 'sage', CONSEGNATO: 'emerald',
}

export function GadgetsTab({ entryId }: { entryId: string }) {
  const { data } = useGadgets(entryId)
  const { add, update, remove } = useGadgetMutations(entryId)
  const [draft, setDraft] = useState({
    kind: 'BOMBONIERA', name: '', quantity: '', unit_cost: '', quantity_basis: 'PER_GUEST', supplier_external: '',
  })

  async function handleAdd() {
    if (!draft.name.trim()) return
    try {
      await add.mutateAsync({
        ...draft,
        quantity: draft.quantity ? Number(draft.quantity) : 1,
        unit_cost: draft.unit_cost ? Number(draft.unit_cost) : null,
      })
      setDraft({ kind: 'BOMBONIERA', name: '', quantity: '', unit_cost: '', quantity_basis: 'PER_GUEST', supplier_external: '' })
      toast.success('Aggiunto')
    } catch (e) { toast.error((e as Error).message) }
  }

  const byKind = new Map<string, any[]>()
  for (const g of (data ?? []) as any[]) {
    const arr = byKind.get(g.kind) ?? []
    arr.push(g); byKind.set(g.kind, arr)
  }
  const totalCost = (data ?? []).reduce((s: number, g: any) => s + Number(g.total_cost ?? 0), 0)
  const ordered = (data ?? []).filter((g: any) => g.status === 'ORDINATO' || g.status === 'RICEVUTO' || g.status === 'CONSEGNATO').length

  function exportPdf() {
    exportTableToPdf({
      title: 'Bomboniere & gadget',
      subtitle: `${data?.length ?? 0} voci · €${totalCost.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`,
      filename: 'bomboniere-gadget.pdf',
      landscape: true,
      columns: [
        { header: 'Tipo', key: 'kind', width: 28 },
        { header: 'Nome', key: 'name', width: 65 },
        { header: 'Quantità', key: 'quantity', width: 25 },
        { header: 'Costo unit. €', key: 'unit_cost', width: 28 },
        { header: 'Totale €', key: 'total_cost', width: 25 },
        { header: 'Status', key: 'status' },
      ],
      rows: (data ?? []).map((g: any) => ({
        ...g,
        quantity: g.quantity ?? '',
        unit_cost: g.unit_cost ?? '',
        total_cost: g.total_cost ?? '',
        status: g.status ?? '',
      })),
    })
  }

  return (
    <div>
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl">Bomboniere · Gadget · Inviti</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Tutto il "merchandising" del matrimonio: bomboniere, confetti, welcome bag, save the date, inviti, tableau, segnaposto.</p>
        </div>
        <div className="flex gap-3 items-center">
          <Stat label="Voci" value={data?.length ?? 0} />
          <Stat label="Ordinate" value={ordered} />
          <Stat label="Spesa totale" value={`€ ${totalCost.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`} />
          <Button variant="outline" onClick={exportPdf}><Download size={14} /> PDF</Button>
        </div>
      </header>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
          <Select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}>
            {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </Select>
          <Input className="sm:col-span-2" placeholder="Nome / descrizione" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          <Input placeholder="Fornitore" value={draft.supplier_external} onChange={(e) => setDraft((d) => ({ ...d, supplier_external: e.target.value }))} />
          <Input type="number" placeholder="Quantità" value={draft.quantity} onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))} />
          <Input type="number" placeholder="€ unità" step="0.01" value={draft.unit_cost} onChange={(e) => setDraft((d) => ({ ...d, unit_cost: e.target.value }))} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 items-end">
          <Select value={draft.quantity_basis} onChange={(e) => setDraft((d) => ({ ...d, quantity_basis: e.target.value }))}>
            <option value="FLAT">Quantità fissa</option>
            <option value="PER_GUEST">× invitati</option>
            <option value="PER_TABLE">× tavoli</option>
          </Select>
          <span className="text-xs text-[rgb(var(--fg-subtle))] self-center">
            Suggerimento: bomboniere = × invitati · menu stampati = × invitati · tableau = quantità fissa · segnaposto = × invitati
          </span>
          <Button variant="gold" onClick={handleAdd}><Plus /> Aggiungi</Button>
        </div>
      </Card>

      {(data ?? []).length === 0 && (
        <Card className="p-10 text-center">
          <Gift size={28} className="mx-auto mb-3 text-[rgb(var(--fg-subtle))]" />
          <p className="text-[rgb(var(--fg-muted))]">Nessuna voce. Inizia con le bomboniere o gli inviti.</p>
        </Card>
      )}

      <div className="space-y-5">
        {KINDS.map((k) => {
          const items = byKind.get(k.key) ?? []
          if (items.length === 0) return null
          return (
            <section key={k.key}>
              <h3 className="font-display text-lg mb-2">{k.label} <span className="text-xs text-[rgb(var(--fg-subtle))]">({items.length})</span></h3>
              <Card>
                <ul className="divide-y" style={{ borderColor: 'rgb(var(--border))' }}>
                  {items.map((g: any) => (
                    <li key={g.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                      <Package size={16} className="text-[rgb(var(--fg-muted))]" />
                      <div className="flex-1 min-w-[180px]">
                        <p className="font-medium">{g.name}</p>
                        <p className="text-xs text-[rgb(var(--fg-subtle))]">
                          {g.supplier_external && `${g.supplier_external} · `}
                          {g.quantity} {g.quantity_basis === 'PER_GUEST' ? '× invitati' : g.quantity_basis === 'PER_TABLE' ? '× tavoli' : 'unità'}
                          {g.unit_cost && ` · € ${g.unit_cost}/u`}
                        </p>
                      </div>
                      <div className="text-right tabular-nums font-display">
                        € {Number(g.total_cost ?? 0).toLocaleString('it-IT')}
                      </div>
                      <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2 text-xs"
                        value={g.status} onChange={(e) => update.mutate({ id: g.id, patch: { status: e.target.value } })}>
                        {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <Badge tone={STATUS_TONE[g.status]}>{g.status}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(g.id)}><Trash2 size={14} /></Button>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
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
