import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, Filter, Download, Accessibility, GripVertical, Star, ArrowDownAZ, Heart, Baby } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useQueryClient } from '@tanstack/react-query'
import { useGuests, useGuestMutations, useTables } from '@/hooks/useWedding'
import { exportTableToPdf } from '@/lib/pdf-export'
import { GuestsCsvImport } from '@/components/wedding/GuestsCsvImport'
import { eventTerm } from '@/lib/eventKind'
import { SectionRings } from '@/components/event/SectionRings'
import { supabase } from '@/lib/supabase'

export function GuestsTab({ entryId, eventKind }: { entryId: string; eventKind?: string }) {
  // Le opzioni "Lato" hanno senso come Sposa/Sposo solo per eventi con due
  // protagonisti (matrimonio). Per gli altri usiamo etichette neutre, mantenendo
  // i value DB (SPOSA/SPOSO/ENTRAMBI) per non rompere i dati.
  const couple = eventTerm(eventKind ?? 'matrimonio').hasCoupleConcept
  const sideLabels = couple
    ? { SPOSA: 'Sposa', SPOSO: 'Sposo', ENTRAMBI: 'Entrambi' }
    : { SPOSA: 'Lato A', SPOSO: 'Lato B', ENTRAMBI: 'Entrambi' }
  const { data: guests } = useGuests(entryId)
  const { data: tables } = useTables(entryId)
  const { add, update, remove } = useGuestMutations(entryId)
  const qc = useQueryClient()
  const [filter, setFilter] = useState('')
  const [rsvpFilter, setRsvpFilter] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const canReorder = !filter && !rsvpFilter

  // Scrive sort_order = posizione per le righe cambiate, poi UN solo refetch.
  async function persistOrder(ordered: any[]) {
    const changed = ordered.map((g, i) => ({ g, i })).filter(({ g, i }) => (g.sort_order ?? -1) !== i)
    if (changed.length === 0) return
    await Promise.all(changed.map(({ g, i }) => (supabase.from('event_guests') as any).update({ sort_order: i }).eq('id', g.id)))
    qc.invalidateQueries({ queryKey: ['guests', entryId] })
  }
  function reorder(targetId: string) {
    if (!draggingId || draggingId === targetId) return
    const arr = [...((guests ?? []) as any[])]
    const from = arr.findIndex((x) => x.id === draggingId)
    const to = arr.findIndex((x) => x.id === targetId)
    if (from < 0 || to < 0) return
    const [moved] = arr.splice(from, 1)
    arr.splice(to, 0, moved)
    void persistOrder(arr)
  }
  function sortAlphabetical() {
    const arr = [...((guests ?? []) as any[])].sort((a, b) => a.full_name.localeCompare(b.full_name, 'it'))
    void persistOrder(arr).then(() => toast.success('Ordine alfabetico applicato'))
  }
  function sortCloseFamily() {
    const arr = [...((guests ?? []) as any[])].sort((a, b) =>
      (b.is_close_family ? 1 : 0) - (a.is_close_family ? 1 : 0) || a.full_name.localeCompare(b.full_name, 'it'))
    void persistOrder(arr).then(() => toast.success('Parenti più stretti in cima'))
  }

  const filtered = useMemo(() => {
    return (guests ?? []).filter((g: any) => {
      if (filter && !g.full_name.toLowerCase().includes(filter.toLowerCase())) return false
      if (rsvpFilter && g.rsvp !== rsvpFilter) return false
      return true
    })
  }, [guests, filter, rsvpFilter])

  const stats = useMemo(() => {
    const list = guests ?? []
    const yesList = list.filter((g: any) => g.rsvp === 'YES')
    const total = list.length
    const yes = yesList.length
    const no = list.filter((g: any) => g.rsvp === 'NO').length
    const pending = list.filter((g: any) => g.rsvp === 'PENDING').length
    const adults  = yesList.filter((g: any) => (g.age_group ?? 'ADULT') === 'ADULT').reduce((s: number, g: any) => s + (g.party_size ?? 1), 0)
    const kids    = yesList.filter((g: any) => g.age_group === 'CHILD').reduce((s: number, g: any) => s + (g.party_size ?? 1), 0)
    const infants = yesList.filter((g: any) => g.age_group === 'INFANT').length
    const accessibility = list.filter((g: any) => (Array.isArray(g.accessibility_needs) && g.accessibility_needs.length > 0) || g.accessibility_notes).length
    return { total, yes, no, pending, adults, kids, infants, accessibility }
  }, [guests])

  async function quickAdd() {
    const name = prompt('Nome invitato:')
    if (!name) return
    try { await add.mutateAsync({ full_name: name }); toast.success('Invitato aggiunto') }
    catch (e) { toast.error((e as Error).message) }
  }

  function exportPdf() {
    const tableMap = new Map((tables ?? []).map((t: any) => [t.id, t.label ?? `Tavolo ${t.table_no}`]))
    exportTableToPdf({
      title: 'Lista invitati',
      subtitle: `${stats.total} invitati · ${stats.yes} confermati · ${stats.adults} adulti + ${stats.kids} bambini${stats.accessibility > 0 ? ` · ${stats.accessibility} con esigenze speciali` : ''}`,
      filename: 'lista-invitati.pdf',
      landscape: true,
      columns: [
        { header: 'Nome', key: 'full_name', width: 60 },
        { header: 'RSVP', key: 'rsvp', width: 22 },
        { header: 'Dieta', key: 'diet', width: 40 },
        { header: 'Lato', key: 'side', width: 22 },
        { header: 'Tavolo', key: 'tableName', width: 35 },
        { header: '+1', key: 'party_size', width: 12 },
        { header: 'Email', key: 'email' },
      ],
      rows: (filtered as any[]).map((g) => ({
        ...g,
        tableName: g.table_id ? tableMap.get(g.table_id) : '—',
        diet: g.diet ?? '—',
        side: g.side ?? '—',
        email: g.email ?? '',
      })),
    })
  }

  return (
    <div>
      <SectionRings entryId={entryId} keys={['guests', 'rsvp']} />
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-2xl">Lista invitati</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Anagrafica + RSVP + assegnazione tavolo.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={exportPdf}><Download size={14} /> PDF</Button>
          {(guests ?? []).length > 0 && (
            <Button variant="ghost" onClick={async () => {
              if (!confirm(`Svuotare la lista? Verranno eliminati tutti i ${(guests ?? []).length} invitati di questo evento. Azione irreversibile.`)) return
              const { error } = await (supabase.from as any)('event_guests').delete().eq('entry_id', entryId)
              if (error) { toast.error(error.message); return }
              toast.success('Lista invitati svuotata')
              qc.invalidateQueries({ queryKey: ['guests', entryId] })
            }}><Trash2 size={14} /> Svuota lista</Button>
          )}
          <GuestsCsvImport entryId={entryId} onImported={() => qc.invalidateQueries({ queryKey: ['guests', entryId] })} />
          <Button variant="gold" onClick={quickAdd}><Plus /> Aggiungi invitato</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-5">
        <Stat label="Totale" value={stats.total} />
        <Stat label="Confermati" value={stats.yes} tone="emerald" />
        <Stat label="In attesa" value={stats.pending} tone="amber" />
        <Stat label="Adulti" value={stats.adults} />
        <Stat label="Bambini" value={stats.kids} />
        <Stat label="Infant" value={stats.infants} />
        <Stat label="♿ Esigenze" value={stats.accessibility} tone={stats.accessibility > 0 ? 'amber' : undefined} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 sm:max-w-md">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-subtle))]" />
          <Input className="pl-8" placeholder="Filtra per nome..." value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <Select className="sm:max-w-[180px]" value={rsvpFilter} onChange={(e) => setRsvpFilter(e.target.value)}>
          <option value="">Tutti RSVP</option>
          <option value="YES">Confermati</option>
          <option value="PENDING">In attesa</option>
          <option value="NO">Rifiutati</option>
          <option value="MAYBE">Forse</option>
        </Select>
      </div>

      {/* Ordinamento: trascina per ordine personale, oppure preset */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-[rgb(var(--fg-muted))]">Ordina:</span>
        <Button variant="outline" size="sm" onClick={sortAlphabetical}><ArrowDownAZ size={14} /> Alfabetico</Button>
        <Button variant="outline" size="sm" onClick={sortCloseFamily}><Heart size={14} /> Parenti più stretti</Button>
        <span className="text-[11px] text-[rgb(var(--fg-subtle))]">
          {canReorder ? 'oppure trascina ⠿ una riga su/giù per l’ordine manuale · ★ = parente stretto' : 'azzera i filtri per riordinare a mano'}
        </span>
      </div>

      {/* Tanti bambini → consiglia animazione + baby-sitting (anche come servizio da Scopri) */}
      {(stats.kids + stats.infants) >= 6 && (
        <Card className="p-3 mb-3 flex flex-wrap items-center gap-3" style={{ background: 'rgb(var(--gold-100))', borderColor: 'rgb(var(--gold-400))' }}>
          <span className="inline-flex items-start gap-2 text-sm flex-1 min-w-[240px]">
            <Baby size={18} className="text-[rgb(var(--gold-600))] shrink-0 mt-0.5" />
            <span><strong>{stats.kids + stats.infants} bambini</strong> tra i confermati. Con così tanti piccoli conviene prevedere <strong>animazione e baby-sitting</strong>: li tieni occupati e sereni e i genitori si godono la festa. Poi, dalla lista, assegni i bimbi a chi se ne occupa.</span>
          </span>
          <Link to="/scopri?subrole=animazione" className="ml-auto">
            <Button variant="gold" size="sm"><Baby size={14} /> Trova animazione</Button>
          </Link>
        </Card>
      )}

      {/* Desktop: table */}
      <Card className="overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]">
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Nome</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">RSVP</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Diet</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Lato</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Tavolo</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">+1</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">Età</th>
              <th className="px-4 py-3 text-xs uppercase tracking-wider">♿</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-[rgb(var(--fg-subtle))]">Nessun invitato.</td></tr>
            )}
            {filtered.map((g: any) => (
              <tr key={g.id}
                onDragOver={(e) => { if (canReorder && draggingId) { e.preventDefault(); setOverId(g.id) } }}
                onDrop={(e) => { if (canReorder && draggingId) { e.preventDefault(); reorder(g.id); setDraggingId(null); setOverId(null) } }}
                className={`border-t ${overId === g.id ? 'bg-[rgb(var(--gold-100))]/50' : ''} ${draggingId === g.id ? 'opacity-50' : ''}`}
                style={{ borderColor: 'rgb(var(--border))' }}>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1.5">
                    {canReorder && (
                      <span draggable
                        onDragStart={() => setDraggingId(g.id)}
                        onDragEnd={() => { setDraggingId(null); setOverId(null) }}
                        title="Trascina per ordinare" className="cursor-grab active:cursor-grabbing text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--fg))]"><GripVertical size={14} /></span>
                    )}
                    <button title={g.is_close_family ? 'Parente stretto (togli)' : 'Segna come parente stretto'}
                      onClick={() => update.mutate({ id: g.id, patch: { is_close_family: !g.is_close_family } })}
                      className={g.is_close_family ? 'text-[rgb(var(--gold-500))]' : 'text-[rgb(var(--fg-subtle))] hover:text-[rgb(var(--gold-500))]'}>
                      <Star size={14} fill={g.is_close_family ? 'currentColor' : 'none'} />
                    </button>
                    <Input className="h-8 text-sm flex-1" defaultValue={g.full_name}
                      onBlur={(e) => { if (e.target.value !== g.full_name) update.mutate({ id: g.id, patch: { full_name: e.target.value } }) }} />
                  </div>
                </td>
                <td className="px-4 py-2">
                  <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2 text-xs"
                    value={g.rsvp} onChange={(e) => update.mutate({ id: g.id, patch: { rsvp: e.target.value } })}>
                    <option value="PENDING">In attesa</option>
                    <option value="YES">Sì</option>
                    <option value="NO">No</option>
                    <option value="MAYBE">Forse</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <Input className="h-8 text-sm" defaultValue={g.diet ?? ''}
                    placeholder="vegan, allergie..."
                    onBlur={(e) => { if (e.target.value !== (g.diet ?? '')) update.mutate({ id: g.id, patch: { diet: e.target.value || null } }) }} />
                </td>
                <td className="px-4 py-2">
                  <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2 text-xs"
                    value={g.side ?? ''} onChange={(e) => update.mutate({ id: g.id, patch: { side: e.target.value || null } })}>
                    <option value="">—</option>
                    <option value="SPOSA">{sideLabels.SPOSA}</option>
                    <option value="SPOSO">{sideLabels.SPOSO}</option>
                    <option value="ENTRAMBI">{sideLabels.ENTRAMBI}</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2 text-xs"
                    value={g.table_id ?? ''} onChange={(e) => update.mutate({ id: g.id, patch: { table_id: e.target.value || null } })}>
                    <option value="">—</option>
                    {(tables ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.label ?? `Tavolo ${t.table_no}`}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <Input type="number" min="1" className="h-8 w-16 text-sm" defaultValue={g.party_size}
                    onBlur={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isFinite(n) || n < 1) { e.target.value = String(g.party_size ?? 1); return } if (n !== g.party_size) update.mutate({ id: g.id, patch: { party_size: n } }) }} />
                </td>
                <td className="px-4 py-2">
                  <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2 text-xs"
                    value={g.age_group ?? 'ADULT'}
                    onChange={(e) => update.mutate({ id: g.id, patch: { age_group: e.target.value } })}>
                    <option value="ADULT">👤 Adulto</option>
                    <option value="CHILD">🧒 Bambino</option>
                    <option value="INFANT">👶 Infant</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <AccessibilityBtn guest={g} onSave={(needs, notes) => update.mutate({ id: g.id, patch: { accessibility_needs: needs, accessibility_notes: notes } })} />
                </td>
                <td className="px-2 py-2">
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(g.id)}><Trash2 size={14} /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </Card>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-2">
        {filtered.length === 0 && <Card className="p-6 text-center text-[rgb(var(--fg-subtle))]">Nessun invitato.</Card>}
        {filtered.map((g: any) => (
          <Card key={g.id} className="p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <Input className="h-8 text-sm flex-1" defaultValue={g.full_name}
                onBlur={(e) => { if (e.target.value !== g.full_name) update.mutate({ id: g.id, patch: { full_name: e.target.value } }) }} />
              <Button variant="ghost" size="icon" onClick={() => remove.mutate(g.id)}><Trash2 size={14} /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-[rgb(var(--fg-muted))]">RSVP</span>
                <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2"
                  value={g.rsvp} onChange={(e) => update.mutate({ id: g.id, patch: { rsvp: e.target.value } })}>
                  <option value="PENDING">In attesa</option>
                  <option value="YES">Sì</option>
                  <option value="NO">No</option>
                  <option value="MAYBE">Forse</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-[rgb(var(--fg-muted))]">Lato</span>
                <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2"
                  value={g.side ?? ''} onChange={(e) => update.mutate({ id: g.id, patch: { side: e.target.value || null } })}>
                  <option value="">—</option>
                  <option value="SPOSA">Sposa</option>
                  <option value="SPOSO">Sposo</option>
                  <option value="ENTRAMBI">Entrambi</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 col-span-2">
                <span className="text-[10px] uppercase text-[rgb(var(--fg-muted))]">Dieta / allergie</span>
                <Input className="h-8 text-xs" defaultValue={g.diet ?? ''} placeholder="vegan, allergie..."
                  onBlur={(e) => { if (e.target.value !== (g.diet ?? '')) update.mutate({ id: g.id, patch: { diet: e.target.value || null } }) }} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-[rgb(var(--fg-muted))]">Tavolo</span>
                <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2"
                  value={g.table_id ?? ''} onChange={(e) => update.mutate({ id: g.id, patch: { table_id: e.target.value || null } })}>
                  <option value="">—</option>
                  {(tables ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.label ?? `Tavolo ${t.table_no}`}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-[rgb(var(--fg-muted))]">+1</span>
                <Input type="number" min="1" className="h-8 text-xs" defaultValue={g.party_size}
                  onBlur={(e) => { const n = Number(e.target.value); if (n !== g.party_size) update.mutate({ id: g.id, patch: { party_size: n } }) }} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase text-[rgb(var(--fg-muted))]">Età</span>
                <select className="h-8 rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-elev))] px-2"
                  value={g.age_group ?? 'ADULT'}
                  onChange={(e) => update.mutate({ id: g.id, patch: { age_group: e.target.value } })}>
                  <option value="ADULT">Adulto</option>
                  <option value="CHILD">Bambino</option>
                  <option value="INFANT">Infant</option>
                </select>
              </label>
              <div className="col-span-2">
                <span className="text-[10px] uppercase text-[rgb(var(--fg-muted))]">Esigenze speciali</span>
                <AccessibilityBtn guest={g} onSave={(needs, notes) => update.mutate({ id: g.id, patch: { accessibility_needs: needs, accessibility_notes: notes } })} />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

const ACCESSIBILITY_OPTIONS: Array<{ v: string; label: string }> = [
  { v: 'MOBILITY',           label: 'Mobilità ridotta' },
  { v: 'ACCESSIBLE_BATHROOM', label: 'Bagno accessibile' },
  { v: 'RAMP',               label: 'Rampa di accesso' },
  { v: 'FRONT_ROW',          label: 'Posto in prima fila' },
  { v: 'DEAF',               label: 'Sordità (interprete LIS?)' },
  { v: 'BLIND',              label: 'Cecità / ipovisione' },
  { v: 'MEDICAL_DIET',       label: 'Dieta medica' },
  { v: 'INTERPRETER',        label: 'Interprete lingua' },
  { v: 'OTHER',              label: 'Altro (specifica)' },
]

function AccessibilityBtn({ guest, onSave }: {
  guest: any
  onSave: (needs: string[], notes: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const initialNeeds: string[] = Array.isArray(guest.accessibility_needs) ? guest.accessibility_needs : []
  const [needs, setNeeds] = useState<string[]>(initialNeeds)
  const [notes, setNotes] = useState<string>(guest.accessibility_notes ?? '')

  const hasAny = initialNeeds.length > 0 || !!guest.accessibility_notes

  function toggle(v: string) {
    setNeeds((arr) => arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])
  }

  function save() {
    onSave(needs, notes.trim() || null)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setNeeds(initialNeeds); setNotes(guest.accessibility_notes ?? ''); setOpen(true) }}
        className={`inline-flex items-center justify-center h-8 w-8 rounded-md border transition-colors ${
          hasAny ? 'bg-amber-50 border-amber-500 text-amber-700 dark:bg-amber-900/30' : 'border-[rgb(var(--border))] text-[rgb(var(--fg-subtle))] hover:bg-[rgb(var(--bg-sunken))]'
        }`}
        title={hasAny ? `Esigenze: ${initialNeeds.length}${guest.accessibility_notes ? ' + note' : ''}` : 'Aggiungi esigenze speciali'}
      >
        <Accessibility size={14} />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgb(0 0 0 / 0.4)' }} onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b" style={{ borderColor: 'rgb(var(--border))' }}>
              <h3 className="font-display text-lg">Esigenze speciali — {guest.full_name}</h3>
              <p className="text-xs text-[rgb(var(--fg-muted))]">Tutto ciò che serve per l'accoglienza inclusiva.</p>
            </div>
            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-1 gap-1">
                {ACCESSIBILITY_OPTIONS.map((o) => (
                  <label key={o.v} className="flex items-center gap-2 p-2 rounded hover:bg-[rgb(var(--bg-sunken))] cursor-pointer text-sm">
                    <input type="checkbox" checked={needs.includes(o.v)} onChange={() => toggle(o.v)} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-muted))]">Note (allergie gravi, dispositivi, accompagnatore…)</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="es. accompagnata da figlia; usa carrozzina elettrica; necessita di una stanza tranquilla in caso di crisi epilettica…"
                  className="w-full rounded-md border bg-[rgb(var(--bg-elev))] px-3 py-2 text-sm"
                  style={{ borderColor: 'rgb(var(--border-strong))' }}
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: 'rgb(var(--border))' }}>
              <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
              <Button variant="gold" onClick={save}>Salva</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'amber' | 'rose' | undefined }) {
  const cls = tone === 'emerald' ? 'text-[rgb(var(--emerald-500))]'
    : tone === 'amber' ? 'text-[rgb(var(--amber-500))]'
    : tone === 'rose' ? 'text-[rgb(var(--rose-500))]' : ''
  return (
    <div className="surface p-3">
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className={`font-display text-2xl mt-0.5 tabular-nums ${cls}`}>{value}</p>
    </div>
  )
}
