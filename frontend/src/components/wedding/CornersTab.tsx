import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, Euro, User, Sparkles, Check, Circle, CheckCircle2, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCorners, useCornerMutations, CORNER_PRESETS, presetByKind, cornerCost, type Corner, type CornerItem } from '@/hooks/useCorners'

const eur = (n: number) => (n || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

// Strumento "Angoli": il professionista mette insieme accessori per costruire angoli a tema
// (bomboniere, polaroid, confettata…). Parte da preset modificabili o da un angolo vuoto.
export function CornersTab({ entryId }: { entryId: string }) {
  const { data: corners, isLoading } = useCorners(entryId)
  const mut = useCornerMutations(entryId)
  const [picker, setPicker] = useState(false)

  const list = corners ?? []
  const totals = useMemo(() => {
    const accessori = list.reduce((s, c) => s + c.items.length, 0)
    const costo = list.reduce((s, c) => s + cornerCost(c), 0)
    const pronti = list.filter((c) => c.status === 'PRONTO').length
    return { accessori, costo, pronti }
  }, [list])

  async function pick(kind: string) {
    try { await mut.createFromPreset.mutateAsync(presetByKind(kind)); setPicker(false) }
    catch (e) { toast.error((e as Error).message) }
  }

  if (isLoading) return <div className="text-sm text-[rgb(var(--fg-subtle))] py-8">Carico gli angoli…</div>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Angoli</h2>
          <p className="text-sm text-[rgb(var(--fg-muted))]">Costruisci gli angoli dell'evento mettendo insieme gli accessori: bomboniere, polaroid, confettata…</p>
        </div>
        <Button variant="gold" onClick={() => setPicker((v) => !v)}><Plus size={15} /> Nuovo angolo</Button>
      </div>

      {/* riepilogo */}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-[rgb(var(--bg-sunken))] px-3 py-1">{list.length} angoli</span>
          <span className="rounded-full bg-[rgb(var(--bg-sunken))] px-3 py-1">{totals.accessori} accessori</span>
          <span className="rounded-full bg-[rgb(var(--bg-sunken))] px-3 py-1">{totals.pronti}/{list.length} pronti</span>
          {totals.costo > 0 && <span className="rounded-full bg-[rgb(var(--gold-100))] text-[rgb(var(--gold-700))] px-3 py-1 font-medium">{eur(totals.costo)} stima</span>}
        </div>
      )}

      {/* galleria preset */}
      {picker && (
        <Card className="p-4">
          <p className="text-sm font-medium mb-3">Scegli un tipo di angolo — gli accessori tipici si compilano da soli (poi li modifichi).</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {CORNER_PRESETS.map((p) => (
              <button key={p.kind} onClick={() => pick(p.kind)}
                className="text-left rounded-xl border border-[rgb(var(--border))] hover:border-[rgb(var(--gold-500))] hover:bg-[rgb(var(--bg-sunken))] transition p-3">
                <div className="text-2xl leading-none mb-1">{p.emoji}</div>
                <div className="text-sm font-medium">{p.label.replace('Angolo ', '')}</div>
                <div className="text-[11px] text-[rgb(var(--fg-subtle))]">{p.items.length ? `${p.items.length} accessori` : 'vuoto'}</div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {list.length === 0 && !picker && (
        <Card className="p-8 text-center">
          <Sparkles size={26} className="mx-auto mb-2 text-[rgb(var(--gold-600))]" />
          <p className="text-sm text-[rgb(var(--fg-muted))] mb-3">Ancora nessun angolo. Crea il primo: angolo bomboniere, polaroid, confettata…</p>
          <Button variant="gold" onClick={() => setPicker(true)}><Plus size={14} /> Nuovo angolo</Button>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {list.map((c) => <CornerCard key={c.id} corner={c} mut={mut} />)}
      </div>
    </div>
  )
}

function CornerCard({ corner: c, mut }: { corner: Corner; mut: ReturnType<typeof useCornerMutations> }) {
  const [newItem, setNewItem] = useState('')
  const pronto = c.status === 'PRONTO'
  const cost = cornerCost(c)

  const saveCorner = (patch: Partial<Corner>) => mut.updateCorner.mutate({ id: c.id, patch })
  const saveItem = (id: string, patch: Partial<CornerItem>) => mut.updateItem.mutate({ id, patch })

  async function add() {
    const label = newItem.trim()
    if (!label) return
    try { await mut.addItem.mutateAsync({ cornerId: c.id, label, sort: c.items.length }); setNewItem('') }
    catch (e) { toast.error((e as Error).message) }
  }

  return (
    <Card className="p-4">
      {/* intestazione angolo */}
      <div className="flex items-start gap-2">
        <span className="text-2xl leading-none mt-0.5">{presetByKind(c.kind).emoji}</span>
        <input defaultValue={c.name} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.name) saveCorner({ name: v }) }}
          className="flex-1 bg-transparent font-display text-lg outline-none border-b border-transparent focus:border-[rgb(var(--border))]" />
        <button onClick={() => saveCorner({ status: pronto ? 'DA_PREPARARE' : 'PRONTO' })}
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${pronto ? 'bg-emerald-100 text-emerald-700' : 'bg-[rgb(var(--bg-sunken))] text-[rgb(var(--fg-muted))]'}`}>
          {pronto ? <CheckCircle2 size={13} /> : <Circle size={13} />}{pronto ? 'Pronto' : 'Da preparare'}
        </button>
        <button onClick={() => { if (confirm(`Eliminare l'angolo "${c.name}"?`)) mut.deleteCorner.mutate(c.id) }}
          className="shrink-0 text-[rgb(var(--fg-subtle))] hover:text-rose-500 p-1" title="Elimina angolo"><Trash2 size={15} /></button>
      </div>

      {/* a chi è affidato */}
      <div className="mt-2 flex items-center gap-1.5 text-sm text-[rgb(var(--fg-muted))]">
        <User size={13} className="shrink-0" />
        <input defaultValue={c.assignee ?? ''} placeholder="A chi è affidato (facolt.)"
          onBlur={(e) => { const v = e.target.value.trim(); if (v !== (c.assignee ?? '')) saveCorner({ assignee: v || null }) }}
          className="flex-1 bg-transparent outline-none border-b border-transparent focus:border-[rgb(var(--border))]" />
      </div>

      {/* accessori */}
      <div className="mt-3 space-y-1">
        {c.items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 group">
            <button onClick={() => saveItem(it.id, { checked: !it.checked })}
              className={`shrink-0 h-5 w-5 rounded border flex items-center justify-center ${it.checked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-[rgb(var(--border))] text-transparent'}`} title="Pronto/da prendere">
              <Check size={13} />
            </button>
            <input defaultValue={it.label} onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== it.label) saveItem(it.id, { label: v }) }}
              className={`flex-1 min-w-0 bg-transparent text-sm outline-none border-b border-transparent focus:border-[rgb(var(--border))] ${it.checked ? 'line-through text-[rgb(var(--fg-subtle))]' : ''}`} />
            <input defaultValue={String(it.qty)} inputMode="decimal" title="Quantità"
              onBlur={(e) => { const v = parseFloat(e.target.value.replace(',', '.')) || 1; if (v !== it.qty) saveItem(it.id, { qty: v }) }}
              className="w-10 text-center bg-transparent text-xs text-[rgb(var(--fg-muted))] outline-none border-b border-transparent focus:border-[rgb(var(--border))]" />
            <div className="flex items-center w-16 text-xs text-[rgb(var(--fg-muted))]">
              <Euro size={11} className="shrink-0" />
              <input defaultValue={it.unit_cost == null ? '' : String(it.unit_cost)} inputMode="decimal" placeholder="cad." title="Costo cad."
                onBlur={(e) => { const raw = e.target.value.trim(); const v = raw ? parseFloat(raw.replace(',', '.')) : null; if (v !== it.unit_cost) saveItem(it.id, { unit_cost: Number.isNaN(v as number) ? null : v }) }}
                className="w-full bg-transparent outline-none border-b border-transparent focus:border-[rgb(var(--border))]" />
            </div>
            <button onClick={() => mut.deleteItem.mutate(it.id)} className="shrink-0 text-[rgb(var(--fg-subtle))] hover:text-rose-500 opacity-0 group-hover:opacity-100 transition" title="Togli"><X size={14} /></button>
          </div>
        ))}
      </div>

      {/* aggiungi accessorio */}
      <div className="mt-2 flex items-center gap-2">
        <Input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
          placeholder="Aggiungi accessorio…" className="h-8 text-sm" />
        <Button size="sm" variant="outline" onClick={() => void add()} disabled={!newItem.trim()}><Plus size={14} /></Button>
      </div>

      {cost > 0 && <p className="mt-2 text-right text-sm"><span className="text-[rgb(var(--fg-muted))]">Stima angolo:</span> <strong>{eur(cost)}</strong></p>}
    </Card>
  )
}
