import { useState, useMemo } from 'react'
import { Plus, Trash2, Filter, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useGuests, useGuestMutations, useTables } from '@/hooks/useWedding'
import { exportTableToPdf } from '@/lib/pdf-export'

export function GuestsTab({ entryId }: { entryId: string }) {
  const { data: guests } = useGuests(entryId)
  const { data: tables } = useTables(entryId)
  const { add, update, remove } = useGuestMutations(entryId)
  const [filter, setFilter] = useState('')
  const [rsvpFilter, setRsvpFilter] = useState('')

  const filtered = useMemo(() => {
    return (guests ?? []).filter((g: any) => {
      if (filter && !g.full_name.toLowerCase().includes(filter.toLowerCase())) return false
      if (rsvpFilter && g.rsvp !== rsvpFilter) return false
      return true
    })
  }, [guests, filter, rsvpFilter])

  const stats = useMemo(() => {
    const total = guests?.length ?? 0
    const yes = (guests ?? []).filter((g: any) => g.rsvp === 'YES').length
    const no = (guests ?? []).filter((g: any) => g.rsvp === 'NO').length
    const pending = (guests ?? []).filter((g: any) => g.rsvp === 'PENDING').length
    const partySize = (guests ?? []).filter((g: any) => g.rsvp === 'YES').reduce((s: number, g: any) => s + (g.party_size ?? 1), 0)
    return { total, yes, no, pending, partySize }
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
      subtitle: `${stats.total} invitati · ${stats.yes} confermati · ${stats.partySize} posti`,
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
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-display text-2xl">Lista invitati</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Anagrafica + RSVP + assegnazione tavolo.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportPdf}><Download size={14} /> PDF</Button>
          <Button variant="gold" onClick={quickAdd}><Plus /> Aggiungi invitato</Button>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        <Stat label="Totale" value={stats.total} />
        <Stat label="Confermati" value={stats.yes} tone="emerald" />
        <Stat label="In attesa" value={stats.pending} tone="amber" />
        <Stat label="No" value={stats.no} tone="rose" />
        <Stat label="Posti (party_size)" value={stats.partySize} />
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-[rgb(var(--fg-subtle))]">Nessun invitato.</td></tr>
            )}
            {filtered.map((g: any) => (
              <tr key={g.id} className="border-t" style={{ borderColor: 'rgb(var(--border))' }}>
                <td className="px-4 py-2">
                  <Input className="h-8 text-sm" defaultValue={g.full_name}
                    onBlur={(e) => { if (e.target.value !== g.full_name) update.mutate({ id: g.id, patch: { full_name: e.target.value } }) }} />
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
                    <option value="SPOSA">Sposa</option>
                    <option value="SPOSO">Sposo</option>
                    <option value="ENTRAMBI">Entrambi</option>
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
                    onBlur={(e) => { const n = Number(e.target.value); if (n !== g.party_size) update.mutate({ id: g.id, patch: { party_size: n } }) }} />
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
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'amber' | 'rose' }) {
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
