import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { useBudget, useBudgetCatMutations, useBudgetEntryMutations } from '@/hooks/useWedding'

export function BudgetTab({ entryId }: { entryId: string }) {
  const { data } = useBudget(entryId)
  const catMut = useBudgetCatMutations(entryId)
  const entMut = useBudgetEntryMutations(entryId)
  const [newCat, setNewCat] = useState({ name: '', planned: '' })
  const [newEntry, setNewEntry] = useState({ category_id: '', description: '', amount: '' })

  const cats = data?.categories ?? []
  const entries = data?.entries ?? []

  function entriesOf(catId: string) {
    return entries.filter((e: any) => e.category_id === catId)
  }
  function spentOf(catId: string) {
    return entriesOf(catId).reduce((s: number, e: any) => s + Number(e.amount), 0)
  }

  const totalPlanned = cats.reduce((s: number, c: any) => s + Number(c.planned_amount ?? 0), 0)
  const totalSpent = entries.reduce((s: number, e: any) => s + Number(e.amount), 0)
  const totalPaid = entries.filter((e: any) => e.paid).reduce((s: number, e: any) => s + Number(e.amount), 0)

  return (
    <div>
      <header className="mb-6">
        <h2 className="font-display text-2xl">Budget</h2>
        <p className="text-sm text-[rgb(var(--fg-muted))]">Categorie pianificate vs spese reali.</p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat label="Pianificato" value={totalPlanned} />
        <Stat label="Speso" value={totalSpent} tone={totalSpent > totalPlanned ? 'rose' : 'emerald'} />
        <Stat label="Pagato" value={totalPaid} />
        <Stat label="Residuo" value={totalPlanned - totalSpent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          {cats.length === 0 && (
            <Card className="p-8 text-center"><p className="text-[rgb(var(--fg-muted))]">Crea le categorie di budget.</p></Card>
          )}
          {cats.map((c: any) => {
            const spent = spentOf(c.id)
            const planned = Number(c.planned_amount ?? 0)
            const pct = planned > 0 ? Math.min(100, (spent / planned) * 100) : 0
            const over = spent > planned && planned > 0
            return (
              <Card key={c.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-medium">{c.name}</h3>
                    <p className="text-xs text-[rgb(var(--fg-subtle))]">
                      € {spent.toLocaleString('it-IT')} su € {planned.toLocaleString('it-IT')}
                      {over && <span className="text-[rgb(var(--rose-500))]"> · sforato di € {(spent - planned).toLocaleString('it-IT')}</span>}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => catMut.remove.mutate(c.id)}><Trash2 size={14} /></Button>
                </div>
                <div className="h-2 rounded-full bg-[rgb(var(--bg-sunken))] overflow-hidden">
                  <div className="h-full transition-all" style={{
                    width: `${pct}%`,
                    background: over ? 'rgb(var(--rose-500))' : 'rgb(var(--gold-500))',
                  }} />
                </div>
                {entriesOf(c.id).length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm">
                    {entriesOf(c.id).map((e: any) => (
                      <li key={e.id} className="flex justify-between items-center">
                        <span className="flex items-center gap-2">
                          <input type="checkbox" className="size-3 accent-[rgb(var(--gold-500))]"
                            checked={e.paid} onChange={(ev) => entMut.update.mutate({ id: e.id, patch: { paid: ev.target.checked, paid_at: ev.target.checked ? new Date().toISOString().slice(0, 10) : null } })} />
                          {e.description}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">€ {Number(e.amount).toLocaleString('it-IT')}</span>
                          <Button variant="ghost" size="icon" onClick={() => entMut.remove.mutate(e.id)}><Trash2 size={12} /></Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )
          })}
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="font-medium mb-3">Nuova categoria</h3>
            <div className="space-y-2">
              <Input placeholder="Es. Fiori" value={newCat.name} onChange={(e) => setNewCat((d) => ({ ...d, name: e.target.value }))} />
              <Input type="number" placeholder="Pianificato €" value={newCat.planned} onChange={(e) => setNewCat((d) => ({ ...d, planned: e.target.value }))} />
              <Button variant="gold" className="w-full" onClick={async () => {
                if (!newCat.name) return
                try { await catMut.add.mutateAsync({ name: newCat.name, planned_amount: Number(newCat.planned || 0) }); setNewCat({ name: '', planned: '' }); toast.success('Categoria') }
                catch (e) { toast.error((e as Error).message) }
              }}><Plus size={14} /> Aggiungi</Button>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="font-medium mb-3">Nuova spesa</h3>
            <div className="space-y-2">
              <Select value={newEntry.category_id} onChange={(e) => setNewEntry((d) => ({ ...d, category_id: e.target.value }))}>
                <option value="">— Categoria —</option>
                {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Input placeholder="Descrizione" value={newEntry.description} onChange={(e) => setNewEntry((d) => ({ ...d, description: e.target.value }))} />
              <Input type="number" placeholder="Importo €" value={newEntry.amount} onChange={(e) => setNewEntry((d) => ({ ...d, amount: e.target.value }))} />
              <Button variant="gold" className="w-full" onClick={async () => {
                if (!newEntry.category_id || !newEntry.description) return
                try {
                  await entMut.add.mutateAsync({
                    category_id: newEntry.category_id,
                    description: newEntry.description,
                    amount: Number(newEntry.amount || 0),
                  })
                  setNewEntry({ category_id: '', description: '', amount: '' })
                  toast.success('Spesa registrata')
                } catch (e) { toast.error((e as Error).message) }
              }}><Plus size={14} /> Aggiungi</Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'emerald' | 'rose' }) {
  const cls = tone === 'emerald' ? 'text-[rgb(var(--emerald-500))]'
    : tone === 'rose' ? 'text-[rgb(var(--rose-500))]' : ''
  return (
    <div className="surface p-4">
      <p className="text-[10px] uppercase tracking-wider text-[rgb(var(--fg-subtle))]">{label}</p>
      <p className={`font-display text-2xl mt-0.5 tabular-nums ${cls}`}>€ {value.toLocaleString('it-IT', { maximumFractionDigits: 0 })}</p>
    </div>
  )
}
