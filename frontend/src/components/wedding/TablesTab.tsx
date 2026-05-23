import { useState } from 'react'
import { Plus, Trash2, Users, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGuests, useTables, useTableMutations } from '@/hooks/useWedding'
import { exportTableToPdf } from '@/lib/pdf-export'
import { EditRowModal, type Field } from './EditRowModal'

const SHAPES = ['ROUND', 'SQUARE', 'RECT', 'HEAD']

const TABLE_FIELDS: Field[] = [
  { type: 'number', key: 'table_no', label: 'Numero tavolo' },
  { type: 'text', key: 'label', label: 'Etichetta', placeholder: 'Es. Tavolo sposi, Famiglia, ...' },
  { type: 'number', key: 'seats', label: 'Posti' },
  { type: 'select', key: 'shape', label: 'Forma', options: SHAPES.map((s) => ({ v: s, l: s })) },
]

export function TablesTab({ entryId }: { entryId: string }) {
  const { data: tables } = useTables(entryId)
  const { data: guests } = useGuests(entryId)
  const { add, update, remove } = useTableMutations(entryId)
  const [draft, setDraft] = useState({ table_no: '', label: '', seats: '8', shape: 'ROUND' })
  const [editTable, setEditTable] = useState<any | null>(null)

  async function handleAdd() {
    try {
      await add.mutateAsync({
        table_no: draft.table_no ? Number(draft.table_no) : (tables?.length ?? 0) + 1,
        label: draft.label || null,
        seats: Number(draft.seats || 8),
        shape: draft.shape,
      })
      setDraft({ table_no: '', label: '', seats: '8', shape: 'ROUND' })
      toast.success('Tavolo aggiunto')
    } catch (e) { toast.error((e as Error).message) }
  }

  function guestsAt(tableId: string) {
    return (guests ?? []).filter((g: any) => g.table_id === tableId)
  }

  function exportPdf() {
    const rows: any[] = []
    for (const t of (tables ?? []) as any[]) {
      const seated = guestsAt(t.id)
      rows.push({ table: t.label ?? `Tavolo ${t.table_no}`, name: `── ${seated.length}/${t.seats} posti · ${t.shape}`, diet: '' })
      for (const g of seated) {
        rows.push({ table: '', name: g.full_name, diet: g.diet ?? '' })
      }
      rows.push({ table: '', name: '', diet: '' })
    }
    exportTableToPdf({
      title: 'Disposizione tavoli',
      subtitle: `${(tables ?? []).length} tavoli · ${(guests ?? []).filter((g: any) => g.table_id).length} invitati assegnati`,
      filename: 'tavoli.pdf',
      columns: [
        { header: 'Tavolo', key: 'table', width: 50 },
        { header: 'Invitato', key: 'name', width: 80 },
        { header: 'Dieta', key: 'diet' },
      ],
      rows,
    })
  }

  return (
    <div>
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-2xl">Disposizione tavoli</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Crea i tavoli e assegna gli invitati dalla scheda Invitati.</p>
        </div>
        <Button variant="outline" onClick={exportPdf}><Download size={14} /> PDF</Button>
      </header>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <Label>N.</Label>
            <Input type="number" value={draft.table_no} onChange={(e) => setDraft((d) => ({ ...d, table_no: e.target.value }))} placeholder="auto" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Etichetta</Label>
            <Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Sposi, Familiari, ..." />
          </div>
          <div className="space-y-1">
            <Label>Posti</Label>
            <Input type="number" value={draft.seats} onChange={(e) => setDraft((d) => ({ ...d, seats: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label>Forma</Label>
            <Select value={draft.shape} onChange={(e) => setDraft((d) => ({ ...d, shape: e.target.value }))}>
              {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>
        <div className="mt-3 text-right">
          <Button variant="gold" onClick={handleAdd}><Plus /> Aggiungi tavolo</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(tables ?? []).map((t: any) => {
          const seated = guestsAt(t.id)
          const free = (t.seats ?? 0) - seated.length
          return (
            <Card key={t.id} className="p-5 cursor-pointer hover:shadow-[var(--shadow-lift)] transition-shadow"
              onClick={() => setEditTable(t)}>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <p className="text-xs uppercase tracking-wider text-[rgb(var(--fg-subtle))]">Tavolo {t.table_no} · {t.shape}</p>
                  <h3 className="font-display text-lg mt-0.5">{t.label ?? `Tavolo ${t.table_no}`}</h3>
                </div>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); remove.mutate(t.id) }}><Trash2 size={14} /></Button>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-[rgb(var(--fg-muted))]" />
                <span className="text-sm">{seated.length} / {t.seats} posti</span>
                {free < 0 && <span className="text-xs text-[rgb(var(--rose-500))]">+{-free} sovraffolato</span>}
                {free > 0 && <span className="text-xs text-[rgb(var(--fg-subtle))]">{free} liberi</span>}
              </div>
              {seated.length > 0 && (
                <ul className="text-sm space-y-1">
                  {seated.map((g: any) => (
                    <li key={g.id} className="flex items-center justify-between">
                      <span>{g.full_name}</span>
                      <span className="text-xs text-[rgb(var(--fg-subtle))]">
                        {g.diet ? `· ${g.diet}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
        {(tables ?? []).length === 0 && (
          <Card className="p-10 col-span-full text-center">
            <p className="text-[rgb(var(--fg-muted))]">Nessun tavolo creato. Inizia con il "Tavolo Sposi".</p>
          </Card>
        )}
      </div>

      <EditRowModal
        open={!!editTable}
        onClose={() => setEditTable(null)}
        title={editTable ? `Tavolo ${editTable.table_no}` : 'Modifica tavolo'}
        row={editTable ?? {}}
        fields={TABLE_FIELDS}
        onSave={async (patch) => {
          if (!editTable) return
          await update.mutateAsync({ id: editTable.id, patch })
        }}
        onDelete={async () => {
          if (!editTable) return
          await remove.mutateAsync(editTable.id)
        }}
      />
    </div>
  )
}
