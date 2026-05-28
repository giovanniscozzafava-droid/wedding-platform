import { useState } from 'react'
import { Plus, Trash2, Users, Download, Sparkles, Palette, UserPlus, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGuests, useGuestMutations, useTables, useTableMutations, useUpdateWedding, useWedding } from '@/hooks/useWedding'
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
// Numerati = "Tavolo 1, 2, 3..." (default, label = null)
// Libero    = nome custom scelto manualmente per ogni tavolo
// Gli altri sono preset tematici (Mare, Citta, Stelle, ...)
const NAMING_STYLES = ['Numerati', 'Libero', ...Object.keys(TABLE_NAMING_PRESETS)]

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
  const { update: updateGuest } = useGuestMutations(entryId)
  const [draft, setDraft] = useState({ table_no: '', label: '', seats: '8', shape: 'ROUND' })
  const [editTable, setEditTable] = useState<any | null>(null)
  const [assigningTable, setAssigningTable] = useState<any | null>(null)
  const currentTheme = (wedding as any)?.theme ?? ''
  const currentStyle = (wedding as any)?.tables_naming_style ?? ''

  async function applyNamingPreset(style: string) {
    const list = (tables ?? []) as any[]
    if (list.length === 0) {
      toast.error('Aggiungi prima dei tavoli')
      return
    }
    try {
      await updateWedding.mutateAsync({ tables_naming_style: style } as any)
      if (style === 'Numerati') {
        // Resetta tutte le etichette: i tavoli torneranno a mostrare "Tavolo {n}"
        for (const t of list) {
          if (t.label) await update.mutateAsync({ id: t.id, patch: { label: null } } as any)
        }
        toast.success(`${list.length} tavoli numerati`)
        return
      }
      if (style === 'Libero') {
        // Apri un prompt per ogni tavolo (in sequenza). L'utente decide nome custom.
        let changed = 0
        for (const t of list) {
          const current = t.label ?? `Tavolo ${t.table_no}`
          const ans = window.prompt(`Nome per il tavolo #${t.table_no}`, current)
          if (ans === null) break // utente ha annullato → interrompe ma mantiene quelli già rinominati
          const next = ans.trim() || null
          if (next !== t.label) {
            await update.mutateAsync({ id: t.id, patch: { label: next } } as any)
            changed++
          }
        }
        toast.success(`Rinominati ${changed} tavoli`)
        return
      }
      // Preset tematici (Mare, Città, Stelle, ...)
      const names = TABLE_NAMING_PRESETS[style] ?? []
      if (!names.length) return
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

  // Ospiti che dovrebbero essere a un tavolo ma non sono assegnati.
  // Includiamo solo confermati (YES) e in attesa (PENDING) e in forse (MAYBE),
  // escludiamo INFANT (non occupa posto a tavola).
  const unseated = (guests ?? []).filter((g: any) => {
    if (g.table_id) return false
    if ((g.rsvp ?? 'PENDING') === 'NO') return false
    if (g.age_group === 'INFANT') return false
    return true
  })
  const totalSeatsAvailable = (tables ?? []).reduce((s: number, t: any) => s + (t.seats ?? 0), 0)
  const totalSeated = (guests ?? []).filter((g: any) => g.table_id).reduce((s: number, g: any) => s + (g.party_size ?? 1), 0)
  const totalUnseatedSize = unseated.reduce((s: number, g: any) => s + (g.party_size ?? 1), 0)

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

      {/* Banner ospiti non ancora assegnati */}
      {(tables ?? []).length > 0 && (
        unseated.length === 0 ? (
          <Card className="p-3 mb-4 flex items-center gap-3" style={{ background: 'rgb(var(--bg-sunken))', borderColor: 'rgb(34 197 94 / 0.4)' }}>
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <p className="text-sm text-[rgb(var(--fg-muted))]">
              Tutti gli invitati sono seduti — <strong>{totalSeated}</strong> posti occupati su {totalSeatsAvailable} disponibili.
            </p>
          </Card>
        ) : (
          <Card className="p-4 mb-4 border-l-4" style={{ borderLeftColor: 'rgb(var(--amber-500))', background: 'rgb(var(--bg-sunken))' }}>
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-[rgb(var(--amber-500))] shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">
                  Mancano {unseated.length} {unseated.length === 1 ? 'invitato' : 'invitati'} ai tavoli
                  {totalUnseatedSize !== unseated.length && ` (${totalUnseatedSize} posti totali)`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {unseated.slice(0, 18).map((g: any) => (
                    <span key={g.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                      style={{ background: 'rgb(var(--bg-elev))', border: '1px solid rgb(var(--border))' }}>
                      {g.full_name}
                      {g.party_size > 1 && <span className="text-[rgb(var(--fg-subtle))]">×{g.party_size}</span>}
                      {g.age_group === 'CHILD' && '🧒'}
                      {g.rsvp === 'PENDING' && <span className="text-[rgb(var(--amber-600))] text-[10px]">in attesa</span>}
                      {g.rsvp === 'MAYBE' && <span className="text-[rgb(var(--fg-subtle))] text-[10px]">forse</span>}
                    </span>
                  ))}
                  {unseated.length > 18 && (
                    <span className="text-xs text-[rgb(var(--fg-subtle))] self-center">+{unseated.length - 18} altri…</span>
                  )}
                </div>
                <p className="text-xs text-[rgb(var(--fg-subtle))] mt-2">
                  Apri un tavolo e clicca <strong>+ Assegna invitati</strong> per posizionarli. Gli infant (in braccio) non vengono contati.
                </p>
              </div>
            </div>
          </Card>
        )
      )}

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
                    title={s === 'Numerati' ? 'Etichette vuote, mostra solo il numero del tavolo'
                      : s === 'Libero' ? 'Scegli a mano il nome di ogni tavolo'
                      : `Applica il preset "${s}" a tutti i tavoli`}
                    className={`rounded-full px-2.5 py-1 text-xs border transition-colors disabled:opacity-50 ${active ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))] border-transparent' : 'hover:bg-[rgb(var(--bg-sunken))]'}`}
                    style={!active ? { borderColor: 'rgb(var(--border))' } : undefined}>
                    {s === 'Numerati' ? <span className="inline-block mr-1">#</span>
                      : s === 'Libero' ? <span className="inline-block mr-1">✎</span>
                      : <Sparkles size={10} className="inline mr-1" />}
                    {s}
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
                <ul className="text-sm space-y-1 mb-3">
                  {seated.map((g: any) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 group">
                      <span className="truncate flex-1">{g.full_name}</span>
                      {g.diet && <span className="text-xs text-[rgb(var(--fg-subtle))]">· {g.diet}</span>}
                      <button
                        onClick={(e) => { e.stopPropagation(); updateGuest.mutate({ id: g.id, patch: { table_id: null } }) }}
                        className="opacity-0 group-hover:opacity-100 text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--rose-500))] transition-opacity"
                        title="Rimuovi dal tavolo"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); setAssigningTable(t) }}
                className="w-full inline-flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md border border-dashed transition-colors hover:bg-[rgb(var(--bg-sunken))]"
                style={{ borderColor: 'rgb(var(--border-strong))', color: 'rgb(var(--fg-muted))' }}
              >
                <UserPlus size={12} /> Assegna invitati
              </button>
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

      {assigningTable && (
        <AssignGuestsModal
          table={assigningTable}
          guests={guests ?? []}
          tables={tables ?? []}
          onClose={() => setAssigningTable(null)}
          onAssign={(guestId) => updateGuest.mutate({ id: guestId, patch: { table_id: assigningTable.id } })}
          onUnassign={(guestId) => updateGuest.mutate({ id: guestId, patch: { table_id: null } })}
        />
      )}
    </div>
  )
}

function AssignGuestsModal({ table, guests, tables, onClose, onAssign, onUnassign }: {
  table: any
  guests: any[]
  tables: any[]
  onClose: () => void
  onAssign: (guestId: string) => void
  onUnassign: (guestId: string) => void
}) {
  const [filter, setFilter] = useState('')
  const [tab, setTab] = useState<'unassigned' | 'all'>('unassigned')

  const tableNameById = new Map<string, string>(
    tables.map((t: any) => [t.id, t.label ?? `Tavolo ${t.table_no}`]),
  )

  const filtered = guests.filter((g: any) => {
    if (filter && !g.full_name.toLowerCase().includes(filter.toLowerCase())) return false
    if (tab === 'unassigned' && g.table_id && g.table_id !== table.id) return false
    return true
  })

  const tableSeated = guests.filter((g: any) => g.table_id === table.id)
  const seatsTotal = table.seats ?? 0
  const seatsFree = seatsTotal - tableSeated.length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgb(0 0 0 / 0.4)' }} onClick={onClose}>
      <Card className="w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex items-start justify-between gap-3" style={{ borderColor: 'rgb(var(--border))' }}>
          <div>
            <h3 className="font-display text-lg">Assegna invitati · {table.label ?? `Tavolo ${table.table_no}`}</h3>
            <p className="text-xs text-[rgb(var(--fg-muted))]">
              {tableSeated.length} / {seatsTotal} posti occupati
              {seatsFree > 0 && ` · ${seatsFree} liberi`}
              {seatsFree < 0 && ` · sovraffollato di ${-seatsFree}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X size={16} /></Button>
        </div>

        <div className="px-5 pt-3">
          <div className="flex gap-1 mb-3">
            <button onClick={() => setTab('unassigned')}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${tab === 'unassigned' ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]' : 'bg-[rgb(var(--bg-sunken))]'}`}>
              Disponibili
            </button>
            <button onClick={() => setTab('all')}
              className={`text-xs px-3 py-1.5 rounded-full transition-colors ${tab === 'all' ? 'bg-[rgb(var(--fg))] text-[rgb(var(--bg-elev))]' : 'bg-[rgb(var(--bg-sunken))]'}`}>
              Tutti gli invitati
            </button>
          </div>
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Cerca per nome..." />
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-1">
          {filtered.length === 0 && (
            <p className="text-sm text-center text-[rgb(var(--fg-subtle))] py-8">
              {tab === 'unassigned' ? 'Nessun invitato disponibile' : 'Nessun invitato corrisponde alla ricerca'}
            </p>
          )}
          {filtered.map((g: any) => {
            const isHere = g.table_id === table.id
            const otherTable = g.table_id && g.table_id !== table.id ? tableNameById.get(g.table_id) : null
            return (
              <div key={g.id} className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-[rgb(var(--bg-sunken))]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">
                    {g.full_name}
                    {g.party_size > 1 && <span className="text-xs text-[rgb(var(--fg-subtle))]"> ×{g.party_size}</span>}
                    {g.age_group === 'CHILD' && <span className="text-xs ml-1">🧒</span>}
                    {g.age_group === 'INFANT' && <span className="text-xs ml-1">👶</span>}
                  </p>
                  <p className="text-[10px] text-[rgb(var(--fg-subtle))]">
                    {otherTable ? `Già al ${otherTable}` : isHere ? 'A questo tavolo' : 'Non assegnato'}
                    {g.diet && ` · ${g.diet}`}
                    {Array.isArray(g.accessibility_needs) && g.accessibility_needs.length > 0 && ' · ♿'}
                  </p>
                </div>
                {isHere ? (
                  <Button variant="ghost" size="sm" onClick={() => onUnassign(g.id)} className="text-[rgb(var(--rose-500))]">
                    Rimuovi
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onAssign(g.id)}>
                    {otherTable ? 'Sposta qui' : 'Aggiungi'}
                  </Button>
                )}
              </div>
            )
          })}
        </div>

        <div className="px-5 py-3 border-t" style={{ borderColor: 'rgb(var(--border))' }}>
          <Button variant="ghost" className="w-full" onClick={onClose}>Chiudi</Button>
        </div>
      </Card>
    </div>
  )
}
