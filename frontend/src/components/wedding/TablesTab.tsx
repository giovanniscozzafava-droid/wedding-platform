import { useState } from 'react'
import { Plus, Trash2, Users, Download, Sparkles, Palette } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGuests, useTables, useTableMutations, useUpdateWedding, useWedding } from '@/hooks/useWedding'
import { exportTableToPdf } from '@/lib/pdf-export'
import { EditRowModal, type Field } from './EditRowModal'

const TABLE_NAMING_PRESETS: Record<string, string[]> = {
  Mare:    ['Tirreno', 'Ionio', 'Adriatico', 'Egeo', 'Atlantico', 'Pacifico', 'Caraibi', 'Mar Rosso', 'Mediterraneo', 'Mar Baltico', 'Mar Nero', 'Mar Caspio'],
  Città:   ['Roma', 'Parigi', 'Tokyo', 'New York', 'Londra', 'Barcellona', 'Lisbona', 'Vienna', 'Praga', 'Berlino', 'Marrakech', 'Bangkok'],
  Stelle:  ['Vega', 'Sirio', 'Antares', 'Andromeda', 'Cassiopea', 'Orione', 'Pegaso', 'Lyra', 'Polare', 'Aldebaran', 'Rigel', 'Capella'],
  Fiori:   ['Rosa', 'Peonia', 'Glicine', 'Lavanda', 'Ortensia', 'Magnolia', 'Tulipano', 'Gardenia', 'Bouganville', 'Iris', 'Mimosa', 'Calle'],
  Vini:    ['Brunello', 'Amarone', 'Barolo', 'Sassicaia', 'Tignanello', 'Chianti', 'Falanghina', 'Greco', 'Aglianico', 'Cirò', 'Negroamaro', 'Primitivo'],
  Musica:  ['Mozart', 'Verdi', 'Bach', 'Chopin', 'Beethoven', 'Vivaldi', 'Puccini', 'Brahms', 'Schubert', 'Wagner', 'Rossini', 'Bellini'],
  Libri:   ['Calvino', 'Pavese', 'Eco', 'Pasolini', 'Ferrante', 'Sciascia', 'Morante', 'Levi', 'Saba', 'Magris', 'Tabucchi', 'Ammaniti'],
  Colori:  ['Oro', 'Rame', 'Argento', 'Avorio', 'Salvia', 'Pesca', 'Rosa cipria', 'Blu notte', 'Verde bosco', 'Sabbia', 'Bordeaux', 'Lavanda'],
}
const NAMING_STYLES = Object.keys(TABLE_NAMING_PRESETS)

const THEME_PRESETS = [
  'Boho chic', 'Classic elegance', 'Rustic country', 'Coastal Mediterranean',
  'Black-tie gala', 'Garden & botanical', 'Vintage 50s', 'Minimal Scandi',
  'Sicilian heritage', 'Dolce vita', 'Tropical', 'Industrial loft',
]

const SHAPES = ['ROUND', 'SQUARE', 'RECT', 'HEAD', 'IMPERIALE']
const SHAPE_LABEL: Record<string, string> = {
  ROUND: 'Rotondo', SQUARE: 'Quadrato', RECT: 'Rettangolare',
  HEAD: 'Tavolo sposi (testa)', IMPERIALE: 'Imperiale (lungo)',
}

const TABLE_FIELDS: Field[] = [
  { type: 'number', key: 'table_no', label: 'Numero tavolo' },
  { type: 'text', key: 'label', label: 'Etichetta', placeholder: 'Es. Tavolo principale, Famiglia, ...' },
  { type: 'number', key: 'seats', label: 'Posti' },
  { type: 'select', key: 'shape', label: 'Forma', options: SHAPES.map((s) => ({ v: s, l: SHAPE_LABEL[s] ?? s })) },
]

export function TablesTab({ entryId }: { entryId: string }) {
  const { data: tables } = useTables(entryId)
  const { data: guests } = useGuests(entryId)
  const { data: wedding } = useWedding(entryId)
  const updateWedding = useUpdateWedding(entryId)
  const { add, update, remove } = useTableMutations(entryId)
  const [draft, setDraft] = useState({ table_no: '', label: '', seats: '8', shape: 'ROUND' })
  const [editTable, setEditTable] = useState<any | null>(null)
  const currentTheme = (wedding as any)?.theme ?? ''
  const currentStyle = (wedding as any)?.tables_naming_style ?? ''

  async function applyNamingPreset(style: string) {
    const names = TABLE_NAMING_PRESETS[style] ?? []
    if (!names.length) return
    const list = (tables ?? []) as any[]
    try {
      await updateWedding.mutateAsync({ tables_naming_style: style } as any)
      for (let i = 0; i < list.length; i++) {
        const nameForTable = names[i % names.length]
        await update.mutateAsync({ id: list[i].id, patch: { label: nameForTable } } as any)
      }
      toast.success(`Tema "${style}" applicato a ${list.length} tavoli`)
    } catch (e) { toast.error((e as Error).message) }
  }

  async function setTheme(theme: string) {
    try {
      await updateWedding.mutateAsync({ theme } as any)
      toast.success(`Tema matrimonio: ${theme}`)
    } catch (e) { toast.error((e as Error).message) }
  }

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

      <Card className="p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Palette size={14} className="text-[rgb(var(--gold-600))]" />
          <h3 className="font-medium">Tema evento & nomi tavoli</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">Tema evento</Label>
            <div className="flex flex-wrap gap-1.5">
              {THEME_PRESETS.map((t) => {
                const active = currentTheme === t
                return (
                  <button key={t} onClick={() => setTheme(t)}
                    className={`rounded-full px-2.5 py-1 text-xs border transition-colors ${active ? 'bg-[rgb(var(--gold-500))] text-[rgb(var(--bg))] border-transparent' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}
                    style={!active ? { borderColor: 'rgb(var(--border))' } : undefined}>
                    {t}
                  </button>
                )
              })}
            </div>
            {currentTheme && <p className="text-xs text-[rgb(var(--fg-subtle))]">Attivo: <strong>{currentTheme}</strong></p>}
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider">Nomi tavoli (preset)</Label>
            <div className="flex flex-wrap gap-1.5">
              {NAMING_STYLES.map((s) => {
                const active = currentStyle === s
                return (
                  <button key={s} onClick={() => applyNamingPreset(s)}
                    disabled={(tables ?? []).length === 0}
                    className={`rounded-full px-2.5 py-1 text-xs border transition-colors disabled:opacity-50 ${active ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-transparent' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}
                    style={!active ? { borderColor: 'rgb(var(--border))' } : undefined}>
                    <Sparkles size={10} className="inline mr-1" /> {s}
                  </button>
                )
              })}
            </div>
            {(tables ?? []).length === 0
              ? <p className="text-xs text-[rgb(var(--fg-subtle))]">Aggiungi prima dei tavoli, poi applica un preset di nomi.</p>
              : currentStyle && <p className="text-xs text-[rgb(var(--fg-subtle))]">Stile attivo: <strong>{currentStyle}</strong></p>}
          </div>
        </div>
      </Card>

      <Card className="p-4 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <Label>N.</Label>
            <Input type="number" value={draft.table_no} onChange={(e) => setDraft((d) => ({ ...d, table_no: e.target.value }))} placeholder="auto" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Etichetta</Label>
            <Input value={draft.label} onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))} placeholder="Tavolo principale, Familiari, ..." />
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
            <p className="text-[rgb(var(--fg-muted))]">Nessun tavolo creato. Inizia con il "Tavolo principale".</p>
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
